# BearTeam OS Dashboard

Internal agent management dashboard for Bear Team Real Estate.

## Stack
- Next.js 15 App Router (TypeScript) — deployed on Vercel
- Supabase (Postgres) for all data persistence
- OpenAI `gpt-4o-mini` for pipeline chat assistant

## Supabase: `pipeline` table requirements

| Column | Type | Notes |
|--------|------|-------|
| `stage` | `text` | Plain text. No enum. Allowed values: `new_lead`, `attempting_contact`, `contacted`, `appointment_set`, `active_client`, `under_contract`, `closed`, `stalled` |
| `lead_type` | `text` | CHECK constraint: `buyer`, `seller`, `rental`. Must be resolved before insert — the chat assistant will ask for clarification if not provided. |

### Migration (run once in Supabase SQL Editor)
```sql
ALTER TABLE pipeline
  ADD COLUMN IF NOT EXISTS lead_type text
  CHECK (lead_type IN ('buyer', 'seller', 'rental'));
```

## Auth
Agent login validated against `AGENTS` env var (JSON array of `{username, password}`).
Set in Vercel project settings. Username stored in `sessionStorage` as `bt_username` on login.
