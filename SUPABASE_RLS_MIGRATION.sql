-- ============================================================
-- BearTeam OS — Row Level Security Migration
-- Run this once in: Supabase Dashboard > SQL Editor
-- Protects agents, tasks, pipeline, compliance from cross-agent access
-- ============================================================

-- 1. Link auth users to agent rows (required for RLS policies)
-- Run this to populate auth_user_id for all existing agents:
UPDATE agents a
SET auth_user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(a.email)
  AND a.auth_user_id IS NULL;

-- ─── AGENTS TABLE ────────────────────────────────────────────
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Agents can only read their own row
CREATE POLICY "agents_select_own" ON agents
  FOR SELECT USING (auth_user_id = auth.uid());

-- Admins can read all agents (for broker view)
CREATE POLICY "agents_select_admin" ON agents
  FOR SELECT USING (
    auth.email() IN (
      SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ','))
    )
  );

-- Agents can only update their own row
CREATE POLICY "agents_update_own" ON agents
  FOR UPDATE USING (auth_user_id = auth.uid());

-- ─── TASKS TABLE ─────────────────────────────────────────────
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Agents can only see/update their own tasks
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

-- Admins can see all tasks
CREATE POLICY "tasks_select_admin" ON tasks
  FOR ALL USING (
    auth.email() IN (
      SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ','))
    )
  );

-- ─── PIPELINE TABLE ──────────────────────────────────────────
ALTER TABLE pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_select_own" ON pipeline
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
    OR is_hot_lead = true  -- hot leads are visible to all agents
  );

CREATE POLICY "pipeline_insert_own" ON pipeline
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "pipeline_update_own" ON pipeline
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

-- Admins can see all pipeline
CREATE POLICY "pipeline_select_admin" ON pipeline
  FOR ALL USING (
    auth.email() IN (
      SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ','))
    )
  );

-- ─── COMPLIANCE TABLE ────────────────────────────────────────
ALTER TABLE compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_select_own" ON compliance
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "compliance_update_own" ON compliance
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

-- Admins can see all compliance
CREATE POLICY "compliance_select_admin" ON compliance
  FOR ALL USING (
    auth.email() IN (
      SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ','))
    )
  );

-- ─── ACTIVITY LOG TABLE ──────────────────────────────────────
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_select_own" ON activity_log
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "activity_log_insert_own" ON activity_log
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE auth_user_id = auth.uid())
  );

-- Admins can see all activity
CREATE POLICY "activity_log_select_admin" ON activity_log
  FOR ALL USING (
    auth.email() IN (
      SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ','))
    )
  );

-- ─── SERVICE ROLE BYPASS ─────────────────────────────────────
-- The SUPABASE_SERVICE_ROLE_KEY used in server-side API routes
-- bypasses RLS automatically — no changes needed for server routes.
-- Only the anon key (used client-side) is subject to these policies.

-- ============================================================
-- IMPORTANT: After running this, set the app.admin_emails setting:
-- Run: ALTER DATABASE postgres SET app.admin_emails = 
--   'tom@bearteam.com,bethanne@bearteam.com,veronica@bearteam.com,thomas.songer@gmail.com';
-- ============================================================
