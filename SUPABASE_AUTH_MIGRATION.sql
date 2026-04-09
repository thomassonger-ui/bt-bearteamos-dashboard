-- Run this in Supabase SQL editor
-- Adds auth_user_id to agents table so Supabase Auth users link to agent profiles

ALTER TABLE agents ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS invited_at timestamptz;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS agents_auth_user_id_idx ON agents(auth_user_id);

-- Allow Supabase Auth users to read/update their own agent row
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Agent can read own row"
  ON agents FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY IF NOT EXISTS "Agent can update own row"
  ON agents FOR UPDATE
  USING (auth.uid() = auth_user_id);

-- Service role bypass (used by server-side API routes with service key)
-- No policy needed — service role bypasses RLS by default
