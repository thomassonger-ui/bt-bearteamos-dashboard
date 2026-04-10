import { NextRequest, NextResponse } from 'next/server'
import { upsertHotLead, updateHotLeadSourceStatus } from '@/lib/queries'

const DEFAULT_AGENT_ID = 'e424ecf9-ce0d-4e7f-85e9-286dd9f66e1e'

// Blocklist — skip leads from brokers, investors, wholesalers
const BLOCKLIST = [
  'we buy houses', 'cash offer', 'cash for your', 'investor', 'investment opportunity',
  'wholesale', 'wholesaler', 'brokerage', 'licensed agent', 'licensed realtor',
  'realty company', 'real estate group', 'property management', 'flip this',
  'buy and hold', 'rental property for investors', 'turnkey investment',
  'broker', 'MLS#', 'mls #', 'listed by', 'listing agent',
  'schedule a showing', 'open house hosted by', 'presented by',
]

function isBlocklisted(title: string, desc: string): boolean {
  const text = `${title} ${desc}`.toLowerCase()
  return BLOCKLIST.some(term => text.includes(term))
}

function classifyUrgency(title: string, desc: string, source: string, taxStatus?: string): 'critical' | 'high' | 'normal' | 'low' {
  const text = `${title} ${desc}`.toLowerCase()
  if (taxStatus === 'delinquent') return 'critical'
  if (text.includes('foreclosure') || text.includes('must sell') || text.includes('bank owned')) return 'critical'
  if (text.includes('motivated') || text.includes('as-is') || text.includes('estate sale') || text.includes('probate')) return 'high'
  if (text.includes('fixer') || text.includes('investor') || text.includes('below market')) return 'high'
  if (source === 'county_appraisal') return 'high'
  return 'normal'
}

function classifyLeadType(title: string, desc: string, source: string, taxStatus?: string): string | undefined {
  const text = `${title} ${desc}`.toLowerCase()
  if (text.includes('probate') || text.includes('estate')) return 'probate'
  if (text.includes('foreclosure') || text.includes('pre-foreclosure')) return 'pre_foreclosure'
  if (text.includes('tax delinquent') || text.includes('tax lien') || taxStatus === 'delinquent') return 'tax_delinquent'
  if (text.includes('code violation')) return 'code_violation'
  if (text.includes('hoa lien')) return 'hoa_lien'
  if (text.includes('fsbo') || text.includes('for sale by owner')) return 'fsbo'
  if (text.includes('expired listing')) return 'expired_listing'
  if (text.includes('divorce')) return 'divorce'
  if (source === 'county_appraisal') return 'tax_delinquent'
  return undefined
}

