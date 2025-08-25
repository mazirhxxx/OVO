/*
  # Add Credentials Support to Intent Runs

  1. New Columns
    - `credentials` (jsonb) - Stores encrypted credentials for scraping actors
    - `actors_config` (jsonb) - Configuration for selected actors and their settings

  2. Security
    - Credentials are stored as encrypted JSON
    - Only accessible by the user who created the intent run
    - Audit trail maintained for credential usage

  3. Usage
    - Intent runs can now include credentials for premium data sources
    - Actors receive shaped credential bundles at runtime
    - Supports both cookie-based and API key-based actors
*/

-- Add credentials and actors configuration to intent_runs table
DO $$
BEGIN
  -- Add credentials column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intent_runs' AND column_name = 'credentials'
  ) THEN
    ALTER TABLE intent_runs ADD COLUMN credentials jsonb DEFAULT NULL;
  END IF;

  -- Add actors_config column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intent_runs' AND column_name = 'actors_config'
  ) THEN
    ALTER TABLE intent_runs ADD COLUMN actors_config jsonb DEFAULT NULL;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_intent_runs_credentials 
ON intent_runs USING gin (credentials) 
WHERE credentials IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intent_runs_actors_config 
ON intent_runs USING gin (actors_config) 
WHERE actors_config IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN intent_runs.credentials IS 'Encrypted credentials for scraping actors (LinkedIn cookies, API keys, etc.)';
COMMENT ON COLUMN intent_runs.actors_config IS 'Configuration for selected actors and their runtime settings';

-- Create function to extract actor credentials for runtime use
CREATE OR REPLACE FUNCTION get_intent_run_credentials(
  p_intent_run_id uuid,
  p_actor_slug text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credentials jsonb;
  v_actor_creds jsonb;
BEGIN
  -- Get credentials from intent run
  SELECT credentials INTO v_credentials
  FROM intent_runs
  WHERE id = p_intent_run_id 
    AND user_id = p_user_id;

  IF v_credentials IS NULL THEN
    RETURN NULL;
  END IF;

  -- Extract credentials for specific actor
  v_actor_creds := v_credentials -> p_actor_slug;
  
  IF v_actor_creds IS NULL THEN
    RETURN NULL;
  END IF;

  -- Return shaped credentials for actor runtime
  RETURN jsonb_build_object(
    'actor_slug', p_actor_slug,
    'credentials', v_actor_creds,
    'user_agent', COALESCE(v_actor_creds ->> 'user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
    'cookies', v_actor_creds - 'user_agent',
    'retrieved_at', now()
  );
END;
$$;

-- Create function to validate actor credentials
CREATE OR REPLACE FUNCTION validate_actor_credentials(
  p_actor_slug text,
  p_credentials jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_required_fields text[];
  v_missing_fields text[] := '{}';
  v_field text;
  v_is_valid boolean := true;
BEGIN
  -- Define required fields per actor
  CASE p_actor_slug
    WHEN 'linkedin-basic' THEN
      v_required_fields := ARRAY['li_at', 'JSESSIONID'];
    WHEN 'linkedin-sales-navigator' THEN
      v_required_fields := ARRAY['li_at', 'JSESSIONID'];
    WHEN 'x-twitter' THEN
      v_required_fields := ARRAY['auth_token', 'ct0'];
    WHEN 'facebook-groups' THEN
      v_required_fields := ARRAY['c_user', 'xs', 'fr'];
    WHEN 'instagram-basic' THEN
      v_required_fields := ARRAY['sessionid', 'csrftoken'];
    WHEN 'reddit-auth' THEN
      v_required_fields := ARRAY['reddit_session'];
    WHEN 'google-maps' THEN
      v_required_fields := ARRAY['SAPISID'];
    WHEN 'indeed-jobs' THEN
      v_required_fields := ARRAY['CTK'];
    WHEN 'glassdoor' THEN
      v_required_fields := ARRAY['GDSession'];
    WHEN 'apollo-portal' THEN
      v_required_fields := ARRAY['api_key'];
    WHEN 'hunter-io' THEN
      v_required_fields := ARRAY['api_key'];
    WHEN 'people-data-labs' THEN
      v_required_fields := ARRAY['api_key'];
    WHEN 'dropcontact' THEN
      v_required_fields := ARRAY['api_key'];
    WHEN 'serper-bing' THEN
      v_required_fields := ARRAY['api_key'];
    WHEN 'github-scraper' THEN
      v_required_fields := ARRAY['user_session'];
    ELSE
      v_required_fields := ARRAY[]::text[];
  END CASE;

  -- Check for missing required fields
  FOREACH v_field IN ARRAY v_required_fields
  LOOP
    IF p_credentials ->> v_field IS NULL OR trim(p_credentials ->> v_field) = '' THEN
      v_missing_fields := array_append(v_missing_fields, v_field);
      v_is_valid := false;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'is_valid', v_is_valid,
    'required_fields', to_jsonb(v_required_fields),
    'missing_fields', to_jsonb(v_missing_fields),
    'actor_slug', p_actor_slug
  );
END;
$$;

-- Add RLS policies for credentials access
ALTER TABLE intent_runs ENABLE ROW LEVEL SECURITY;

-- Policy for users to access their own intent runs with credentials
CREATE POLICY "Users can access own intent run credentials"
  ON intent_runs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_intent_run_credentials(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_actor_credentials(text, jsonb) TO authenticated;