/*
  # Credential Vault Functions

  1. Core Functions
    - Cookie parsing and validation
    - Credential encryption/decryption
    - Verification and status management
    - Audit logging

  2. Security
    - Server-side encryption using pgcrypto
    - Secure credential retrieval for actors
    - Comprehensive audit trail
*/

-- Function to parse raw cookie string into structured data
CREATE OR REPLACE FUNCTION parse_cookie_string(raw_cookies text)
RETURNS jsonb AS $$
DECLARE
  cookie_pairs text[];
  cookie_pair text;
  cookie_parts text[];
  cookie_key text;
  cookie_value text;
  result jsonb := '{}';
BEGIN
  -- Split by semicolon and clean up
  cookie_pairs := string_to_array(raw_cookies, ';');
  
  FOREACH cookie_pair IN ARRAY cookie_pairs
  LOOP
    -- Trim whitespace
    cookie_pair := trim(cookie_pair);
    
    -- Skip empty pairs
    IF length(cookie_pair) = 0 THEN
      CONTINUE;
    END IF;
    
    -- Split by first equals sign
    cookie_parts := string_to_array(cookie_pair, '=');
    
    -- Must have at least key=value
    IF array_length(cookie_parts, 1) >= 2 THEN
      cookie_key := trim(cookie_parts[1]);
      cookie_value := trim(array_to_string(cookie_parts[2:], '='));
      
      -- Store in result
      result := jsonb_set(result, ARRAY[cookie_key], to_jsonb(cookie_value));
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to validate credentials against actor requirements
CREATE OR REPLACE FUNCTION validate_actor_credentials(
  actor_slug_param text,
  credential_data jsonb
)
RETURNS jsonb AS $$
DECLARE
  required_fields record;
  field_value text;
  issues text[] := '{}';
  result jsonb;
