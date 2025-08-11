/*
  # Create Essential Intent Discovery Tables

  1. New Tables
    - `intent_runs` - Track intent discovery runs
    - `discovered_leads` - Store discovered leads from intent discovery
    
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Create intent_runs table
CREATE TABLE IF NOT EXISTS public.intent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text NOT NULL,
  niche text,
  signals text[] DEFAULT '{}',
  actors_used text[] DEFAULT '{}',
  leads_found integer DEFAULT 0,
  cost_usd numeric DEFAULT 0.0,
  status text DEFAULT 'running' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  seed_queries text[] DEFAULT '{}',
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
  intent_score numeric DEFAULT 0.0 NOT NULL,
  tags text[] DEFAULT '{}',
  reasons text[] DEFAULT '{}',
  raw jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.intent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_leads ENABLE ROW LEVEL SECURITY;

-- Create policies for intent_runs
CREATE POLICY "Users can view their own intent runs" ON public.intent_runs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own intent runs" ON public.intent_runs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own intent runs" ON public.intent_runs
  FOR UPDATE USING (user_id = auth.uid());

-- Create policies for discovered_leads
CREATE POLICY "Users can view their own discovered leads" ON public.discovered_leads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own discovered leads" ON public.discovered_leads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own discovered leads" ON public.discovered_leads
  FOR UPDATE USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_intent_runs_user_id ON public.intent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_intent_runs_status ON public.intent_runs(status);
CREATE INDEX IF NOT EXISTS idx_intent_runs_created_at ON public.intent_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discovered_leads_user_id ON public.discovered_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_discovered_leads_intent_score ON public.discovered_leads(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_leads_created_at ON public.discovered_leads(created_at DESC);