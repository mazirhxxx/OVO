/*
  # Actor Registry for Credentials Vault

  1. New Tables
    - `actor_registry` - Defines all 21+ scraping actors and their required fields
    - `actor_fields` - Field definitions for each actor (cookies, API keys, etc.)
    - `user_credentials` - Encrypted storage of user credentials per actor
    - `credential_audit` - Audit trail for all credential operations
    - `credential_verification` - Verification status and history

  2. Security
    - Enable RLS on all tables
    - Encrypt sensitive data using pgcrypto
    - User-only access policies
    - Audit trail for all operations

  3. Features
    - Dynamic field rendering based on actor requirements
    - Cookie parsing and validation
    - Credential verification tracking
    - Rotation and lifecycle management
*/

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Actor Registry: Defines all scraping actors and their capabilities
CREATE TABLE IF NOT EXISTS actor_registry (
  slug text PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'social',
  requires_cookies boolean DEFAULT true,
  requires_api_key boolean DEFAULT false,
  verify_endpoint text,
  verify_hint text,
  scopes text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Actor Fields: Dynamic field definitions for each actor
CREATE TABLE IF NOT EXISTS actor_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_slug text NOT NULL REFERENCES actor_registry(slug) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'password', 'cookie', 'textarea', 'select', 'url')),
  is_required boolean DEFAULT false,
  is_masked boolean DEFAULT false,
  helper_text text,
  placeholder text,
  validation_regex text,
  select_options jsonb DEFAULT '[]',
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(actor_slug, field_key)
);

-- User Credentials: Encrypted storage of user credentials per actor
CREATE TABLE IF NOT EXISTS user_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL REFERENCES actor_registry(slug) ON DELETE CASCADE,
  encrypted_payload bytea NOT NULL, -- Encrypted JSON with cookies, tokens, headers
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('active', 'disabled', 'expired', 'unverified', 'failed')),
  last_verified_at timestamptz,
  verification_details jsonb DEFAULT '{}',
  user_agent text,
  proxy_hint text,
  rotation_enabled boolean DEFAULT false,
  reminder_enabled boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, actor_slug)
);

-- Credential Audit: Audit trail for all credential operations
CREATE TABLE IF NOT EXISTS credential_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL REFERENCES actor_registry(slug) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('create', 'update', 'verify', 'disable', 'enable', 'delete', 'rotate', 'export', 'access')),
  action_context jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Credential Verification: Track verification attempts and results
CREATE TABLE IF NOT EXISTS credential_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL REFERENCES actor_registry(slug) ON DELETE CASCADE,
  verification_type text NOT NULL DEFAULT 'manual' CHECK (verification_type IN ('manual', 'automatic', 'scheduled')),
  status text NOT NULL CHECK (status IN ('pass', 'fail', 'timeout', 'error')),
  response_time_ms integer,
  verification_details jsonb DEFAULT '{}',
  error_message text,
  verified_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_actor_fields_actor_slug ON actor_fields(actor_slug);
CREATE INDEX IF NOT EXISTS idx_actor_fields_display_order ON actor_fields(actor_slug, display_order);
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_actor_slug ON user_credentials(actor_slug);
CREATE INDEX IF NOT EXISTS idx_user_credentials_status ON user_credentials(status);
CREATE INDEX IF NOT EXISTS idx_user_credentials_expires_at ON user_credentials(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credential_audit_user_id ON credential_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_credential_audit_actor_slug ON credential_audit(actor_slug);
CREATE INDEX IF NOT EXISTS idx_credential_audit_created_at ON credential_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credential_verification_user_actor ON credential_verification(user_id, actor_slug);
CREATE INDEX IF NOT EXISTS idx_credential_verification_verified_at ON credential_verification(verified_at DESC);

-- Enable Row Level Security
ALTER TABLE actor_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_verification ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Actor Registry: Public read access (everyone can see available actors)
CREATE POLICY "Anyone can read actor registry"
  ON actor_registry
  FOR SELECT
  TO authenticated
  USING (true);

-- Actor Fields: Public read access (everyone can see field definitions)
CREATE POLICY "Anyone can read actor fields"
  ON actor_fields
  FOR SELECT
  TO authenticated
  USING (true);

-- User Credentials: Users can only access their own credentials
CREATE POLICY "Users can manage their own credentials"
  ON user_credentials
  FOR ALL
  TO authenticated
  USING (user_id = uid())
  WITH CHECK (user_id = uid());

-- Credential Audit: Users can only see their own audit logs
CREATE POLICY "Users can read their own audit logs"
  ON credential_audit
  FOR SELECT
  TO authenticated
  USING (user_id = uid());

CREATE POLICY "System can insert audit logs"
  ON credential_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = uid());

-- Credential Verification: Users can only see their own verification history
CREATE POLICY "Users can manage their own verification history"
  ON credential_verification
  FOR ALL
  TO authenticated
  USING (user_id = uid())
  WITH CHECK (user_id = uid());

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON user_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Encryption/Decryption helper functions
CREATE OR REPLACE FUNCTION encrypt_credential_payload(payload jsonb, encryption_key text DEFAULT 'default-key')
RETURNS bytea AS $$
BEGIN
  RETURN pgp_sym_encrypt(payload::text, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_credential_payload(encrypted_payload bytea, encryption_key text DEFAULT 'default-key')
RETURNS jsonb AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_payload, encryption_key)::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN '{}'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit logging function
CREATE OR REPLACE FUNCTION log_credential_audit(
  p_user_id uuid,
  p_actor_slug text,
  p_action_type text,
  p_action_context jsonb DEFAULT '{}',
  p_success boolean DEFAULT true,
  p_error_message text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO credential_audit (
    user_id,
    actor_slug,
    action_type,
    action_context,
    success,
    error_message
  ) VALUES (
    p_user_id,
    p_actor_slug,
    p_action_type,
    p_action_context,
    p_success,
    p_error_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;