BEGIN
  -- Get required fields for this actor
  FOR required_fields IN 
    SELECT field_key, field_label, is_required, validation_regex
    FROM actor_fields 
    WHERE actor_slug = actor_slug_param AND is_required = true
  LOOP
    -- Check if required field exists
    field_value := credential_data ->> required_fields.field_key;
    
    IF field_value IS NULL OR length(trim(field_value)) = 0 THEN
      issues := array_append(issues, format('Missing required field: %s', required_fields.field_label));
    ELSIF required_fields.validation_regex IS NOT NULL THEN
      -- Validate against regex if provided
      IF NOT (field_value ~ required_fields.validation_regex) THEN
        issues := array_append(issues, format('Invalid format for %s', required_fields.field_label));
      END IF;
    END IF;
  END LOOP;
  
  -- Return validation result
  result := jsonb_build_object(
    'valid', array_length(issues, 1) = 0 OR issues IS NULL,
    'issues', to_jsonb(issues)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to store encrypted credentials
CREATE OR REPLACE FUNCTION store_user_credentials(
  p_user_id uuid,
  p_actor_slug text,
  p_credential_data jsonb,
  p_user_agent text DEFAULT NULL,
  p_proxy_hint text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  validation_result jsonb;
  encrypted_payload bytea;
  credential_id uuid;
  existing_record record;
BEGIN
  -- Validate credentials first
  validation_result := validate_actor_credentials(p_actor_slug, p_credential_data);
  
  IF NOT (validation_result ->> 'valid')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Validation failed',
      'issues', validation_result -> 'issues'
    );
  END IF;
  
  -- Encrypt the credential payload
  encrypted_payload := encrypt_credential_payload(p_credential_data);
  
  -- Check if credentials already exist for this user/actor
  SELECT * INTO existing_record
  FROM user_credentials 
  WHERE user_id = p_user_id AND actor_slug = p_actor_slug;
  
  IF existing_record IS NOT NULL THEN
    -- Update existing credentials
    UPDATE user_credentials SET
      encrypted_payload = encrypted_payload,
      user_agent = p_user_agent,
      proxy_hint = p_proxy_hint,
      status = 'unverified',
      last_verified_at = NULL,
      updated_at = now()
    WHERE user_id = p_user_id AND actor_slug = p_actor_slug
    RETURNING id INTO credential_id;
    
    -- Log audit
    PERFORM log_credential_audit(p_user_id, p_actor_slug, 'update', 
      jsonb_build_object('fields_updated', array_length(jsonb_object_keys(p_credential_data), 1)));
  ELSE
    -- Insert new credentials
    INSERT INTO user_credentials (
      user_id,
      actor_slug,
      encrypted_payload,
      user_agent,
      proxy_hint,
      status
    ) VALUES (
      p_user_id,
      p_actor_slug,
      encrypted_payload,
      p_user_agent,
      p_proxy_hint,
      'unverified'
    ) RETURNING id INTO credential_id;
    
    -- Log audit
    PERFORM log_credential_audit(p_user_id, p_actor_slug, 'create', 
      jsonb_build_object('fields_count', array_length(jsonb_object_keys(p_credential_data), 1)));
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'credential_id', credential_id,
    'status', 'unverified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get credentials for actor runtime (server-side only)
CREATE OR REPLACE FUNCTION get_credentials_for_actor(
  p_user_id uuid,
  p_actor_slug text,
  p_scope text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  credential_record record;
  decrypted_payload jsonb;
BEGIN
  -- Get credential record
  SELECT * INTO credential_record
  FROM user_credentials
  WHERE user_id = p_user_id 
    AND actor_slug = p_actor_slug 
    AND status = 'active';
  
  IF credential_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active credentials found for actor'
    );
  END IF;
  
  -- Decrypt payload
  decrypted_payload := decrypt_credential_payload(credential_record.encrypted_payload);
  
  -- Log access audit
  PERFORM log_credential_audit(p_user_id, p_actor_slug, 'access', 
    jsonb_build_object('scope', p_scope, 'timestamp', now()));
  
  -- Return shaped credential bundle
  RETURN jsonb_build_object(
    'success', true,
    'actor_slug', p_actor_slug,
    'credentials', decrypted_payload,
    'user_agent', credential_record.user_agent,
    'proxy_hint', credential_record.proxy_hint,
    'last_verified_at', credential_record.last_verified_at,
    'status', credential_record.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update credential verification status
CREATE OR REPLACE FUNCTION update_credential_verification(
  p_user_id uuid,
  p_actor_slug text,
  p_status text,
  p_verification_details jsonb DEFAULT '{}',
  p_response_time_ms integer DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Update credential status
  UPDATE user_credentials SET
    status = CASE 
      WHEN p_status = 'pass' THEN 'active'
      WHEN p_status = 'fail' THEN 'failed'
      ELSE 'unverified'
    END,
    last_verified_at = CASE WHEN p_status = 'pass' THEN now() ELSE last_verified_at END,
    verification_details = p_verification_details,
    updated_at = now()
  WHERE user_id = p_user_id AND actor_slug = p_actor_slug;
  
  -- Record verification attempt
  INSERT INTO credential_verification (
    user_id,
    actor_slug,
    verification_type,
    status,
    response_time_ms,
    verification_details,
    error_message
  ) VALUES (
    p_user_id,
    p_actor_slug,
    'manual',
    p_status,
    p_response_time_ms,
    p_verification_details,
    p_error_message
  );
  
  -- Log audit
  PERFORM log_credential_audit(p_user_id, p_actor_slug, 'verify', 
    jsonb_build_object('status', p_status, 'response_time_ms', p_response_time_ms));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rotate or manage credentials
CREATE OR REPLACE FUNCTION manage_user_credentials(
  p_user_id uuid,
  p_actor_slug text,
  p_action text, -- 'rotate', 'disable', 'enable', 'delete'
  p_new_data jsonb DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  CASE p_action
    WHEN 'disable' THEN
      UPDATE user_credentials SET
        status = 'disabled',
        updated_at = now()
      WHERE user_id = p_user_id AND actor_slug = p_actor_slug;
      
      PERFORM log_credential_audit(p_user_id, p_actor_slug, 'disable');
      result := jsonb_build_object('success', true, 'action', 'disabled');
      
    WHEN 'enable' THEN
      UPDATE user_credentials SET
        status = 'unverified',
        updated_at = now()
      WHERE user_id = p_user_id AND actor_slug = p_actor_slug;
      
      PERFORM log_credential_audit(p_user_id, p_actor_slug, 'enable');
      result := jsonb_build_object('success', true, 'action', 'enabled');
      
    WHEN 'delete' THEN
      DELETE FROM user_credentials 
      WHERE user_id = p_user_id AND actor_slug = p_actor_slug;
      
      PERFORM log_credential_audit(p_user_id, p_actor_slug, 'delete');
      result := jsonb_build_object('success', true, 'action', 'deleted');
      
    WHEN 'rotate' THEN
      IF p_new_data IS NOT NULL THEN
        UPDATE user_credentials SET
          encrypted_payload = encrypt_credential_payload(p_new_data),
          status = 'unverified',
          last_verified_at = NULL,
          updated_at = now()
        WHERE user_id = p_user_id AND actor_slug = p_actor_slug;
        
        PERFORM log_credential_audit(p_user_id, p_actor_slug, 'rotate');
        result := jsonb_build_object('success', true, 'action', 'rotated');
      ELSE
        result := jsonb_build_object('success', false, 'error', 'New credential data required for rotation');
      END IF;
      
    ELSE
      result := jsonb_build_object('success', false, 'error', 'Invalid action');
  END CASE;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's integration status overview
CREATE OR REPLACE FUNCTION get_user_integrations_status(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  integration_status jsonb := '[]';
  actor_record record;
  credential_record record;
  status_item jsonb;
BEGIN
  -- Loop through all active actors
  FOR actor_record IN 
    SELECT * FROM actor_registry WHERE is_active = true ORDER BY category, title
  LOOP
    -- Get user's credential for this actor
    SELECT * INTO credential_record
    FROM user_credentials
    WHERE user_id = p_user_id AND actor_slug = actor_record.slug;
    
    -- Build status item
    status_item := jsonb_build_object(
      'actor_slug', actor_record.slug,
      'title', actor_record.title,
      'category', actor_record.category,
      'requires_cookies', actor_record.requires_cookies,
      'requires_api_key', actor_record.requires_api_key,
      'status', COALESCE(credential_record.status, 'not_connected'),
      'last_verified_at', credential_record.last_verified_at,
      'created_at', credential_record.created_at,
      'expires_at', credential_record.expires_at
    );
    
    integration_status := integration_status || status_item;
  END LOOP;
  
  RETURN integration_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired credentials (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_credentials()
RETURNS integer AS $$
DECLARE
  expired_count integer;
BEGIN
  -- Mark expired credentials as expired
  UPDATE user_credentials SET
    status = 'expired',
    updated_at = now()
  WHERE expires_at < now() 
    AND status NOT IN ('expired', 'disabled', 'deleted');
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Log cleanup audit
  INSERT INTO credential_audit (
    user_id,
    actor_slug,
    action_type,
    action_context,
    success
  )
  SELECT 
    user_id,
    actor_slug,
    'expire',
    jsonb_build_object('cleanup_batch', true, 'expired_at', now()),
    true
  FROM user_credentials 
  WHERE status = 'expired' AND updated_at >= now() - interval '1 minute';
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;