# Apify Actor Configurations for BearTeamOS Hot Leads

Each JSON file below is the input configuration for an Apify actor.
Paste these into the actor's input settings in Apify Console.

## Actors

| File | Actor | Source |
|------|-------|--------|
| `facebook-marketplace.json` | `apify/facebook-marketplace-scraper` | Facebook Marketplace |
| `craigslist.json` | `automation-lab/craigslist-scraper` | Craigslist |
| `google-maps.json` | `compass/crawler-google-places` | Google Maps |
| `county-appraisal.json` | `great_pistachio/property-tax-scraper` | County Tax Records |
| `newspaper.json` | `lukaskrivka/article-extractor-smart` | Orlando Sentinel |

## Webhook Setup

Each actor should have a webhook configured to send results to your n8n workflow:

1. In Apify Console, go to the actor run settings
2. Under "Integrations" or "Webhooks", add:
   - **Event:** Run succeeded
   - **URL:** Your n8n webhook URL (from the workflow)
   - **Payload template:** See each config file for the recommended format
