/*
  # Create Intent Discovery Tables

  1. New Tables
    - `intent_runs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `goal` (text)
      - `niche` (text)
      - `signals` (text array)
      - `actors_used` (text array)
      - `leads_found` (integer)
      - `cost_usd` (numeric)
      - `status` (text)
      - `created_at` (timestamp)
      - `completed_at` (timestamp)
    - `lead_import_jobs`
      - For tracking import operations from lists to campaigns

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Intent runs table
CREATE TABLE IF NOT EXISTS public.intent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal text NOT NULL,
  niche text,
  signals text[] DEFAULT '{}',
  actors_used text[] DEFAULT '{}',
  leads_found integer DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  status text DEFAULT 'running',
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Lead import jobs table
CREATE TABLE IF NOT EXISTS public.lead_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  target_campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  leads_selected integer DEFAULT 0,
  leads_imported integer DEFAULT 0,
  leads_skipped integer DEFAULT 0,
  duplicate_handling text DEFAULT 'skip',
  status text DEFAULT 'processing',
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_intent_runs_user_id ON public.intent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_intent_runs_status ON public.intent_runs(status);
CREATE INDEX IF NOT EXISTS idx_intent_runs_created_at ON public.intent_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_import_jobs_user_id ON public.lead_import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_import_jobs_status ON public.lead_import_jobs(status);

-- Enable RLS
ALTER TABLE public.intent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own intent runs"
  ON public.intent_runs
  FOR ALL
  TO authenticated
  USING (user_id = uid())
  WITH CHECK (user_id = uid());

CREATE POLICY "Users can manage their own import jobs"
  ON public.lead_import_jobs
  FOR ALL
  TO authenticated
  USING (user_id = uid())
  WITH CHECK (user_id = uid());

-- Add constraints
ALTER TABLE public.intent_runs 
ADD CONSTRAINT intent_runs_status_check 
CHECK (status IN ('running', 'completed', 'failed'));

ALTER TABLE public.lead_import_jobs 
ADD CONSTRAINT lead_import_jobs_status_check 
CHECK (status IN ('processing', 'completed', 'failed', 'completed_with_errors'));

ALTER TABLE public.lead_import_jobs 
ADD CONSTRAINT lead_import_jobs_duplicate_handling_check 
CHECK (duplicate_handling IN ('skip', 'update', 'create_new'));