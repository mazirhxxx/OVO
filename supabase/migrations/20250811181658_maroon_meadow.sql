/*
  # Intent Discovery System - Independent Tables

  1. New Tables
    - `discovered_leads` - Master leads from intent discovery (normalized, deduped)
    - `intent_runs` - Track orchestrator runs and performance
    - `lead_feedback` - Learning signals for actor improvement
    - `actor_policy` - Per-user bandit weights for actor selection
    - `apollo_files` - Track Apollo CSV uploads and processing

  2. Security
    - Enable RLS on all new tables
    - Add policies for user-scoped access
    - Service key access for n8n orchestrator

  3. Features
    - Complete deduplication via dup_key
    - Intent scoring and source attribution
    - Learning system for actor performance
    - Apollo CSV ingestion tracking
*/

-- Master leads table (normalized, deduped)
CREATE TABLE IF NOT EXISTS public.discovered_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  raw jsonb,
  user_id uuid REFERENCES users(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discovered_leads_dup_key_uidx ON public.discovered_leads(dup_key);
CREATE INDEX IF NOT EXISTS discovered_leads_user_id_idx ON public.discovered_leads(user_id);
CREATE INDEX IF NOT EXISTS discovered_leads_intent_score_idx ON public.discovered_leads(intent_score DESC);
CREATE INDEX IF NOT EXISTS discovered_leads_source_idx ON public.discovered_leads(source_slug);

-- Intent discovery runs
CREATE TABLE IF NOT EXISTS public.intent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  goal text,
  niche text,
  signals text[] DEFAULT '{}',
  seed_queries text[] DEFAULT '{}',
  actors_used text[] DEFAULT '{}',
  actors_planned jsonb,
  leads_found integer DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  budget_max_usd numeric DEFAULT 8,
  explore_ratio numeric DEFAULT 0.10,
  status text DEFAULT 'running',
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS intent_runs_user_id_idx ON public.intent_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intent_runs_status_idx ON public.intent_runs(status);

-- Items generated per run (for analytics + UI feed)
CREATE TABLE IF NOT EXISTS public.run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES intent_runs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  source_slug text,
  score numeric,
  tags text[] DEFAULT '{}',
  reasons text[] DEFAULT '{}',
  lead_data jsonb,
  discovered_lead_id uuid REFERENCES discovered_leads(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS run_items_run_id_idx ON public.run_items(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS run_items_user_id_idx ON public.run_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS run_items_score_idx ON public.run_items(score DESC);

-- Feedback from outreach (learning signal)
CREATE TABLE IF NOT EXISTS public.lead_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid, -- can reference discovered_leads or uploaded_leads
  source_slug text,
  outcome text, -- opened|replied|booked|closed_won|invalid
  outcome_value numeric DEFAULT 0,
  campaign_id uuid REFERENCES campaigns(id),
  user_id uuid REFERENCES users(id),
  reward numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_feedback_user_id_idx ON public.lead_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_feedback_source_idx ON public.lead_feedback(source_slug);
CREATE INDEX IF NOT EXISTS lead_feedback_outcome_idx ON public.lead_feedback(outcome);

-- Actor policy (per-user bandit weights)
CREATE TABLE IF NOT EXISTS public.actor_policy (
  user_id uuid REFERENCES users(id),
  actor_slug text NOT NULL,
  weight_mean numeric DEFAULT 1,
  weight_count integer DEFAULT 0,
  reward numeric DEFAULT 0,
  last_used_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, actor_slug)
);

CREATE INDEX IF NOT EXISTS actor_policy_user_id_idx ON public.actor_policy(user_id);
CREATE INDEX IF NOT EXISTS actor_policy_weight_idx ON public.actor_policy(weight_mean DESC);

-- Apollo file tracking
CREATE TABLE IF NOT EXISTS public.apollo_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  file_path text NOT NULL,
  original_filename text,
  status text DEFAULT 'queued',
  rows_total integer DEFAULT 0,
  rows_inserted integer DEFAULT 0,
  rows_updated integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS apollo_files_user_id_idx ON public.apollo_files(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS apollo_files_status_idx ON public.apollo_files(status);

-- Lead import jobs (track exports from lists to campaigns)
CREATE TABLE IF NOT EXISTS public.lead_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  source_list_id uuid REFERENCES lists(id),
  target_campaign_id uuid REFERENCES campaigns(id),
  leads_selected integer DEFAULT 0,
  leads_imported integer DEFAULT 0,
  leads_skipped integer DEFAULT 0,
  duplicate_handling text DEFAULT 'skip', -- skip|update|create_new
  status text DEFAULT 'processing',
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS lead_import_jobs_user_id_idx ON public.lead_import_jobs(user_id, created_at DESC);

-- Add source tracking to existing tables
ALTER TABLE uploaded_leads ADD COLUMN IF NOT EXISTS source_list_id uuid REFERENCES lists(id);
ALTER TABLE uploaded_leads ADD COLUMN IF NOT EXISTS master_lead_id uuid REFERENCES discovered_leads(id);
ALTER TABLE uploaded_leads ADD COLUMN IF NOT EXISTS import_job_id uuid REFERENCES lead_import_jobs(id);

ALTER TABLE list_leads ADD COLUMN IF NOT EXISTS intent_score numeric DEFAULT 0;
ALTER TABLE list_leads ADD COLUMN IF NOT EXISTS source_slug text;
ALTER TABLE list_leads ADD COLUMN IF NOT EXISTS master_lead_id uuid REFERENCES discovered_leads(id);

-- Enable RLS on new tables
ALTER TABLE discovered_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE apollo_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their discovered leads"
  ON discovered_leads
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their intent runs"
  ON intent_runs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their run items"
  ON run_items
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their feedback"
  ON lead_feedback
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their actor policy"
  ON actor_policy
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their apollo files"
  ON apollo_files
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their import jobs"
  ON lead_import_jobs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Learning trigger function
CREATE OR REPLACE FUNCTION public.apply_policy_event()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.actor_policy(user_id, actor_slug, weight_mean, weight_count, reward, updated_at)
  VALUES(NEW.user_id, NEW.source_slug, NEW.reward, 1, NEW.reward, now())
  ON CONFLICT (user_id, actor_slug) DO UPDATE
  SET weight_mean = (
        (public.actor_policy.weight_mean * public.actor_policy.weight_count + NEW.reward)
        / NULLIF(public.actor_policy.weight_count + 1, 0)
      ),
      weight_count = public.actor_policy.weight_count + 1,
      reward = NEW.reward,
      updated_at = now();
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_feedback_policy ON public.lead_feedback;
CREATE TRIGGER trg_feedback_policy
  AFTER INSERT ON public.lead_feedback
  FOR EACH ROW EXECUTE FUNCTION public.apply_policy_event();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_discovered_leads_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER update_discovered_leads_updated_at_trigger
  BEFORE UPDATE ON public.discovered_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_discovered_leads_updated_at();