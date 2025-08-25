/*
  # Credentials Vault Database Schema

  1. New Tables
    - `actor_registry` - Available scraping actors and their field definitions
    - `actor_fields` - Field definitions for each actor (labels, types, validation)
    - `user_credentials` - Encrypted user credentials for each actor
    - `credential_audit_log` - Audit trail for credential operations
    - `credential_verification_history` - History of verification attempts

  2. Security
    - Enable RLS on all tables
    - Add policies for user-owned data access
    - Encrypt sensitive credential data
    - Audit logging for all operations

  3. Functions
    - `encrypt_credentials()` - Server-side encryption using pgcrypto
    - `decrypt_credentials()` - Server-side decryption
    - `log_credential_audit()` - Audit trail logging
    - `record_verification_attempt()` - Track verification attempts
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
  category text NOT NULL DEFAULT 'general',
  requires_cookies boolean NOT NULL DEFAULT true,
  requires_user_agent boolean NOT NULL DEFAULT true,
  target_domain text,
  verify_endpoint text,
  verify_hint text,
  scopes text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Actor Fields Table
CREATE TABLE IF NOT EXISTS actor_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_slug text NOT NULL REFERENCES actor_registry(slug) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  is_masked boolean NOT NULL DEFAULT false,
  placeholder text,
  helper_text text,
  validation_regex text,
  field_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(actor_slug, field_key)
);

-- User Credentials Table
CREATE TABLE IF NOT EXISTS user_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL REFERENCES actor_registry(slug) ON DELETE CASCADE,
  encrypted_payload bytea NOT NULL,
  status text NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  verification_attempts integer DEFAULT 0,
  max_verification_attempts integer DEFAULT 10,
  expires_at timestamptz,
  user_agent text,
  proxy_hint text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(user_id, actor_slug),
  CONSTRAINT valid_status CHECK (status IN ('unverified', 'active', 'failed', 'expired', 'disabled'))
);

-- Credential Audit Log Table
CREATE TABLE IF NOT EXISTS credential_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_action CHECK (action IN ('create', 'update', 'delete', 'verify', 'access', 'expire'))
);

-- Credential Verification History Table
CREATE TABLE IF NOT EXISTS credential_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
  status text NOT NULL,
  response_code integer,
  response_details jsonb DEFAULT '{}',
  error_message text,
  duration_ms integer,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_verification_status CHECK (status IN ('pass', 'fail', 'error', 'timeout'))
);

-- Enable RLS
ALTER TABLE actor_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_verification_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Actor Registry: Public read access
CREATE POLICY "Anyone can read active actors"
  ON actor_registry
  FOR SELECT
  USING (is_active = true);

-- Actor Fields: Public read access
CREATE POLICY "Anyone can read actor fields"
  ON actor_fields
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM actor_registry 
    WHERE slug = actor_fields.actor_slug AND is_active = true
  ));

-- User Credentials: User owns their credentials
CREATE POLICY "Users can manage their own credentials"
  ON user_credentials
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Audit Log: User can read their own audit logs
CREATE POLICY "Users can read their own audit logs"
  ON credential_audit_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Verification History: User can read their own verification history
CREATE POLICY "Users can read their own verification history"
  ON credential_verification_history
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_credentials 
    WHERE id = credential_verification_history.credential_id 
    AND user_id = auth.uid()
  ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_actor_registry_category ON actor_registry(category);
CREATE INDEX IF NOT EXISTS idx_actor_registry_active ON actor_registry(is_active);
CREATE INDEX IF NOT EXISTS idx_actor_fields_actor_slug ON actor_fields(actor_slug);
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_status ON user_credentials(status);
CREATE INDEX IF NOT EXISTS idx_user_credentials_expires_at ON user_credentials(expires_at);
CREATE INDEX IF NOT EXISTS idx_credential_audit_log_user_id ON credential_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_credential_audit_log_created_at ON credential_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_verification_history_credential_id ON credential_verification_history(credential_id);

-- Functions for credential management

-- Encrypt credentials function
CREATE OR REPLACE FUNCTION encrypt_credentials(
  payload jsonb,
  encryption_key text
) RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pgp_sym_encrypt(payload::text, encryption_key);
END;
$$;

-- Decrypt credentials function
CREATE OR REPLACE FUNCTION decrypt_credentials(
  encrypted_payload bytea,
  encryption_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  decrypted_text text;
BEGIN
  decrypted_text := pgp_sym_decrypt(encrypted_payload, encryption_key);
  RETURN decrypted_text::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Log credential audit function
CREATE OR REPLACE FUNCTION log_credential_audit(
  p_user_id uuid,
  p_actor_slug text,
  p_action text,
  p_details jsonb DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO credential_audit_log (
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
    inet_client_addr(),
    current_setting('request.headers', true)::jsonb->>'user-agent'
  );
END;
$$;

-- Record verification attempt function
CREATE OR REPLACE FUNCTION record_verification_attempt(
  p_credential_id uuid,
  p_status text,
  p_response_code integer DEFAULT NULL,
  p_response_details jsonb DEFAULT '{}',
  p_error_message text DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert verification history
  INSERT INTO credential_verification_history (
    credential_id,
    status,
    response_code,
    response_details,
    error_message,
    duration_ms
  ) VALUES (
    p_credential_id,
    p_status,
    p_response_code,
    p_response_details,
    p_error_message,
    p_duration_ms
  );

  -- Update credential status and verification count
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
$$;

-- Insert Actor Registry Data
INSERT INTO actor_registry (slug, title, description, category, requires_cookies, target_domain, verify_hint) VALUES
  ('linkedin-basic', 'LinkedIn (Basic)', 'Basic LinkedIn profile and connection scraping', 'social', true, 'linkedin.com', 'Fetch https://www.linkedin.com/feed/ and detect logged-in marker'),
  ('linkedin-sales-navigator', 'LinkedIn Sales Navigator', 'Advanced LinkedIn Sales Navigator features', 'social', true, 'linkedin.com', 'Fetch a Sales Navigator page and ensure no auth redirect'),
  ('x-twitter', 'X / Twitter', 'Twitter/X profile and tweet scraping', 'social', true, 'x.com', 'Fetch https://x.com/settings/account or who-am-I endpoint'),
  ('facebook-groups', 'Facebook (Groups)', 'Facebook groups and member scraping', 'social', true, 'facebook.com', 'Fetch a joined group page and ensure HTML contains user markers'),
  ('facebook-pages', 'Facebook (Pages)', 'Facebook pages and business scraping', 'social', true, 'facebook.com', 'Fetch /me or a managed page and detect login'),
  ('instagram-basic', 'Instagram', 'Instagram profile and post scraping', 'social', true, 'instagram.com', 'Fetch profile page and detect logged-in state'),
  ('reddit-auth', 'Reddit', 'Reddit posts and community scraping', 'social', true, 'reddit.com', 'Fetch https://www.reddit.com/settings/ and ensure no redirect'),
  ('google-maps', 'Google Maps', 'Google Maps business and location data', 'maps', true, 'maps.google.com', 'Fetch a business page; ensure not blocked and cookie accepted'),
  ('maps-business-details', 'Maps Business Details', 'Detailed Google Maps business information', 'maps', true, 'maps.google.com', 'Same as Google Maps; detail endpoint'),
  ('indeed-jobs', 'Indeed Jobs', 'Indeed job postings and company data', 'jobs', true, 'indeed.com', 'Fetch a saved jobs page and ensure session is valid'),
  ('glassdoor', 'Glassdoor', 'Glassdoor company reviews and salary data', 'jobs', true, 'glassdoor.com', 'Fetch /member/home and detect login'),
  ('apollo-portal', 'Apollo.io Portal', 'Apollo.io contact and company enrichment', 'enrichment', false, 'apollo.io', 'Ping API key or fetch minimal GraphQL with cookie'),
  ('contactout', 'ContactOut', 'ContactOut email finder and enrichment', 'enrichment', true, 'contactout.com', 'Fetch dashboard page; ensure credits visible'),
  ('hunter-io', 'Hunter.io', 'Hunter.io email finder API', 'enrichment', false, 'hunter.io', 'Ping account endpoint'),
  ('people-data-labs', 'People Data Labs', 'People Data Labs enrichment API', 'enrichment', false, 'peopledatalabs.com', 'Ping API key usage endpoint'),
  ('dropcontact', 'Dropcontact', 'Dropcontact email enrichment API', 'enrichment', false, 'dropcontact.io', 'Ping status endpoint'),
  ('serper-bing', 'Serper / Bing API', 'Serper search API with Bing results', 'search', false, 'serper.dev', 'Ping test search'),
  ('github-scraper', 'GitHub', 'GitHub profile and repository scraping', 'developer', true, 'github.com', 'Fetch profile page while authenticated'),
  ('stackoverflow-jobs', 'StackOverflow Jobs', 'StackOverflow job postings and developer profiles', 'jobs', true, 'stackoverflow.com', 'Fetch saved jobs page'),
  ('ycombinator-hn', 'Hacker News', 'Hacker News posts and user data', 'community', false, 'news.ycombinator.com', 'No auth required'),
  ('google-scholar', 'Google Scholar', 'Google Scholar academic profiles and papers', 'academic', true, 'scholar.google.com', 'Fetch profile/search page without captcha')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  requires_cookies = EXCLUDED.requires_cookies,
  target_domain = EXCLUDED.target_domain,
  verify_hint = EXCLUDED.verify_hint,
  updated_at = now();

-- Insert Actor Fields Data
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, helper_text, field_order) VALUES
  -- LinkedIn Basic
  ('linkedin-basic', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste full document.cookie from .linkedin.com', 0),
  ('linkedin-basic', 'li_at', 'li_at', 'password', true, true, 'Chrome → DevTools → Application → Cookies → .linkedin.com', 1),
  ('linkedin-basic', 'JSESSIONID', 'JSESSIONID', 'password', true, true, '.linkedin.com', 2),
  ('linkedin-basic', 'userAgent', 'User Agent', 'text', true, false, 'navigator.userAgent', 3),
  
  -- LinkedIn Sales Navigator
  ('linkedin-sales-navigator', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste full document.cookie from .linkedin.com', 0),
  ('linkedin-sales-navigator', 'li_at', 'li_at', 'password', true, true, NULL, 1),
  ('linkedin-sales-navigator', 'JSESSIONID', 'JSESSIONID', 'password', true, true, NULL, 2),
  ('linkedin-sales-navigator', 'li_a', 'li_a (if present)', 'password', false, true, NULL, 3),
  ('linkedin-sales-navigator', 'userAgent', 'User Agent', 'text', true, false, NULL, 4),
  
  -- X/Twitter
  ('x-twitter', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .x.com or .twitter.com', 0),
  ('x-twitter', 'auth_token', 'auth_token', 'password', true, true, NULL, 1),
  ('x-twitter', 'ct0', 'ct0 (CSRF)', 'password', true, true, NULL, 2),
  ('x-twitter', 'userAgent', 'User Agent', 'text', true, false, NULL, 3),
  
  -- Facebook Groups
  ('facebook-groups', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .facebook.com', 0),
  ('facebook-groups', 'c_user', 'c_user', 'password', true, true, NULL, 1),
  ('facebook-groups', 'xs', 'xs', 'password', true, true, NULL, 2),
  ('facebook-groups', 'fr', 'fr', 'password', false, true, NULL, 3),
  ('facebook-groups', 'userAgent', 'User Agent', 'text', true, false, NULL, 4),
  
  -- Facebook Pages
  ('facebook-pages', 'cookieString', 'Raw Cookie String', 'textarea', false, false, NULL, 0),
  ('facebook-pages', 'c_user', 'c_user', 'password', true, true, NULL, 1),
  ('facebook-pages', 'xs', 'xs', 'password', true, true, NULL, 2),
  ('facebook-pages', 'fr', 'fr', 'password', false, true, NULL, 3),
  ('facebook-pages', 'userAgent', 'User Agent', 'text', true, false, NULL, 4),
  
  -- Instagram
  ('instagram-basic', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .instagram.com', 0),
  ('instagram-basic', 'sessionid', 'sessionid', 'password', true, true, NULL, 1),
  ('instagram-basic', 'csrftoken', 'csrftoken', 'password', true, true, NULL, 2),
  ('instagram-basic', 'userAgent', 'User Agent', 'text', true, false, NULL, 3),
  
  -- Reddit
  ('reddit-auth', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .reddit.com', 0),
  ('reddit-auth', 'reddit_session', 'reddit_session (or OAuth token)', 'password', true, true, NULL, 1),
  ('reddit-auth', 'userAgent', 'User Agent', 'text', true, false, NULL, 2),
  
  -- Google Maps
  ('google-maps', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .google.com / .maps.google.com', 0),
  ('google-maps', 'SAPISID', 'SAPISID', 'password', true, true, NULL, 1),
  ('google-maps', '__Secure-3PSAPISID', '__Secure-3PSAPISID', 'password', true, true, NULL, 2),
  ('google-maps', 'userAgent', 'User Agent', 'text', true, false, NULL, 3),
  
  -- Maps Business Details
  ('maps-business-details', 'reuseFrom', 'Reuse from Integration', 'select', false, false, 'Select google-maps to reuse', 0),
  ('maps-business-details', 'userAgent', 'User Agent', 'text', true, false, NULL, 1),
  
  -- Indeed Jobs
  ('indeed-jobs', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .indeed.com', 0),
  ('indeed-jobs', 'CTK', 'CTK (session)', 'password', true, true, NULL, 1),
  ('indeed-jobs', 'userAgent', 'User Agent', 'text', true, false, NULL, 2),
  
  -- Glassdoor
  ('glassdoor', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .glassdoor.com', 0),
  ('glassdoor', 'GDSession', 'GDSession', 'password', true, true, NULL, 1),
  ('glassdoor', 'TS*', 'TS*', 'password', false, true, 'Security cookie often named TSxxxxx', 2),
  ('glassdoor', 'userAgent', 'User Agent', 'text', true, false, NULL, 3),
  
  -- Apollo Portal
  ('apollo-portal', 'apiKey', 'API Key (preferred)', 'password', false, true, NULL, 0),
  ('apollo-portal', 'apollographql.session', 'apollographql.session (cookie)', 'password', false, true, NULL, 1),
  ('apollo-portal', 'userAgent', 'User Agent', 'text', false, false, NULL, 2),
  
  -- ContactOut
  ('contactout', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from portal.contactout.com', 0),
  ('contactout', 'co_session', 'Portal session (name may vary)', 'password', true, true, NULL, 1),
  ('contactout', 'userAgent', 'User Agent', 'text', true, false, NULL, 2),
  
  -- Hunter.io
  ('hunter-io', 'apiKey', 'API Key', 'password', true, true, NULL, 0),
  
  -- People Data Labs
  ('people-data-labs', 'apiKey', 'API Key', 'password', true, true, NULL, 0),
  
  -- Dropcontact
  ('dropcontact', 'apiKey', 'API Key', 'password', true, true, NULL, 0),
  
  -- Serper/Bing
  ('serper-bing', 'apiKey', 'API Key', 'password', true, true, NULL, 0),
  
  -- GitHub
  ('github-scraper', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .github.com', 0),
  ('github-scraper', 'userSession', 'userSession (or token)', 'password', true, true, NULL, 1),
  ('github-scraper', 'userAgent', 'User Agent', 'text', true, false, NULL, 2),
  
  -- StackOverflow Jobs
  ('stackoverflow-jobs', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .stackoverflow.com', 0),
  ('stackoverflow-jobs', 'acct', 'acct/session (name varies)', 'password', true, true, NULL, 1),
  ('stackoverflow-jobs', 'userAgent', 'User Agent', 'text', true, false, NULL, 2),
  
  -- Google Scholar
  ('google-scholar', 'cookieString', 'Raw Cookie String', 'textarea', false, false, 'Paste from .scholar.google.com', 0),
  ('google-scholar', 'SID', 'SID (or SAPISID)', 'password', true, true, NULL, 1),
  ('google-scholar', 'userAgent', 'User Agent', 'text', true, false, NULL, 2)
ON CONFLICT (actor_slug, field_key) DO UPDATE SET
  field_label = EXCLUDED.field_label,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  is_masked = EXCLUDED.is_masked,
  helper_text = EXCLUDED.helper_text,
  field_order = EXCLUDED.field_order;

-- Update updated_at trigger for user_credentials
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON user_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_actor_registry_updated_at
  BEFORE UPDATE ON actor_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();