/*
  # Credentials Vault System

  1. New Tables
    - `actor_registry` - Defines all 21 scraping actors and their required fields
    - `user_credentials` - Stores encrypted credentials per user × actor
    - `credential_audit` - Audit trail for all credential operations
    - `verification_cache` - Caches verification results to avoid rate limits

  2. Security
    - Enable RLS on all tables
    - Encrypt sensitive data using pgcrypto
    - Add policies for user-only access
    - Audit trail for all operations

  3. Functions
    - Credential encryption/decryption helpers
    - Verification status management
    - Audit logging
*/

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Actor Registry: Defines all scraping actors and their requirements
CREATE TABLE IF NOT EXISTS actor_registry (
  slug text PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'social',
  requires_cookies boolean DEFAULT true,
  requires_user_agent boolean DEFAULT true,
  fields jsonb NOT NULL DEFAULT '[]',
  verify_hint text,
  scopes text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Credentials: Encrypted storage per user × actor
CREATE TABLE IF NOT EXISTS user_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL REFERENCES actor_registry(slug) ON DELETE CASCADE,
  encrypted_secret text NOT NULL, -- Encrypted JSON payload
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('active', 'disabled', 'expired', 'unverified', 'failed')),
  last_verified_at timestamptz,
  verification_details jsonb DEFAULT '{}',
  user_agent text,
  proxy_hint text,
  rotation_enabled boolean DEFAULT false,
  reminder_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, actor_slug)
);

-- Credential Audit: Track all operations
CREATE TABLE IF NOT EXISTS credential_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'verify', 'disable', 'enable', 'delete', 'export', 'rotate')),
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Verification Cache: Cache verification results to avoid rate limits
CREATE TABLE IF NOT EXISTS verification_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL,
  verification_result jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, actor_slug)
);

-- Enable RLS
ALTER TABLE actor_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Actor registry is public read"
  ON actor_registry
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage own credentials"
  ON user_credentials
  FOR ALL
  TO authenticated
  USING (user_id = uid())
  WITH CHECK (user_id = uid());

CREATE POLICY "Users can view own audit logs"
  ON credential_audit
  FOR SELECT
  TO authenticated
  USING (user_id = uid());

CREATE POLICY "Users can manage own verification cache"
  ON verification_cache
  FOR ALL
  TO authenticated
  USING (user_id = uid())
  WITH CHECK (user_id = uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_actor ON user_credentials(user_id, actor_slug);
CREATE INDEX IF NOT EXISTS idx_user_credentials_status ON user_credentials(status);
CREATE INDEX IF NOT EXISTS idx_credential_audit_user_created ON credential_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_cache_expires ON verification_cache(expires_at);

-- Functions for encryption/decryption
CREATE OR REPLACE FUNCTION encrypt_credential(secret_data jsonb, encryption_key text DEFAULT 'default_key')
RETURNS text AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(
      secret_data::text,
      encryption_key,
      'compress-algo=1, cipher-algo=aes256'
    ),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_credential(encrypted_secret text, encryption_key text DEFAULT 'default_key')
RETURNS jsonb AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_secret, 'base64'),
    encryption_key
  )::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN '{}'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update verification status
