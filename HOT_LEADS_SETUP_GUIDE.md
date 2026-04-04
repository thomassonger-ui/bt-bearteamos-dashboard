# Hot Leads Setup Guide

Complete setup for the Apify → n8n → Supabase → Dashboard pipeline.

---

## Step 1: Run the Supabase Migration

1. Go to **Supabase Dashboard** → SQL Editor
2. Open `SUPABASE_HOT_LEADS_MIGRATION.sql`
3. Copy the entire contents and paste into a new query
4. Click **Run**
5. Verify: go to Table Editor → `pipeline` table → you should see new columns (`lead_source`, `hot_lead_type`, `urgency`, etc.)
6. Verify: a new `hot_lead_sources` table should exist with 5 rows

---

## Step 2: Import the n8n Workflow

1. Log into your **n8n** account
2. Go to **Workflows** → **Import from File**
3. Select `n8n-hot-leads-workflow.json`
4. The workflow will appear with 5 nodes:
   - **Apify Webhook** — receives data from Apify
   - **Normalize Leads** — standardizes different actor formats
   - **Deduplicate** — removes duplicates within batch
   - **Send to BearTeamOS** — POSTs to your dashboard webhook
   - **Log Results** — tracks what happened
5. Set environment variables in n8n (Settings → Variables):
   - `BEARTEAM_DASHBOARD_URL` = your Vercel dashboard URL (e.g. `https://bearteam-os.vercel.app`)
   - `BEARTEAM_API_KEY` = the value of `INTERNAL_API_KEY` from your dashboard `.env.local`
6. **Activate the workflow** (toggle on)
7. Copy the **Webhook URL** from the "Apify Webhook" node — you'll need this for Step 3

---

## Step 3: Set Up Apify Actors

For each scraper, do the following in **Apify Console**:

### 3a. Facebook Marketplace
1. Go to Apify Store → search `apify/facebook-marketplace-scraper`
2. Click **Try for free** or **Run**
3. Paste the input from `apify-configs/facebook-marketplace.json` (skip `_` prefixed fields)
4. Under **Integrations** → **Webhooks**:
   - Event: `ACTOR.RUN.SUCCEEDED`
   - URL: Your n8n webhook URL from Step 2
   - Payload: `{"source": "facebook_marketplace", "leads": {{output}}}`
5. Under **Schedules**: Set to daily at 6 AM ET (`0 10 * * *` UTC)

### 3b. Craigslist
1. Actor: `automation-lab/craigslist-scraper`
2. Input: from `apify-configs/craigslist.json`
3. Webhook payload: `{"source": "craigslist", "leads": {{output}}}`
4. Schedule: daily at 7 AM ET (`0 11 * * *` UTC)

### 3c. Google Maps
1. Actor: `compass/crawler-google-places`
2. Input: from `apify-configs/google-maps.json`
3. Webhook payload: `{"source": "google_maps", "leads": {{output}}}`
4. Schedule: weekly Monday 6 AM ET (`0 10 * * 1` UTC)

### 3d. County Appraisal
1. Actor: `great_pistachio/property-tax-scraper`
2. Input: from `apify-configs/county-appraisal.json`
3. Webhook payload: `{"source": "county_appraisal", "leads": {{output}}}`
4. Schedule: weekly Wednesday 6 AM ET (`0 10 * * 3` UTC)
5. **Note:** This actor may not cover Orange/Seminole/Osceola directly. You may need to use a generic web scraper for those county appraiser sites.

### 3e. Newspaper
1. Actor: `lukaskrivka/article-extractor-smart`
2. Input: from `apify-configs/newspaper.json`
3. Webhook payload: `{"source": "newspaper", "leads": {{output}}}`
4. Schedule: daily at 5 AM ET (`0 9 * * *` UTC)

---

## Step 4: Test the Pipeline

1. In Apify, manually run one actor (start with Craigslist — it's the most reliable)
2. Watch your n8n workflow execution log — you should see:
   - Webhook received
   - Leads normalized
   - Duplicates removed
   - POST to BearTeamOS succeeded
3. Go to your dashboard → **Hot Leads** page
4. You should see leads appearing with urgency badges, source tags, and type classifications

---

## Step 5: Verify in Supabase

1. Go to Supabase → Table Editor → `pipeline`
2. Filter by `is_hot_lead = true`
3. You should see rows with populated `lead_source`, `hot_lead_type`, `urgency`, etc.
4. Check `hot_lead_sources` table — `last_run_at` and `leads_found` should be updated

---

## Architecture Reference

```
Apify Actors (5 scrapers)
    ↓ webhook on run success
n8n Workflow
    ↓ normalize → dedupe → POST
BearTeamOS API (/api/hot-leads-webhook)
    ↓ classify urgency/type → upsert
Supabase (pipeline table, is_hot_lead=true)
    ↓ query
Hot Leads Dashboard Page
```

## Troubleshooting

- **No leads appearing?** Check n8n execution log for errors. Verify webhook URL is correct.
- **401 Unauthorized?** Make sure `BEARTEAM_API_KEY` in n8n matches `INTERNAL_API_KEY` in dashboard `.env.local`.
- **Duplicates?** The system deduplicates by `source_id`. If you're seeing duplicates, the actors may be returning different IDs for the same listing.
- **Facebook scraper failing?** Meta frequently blocks scrapers. Try residential proxies in Apify settings.
- **County sites not working?** These have custom portals. You may need a tailored Apify actor or direct scraper.

## Cost Estimate (Monthly)

| Source | Frequency | Est. Cost |
|--------|-----------|-----------|
| Facebook Marketplace | Daily | ~$5-10 |
| Craigslist | Daily | ~$3-5 |
| Google Maps | Weekly | ~$2-3 |
| County Appraisal | Weekly | ~$2-3 |
| Newspaper | Daily | ~$2-3 |
| **Total** | | **~$15-25/mo** |

Apify free tier ($5/mo credit) covers light usage. Scale up as needed.
