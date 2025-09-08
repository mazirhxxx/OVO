/*
  # Create cleaning_sessions table

  1. New Tables
    - `cleaning_sessions`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references users)
      - `avatar_spec` (jsonb, avatar description and specs)
      - `avatar_id` (text, optional label)
      - `batch_id` (text, unique batch identifier)
      - `batch_size` (integer, default 500)
      - `lead_count` (integer, number of leads processed)
      - `status` (text, queued|running|completed|failed)
      - `created_at` (timestamptz)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `summary` (jsonb, results and statistics)

  2. Security
    - Enable RLS on `cleaning_sessions` table
    - Add policy for users to manage their own cleaning sessions

  3. Indexes
    - Index on owner_id for fast user queries
    - Index on status for filtering active sessions
    - Index on batch_id for webhook lookups
*/

CREATE TABLE IF NOT EXISTS cleaning_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  avatar_spec jsonb NOT NULL,
  avatar_id text,
  batch_id text NOT NULL,
  batch_size integer NOT NULL DEFAULT 500,
  lead_count integer,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  summary jsonb,
  CONSTRAINT cleaning_sessions_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed'))
);

-- Enable RLS
ALTER TABLE cleaning_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own cleaning sessions
CREATE POLICY "Users can manage their own cleaning sessions"
  ON cleaning_sessions
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cleaning_sessions_owner_id ON cleaning_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_sessions_status ON cleaning_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cleaning_sessions_batch_id ON cleaning_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_sessions_created_at ON cleaning_sessions(created_at DESC);

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cleaning_sessions_owner_id_fkey'
  ) THEN
    ALTER TABLE cleaning_sessions 
    ADD CONSTRAINT cleaning_sessions_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;