/*
  # Add Cleaning and Enrichment Columns to list_leads

  1. New Columns
    - `score` (numeric) - AI scoring for lead quality
    - `label` (text) - Decision label (accept/review/reject)
    - `normalized_title` (text) - Cleaned job title
    - `normalized_industry` (text) - Cleaned industry
    - `reasons` (text) - Reasons for scoring/decision
    - `ai_notes` (text) - AI-generated notes about the lead
    - `batch_id` (text) - Cleaning batch identifier
    - `updated_at` (timestamp) - Last update timestamp

  2. Indexes
    - Index on score for performance
    - Index on label for filtering
    - Index on batch_id for batch operations

  3. Triggers
    - Auto-update updated_at on row changes
*/

-- Add new columns to list_leads table
ALTER TABLE list_leads 
ADD COLUMN IF NOT EXISTS score NUMERIC(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS label TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS normalized_title TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS normalized_industry TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reasons TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_notes TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS batch_id TEXT DEFAULT NULL;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'list_leads' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE list_leads ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_list_leads_score ON list_leads(score) WHERE score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_leads_label ON list_leads(label) WHERE label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_leads_batch_id ON list_leads(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_leads_normalized_title ON list_leads(normalized_title) WHERE normalized_title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_leads_normalized_industry ON list_leads(normalized_industry) WHERE normalized_industry IS NOT NULL;

-- Create or replace the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_list_leads_updated_at_trigger ON list_leads;
CREATE TRIGGER update_list_leads_updated_at_trigger
    BEFORE UPDATE ON list_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN list_leads.score IS 'AI quality score (0.00-1.00)';
COMMENT ON COLUMN list_leads.label IS 'Decision label: accept, review, reject';
COMMENT ON COLUMN list_leads.normalized_title IS 'Cleaned and standardized job title';
COMMENT ON COLUMN list_leads.normalized_industry IS 'Cleaned and standardized industry';
COMMENT ON COLUMN list_leads.reasons IS 'AI reasoning for score and decision';
COMMENT ON COLUMN list_leads.ai_notes IS 'AI-generated notes and insights';
COMMENT ON COLUMN list_leads.batch_id IS 'Cleaning/enrichment batch identifier';