CREATE OR REPLACE FUNCTION update_credential_verification(
  p_user_id uuid,
  p_actor_slug text,
  p_status text,
  p_details jsonb DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  UPDATE user_credentials
  SET 
    status = p_status,
    last_verified_at = now(),
    verification_details = p_details,
    updated_at = now()
  WHERE user_id = p_user_id AND actor_slug = p_actor_slug;
  
  -- Record audit
  INSERT INTO credential_audit (user_id, actor_slug, action, status, details)
  VALUES (p_user_id, p_actor_slug, 'verify', 
          CASE WHEN p_status = 'active' THEN 'success' ELSE 'failure' END,
          p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON user_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert Actor Registry Data (21 actors)
INSERT INTO actor_registry (slug, title, description, category, requires_cookies, requires_user_agent, fields, verify_hint, scopes) VALUES

-- LinkedIn Actors
('linkedin-basic', 'LinkedIn Basic', 'Scrape LinkedIn profiles and connections', 'social', true, true, 
'[
  {"key": "li_at", "label": "li_at Cookie", "type": "password", "required": true, "mask": true, "helper": "Main LinkedIn authentication cookie"},
  {"key": "JSESSIONID", "label": "JSESSIONID Cookie", "type": "password", "required": true, "mask": true, "helper": "Session identifier cookie"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string from same session"}
]', 'Fetch /feed/ and detect logged-in marker', '["profile_view", "connection_search"]'),

('linkedin-sales-navigator', 'LinkedIn Sales Navigator', 'Advanced LinkedIn prospecting with Sales Navigator', 'social', true, true,
'[
  {"key": "li_at", "label": "li_at Cookie", "type": "password", "required": true, "mask": true, "helper": "Main LinkedIn authentication cookie"},
  {"key": "JSESSIONID", "label": "JSESSIONID Cookie", "type": "password", "required": true, "mask": true, "helper": "Session identifier cookie"},
  {"key": "li_a", "label": "li_a Cookie", "type": "password", "required": false, "mask": true, "helper": "Additional LinkedIn cookie (sometimes required)"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Sales Navigator dashboard', '["sales_navigator", "advanced_search"]'),

-- Twitter/X Actors
('x-twitter', 'X (Twitter)', 'Scrape Twitter profiles, tweets, and followers', 'social', true, true,
'[
  {"key": "auth_token", "label": "auth_token Cookie", "type": "password", "required": true, "mask": true, "helper": "Twitter authentication token"},
  {"key": "ct0", "label": "ct0 Cookie", "type": "password", "required": true, "mask": true, "helper": "CSRF token for Twitter API"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Fetch /settings/account and check authentication', '["profile_access", "tweet_search"]'),

-- Facebook Actors
('facebook-groups', 'Facebook Groups', 'Scrape Facebook group members and posts', 'social', true, true,
'[
  {"key": "c_user", "label": "c_user Cookie", "type": "password", "required": true, "mask": true, "helper": "Facebook user ID cookie"},
  {"key": "xs", "label": "xs Cookie", "type": "password", "required": true, "mask": true, "helper": "Facebook session cookie"},
  {"key": "fr", "label": "fr Cookie", "type": "password", "required": true, "mask": true, "helper": "Facebook request cookie"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Facebook groups page', '["group_access", "member_list"]'),

('facebook-pages', 'Facebook Pages', 'Scrape Facebook business pages and insights', 'social', true, true,
'[
  {"key": "c_user", "label": "c_user Cookie", "type": "password", "required": true, "mask": true, "helper": "Facebook user ID cookie"},
  {"key": "xs", "label": "xs Cookie", "type": "password", "required": true, "mask": true, "helper": "Facebook session cookie"},
  {"key": "fr", "label": "fr Cookie", "type": "password", "required": true, "mask": true, "helper": "Facebook request cookie"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Facebook pages manager', '["page_access", "insights"]'),

('instagram-basic', 'Instagram', 'Scrape Instagram profiles and posts', 'social', true, true,
'[
  {"key": "sessionid", "label": "sessionid Cookie", "type": "password", "required": true, "mask": true, "helper": "Instagram session ID"},
  {"key": "csrftoken", "label": "csrftoken Cookie", "type": "password", "required": true, "mask": true, "helper": "Instagram CSRF token"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Instagram profile page', '["profile_view", "post_access"]'),

-- Reddit Actor
('reddit-auth', 'Reddit', 'Scrape Reddit posts, comments, and user profiles', 'social', true, true,
'[
  {"key": "reddit_session", "label": "reddit_session Cookie", "type": "password", "required": false, "mask": true, "helper": "Reddit session cookie"},
  {"key": "oauth_token", "label": "OAuth Token", "type": "password", "required": false, "mask": true, "helper": "Reddit OAuth token (alternative to cookies)"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Reddit user profile', '["post_access", "comment_access"]'),

-- Google Maps Actors
('google-maps', 'Google Maps', 'Scrape Google Maps business listings', 'maps', true, true,
'[
  {"key": "SAPISID", "label": "SAPISID Cookie", "type": "password", "required": true, "mask": true, "helper": "Google API session ID"},
  {"key": "__Secure-3PSAPISID", "label": "__Secure-3PSAPISID Cookie", "type": "password", "required": false, "mask": true, "helper": "Secure Google API session ID"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Google Maps business page', '["business_search", "reviews_access"]'),

('maps-business-details', 'Google Maps Business Details', 'Extract detailed business information from Google Maps', 'maps', true, true,
'[
  {"key": "SAPISID", "label": "SAPISID Cookie", "type": "password", "required": true, "mask": true, "helper": "Google API session ID"},
  {"key": "__Secure-3PSAPISID", "label": "__Secure-3PSAPISID Cookie", "type": "password", "required": false, "mask": true, "helper": "Secure Google API session ID"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access detailed business listings', '["business_details", "contact_info"]'),

-- Job Board Actors
('indeed-jobs', 'Indeed Jobs', 'Scrape job postings and company information from Indeed', 'jobs', true, true,
'[
  {"key": "CTK", "label": "CTK Session Cookie", "type": "password", "required": true, "mask": true, "helper": "Indeed session cookie (name may vary)"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Indeed job search results', '["job_search", "company_info"]'),

('glassdoor', 'Glassdoor', 'Scrape company reviews and salary information', 'jobs', true, true,
'[
  {"key": "GDSession", "label": "GDSession Cookie", "type": "password", "required": true, "mask": true, "helper": "Glassdoor session cookie"},
  {"key": "TS_cookie", "label": "TS Cookie", "type": "password", "required": false, "mask": true, "helper": "Glassdoor timestamp cookie"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Glassdoor company pages', '["company_reviews", "salary_data"]'),

('stackoverflow-jobs', 'Stack Overflow Jobs', 'Scrape developer job postings and profiles', 'jobs', true, true,
'[
  {"key": "session_cookie", "label": "Session Cookie", "type": "password", "required": true, "mask": true, "helper": "Stack Overflow session cookie"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Stack Overflow jobs section', '["job_listings", "developer_profiles"]'),

-- Enrichment API Actors
('apollo-portal', 'Apollo.io', 'Email finder and contact enrichment', 'enrichment', false, false,
'[
  {"key": "api_key", "label": "API Key", "type": "password", "required": false, "mask": true, "helper": "Apollo.io API key"},
  {"key": "session_cookie", "label": "Portal Session Cookie", "type": "password", "required": false, "mask": true, "helper": "Apollo portal authentication cookie"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": false, "mask": false, "helper": "Browser user agent (if using cookies)"}
]', 'Test API endpoint or portal access', '["email_finder", "contact_enrichment"]'),

('contactout', 'ContactOut', 'Email and phone number finder', 'enrichment', true, true,
'[
  {"key": "portal_auth_cookie", "label": "Portal Auth Cookie", "type": "password", "required": true, "mask": true, "helper": "ContactOut authentication cookie"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access ContactOut dashboard', '["email_finder", "phone_finder"]'),

('hunter-io', 'Hunter.io', 'Email verification and domain search', 'enrichment', false, false,
'[
  {"key": "api_key", "label": "API Key", "type": "password", "required": true, "mask": true, "helper": "Hunter.io API key from dashboard"}
]', 'Test API with account info endpoint', '["email_verification", "domain_search"]'),

('people-data-labs', 'People Data Labs', 'Person and company enrichment API', 'enrichment', false, false,
'[
  {"key": "api_key", "label": "API Key", "type": "password", "required": true, "mask": true, "helper": "People Data Labs API key"}
]', 'Test API with person search endpoint', '["person_enrichment", "company_data"]'),

('dropcontact', 'Dropcontact', 'Email enrichment and verification', 'enrichment', false, false,
'[
  {"key": "api_key", "label": "API Key", "type": "password", "required": true, "mask": true, "helper": "Dropcontact API key"}
]', 'Test API with enrichment endpoint', '["email_enrichment", "data_verification"]'),

('serper-bing', 'Serper Bing Search', 'Bing search API for lead discovery', 'search', false, false,
'[
  {"key": "api_key", "label": "API Key", "type": "password", "required": true, "mask": true, "helper": "Serper.dev API key for Bing search"}
]', 'Test search API endpoint', '["web_search", "business_search"]'),

-- Developer Platform Actors
('github-scraper', 'GitHub', 'Scrape GitHub profiles and repositories', 'developer', true, true,
'[
  {"key": "user_session", "label": "user_session Cookie", "type": "password", "required": false, "mask": true, "helper": "GitHub session cookie"},
  {"key": "access_token", "label": "Personal Access Token", "type": "password", "required": false, "mask": true, "helper": "GitHub personal access token"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access GitHub profile or API', '["profile_access", "repo_access"]'),

('google-scholar', 'Google Scholar', 'Scrape academic profiles and publications', 'academic', true, true,
'[
  {"key": "scholar_cookie", "label": "Scholar Cookie", "type": "password", "required": true, "mask": true, "helper": "Google Scholar anti-bot cookie"},
  {"key": "user_agent", "label": "User Agent", "type": "textarea", "required": true, "mask": false, "helper": "Browser user agent string"}
]', 'Access Google Scholar search results', '["academic_search", "citation_data"]'),

-- No-Auth Actors
('ycombinator-hn', 'Hacker News (YC)', 'Scrape Hacker News posts and user profiles', 'developer', false, false,
'[]', 'Access Hacker News front page', '["post_access", "user_profiles"]');

-- Insert additional actors for completeness (these can be added later)
INSERT INTO actor_registry (slug, title, description, category, requires_cookies, requires_user_agent, fields, verify_hint) VALUES
('crunchbase', 'Crunchbase', 'Company and funding data', 'business', true, true, '[]', 'Access company profiles'),
('angellist', 'AngelList', 'Startup and investor data', 'business', true, true, '[]', 'Access startup profiles'),
('producthunt', 'Product Hunt', 'Product launches and maker profiles', 'business', true, true, '[]', 'Access product pages'),
('yelp-business', 'Yelp Business', 'Local business data and reviews', 'local', true, true, '[]', 'Access business listings'),
('zoominfo', 'ZoomInfo', 'B2B contact and company database', 'enrichment', true, true, '[]', 'Access contact database'),
('salesforce', 'Salesforce', 'CRM data and lead information', 'crm', true, true, '[]', 'Access Salesforce dashboard'),
('hubspot', 'HubSpot', 'Marketing and sales platform data', 'crm', true, true, '[]', 'Access HubSpot portal'),
('pipedrive', 'Pipedrive', 'Sales pipeline and contact data', 'crm', true, true, '[]', 'Access Pipedrive dashboard');