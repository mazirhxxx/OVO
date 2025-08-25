/*
  # Populate Actor Registry with 21+ Scraping Actors

  This migration populates the actor registry with all supported scraping actors
  and their required field definitions for dynamic UI rendering.
*/

-- Insert Actor Registry entries
INSERT INTO actor_registry (slug, title, description, category, requires_cookies, requires_user_agent, verify_endpoint, verify_hint, scopes) VALUES

-- Social Media Actors
('linkedin-basic', 'LinkedIn Basic', 'Scrape LinkedIn profiles, connections, and posts', 'social', true, true, '/feed/', 'Check if logged into LinkedIn feed', ARRAY['profile', 'connections']),
('linkedin-sales-navigator', 'LinkedIn Sales Navigator', 'Advanced LinkedIn prospecting with Sales Navigator', 'social', true, true, '/sales/homepage', 'Verify Sales Navigator access', ARRAY['sales_nav', 'advanced_search']),
('x-twitter', 'X (Twitter)', 'Scrape Twitter profiles, tweets, and followers', 'social', true, true, '/settings/account', 'Check Twitter account access', ARRAY['profile', 'tweets']),
('facebook-groups', 'Facebook Groups', 'Extract members and posts from Facebook groups', 'social', true, true, '/groups/feed/', 'Verify Facebook groups access', ARRAY['groups', 'members']),
('facebook-pages', 'Facebook Pages', 'Scrape Facebook business pages and insights', 'social', true, true, '/pages/', 'Check Facebook pages access', ARRAY['pages', 'insights']),
('instagram-basic', 'Instagram', 'Scrape Instagram profiles and posts', 'social', true, true, '/accounts/edit/', 'Verify Instagram account access', ARRAY['profile', 'posts']),
('reddit-auth', 'Reddit', 'Extract Reddit posts, comments, and user data', 'social', true, true, '/api/me.json', 'Check Reddit API access', ARRAY['read', 'identity']),

-- Maps & Local Business
('google-maps', 'Google Maps', 'Scrape business listings from Google Maps', 'maps', true, true, '/maps/search/', 'Verify Google Maps access', ARRAY['places', 'reviews']),
('maps-business-details', 'Google My Business', 'Extract detailed business information', 'maps', true, true, '/business/', 'Check Google My Business access', ARRAY['business', 'reviews']),

-- Job Boards
('indeed-jobs', 'Indeed', 'Scrape job postings and company data from Indeed', 'jobs', true, true, '/account/myaccount', 'Verify Indeed account access', ARRAY['jobs', 'companies']),
('glassdoor', 'Glassdoor', 'Extract company reviews and salary data', 'jobs', true, true, '/member/home/', 'Check Glassdoor member access', ARRAY['reviews', 'salaries']),
('stackoverflow-jobs', 'Stack Overflow Jobs', 'Scrape developer job postings', 'jobs', true, true, '/users/current', 'Verify Stack Overflow access', ARRAY['jobs', 'developers']),

-- Enrichment APIs
('apollo-portal', 'Apollo.io', 'B2B contact and company enrichment', 'enrichment', true, true, '/api/v1/auth/health', 'Check Apollo API access', ARRAY['contacts', 'companies']),
('contactout', 'ContactOut', 'Email finder and contact enrichment', 'enrichment', true, true, '/api/user/me', 'Verify ContactOut access', ARRAY['emails', 'contacts']),
('hunter-io', 'Hunter.io', 'Email finder and verification service', 'enrichment', false, false, '/v2/account', 'Check Hunter.io API key', ARRAY['email_finder', 'verifier']),
('people-data-labs', 'People Data Labs', 'Person and company enrichment API', 'enrichment', false, false, '/v5/person/search', 'Verify PDL API access', ARRAY['person', 'company']),
('dropcontact', 'Dropcontact', 'Email enrichment and verification', 'enrichment', false, false, '/batch', 'Check Dropcontact API', ARRAY['enrichment', 'verification']),

-- Search & Data
('serper-bing', 'Serper (Bing)', 'Bing search API for lead discovery', 'search', false, false, '/search', 'Test Serper API key', ARRAY['search', 'results']),
('github-scraper', 'GitHub', 'Scrape GitHub profiles and repositories', 'developer', true, true, '/user', 'Check GitHub authentication', ARRAY['profile', 'repos']),
('google-scholar', 'Google Scholar', 'Academic paper and author search', 'academic', true, true, '/scholar', 'Verify Scholar access', ARRAY['papers', 'authors']),
('ycombinator-hn', 'Hacker News', 'Scrape Hacker News posts and users', 'community', false, false, NULL, 'No authentication required', ARRAY['posts', 'users']),

-- Business Intelligence
('crunchbase', 'Crunchbase', 'Company funding and startup data', 'business', true, true, '/discover/companies', 'Check Crunchbase access', ARRAY['companies', 'funding']),
('angellist', 'AngelList', 'Startup and investor information', 'business', true, true, '/discover', 'Verify AngelList access', ARRAY['startups', 'investors']);

