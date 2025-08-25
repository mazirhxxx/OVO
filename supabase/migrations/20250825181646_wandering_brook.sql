/*
  # Edge Function Helpers for Credential Vault

  1. Purpose
    - SQL functions that edge functions can call
    - Secure credential retrieval for runtime
    - Verification and validation helpers

  2. Security
    - Functions are SECURITY DEFINER (run as owner)
    - Proper input validation
    - Audit logging for all operations
*/

-- Function for edge functions to securely get actor credentials
CREATE OR REPLACE FUNCTION edge_get_actor_credentials(
  p_user_id uuid,
  p_actor_slug text,
  p_request_context jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
DECLARE
  credential_record record;
  decrypted_payload jsonb;
  actor_info record;
BEGIN
  -- Verify actor exists and is active
  SELECT * INTO actor_info
  FROM actor_registry
  WHERE slug = p_actor_slug AND is_active = true;
  
  IF actor_info IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Actor not found or inactive',
      'actor_slug', p_actor_slug
    );
  END IF;
  
  -- Get active credentials
  SELECT * INTO credential_record
  FROM user_credentials
  WHERE user_id = p_user_id 
    AND actor_slug = p_actor_slug 
    AND status IN ('active', 'unverified');
  
  IF credential_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No credentials configured for this actor',
      'actor_slug', p_actor_slug,
      'requires_setup', true
    );
  END IF;
  
  -- Check if credentials are expired
  IF credential_record.expires_at IS NOT NULL AND credential_record.expires_at < now() THEN
    -- Mark as expired
    UPDATE user_credentials SET
      status = 'expired',
      updated_at = now()
    WHERE id = credential_record.id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Credentials have expired',
      'actor_slug', p_actor_slug,
      'expired_at', credential_record.expires_at,
      'requires_refresh', true
    );
  END IF;
  
  -- Decrypt credentials
  BEGIN
    decrypted_payload := decrypt_credential_payload(credential_record.encrypted_payload);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to decrypt credentials',
        'actor_slug', p_actor_slug,
        'requires_reconfiguration', true
      );
  END;
  
  -- Log access
  PERFORM log_credential_audit(
    p_user_id, 
    p_actor_slug, 
    'access', 
    p_request_context || jsonb_build_object('accessed_at', now())
  );
  
  -- Return shaped credential bundle
  RETURN jsonb_build_object(
    'success', true,
    'actor_slug', p_actor_slug,
    'actor_title', actor_info.title,
    'credentials', decrypted_payload,
    'user_agent', credential_record.user_agent,
    'proxy_hint', credential_record.proxy_hint,
    'last_verified_at', credential_record.last_verified_at,
    'status', credential_record.status,
    'verification_details', credential_record.verification_details,
    'metadata', jsonb_build_object(
      'created_at', credential_record.created_at,
      'updated_at', credential_record.updated_at,
      'rotation_enabled', credential_record.rotation_enabled
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to batch get multiple actor credentials (for multi-actor workflows)
CREATE OR REPLACE FUNCTION edge_get_multiple_actor_credentials(
  p_user_id uuid,
  p_actor_slugs text[],
  p_request_context jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
DECLARE
  result jsonb := '{}';
  actor_slug text;
  credential_data jsonb;
BEGIN
  FOREACH actor_slug IN ARRAY p_actor_slugs
  LOOP
    credential_data := edge_get_actor_credentials(
      p_user_id, 
      actor_slug, 
      p_request_context || jsonb_build_object('batch_request', true)
    );
    
    result := jsonb_set(result, ARRAY[actor_slug], credential_data);
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'credentials', result,
    'requested_actors', to_jsonb(p_actor_slugs),
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate and parse cookie strings
CREATE OR REPLACE FUNCTION edge_parse_and_validate_cookies(
  p_actor_slug text,
  p_raw_cookie_string text,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  parsed_cookies jsonb;
  validation_result jsonb;
  shaped_payload jsonb;
  required_fields record;
  field_value text;
  missing_fields text[] := '{}';
BEGIN
  -- Parse cookie string
  parsed_cookies := parse_cookie_string(p_raw_cookie_string);
  
  -- Get required cookie fields for this actor
  FOR required_fields IN
    SELECT field_key, field_label, is_required
    FROM actor_fields
    WHERE actor_slug = p_actor_slug 
      AND field_type IN ('cookie', 'password') 
      AND is_required = true
      AND field_key != 'raw_cookie_string'
      AND field_key != 'user_agent'
  LOOP
    field_value := parsed_cookies ->> required_fields.field_key;
    
    IF field_value IS NULL OR length(trim(field_value)) = 0 THEN
      missing_fields := array_append(missing_fields, required_fields.field_label);
    END IF;
  END LOOP;
  
  -- Shape the payload for storage
  shaped_payload := parsed_cookies;
  
  -- Add user agent if provided
  IF p_user_agent IS NOT NULL THEN
    shaped_payload := jsonb_set(shaped_payload, ARRAY['user_agent'], to_jsonb(p_user_agent));
  END IF;
  
  -- Add metadata
  shaped_payload := jsonb_set(shaped_payload, ARRAY['_meta'], jsonb_build_object(
    'parsed_at', now(),
    'cookie_count', jsonb_object_keys(parsed_cookies) || '[]',
    'raw_length', length(p_raw_cookie_string)
  ));
  
  RETURN jsonb_build_object(
    'success', array_length(missing_fields, 1) = 0 OR missing_fields IS NULL,
    'parsed_cookies', parsed_cookies,
    'shaped_payload', shaped_payload,
    'missing_fields', to_jsonb(missing_fields),
    'cookie_count', (SELECT count(*) FROM jsonb_object_keys(parsed_cookies))
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get actor field definitions (for dynamic form rendering)
CREATE OR REPLACE FUNCTION get_actor_field_definitions(p_actor_slug text)
RETURNS jsonb AS $$
DECLARE
  actor_info record;
  fields_array jsonb;
BEGIN
  -- Get actor info
  SELECT * INTO actor_info
  FROM actor_registry
  WHERE slug = p_actor_slug AND is_active = true;
  
  IF actor_info IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Actor not found'
    );
  END IF;
  
  -- Get fields
  SELECT jsonb_agg(
    jsonb_build_object(
      'key', field_key,
      'label', field_label,
      'type', field_type,
      'required', is_required,
      'masked', is_masked,
      'helper', helper_text,
      'placeholder', placeholder,
      'validation_regex', validation_regex,
      'select_options', select_options
    ) ORDER BY display_order
  ) INTO fields_array
  FROM actor_fields
  WHERE actor_slug = p_actor_slug;
  
  RETURN jsonb_build_object(
    'success', true,
    'actor', jsonb_build_object(
      'slug', actor_info.slug,
      'title', actor_info.title,
      'description', actor_info.description,
      'category', actor_info.category,
      'requires_cookies', actor_info.requires_cookies,
      'requires_api_key', actor_info.requires_api_key,
      'verify_hint', actor_info.verify_hint,
      'scopes', actor_info.scopes
    ),
    'fields', COALESCE(fields_array, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql;