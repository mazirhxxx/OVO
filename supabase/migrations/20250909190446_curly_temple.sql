-- Add new columns to list_leads table for AI cleaning and analysis
ALTER TABLE list_leads 
ADD COLUMN IF NOT EXISTS score NUMERIC(3,2) CHECK (score >= 0.00 AND score <= 1.00),
ADD COLUMN IF NOT EXISTS label TEXT CHECK (label IN ('accept', 'review', 'reject')),
ADD COLUMN IF NOT EXISTS normalized_title TEXT,
ADD COLUMN IF NOT EXISTS normalized_industry TEXT,
ADD COLUMN IF NOT EXISTS reasons TEXT,
ADD COLUMN IF NOT EXISTS ai_notes TEXT,
ADD COLUMN IF NOT EXISTS batch_id TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_list_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_list_leads_updated_at_trigger ON list_leads;
CREATE TRIGGER update_list_leads_updated_at_trigger
    BEFORE UPDATE ON list_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_list_leads_updated_at();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_list_leads_score ON list_leads(score) WHERE score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_leads_label ON list_leads(label) WHERE label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_leads_batch_id ON list_leads(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_leads_updated_at ON list_leads(updated_at);

-- Add comments for documentation
COMMENT ON COLUMN list_leads.score IS 'AI quality score from 0.00 to 1.00';
COMMENT ON COLUMN list_leads.label IS 'AI decision: accept, review, or reject';
COMMENT ON COLUMN list_leads.normalized_title IS 'Cleaned and standardized job title';
COMMENT ON COLUMN list_leads.normalized_industry IS 'Cleaned and standardized industry';
COMMENT ON COLUMN list_leads.reasons IS 'AI reasoning for score and decision';
COMMENT ON COLUMN list_leads.ai_notes IS 'Additional AI insights and notes';
COMMENT ON COLUMN list_leads.batch_id IS 'Cleaning batch identifier for tracking';