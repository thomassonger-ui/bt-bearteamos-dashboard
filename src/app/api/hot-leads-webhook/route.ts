import { NextRequest, NextResponse } from 'next/server'
import { upsertHotLead, updateHotLeadSourceStatus } from '@/lib/queries'

const DEFAULT_AGENT_ID = 'a0000000-0000-0000-0000-000000000001'

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
  const title = raw.title || raw.name || raw.business_name || raw.ownerName || raw.headline || ''
  const desc = raw.description || raw.body || raw.text || raw.content || ''
  const address = raw.location || raw.address || raw.propertyAddress || raw.neighborhood || raw.street || ''

  return {
    name: title || 'Unknown Lead',
    title,
    description: desc,
    price: raw.price,
    address,
    zip: raw.zip || raw.zipCode || raw.postalCode,
    phone: raw.phone || raw.sellerPhone || raw.phoneNumber,
    email: raw.email || raw.sellerEmail || raw.replyEmail,
    url: raw.url || raw.link || raw.website || raw.googleUrl,
    source_id: raw.pid || raw.id || raw.placeId || raw.cid || raw.parcelId || raw.folio || raw.url,
    assessed_value: raw.assessedValue || raw.marketValue,
    tax_status: raw.taxStatus,
  }
}

async function fetchApifyDataset(datasetId: string): Promise<unknown[]> {
  const url = 'https://api.apify.com/v2/datasets/' + datasetId + '/items?format=json'
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
    } else if (body.resource?.defaultDatasetId) {
      // Apify webhook payload: { source, resource: { defaultDatasetId: "..." } }
      rawLeads = await fetchApifyDataset(body.resource.defaultDatasetId) as any[]
    } else if (Array.isArray(body)) {
      rawLeads = body
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
