/*
  # Complete Intent Discovery System

  1. New Tables
    - `discovered_leads` - Master leads from intent discovery with deduplication
    - `intent_runs` - Tracking of intent discovery runs and their results
    - `run_items` - Individual lead discoveries within each run
    - `lead_import_jobs` - Tracking imports from lists to campaigns
    - `lead_feedback` - Learning system for actor performance
    - `actor_policy` - AI policy for actor selection and optimization

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data
    - Proper foreign key constraints and indexes

  3. Features
    - Deduplication system via dup_key
    - Intent scoring and source attribution
    - Import job tracking with progress
    - Learning system for continuous improvement
*/

-- Discovered leads table (master leads from intent discovery)
CREATE TABLE IF NOT EXISTS public.discovered_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  dup_key text GENERATED ALWAYS AS (
    coalesce(lower(email),'') || '|' ||
    coalesce(lower(linkedin_url),'') || '|' ||
    coalesce(lower(full_name),'') || '|' ||
    coalesce(lower(company_domain),'') || '|' ||
    coalesce(phone,'')
  ) STORED,
  
  -- People data
  email text,
  first_name text,
  last_name text,
  full_name text,
  title text,
  linkedin_url text,
  phone text,
  
  -- Company data
  company text,
  company_domain text,
  
  -- Geo data
  country text,
  state text,
  city text,
  
  -- Intent & provenance
  source_slug text,
  intent_score numeric DEFAULT 0,
  tags text[] DEFAULT '{}',
  reasons text[] DEFAULT '{}',
  raw jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Intent discovery runs
CREATE TABLE IF NOT EXISTS public.intent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  goal text NOT NULL,
  niche text DEFAULT 'General',
  signals text[] DEFAULT '{}',
  seed_queries text[] DEFAULT '{}',
  actors_used text[] DEFAULT '{}',
  actors_allow text[] DEFAULT '{}',
  leads_found integer DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  budget_max_usd numeric DEFAULT 8,
  explore_ratio numeric DEFAULT 0.10,
  top_k integer DEFAULT 300,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Individual run items (leads found in each run)
CREATE TABLE IF NOT EXISTS public.run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES intent_runs(id) ON DELETE CASCADE,
  discovered_lead_id uuid REFERENCES discovered_leads(id) ON DELETE CASCADE,
  actor_slug text,
  intent_score numeric DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Lead import jobs (tracking exports from lists to campaigns)
CREATE TABLE IF NOT EXISTS public.lead_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  source_list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  target_campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  leads_selected integer DEFAULT 0,
  leads_imported integer DEFAULT 0,
  leads_skipped integer DEFAULT 0,
  duplicate_handling text DEFAULT 'skip' CHECK (duplicate_handling IN ('skip', 'update', 'create_new')),
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'completed_with_errors', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Lead feedback for learning system
CREATE TABLE IF NOT EXISTS public.lead_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid, -- can reference discovered_leads or uploaded_leads
  source_slug text,
  outcome text CHECK (outcome IN ('opened', 'replied', 'booked', 'closed_won', 'invalid', 'bounced')),
  outcome_value numeric DEFAULT 0,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  reward numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Actor policy for AI optimization
CREATE TABLE IF NOT EXISTS public.actor_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  actor_slug text NOT NULL,
  niche text,
  signals text[] DEFAULT '{}',
  performance_score numeric DEFAULT 0.5,
  cost_per_lead numeric DEFAULT 0,
  quality_score numeric DEFAULT 0.5,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add missing columns to existing tables