-- Insert Actor Fields for each actor
-- LinkedIn Basic
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('linkedin-basic', 'li_at', 'li_at Cookie', 'cookie', true, true, 'AQEDATXNspAAAAA...', 'Main LinkedIn authentication cookie', 1),
('linkedin-basic', 'JSESSIONID', 'JSESSIONID Cookie', 'cookie', true, true, 'ajax:1234567890', 'LinkedIn session identifier', 2),
('linkedin-basic', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 3),
('linkedin-basic', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'li_at=AQEDATXNspAAAAA...; JSESSIONID=ajax:1234...', 'Paste entire cookie string from browser', 4);

-- LinkedIn Sales Navigator
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('linkedin-sales-navigator', 'li_at', 'li_at Cookie', 'cookie', true, true, 'AQEDATXNspAAAAA...', 'LinkedIn authentication cookie', 1),
('linkedin-sales-navigator', 'JSESSIONID', 'JSESSIONID Cookie', 'cookie', true, true, 'ajax:1234567890', 'LinkedIn session identifier', 2),
('linkedin-sales-navigator', 'li_a', 'li_a Cookie', 'cookie', false, true, 'AQEDATXNspBBBB...', 'Additional LinkedIn auth cookie (sometimes required)', 3),
('linkedin-sales-navigator', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 4),
('linkedin-sales-navigator', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'li_at=AQEDATXNspAAAAA...; JSESSIONID=ajax:1234...', 'Paste entire cookie string from browser', 5);

-- X (Twitter)
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('x-twitter', 'auth_token', 'auth_token Cookie', 'cookie', true, true, 'a1b2c3d4e5f6...', 'Twitter authentication token', 1),
('x-twitter', 'ct0', 'ct0 Cookie', 'cookie', true, true, 'f6e5d4c3b2a1...', 'Twitter CSRF token', 2),
('x-twitter', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 3),
('x-twitter', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'auth_token=a1b2c3...; ct0=f6e5d4...', 'Paste entire cookie string from browser', 4);

-- Facebook Groups
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('facebook-groups', 'c_user', 'c_user Cookie', 'cookie', true, true, '1234567890', 'Facebook user ID cookie', 1),
('facebook-groups', 'xs', 'xs Cookie', 'cookie', true, true, '12%3Aabcdefghijklmnop', 'Facebook session cookie', 2),
('facebook-groups', 'fr', 'fr Cookie', 'cookie', true, true, '0abcdefghijklmnop...', 'Facebook request cookie', 3),
('facebook-groups', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 4),
('facebook-groups', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'c_user=1234567890; xs=12%3Aabc...', 'Paste entire cookie string from browser', 5);

-- Facebook Pages
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('facebook-pages', 'c_user', 'c_user Cookie', 'cookie', true, true, '1234567890', 'Facebook user ID cookie', 1),
('facebook-pages', 'xs', 'xs Cookie', 'cookie', true, true, '12%3Aabcdefghijklmnop', 'Facebook session cookie', 2),
('facebook-pages', 'fr', 'fr Cookie', 'cookie', true, true, '0abcdefghijklmnop...', 'Facebook request cookie', 3),
('facebook-pages', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 4),
('facebook-pages', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'c_user=1234567890; xs=12%3Aabc...', 'Paste entire cookie string from browser', 5);

-- Instagram
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('instagram-basic', 'sessionid', 'sessionid Cookie', 'cookie', true, true, '1234567890%3AabcdefG...', 'Instagram session cookie', 1),
('instagram-basic', 'csrftoken', 'csrftoken Cookie', 'cookie', true, true, 'abcdefghijklmnopqrstuvwxyz', 'Instagram CSRF token', 2),
('instagram-basic', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 3),
('instagram-basic', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'sessionid=1234567890%3Aabc...; csrftoken=abc...', 'Paste entire cookie string from browser', 4);

-- Reddit
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('reddit-auth', 'reddit_session', 'reddit_session Cookie', 'cookie', false, true, '1234567890-abcdefghijklmnop', 'Reddit session cookie', 1),
('reddit-auth', 'oauth_token', 'OAuth Token', 'password', false, true, 'bearer_token_here', 'Reddit OAuth2 access token (alternative)', 2),
('reddit-auth', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 3),
('reddit-auth', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'reddit_session=1234567890-abc...', 'Paste entire cookie string from browser', 4);

-- Google Maps
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('google-maps', 'SAPISID', 'SAPISID Cookie', 'cookie', true, true, 'abcdefghijklmnop/1234567890', 'Google API session ID', 1),
('google-maps', '__Secure-3PSAPISID', '__Secure-3PSAPISID Cookie', 'cookie', true, true, 'abcdefghijklmnop/1234567890', 'Secure Google API session ID', 2),
('google-maps', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 3),
('google-maps', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'SAPISID=abc/123; __Secure-3PSAPISID=abc/123...', 'Paste entire cookie string from browser', 4);

