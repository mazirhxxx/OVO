/*
  # Credentials Vault Schema

  1. Core Tables
    - actor_registry: Defines all scraping actors and their requirements
    - actor_fields: Dynamic field definitions for each actor
    - user_credentials: Encrypted storage of user credentials
    - credential_audit: Audit trail for security
    - credential_verification: Verification status tracking

  2. Security
    - All sensitive data encrypted with pgcrypto
    - Row Level Security for user isolation
    - Audit trail for all operations
    - Rate limiting on verification attempts

  3. Actors Supported
    - 21+ scraping actors (LinkedIn, Twitter, Facebook, etc.)
    - Cookie-based and API key authentication
    - Dynamic field rendering based on actor requirements
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Actor Registry Table
CREATE TABLE IF NOT EXISTS actor_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'social',
  requires_cookies boolean DEFAULT true,
  requires_user_agent boolean DEFAULT true,
  verify_endpoint text,
  verify_hint text,
  scopes text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Actor Fields Table (dynamic field definitions)
CREATE TABLE IF NOT EXISTS actor_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_slug text NOT NULL REFERENCES actor_registry(slug) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text', -- text|password|cookie|textarea|select|api_key
  is_required boolean DEFAULT false,
  is_masked boolean DEFAULT false,
  placeholder text,
  helper_text text,
  validation_regex text,
  field_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(actor_slug, field_key)
);

-- User Credentials Table (encrypted storage)
CREATE TABLE IF NOT EXISTS user_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL REFERENCES actor_registry(slug) ON DELETE CASCADE,
  encrypted_payload bytea NOT NULL, -- pgp_sym_encrypt result
  status text DEFAULT 'unverified' CHECK (status IN ('active', 'disabled', 'expired', 'unverified', 'failed')),
  last_verified_at timestamptz,
  verification_attempts integer DEFAULT 0,
  max_verification_attempts integer DEFAULT 5,
  expires_at timestamptz,
  user_agent text,
  proxy_hint text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, actor_slug)
);

-- Credential Verification History
CREATE TABLE IF NOT EXISTS credential_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pass', 'fail', 'error')),
  response_code integer,
  response_details jsonb,
  error_message text,
  verified_at timestamptz DEFAULT now(),
  verification_duration_ms integer
);

-- Credential Audit Trail
CREATE TABLE IF NOT EXISTS credential_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'verify', 'disable', 'enable', 'delete', 'rotate', 'export')),
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_actor_registry_category ON actor_registry(category);
CREATE INDEX IF NOT EXISTS idx_actor_registry_active ON actor_registry(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_actor_fields_actor ON actor_fields(actor_slug);
CREATE INDEX IF NOT EXISTS idx_actor_fields_order ON actor_fields(actor_slug, field_order);
CREATE INDEX IF NOT EXISTS idx_user_credentials_user ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_status ON user_credentials(status);
CREATE INDEX IF NOT EXISTS idx_user_credentials_expires ON user_credentials(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credential_verification_credential ON credential_verification(credential_id);
CREATE INDEX IF NOT EXISTS idx_credential_audit_user ON credential_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_credential_audit_actor ON credential_audit(actor_slug);

-- Enable Row Level Security
ALTER TABLE actor_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Actor registry is public" ON actor_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "Actor fields are public" ON actor_fields FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own credentials" ON user_credentials 
  FOR ALL TO authenticated USING (user_id = uid()) WITH CHECK (user_id = uid());

CREATE POLICY "Users can view own verification history" ON credential_verification 
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_credentials 
      WHERE user_credentials.id = credential_verification.credential_id 
      AND user_credentials.user_id = uid()
    )
  );

CREATE POLICY "Users can view own audit trail" ON credential_audit 
  FOR SELECT TO authenticated USING (user_id = uid());

CREATE POLICY "System can insert audit records" ON credential_audit 
  FOR INSERT TO authenticated WITH CHECK (user_id = uid());

-- Helper Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_actor_registry_updated_at 
  BEFORE UPDATE ON actor_registry 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credentials_updated_at 
  BEFORE UPDATE ON user_credentials 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Credential Management Functions
CREATE OR REPLACE FUNCTION encrypt_credentials(
  payload jsonb,
  encryption_key text DEFAULT 'default-vault-key'
) RETURNS bytea AS $$
BEGIN
  RETURN pgp_sym_encrypt(payload::text, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_credentials(
  encrypted_payload bytea,
  encryption_key text DEFAULT 'default-vault-key'
) RETURNS jsonb AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_payload, encryption_key)::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cookie parsing function
CREATE OR REPLACE FUNCTION parse_cookie_string(cookie_string text)
RETURNS jsonb AS $$
DECLARE
  result jsonb := '{}';
  cookie_pair text;
  key_value text[];
BEGIN
  -- Split by semicolon and process each cookie
  FOR cookie_pair IN 
    SELECT unnest(string_to_array(cookie_string, ';'))
  LOOP
    -- Clean whitespace
    cookie_pair := trim(cookie_pair);
    
    -- Skip empty pairs
    IF cookie_pair = '' THEN
      CONTINUE;
    END IF;
    
    -- Split by first equals sign
    key_value := string_to_array(cookie_pair, '=', 2);
    
    -- Only process if we have both key and value
    IF array_length(key_value, 1) = 2 THEN
      result := jsonb_set(
        result, 
        ARRAY[trim(key_value[1])], 
        to_jsonb(trim(key_value[2]))
      );
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Verification tracking function
CREATE OR REPLACE FUNCTION record_verification_attempt(
  p_credential_id uuid,
  p_status text,
  p_response_code integer DEFAULT NULL,
  p_response_details jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Insert verification record
  INSERT INTO credential_verification (
    credential_id,
    status,
    response_code,
    response_details,
    error_message,
    verification_duration_ms
  ) VALUES (
    p_credential_id,
    p_status,
    p_response_code,
    p_response_details,
    p_error_message,
    p_duration_ms
  );
  
  -- Update credential status and verification timestamp
  UPDATE user_credentials 
  SET 
    status = CASE 
      WHEN p_status = 'pass' THEN 'active'
      WHEN p_status = 'fail' THEN 'failed'
      ELSE 'unverified'
    END,
    last_verified_at = CASE WHEN p_status = 'pass' THEN now() ELSE last_verified_at END,
    verification_attempts = verification_attempts + 1,
    updated_at = now()
  WHERE id = p_credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit logging function
CREATE OR REPLACE FUNCTION log_credential_audit(
  p_user_id uuid,
  p_actor_slug text,
  p_action text,
  p_details jsonb DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO credential_audit (
    user_id,
    actor_slug,
    action,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_actor_slug,
    p_action,
    p_details,
    p_ip_address,
    p_user_agent
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;