-- ============================================================
-- BearTeam OS — Row Level Security Migration
-- Run this once in: Supabase Dashboard > SQL Editor
-- Protects agents, tasks, pipeline, compliance from cross-agent access
-- ============================================================

-- Step 1: Link existing agent rows to their Supabase Auth user IDs
UPDATE agents a
SET auth_user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(a.email)
  AND a.auth_user_id IS NULL;

-- ─── HELPER FUNCTION ─────────────────────────────────────────
-- Returns true if the currently logged-in user is a BearTeam admin.
-- Update this list if admin emails change.
CREATE OR REPLACE FUNCTION is_bt_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.email() IN (
    'tom@bearteam.com',
    'thomas.songer@gmail.com',
    'bethanne@bearteam.com',
    'veronica@bearteam.com'
  )
$$;

-- ─── AGENTS TABLE ────────────────────────────────────────────
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_select_own"   ON agents;
DROP POLICY IF EXISTS "agents_select_admin" ON agents;
DROP POLICY IF EXISTS "agents_update_own"   ON agents;

CREATE POLICY "agents_select_own" ON agents
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "agents_select_admin" ON agents
  FOR SELECT USING (is_bt_admin());

CREATE POLICY "agents_update_own" ON agents
  FOR UPDATE USING (auth_user_id = auth.uid());

-- ─── TASKS TABLE ─────────────────────────────────────────────
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select_own"  ON tasks;
DROP POLICY IF EXISTS "tasks_insert_own"  ON tasks;
DROP POLICY IF EXISTS "tasks_update_own"  ON tasks;
DROP POLICY IF EXISTS "tasks_all_admin"   ON tasks;

CREATE POLICY "tasks_select_own" ON tasks
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "tasks_insert_own" ON tasks
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "tasks_all_admin" ON tasks
  FOR ALL USING (is_bt_admin());

-- ─── PIPELINE TABLE ──────────────────────────────────────────
ALTER TABLE pipeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_select_own"  ON pipeline;
DROP POLICY IF EXISTS "pipeline_insert_own"  ON pipeline;
DROP POLICY IF EXISTS "pipeline_update_own"  ON pipeline;
DROP POLICY IF EXISTS "pipeline_all_admin"   ON pipeline;

CREATE POLICY "pipeline_select_own" ON pipeline
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
    OR is_hot_lead = true
  );

CREATE POLICY "pipeline_insert_own" ON pipeline
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "pipeline_update_own" ON pipeline
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "pipeline_all_admin" ON pipeline
  FOR ALL USING (is_bt_admin());

-- ─── COMPLIANCE TABLE ────────────────────────────────────────
ALTER TABLE compliance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_select_own"  ON compliance;
DROP POLICY IF EXISTS "compliance_update_own"  ON compliance;
DROP POLICY IF EXISTS "compliance_all_admin"   ON compliance;

CREATE POLICY "compliance_select_own" ON compliance
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "compliance_update_own" ON compliance
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "compliance_all_admin" ON compliance
  FOR ALL USING (is_bt_admin());

-- ─── ACTIVITY LOG TABLE ──────────────────────────────────────
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_select_own"  ON activity_log;
DROP POLICY IF EXISTS "activity_log_insert_own"  ON activity_log;
DROP POLICY IF EXISTS "activity_log_all_admin"   ON activity_log;

CREATE POLICY "activity_log_select_own" ON activity_log
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "activity_log_insert_own" ON activity_log
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "activity_log_all_admin" ON activity_log
  FOR ALL USING (is_bt_admin());

-- ─── DONE ─────────────────────────────────────────────────────
-- Server-side API routes use SUPABASE_SERVICE_ROLE_KEY which
-- bypasses RLS automatically — no changes needed there.
-- To add/remove admins later, update the is_bt_admin() function above.
-- ============================================================