-- Google My Business (reuses Google Maps cookies)
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('maps-business-details', 'SAPISID', 'SAPISID Cookie', 'cookie', true, true, 'abcdefghijklmnop/1234567890', 'Google API session ID', 1),
('maps-business-details', '__Secure-3PSAPISID', '__Secure-3PSAPISID Cookie', 'cookie', true, true, 'abcdefghijklmnop/1234567890', 'Secure Google API session ID', 2),
('maps-business-details', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 3),
('maps-business-details', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'SAPISID=abc/123; __Secure-3PSAPISID=abc/123...', 'Paste entire cookie string from browser', 4);

-- Indeed
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('indeed-jobs', 'CTK', 'CTK Session Cookie', 'cookie', true, true, '1234567890abcdef...', 'Indeed session token', 1),
('indeed-jobs', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 2),
('indeed-jobs', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'CTK=1234567890abc...', 'Paste entire cookie string from browser', 3);

-- Glassdoor
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('glassdoor', 'GDSession', 'GDSession Cookie', 'cookie', true, true, 'abcdefghijklmnop1234567890', 'Glassdoor session cookie', 1),
('glassdoor', 'TS_CSRF', 'TS_CSRF Cookie', 'cookie', true, true, 'csrf_token_here', 'Glassdoor CSRF token', 2),
('glassdoor', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 3),
('glassdoor', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'GDSession=abc123...; TS_CSRF=csrf...', 'Paste entire cookie string from browser', 4);

-- Apollo.io
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('apollo-portal', 'apollo_session', 'Apollo Session Cookie', 'cookie', false, true, 'session_token_here', 'Apollo portal session cookie', 1),
('apollo-portal', 'api_key', 'API Key', 'password', false, true, 'your_apollo_api_key', 'Apollo.io API key (alternative)', 2),
('apollo-portal', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 3),
('apollo-portal', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'apollo_session=session_token...', 'Paste entire cookie string from browser', 4);

-- ContactOut
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('contactout', 'auth_cookie', 'Auth Cookie', 'cookie', true, true, 'auth_token_here', 'ContactOut authentication cookie', 1),
('contactout', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 2),
('contactout', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'auth_cookie=auth_token...', 'Paste entire cookie string from browser', 3);

-- API Key Only Actors
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('hunter-io', 'api_key', 'Hunter.io API Key', 'password', true, true, 'your_hunter_api_key', 'Get from Hunter.io dashboard', 1),
('people-data-labs', 'api_key', 'PDL API Key', 'password', true, true, 'your_pdl_api_key', 'Get from People Data Labs dashboard', 1),
('dropcontact', 'api_key', 'Dropcontact API Key', 'password', true, true, 'your_dropcontact_key', 'Get from Dropcontact dashboard', 1),
('serper-bing', 'api_key', 'Serper API Key', 'password', true, true, 'your_serper_key', 'Get from Serper.dev dashboard', 1);

-- GitHub
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('github-scraper', 'user_session', 'user_session Cookie', 'cookie', false, true, 'session_token_here', 'GitHub session cookie', 1),
('github-scraper', 'access_token', 'Personal Access Token', 'password', false, true, 'ghp_abcdefghijklmnop', 'GitHub personal access token (alternative)', 2),
('github-scraper', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 3),
('github-scraper', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'user_session=session_token...', 'Paste entire cookie string from browser', 4);

-- Stack Overflow
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('stackoverflow-jobs', 'session_cookie', 'Session Cookie', 'cookie', true, true, 'session_value_here', 'Stack Overflow session cookie', 1),
('stackoverflow-jobs', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 2),
('stackoverflow-jobs', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'session_cookie=session_value...', 'Paste entire cookie string from browser', 3);

-- Google Scholar
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('google-scholar', 'google_session', 'Google Session Cookies', 'cookie', true, true, 'session_data_here', 'Google Scholar session cookies', 1),
('google-scholar', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 2),
('google-scholar', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'google_session=session_data...', 'Paste entire cookie string from browser', 3);

-- Crunchbase
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('crunchbase', 'cb_session', 'Crunchbase Session', 'cookie', true, true, 'session_token_here', 'Crunchbase session cookie', 1),
('crunchbase', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 2),
('crunchbase', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'cb_session=session_token...', 'Paste entire cookie string from browser', 3);

-- AngelList
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('angellist', 'al_session', 'AngelList Session', 'cookie', true, true, 'session_token_here', 'AngelList session cookie', 1),
('angellist', 'user_agent', 'User Agent', 'textarea', true, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string', 2),
('angellist', 'raw_cookies', 'Raw Cookie String (Alternative)', 'textarea', false, true, 'al_session=session_token...', 'Paste entire cookie string from browser', 3);

-- Hacker News (no auth required)
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, placeholder, helper_text, field_order) VALUES
('ycombinator-hn', 'user_agent', 'User Agent', 'textarea', false, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', 'Browser user agent string (optional)', 1);