function extractPrice(price?: string | number): number | undefined {
  if (!price) return undefined
  const num = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price
  return isNaN(num) ? undefined : num
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeLead(raw: any, source: string) {
  // Facebook Marketplace format
  if (source === 'facebook_marketplace') {
    const geo = raw.reverse_geocode || raw.location || {}
    const city = typeof geo === 'object' ? (geo.city || geo.display_name || '') : String(geo)
    const state = typeof geo === 'object' ? (geo.state || '') : ''
    return {
      name: raw.marketplace_listing_title || raw.title || raw.name || 'FB Listing',
      title: raw.marketplace_listing_title || raw.title || '',
      description: raw.redacted_description?.text || raw.description || raw.body || '',
      price: raw.listing_price?.amount || raw.price || raw.formatted_price,
      address: city ? `${city}${state ? ', ' + state : ''}` : '',
      zip: typeof geo === 'object' ? (geo.zipcode || '') : '',
      phone: raw.phone || raw.seller?.phone,
      email: raw.email || raw.seller?.email,
      url: raw.url || (raw.id ? `https://www.facebook.com/marketplace/item/${raw.id}` : ''),
      source_id: raw.id || raw.listing_id || raw.url,
      assessed_value: undefined,
      tax_status: undefined,
    }
  }

  // Facebook Groups format
  if (source === 'facebook_groups') {
    return {
      name: (raw.text || raw.message || '').slice(0, 80) || 'FB Group Post',
      title: (raw.text || raw.message || '').slice(0, 80),
      description: raw.text || raw.message || raw.postText || '',
      price: undefined,
      address: '',
      zip: '',
      phone: raw.phone,
      email: raw.email,
      url: raw.url || raw.postUrl || raw.link,
      source_id: raw.postId || raw.id || raw.url,
      assessed_value: undefined,
      tax_status: undefined,
    }
  }

  // Default format (Craigslist, etc.)
  // Craigslist scraper uses: name, location, price, url, description
  const title = raw.title || raw.name || raw.address || raw.propertyAddress || raw.headline || raw.business_name || raw.ownerName || ''
  const desc = raw.description || raw.body || raw.text || raw.content || ''
  // Craigslist: location field has city/neighborhood. Try to build a useful address.
  const rawLocation = raw.location || raw.neighborhood || raw.area || ''
  const rawAddress = raw.address || raw.propertyAddress || raw.street || ''
  const address = rawAddress || rawLocation

  // Build a meaningful name from URL if title is empty (common with Craigslist scraper)
  const urlForName = raw.url || raw.link || raw.website || ''
  let derivedName = title
  if (!derivedName && urlForName) {
    // Extract from craigslist URL like /for-sale/real-estate/123-main-st-12345.html
    const urlPathMatch = urlForName.match(/\/([^/]+?)(?:\.html?)?(?:\?.*)?$/)
    if (urlPathMatch) {
      derivedName = urlPathMatch[1]
        .replace(/-(\d{5})/, ' $1')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
        .slice(0, 80)
    }
  }
  if (!derivedName && rawLocation) derivedName = rawLocation
  if (!derivedName) derivedName = `${source} Lead`

  return {
    name: derivedName,
    title: title || derivedName,
    description: desc,
    price: raw.price,
    address,
    zip: raw.zip || raw.zipCode || raw.postalCode,
    phone: raw.phone || raw.sellerPhone || raw.phoneNumber,
    email: raw.email || raw.sellerEmail || raw.replyEmail,
    url: urlForName,
    source_id: raw.pid || raw.id || raw.placeId || raw.cid || raw.parcelId || raw.folio || raw.url,
    assessed_value: raw.assessedValue || raw.marketValue,
    tax_status: raw.taxStatus,
  }
}

async function fetchApifyDataset(datasetId: string): Promise<unknown[]> {
  const token = process.env.APIFY_API_TOKEN
const url = `https://api.apify.com/v2/datasets/${datasetId}/items?format=json${token ? `&token=${token}` : ''}`
  const res = await globalThis.fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function POST(req: NextRequest) {
  // Verify API key (skip if not set — allows Apify direct calls)
  const authHeader = req.headers.get('authorization')
  const apiKey = process.env.INTERNAL_API_KEY
  if (apiKey && authHeader && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    // Determine source
    const source: string = body.source || 'unknown'

    // Get leads — either direct array, or fetch from Apify dataset
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawLeads: any[] = []

    if (body.leads && Array.isArray(body.leads)) {
      // Direct payload: { source, leads: [...] }
      rawLeads = body.leads
    } else if (body.resource?.defaultDatasetId && !body.resource.defaultDatasetId.includes('{{')) {
      // Apify webhook payload: { source, resource: { defaultDatasetId: "abc123" } }
      rawLeads = await fetchApifyDataset(body.resource.defaultDatasetId) as any[]
    } else {
      // Try to fetch from Apify using the actor run ID or dataset ID from any field
      const datasetId = body.defaultDatasetId || body.datasetId || body.resource?.defaultDatasetId
      if (datasetId && !String(datasetId).includes('{{')) {
        rawLeads = await fetchApifyDataset(datasetId) as any[]
      } else if (Array.isArray(body)) {
        rawLeads = body
      } else {
        // Last resort: fetch the most recent dataset from this actor
        const actorId = 'fatihtahta~craigslist-scraper'
        const apifyToken = process.env.APIFY_API_TOKEN
        if (apifyToken) {
          const res = await globalThis.fetch(`https://api.apify.com/v2/acts/${actorId}/runs/last/dataset/items?format=json&token=${apifyToken}`)
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data)) rawLeads = data
          }
        }
      }
    }

    if (!rawLeads.length) {
      return NextResponse.json({ error: 'No leads found', source }, { status: 400 })
    }

    let inserted = 0
    let skipped = 0
    const seen = new Set<string>()

    for (const raw of rawLeads) {
      const lead = normalizeLead(raw, source)

      // Deduplicate within batch
      const dedupeKey = lead.source_id || `${lead.name}_${lead.address}`
      if (seen.has(dedupeKey)) { skipped++; continue }
      seen.add(dedupeKey)

      // Blocklist — skip broker/investor/wholesaler posts
      if (isBlocklisted(lead.title || lead.name || '', lead.description || '')) { skipped++; continue }

      const now = new Date().toISOString()
      // Only columns that exist in the pipeline table
      const insertData: Record<string, unknown> = {
        agent_id: DEFAULT_AGENT_ID,
        lead_name: lead.name,
        stage: 'new_lead',
        last_contact: now,
        notes: lead.description ? lead.description.slice(0, 500) : null,
        lead_source: source,
        hot_lead_type: classifyLeadType(lead.title, lead.description, source, lead.tax_status) || null,
        urgency: classifyUrgency(lead.title, lead.description, source, lead.tax_status),
        arv: lead.assessed_value || extractPrice(lead.price) || null,
        property_address: lead.address || null,
        zip_code: lead.zip || null,
        pain_point: lead.description ? lead.description.slice(0, 200) : null,
        source_url: lead.url || null,
        source_id: lead.source_id || lead.url || dedupeKey,
        scraped_at: now,
        is_hot_lead: true,
      }

      const result = await upsertHotLead(insertData as any)

      if (result) inserted++
      else skipped++
    }

    await updateHotLeadSourceStatus(source, 'success', inserted)

    return NextResponse.json({ ok: true, source, inserted, skipped, total: rawLeads.length })
  } catch (err) {
    console.error('hot-leads-webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


