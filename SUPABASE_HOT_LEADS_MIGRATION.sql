-- ============================================================
-- BearTeamOS — Hot Leads Migration
-- Run this in Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1. ADD HOT LEAD COLUMNS TO PIPELINE TABLE
alter table pipeline
  add column if not exists lead_source      text,
  add column if not exists hot_lead_type    text,
  add column if not exists urgency          text default 'normal',
  add column if not exists arv              numeric,
  add column if not exists property_address text,
  add column if not exists zip_code         text,
  add column if not exists pain_point       text,
  add column if not exists source_url       text,
  add column if not exists source_id        text,
  add column if not exists scraped_at       timestamptz,
  add column if not exists is_hot_lead      boolean default false;

-- 2. INDEXES FOR FAST QUERIES
create index if not exists idx_pipeline_hot_leads
  on pipeline (is_hot_lead, urgency, created_at desc)
  where is_hot_lead = true;

create index if not exists idx_pipeline_source_id
  on pipeline (source_id)
  where source_id is not null;

create index if not exists idx_pipeline_lead_source
  on pipeline (lead_source)
  where lead_source is not null;

create index if not exists idx_pipeline_zip
  on pipeline (zip_code)
  where zip_code is not null;

-- 3. HOT LEAD SOURCES TABLE (track scraper health)
create table if not exists hot_lead_sources (
  id              uuid primary key default gen_random_uuid(),
  source_name     text not null unique,
  apify_actor_id  text,
  is_active       boolean default true,
  last_run_at     timestamptz,
  last_run_status text,
  leads_found     int default 0,
  run_frequency   text default 'daily',
  config          jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 4. SEED SOURCES
insert into hot_lead_sources (source_name, apify_actor_id, run_frequency, config) values
  ('facebook_marketplace', 'apify/facebook-marketplace-scraper', 'daily',
   '{"search_terms": ["house for sale", "property", "land", "fixer upper"], "location": "Orlando, FL", "radius_miles": 50}'::jsonb),
  ('craigslist', 'automation-lab/craigslist-scraper', 'daily',
   '{"sections": ["rea"], "area": "orlando", "search_terms": ["must sell", "motivated", "as-is", "fixer"]}'::jsonb),
  ('google_maps', 'compass/crawler-google-places', 'weekly',
   '{"search_queries": ["we buy houses Orlando", "property management Orlando", "real estate attorney Orlando"], "radius_meters": 50000}'::jsonb),
  ('county_appraisal', 'great_pistachio/property-tax-scraper', 'weekly',
   '{"counties": ["orange", "seminole", "osceola"], "filters": {"delinquent_taxes": true}}'::jsonb),
  ('newspaper', 'lukaskrivka/article-extractor-smart', 'daily',
   '{"urls": ["https://www.orlandosentinel.com"], "keywords": ["foreclosure", "estate sale", "probate", "auction"]}'::jsonb)
on conflict (source_name) do nothing;

-- Done! Run this, then refresh your dashboard.