DO $$
BEGIN
  -- Add intent_score to list_leads if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'list_leads' AND column_name = 'intent_score'
  ) THEN
    ALTER TABLE list_leads ADD COLUMN intent_score numeric DEFAULT 0;
  END IF;

  -- Add source_slug to list_leads if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'list_leads' AND column_name = 'source_slug'
  ) THEN
    ALTER TABLE list_leads ADD COLUMN source_slug text;
  END IF;

  -- Add master_lead_id to list_leads if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'list_leads' AND column_name = 'master_lead_id'
  ) THEN
    ALTER TABLE list_leads ADD COLUMN master_lead_id uuid REFERENCES discovered_leads(id) ON DELETE SET NULL;
  END IF;

  -- Add source_list_id to uploaded_leads if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploaded_leads' AND column_name = 'source_list_id'
  ) THEN
    ALTER TABLE uploaded_leads ADD COLUMN source_list_id uuid REFERENCES lists(id) ON DELETE SET NULL;
  END IF;

  -- Add master_lead_id to uploaded_leads if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploaded_leads' AND column_name = 'master_lead_id'
  ) THEN
    ALTER TABLE uploaded_leads ADD COLUMN master_lead_id uuid REFERENCES discovered_leads(id) ON DELETE SET NULL;
  END IF;

  -- Add import_job_id to uploaded_leads if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploaded_leads' AND column_name = 'import_job_id'
  ) THEN
    ALTER TABLE uploaded_leads ADD COLUMN import_job_id uuid REFERENCES lead_import_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discovered_leads_user_id ON discovered_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_discovered_leads_intent_score ON discovered_leads(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_leads_source_slug ON discovered_leads(source_slug);
CREATE INDEX IF NOT EXISTS idx_discovered_leads_dup_key ON discovered_leads(dup_key);
CREATE INDEX IF NOT EXISTS idx_discovered_leads_company ON discovered_leads(company) WHERE company IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discovered_leads_email ON discovered_leads(email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intent_runs_user_id ON intent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_intent_runs_status ON intent_runs(status);
CREATE INDEX IF NOT EXISTS idx_intent_runs_created_at ON intent_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_run_items_run_id ON run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_run_items_discovered_lead_id ON run_items(discovered_lead_id);
CREATE INDEX IF NOT EXISTS idx_run_items_actor_slug ON run_items(actor_slug);

CREATE INDEX IF NOT EXISTS idx_lead_import_jobs_user_id ON lead_import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_import_jobs_status ON lead_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_lead_import_jobs_source_list_id ON lead_import_jobs(source_list_id);
CREATE INDEX IF NOT EXISTS idx_lead_import_jobs_target_campaign_id ON lead_import_jobs(target_campaign_id);

CREATE INDEX IF NOT EXISTS idx_lead_feedback_user_id ON lead_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_feedback_campaign_id ON lead_feedback(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_feedback_outcome ON lead_feedback(outcome);

CREATE INDEX IF NOT EXISTS idx_actor_policy_user_id ON actor_policy(user_id);
CREATE INDEX IF NOT EXISTS idx_actor_policy_actor_slug ON actor_policy(actor_slug);
CREATE INDEX IF NOT EXISTS idx_actor_policy_niche ON actor_policy(niche);

-- Enable RLS on all new tables
ALTER TABLE discovered_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_policy ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discovered_leads
CREATE POLICY "Users can manage their own discovered leads"
  ON discovered_leads
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for intent_runs
CREATE POLICY "Users can manage their own intent runs"
  ON intent_runs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for run_items
CREATE POLICY "Users can view run items for their runs"
  ON run_items
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM intent_runs 
    WHERE intent_runs.id = run_items.run_id 
    AND intent_runs.user_id = auth.uid()
  ));

-- RLS Policies for lead_import_jobs
CREATE POLICY "Users can manage their own import jobs"
  ON lead_import_jobs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for lead_feedback
CREATE POLICY "Users can manage their own lead feedback"
  ON lead_feedback
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for actor_policy
CREATE POLICY "Users can manage their own actor policies"
  ON actor_policy
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create trigger function for updating updated_at if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER IF NOT EXISTS update_discovered_leads_updated_at_trigger
  BEFORE UPDATE ON discovered_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_actor_policy_updated_at_trigger
  BEFORE UPDATE ON actor_policy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();