/*
  # Populate Actor Registry with 21+ Scraping Actors

  1. Actor Definitions
    - LinkedIn, Sales Navigator, Twitter, Facebook, etc.
    - Each actor defines required fields and validation
    - Cookie-based vs API key-based authentication

  2. Field Definitions
    - Dynamic field rendering based on actor requirements
    - Proper validation and helper text
    - Masked fields for sensitive data
*/

-- Insert Actor Registry entries
INSERT INTO actor_registry (slug, title, description, category, requires_cookies, requires_api_key, verify_endpoint, verify_hint, scopes) VALUES

-- LinkedIn Actors
('linkedin-basic', 'LinkedIn Basic', 'Scrape LinkedIn profiles, connections, and basic company data', 'social', true, false, '/feed/', 'Check if logged into LinkedIn feed', ARRAY['profile_read', 'connections']),
('linkedin-sales-navigator', 'LinkedIn Sales Navigator', 'Advanced LinkedIn prospecting with Sales Navigator features', 'social', true, false, '/sales/homepage', 'Check Sales Navigator access', ARRAY['sales_nav', 'advanced_search']),

-- Twitter/X Actors  
('x-twitter', 'X (Twitter)', 'Scrape Twitter profiles, tweets, and follower data', 'social', true, false, '/home', 'Check Twitter home timeline access', ARRAY['tweets_read', 'profile_read']),

-- Facebook Actors
('facebook-groups', 'Facebook Groups', 'Scrape Facebook group members and posts', 'social', true, false, '/groups/', 'Check Facebook groups access', ARRAY['groups_read']),
('facebook-pages', 'Facebook Pages', 'Scrape Facebook business pages and insights', 'social', true, false, '/pages/', 'Check Facebook pages access', ARRAY['pages_read']),

-- Instagram Actors
('instagram-basic', 'Instagram', 'Scrape Instagram profiles and follower data', 'social', true, false, '/accounts/edit/', 'Check Instagram account access', ARRAY['profile_read']),

-- Reddit Actors
('reddit-auth', 'Reddit', 'Scrape Reddit posts, comments, and user data', 'social', true, false, '/api/me.json', 'Check Reddit API access', ARRAY['read']),

-- Google/Maps Actors
('google-maps', 'Google Maps', 'Scrape Google Maps business listings and reviews', 'maps', true, false, '/maps/', 'Check Google Maps access', ARRAY['places_read']),
('maps-business-details', 'Google My Business', 'Detailed business information from Google Maps', 'maps', true, false, '/maps/place/', 'Check business details access', ARRAY['business_read']),

-- Job Board Actors
('indeed-jobs', 'Indeed Jobs', 'Scrape job postings and company hiring data', 'jobs', true, false, '/account/myaccount', 'Check Indeed account access', ARRAY['jobs_read']),
('glassdoor', 'Glassdoor', 'Company reviews, salaries, and hiring insights', 'jobs', true, false, '/member/home/', 'Check Glassdoor member access', ARRAY['reviews_read', 'salaries_read']),
('stackoverflow-jobs', 'Stack Overflow Jobs', 'Developer job postings and company data', 'jobs', true, false, '/users/current', 'Check Stack Overflow login', ARRAY['jobs_read']),

-- Enrichment API Actors
('apollo-portal', 'Apollo.io', 'B2B contact database and email finder', 'enrichment', true, true, '/api/v1/auth/health', 'Check Apollo API access', ARRAY['contacts_read', 'emails_read']),
('contactout', 'ContactOut', 'Email finder and contact enrichment', 'enrichment', true, false, '/dashboard/', 'Check ContactOut dashboard access', ARRAY['contacts_read']),
('hunter-io', 'Hunter.io', 'Email finder and verification service', 'enrichment', false, true, '/v2/account', 'Check Hunter.io API key', ARRAY['email_finder']),
('people-data-labs', 'People Data Labs', 'Person and company enrichment API', 'enrichment', false, true, '/v5/person/bulk', 'Check PDL API access', ARRAY['person_enrichment']),
('dropcontact', 'Dropcontact', 'Email enrichment and verification', 'enrichment', false, true, '/batch', 'Check Dropcontact API', ARRAY['email_enrichment']),

-- Search API Actors
('serper-bing', 'Serper (Bing)', 'Bing search results via Serper API', 'search', false, true, '/search', 'Check Serper API access', ARRAY['search']),

-- Developer Platform Actors
('github-scraper', 'GitHub', 'Developer profiles and repository data', 'developer', true, false, '/settings/profile', 'Check GitHub profile access', ARRAY['profile_read', 'repos_read']),

-- Academic/Research Actors
('google-scholar', 'Google Scholar', 'Academic profiles and publication data', 'academic', true, false, '/citations', 'Check Scholar profile access', ARRAY['citations_read']),
('ycombinator-hn', 'Hacker News (YC)', 'Startup community posts and user data', 'startup', false, false, '/news', 'Public access, no auth required', ARRAY['public_read']),

