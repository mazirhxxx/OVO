/*
  # Fix Missing Tables for Intent Discovery

  1. New Tables
    - `intent_runs` - Tracks intent discovery runs with goal, status, and results
    - `discovered_leads` - Stores leads found through intent discovery
    - `lead_import_jobs` - Tracks exports from lists to campaigns

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data

  3. Indexes
    - Performance indexes for common queries
*/

-- Create intent_runs table
CREATE TABLE IF NOT EXISTS public.intent_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    goal text NOT NULL,
    niche text,
    signals text[] DEFAULT '{}',
    seed_queries text[] DEFAULT '{}',
    actors_used text[] DEFAULT '{}',
    leads_found integer DEFAULT 0,
    cost_usd numeric DEFAULT 0.0,
    status text DEFAULT 'running' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    budget_max_usd numeric DEFAULT 8.0,
    error_message text
);

-- Create discovered_leads table
CREATE TABLE IF NOT EXISTS public.discovered_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    email text,
    first_name text,
    last_name text,
    full_name text,
    title text,
    linkedin_url text,
    phone text,
    company text,
    company_domain text,
    country text,
    state text,
    city text,
    source_slug text,
    intent_score numeric DEFAULT 0.0,
    tags text[] DEFAULT '{}',
    reasons text[] DEFAULT '{}',
    raw jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create lead_import_jobs table
CREATE TABLE IF NOT EXISTS public.lead_import_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    source_list_id uuid NOT NULL,
    target_campaign_id uuid NOT NULL,
    leads_selected integer DEFAULT 0,
    leads_processed integer DEFAULT 0,
    leads_imported integer DEFAULT 0,
    leads_skipped integer DEFAULT 0,
    duplicate_handling text DEFAULT 'skip',
    status text DEFAULT 'pending',
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.intent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_import_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for intent_runs
CREATE POLICY "Users can manage their own intent runs" ON public.intent_runs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Create RLS policies for discovered_leads
CREATE POLICY "Users can manage their own discovered leads" ON public.discovered_leads
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Create RLS policies for lead_import_jobs
CREATE POLICY "Users can manage their own import jobs" ON public.lead_import_jobs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_intent_runs_user_id ON public.intent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_intent_runs_status ON public.intent_runs(status);
CREATE INDEX IF NOT EXISTS idx_intent_runs_created_at ON public.intent_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discovered_leads_user_id ON public.discovered_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_discovered_leads_intent_score ON public.discovered_leads(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_leads_email ON public.discovered_leads(email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_import_jobs_user_id ON public.lead_import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_import_jobs_status ON public.lead_import_jobs(status);