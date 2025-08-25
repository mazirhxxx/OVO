/*
  # Update Lead Status Based on Activity

  1. Purpose
    - Automatically update lead status when outreach activities occur
    - Keep lead status in sync with conversation history
    - Provide accurate status reporting in campaign views

  2. Function
    - Updates uploaded_leads.status based on conversation_history
    - Triggered after conversation_history inserts/updates
    - Maps activities to appropriate status values

  3. Status Logic
    - 'contacted' when AI sends any message
    - 'replied' when lead responds
    - 'booked' when booking_url is set
*/

-- Function to update lead status based on conversation history
CREATE OR REPLACE FUNCTION update_lead_status_from_conversation()
RETURNS TRIGGER AS $$
BEGIN
  -- Update lead status based on conversation activity
  IF NEW.from_role = 'ai' THEN
    -- AI sent a message, mark as contacted
    UPDATE uploaded_leads 
    SET status = 'contacted', updated_at = NOW()
    WHERE id = NEW.lead_id 
    AND status = 'pending';
    
  ELSIF NEW.from_role = 'lead' THEN
    -- Lead replied, mark as replied
    UPDATE uploaded_leads 
    SET status = 'replied', updated_at = NOW()
    WHERE id = NEW.lead_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update lead status
DROP TRIGGER IF EXISTS update_lead_status_trigger ON conversation_history;
CREATE TRIGGER update_lead_status_trigger
  AFTER INSERT ON conversation_history
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_status_from_conversation();

-- Function to update lead status when booking URL is set
CREATE OR REPLACE FUNCTION update_lead_status_from_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- When booking_url is set, mark lead as booked
  IF NEW.booking_url IS NOT NULL AND NEW.booking_url != '' THEN
    UPDATE uploaded_leads 
    SET status = 'booked', updated_at = NOW()
    WHERE id = NEW.lead_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for booking status updates
DROP TRIGGER IF EXISTS update_lead_booking_status_trigger ON uploaded_leads;
CREATE TRIGGER update_lead_booking_status_trigger
  AFTER UPDATE OF booking_url ON uploaded_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_status_from_booking();

-- Update existing leads that have conversation history but still show pending
UPDATE uploaded_leads 
SET status = 'contacted', updated_at = NOW()
WHERE status = 'pending' 
AND id IN (
  SELECT DISTINCT lead_id 
  FROM conversation_history 
  WHERE from_role = 'ai'
);

-- Update leads that have replies
UPDATE uploaded_leads 
SET status = 'replied', updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT lead_id 
  FROM conversation_history 
  WHERE from_role = 'lead'
);

-- Update leads that have bookings
UPDATE uploaded_leads 
SET status = 'booked', updated_at = NOW()
WHERE booking_url IS NOT NULL 
AND booking_url != '';