-- Additional Specialized Actors
('crunchbase-basic', 'Crunchbase', 'Startup and company funding data', 'business', true, false, '/discover/', 'Check Crunchbase access', ARRAY['companies_read']),
('angellist-talent', 'AngelList Talent', 'Startup job postings and candidate data', 'startup', true, false, '/talent/', 'Check AngelList Talent access', ARRAY['jobs_read']);

-- Insert Actor Field definitions
INSERT INTO actor_fields (actor_slug, field_key, field_label, field_type, is_required, is_masked, helper_text, placeholder, display_order) VALUES

-- LinkedIn Basic Fields
('linkedin-basic', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Chrome DevTools > Application > Cookies', 'li_at=AQEDAReallyLongTokenHere; JSESSIONID=ajax:1234567890; ...', 1),
('linkedin-basic', 'li_at', 'LinkedIn Auth Token (li_at)', 'password', true, true, 'Main LinkedIn authentication cookie', 'AQEDAReallyLongTokenHere', 2),
('linkedin-basic', 'jsessionid', 'Java Session ID (JSESSIONID)', 'password', true, true, 'LinkedIn session identifier', 'ajax:1234567890', 3),
('linkedin-basic', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string from the same session', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- LinkedIn Sales Navigator Fields  
('linkedin-sales-navigator', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Sales Navigator session', 'li_at=AQEDAReallyLongTokenHere; JSESSIONID=ajax:1234567890; li_a=optional...', 1),
('linkedin-sales-navigator', 'li_at', 'LinkedIn Auth Token (li_at)', 'password', true, true, 'Main LinkedIn authentication cookie', 'AQEDAReallyLongTokenHere', 2),
('linkedin-sales-navigator', 'jsessionid', 'Java Session ID (JSESSIONID)', 'password', true, true, 'LinkedIn session identifier', 'ajax:1234567890', 3),
('linkedin-sales-navigator', 'li_a', 'LinkedIn Additional Token (li_a)', 'password', false, true, 'Additional LinkedIn token (sometimes required)', 'AQEDASalesNavTokenHere', 4),
('linkedin-sales-navigator', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 5),

-- X/Twitter Fields
('x-twitter', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Twitter/X session', 'auth_token=1234567890abcdef; ct0=csrf_token_here; ...', 1),
('x-twitter', 'auth_token', 'Auth Token', 'password', true, true, 'Twitter authentication token', '1234567890abcdef1234567890abcdef', 2),
('x-twitter', 'ct0', 'CSRF Token (ct0)', 'password', true, true, 'Twitter CSRF protection token', 'csrf_token_here_1234567890', 3),
('x-twitter', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- Facebook Groups Fields
('facebook-groups', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Facebook session', 'c_user=123456789; xs=session_token; fr=facebook_token; ...', 1),
('facebook-groups', 'c_user', 'User ID (c_user)', 'password', true, true, 'Facebook user identifier', '123456789', 2),
('facebook-groups', 'xs', 'Session Token (xs)', 'password', true, true, 'Facebook session token', 'session_token_here', 3),
('facebook-groups', 'fr', 'Facebook Token (fr)', 'password', true, true, 'Facebook authentication token', 'facebook_token_here', 4),
('facebook-groups', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 5),

-- Facebook Pages Fields (same as groups)
('facebook-pages', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Facebook session', 'c_user=123456789; xs=session_token; fr=facebook_token; ...', 1),
('facebook-pages', 'c_user', 'User ID (c_user)', 'password', true, true, 'Facebook user identifier', '123456789', 2),
('facebook-pages', 'xs', 'Session Token (xs)', 'password', true, true, 'Facebook session token', 'session_token_here', 3),
('facebook-pages', 'fr', 'Facebook Token (fr)', 'password', true, true, 'Facebook authentication token', 'facebook_token_here', 4),
('facebook-pages', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 5),

-- Instagram Fields
('instagram-basic', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Instagram session', 'sessionid=session_here; csrftoken=csrf_here; ...', 1),
('instagram-basic', 'sessionid', 'Session ID', 'password', true, true, 'Instagram session identifier', 'session_id_here', 2),
('instagram-basic', 'csrftoken', 'CSRF Token', 'password', true, true, 'Instagram CSRF token', 'csrf_token_here', 3),
('instagram-basic', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- Reddit Fields
('reddit-auth', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Reddit session', 'reddit_session=session_token; ...', 1),
('reddit-auth', 'reddit_session', 'Reddit Session', 'password', false, true, 'Reddit session cookie', 'session_token_here', 2),
('reddit-auth', 'oauth_token', 'OAuth Token', 'password', false, true, 'Reddit OAuth token (alternative to cookies)', 'oauth_token_here', 3),
('reddit-auth', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- Google Maps Fields
('google-maps', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Google Maps session', 'SAPISID=token; __Secure-3PSAPISID=token; ...', 1),
('google-maps', 'sapisid', 'SAPISID Cookie', 'password', true, true, 'Google API session identifier', 'sapisid_token_here', 2),
('google-maps', 'secure_3psapisid', '__Secure-3PSAPISID Cookie', 'password', true, true, 'Secure Google API session identifier', 'secure_token_here', 3),
('google-maps', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- Google My Business (reuses Google Maps auth)
('maps-business-details', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Google Maps/Business session', 'SAPISID=token; __Secure-3PSAPISID=token; ...', 1),
('maps-business-details', 'sapisid', 'SAPISID Cookie', 'password', true, true, 'Google API session identifier', 'sapisid_token_here', 2),
('maps-business-details', 'secure_3psapisid', '__Secure-3PSAPISID Cookie', 'password', true, true, 'Secure Google API session identifier', 'secure_token_here', 3),
('maps-business-details', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- Indeed Jobs Fields
('indeed-jobs', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Indeed session', 'CTK=session_token; ...', 1),
('indeed-jobs', 'ctk', 'CTK Session Token', 'password', true, true, 'Indeed session token', 'ctk_session_token_here', 2),
('indeed-jobs', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 3),

-- Glassdoor Fields
('glassdoor', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Glassdoor session', 'GDSession=session; TS012345=token; ...', 1),
('glassdoor', 'gdsession', 'GD Session', 'password', true, true, 'Glassdoor session cookie', 'gd_session_token', 2),
('glassdoor', 'ts_token', 'TS Token', 'password', true, true, 'Glassdoor TS token (varies)', 'ts_token_here', 3),
('glassdoor', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- Apollo Portal Fields (hybrid: cookies + API key)
('apollo-portal', 'api_key', 'Apollo API Key', 'password', false, true, 'Apollo.io API key for programmatic access', 'apollo_api_key_here', 1),
('apollo-portal', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Alternative: paste cookies from Apollo portal session', 'apollographql.session=session; ...', 2),
('apollo-portal', 'session_cookie', 'Apollo Session', 'password', false, true, 'Apollo portal session cookie', 'apollo_session_here', 3),
('apollo-portal', 'user_agent', 'User Agent', 'text', false, false, 'Browser User-Agent string (for cookie auth)', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- ContactOut Fields
('contactout', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from ContactOut session', 'session_cookie=value; auth_token=token; ...', 1),
('contactout', 'session_cookie', 'Session Cookie', 'password', true, true, 'ContactOut session cookie (name may vary)', 'session_cookie_value', 2),
('contactout', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 3),

-- API-only Actors
('hunter-io', 'api_key', 'Hunter.io API Key', 'password', true, true, 'Your Hunter.io API key from dashboard', 'hunter_api_key_here', 1),
('people-data-labs', 'api_key', 'PDL API Key', 'password', true, true, 'People Data Labs API key', 'pdl_api_key_here', 1),
('dropcontact', 'api_key', 'Dropcontact API Key', 'password', true, true, 'Dropcontact API key from dashboard', 'dropcontact_api_key_here', 1),
('serper-bing', 'api_key', 'Serper API Key', 'password', true, true, 'Serper.dev API key for Bing search', 'serper_api_key_here', 1),

-- GitHub Fields
('github-scraper', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from GitHub session', 'user_session=session; __Host-user_session_same_site=token; ...', 1),
('github-scraper', 'user_session', 'User Session', 'password', true, true, 'GitHub user session cookie', 'user_session_token', 2),
('github-scraper', 'github_token', 'GitHub Token', 'password', false, true, 'GitHub personal access token (alternative)', 'ghp_token_here', 3),
('github-scraper', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- Stack Overflow Fields
('stackoverflow-jobs', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Stack Overflow session', 'acct=session; prov=provider; ...', 1),
('stackoverflow-jobs', 'acct', 'Account Cookie', 'password', true, true, 'Stack Overflow account cookie', 'account_cookie_here', 2),
('stackoverflow-jobs', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 3),

-- Google Scholar Fields
('google-scholar', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Google Scholar session', 'GSP=session; SID=token; ...', 1),
('google-scholar', 'gsp', 'Google Scholar Session (GSP)', 'password', true, true, 'Google Scholar session cookie', 'gsp_session_here', 2),
('google-scholar', 'sid', 'Session ID (SID)', 'password', true, true, 'Google session identifier', 'sid_token_here', 3),
('google-scholar', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 4),

-- Crunchbase Fields
('crunchbase-basic', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from Crunchbase session', '_crunchbase_session=session; ...', 1),
('crunchbase-basic', 'crunchbase_session', 'Crunchbase Session', 'password', true, true, 'Crunchbase session cookie', 'crunchbase_session_here', 2),
('crunchbase-basic', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 3),

-- AngelList Fields
('angellist-talent', 'raw_cookie_string', 'Raw Cookie String', 'textarea', false, true, 'Paste entire cookie string from AngelList session', '_angellist_session=session; ...', 1),
('angellist-talent', 'angellist_session', 'AngelList Session', 'password', true, true, 'AngelList session cookie', 'angellist_session_here', 2),
('angellist-talent', 'user_agent', 'User Agent', 'text', true, false, 'Browser User-Agent string', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...', 3);

-- No fields needed for Hacker News (public access)
-- ycombinator-hn requires no authentication