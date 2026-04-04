export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEFAULT_AGENT_ID = 'a0000000-0000-0000-0000-000000000001'

// Blocklist — skip broker/investor posts
const BLOCKLIST = [
  'we buy houses', 'cash offer', 'cash for your', 'investor', 'investment opportunity',
  'wholesale', 'wholesaler', 'brokerage', 'licensed agent', 'licensed realtor',
  'broker', 'mls#', 'listed by', 'listing agent', 'schedule a showing',
  'open house hosted by', 'presented by', 'property management',
  // Rentals
  'for rent', 'per month', '/month', '/mo', 'monthly rent', 'lease',
  'apartment', 'apt for rent', 'room for rent', 'roommate',
  'sublease', 'sublet', 'move-in special', 'first month free',
  'security deposit', 'utilities included', 'no pets', 'pet deposit',
  'studio for rent', 'furnished room', 'unfurnished',
  'available now', 'move in', 'move-in', 'rent includes',
  'tenant', 'renter', 'rental', 'renting', 'home for rent',
  'house for rent', 'condo for rent', 'townhouse for rent',
  'duplex for rent', 'affordable apartment', 'bedroom apartment',
  'laundry on site', 'w/d in unit',
]

function isBlocked(text: string): boolean {
  const lower = text.toLowerCase()
  return BLOCKLIST.some(term => lower.includes(term))
}

function classifyUrgency(text: string): 'critical' | 'high' | 'normal' {
  const lower = text.toLowerCase()
  if (lower.includes('must sell') || lower.includes('foreclosure') || lower.includes('bank owned')) return 'critical'
  if (lower.includes('motivated') || lower.includes('as-is') || lower.includes('estate sale') || lower.includes('probate') || lower.includes('reduced')) return 'high'
  return 'normal'
}

function extractPrice(text: string): number | undefined {
  const match = text.match(/\$[\d,]+/)
  if (!match) return undefined
  const num = parseFloat(match[0].replace(/[$,]/g, ''))
  return isNaN(num) ? undefined : num
}

interface Lead {
  title: string
  price?: number
  location: string
  url: string
  source: string
  description?: string
}

// ─── CRAIGSLIST ORLANDO FSBO ────────────────────────────────────────────────
async function scrapeCraigslist(): Promise<Lead[]> {
  const leads: Lead[] = []
  try {
    const res = await fetch('https://orlando.craigslist.org/search/rea?purveyor=owner', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    })
    const html = await res.text()

    // Parse listings from HTML — Craigslist uses <li class="cl-static-search-result">
    const listingRegex = /<li[^>]*class="[^"]*cl-static-search-result[^"]*"[^>]*>[\s\S]*?<\/li>/g
    const listings = html.match(listingRegex) || []

    // Collect listing URLs first
    const listingUrls: { title: string; price?: number; location: string; url: string }[] = []
    for (const listing of listings) {
      const titleMatch = listing.match(/<div[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/)
      const priceMatch = listing.match(/<div[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/div>/)
      const locationMatch = listing.match(/<div[^>]*class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/div>/)
      const linkMatch = listing.match(/href="([^"]*)"/)

      const title = titleMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || ''
      if (!title || isBlocked(title)) continue

      listingUrls.push({
        title,
        price: extractPrice(priceMatch?.[1] || ''),
        location: locationMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || 'Orlando, FL',
        url: linkMatch?.[1] || '',
      })
    }

    // Visit each listing to get full address, phone, description
    for (const item of listingUrls.slice(0, 50)) {
      try {
        if (!item.url) { leads.push({ ...item, source: 'craigslist' }); continue }
        const detailUrl = item.url.startsWith('http') ? item.url : `https://orlando.craigslist.org${item.url}`
        const detailRes = await fetch(detailUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        })
        const detailHtml = await detailRes.text()

        // Get street address
        const streetMatch = detailHtml.match(/<h2[^>]*class="street-address"[^>]*>([\s\S]*?)<\/h2>/)
        const fullAddress = streetMatch?.[1]?.replace(/<[^>]*>/g, '').trim() || ''

        // Get full title with price/beds from posting title
        const fullTitleMatch = detailHtml.match(/<span[^>]*class="postingtitletext"[^>]*>([\s\S]*?)<\/span>\s*<\/h1>/)
        const fullTitle = fullTitleMatch?.[1]?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || item.title

        // Get description
        const descMatch = detailHtml.match(/<section[^>]*id="postingbody"[^>]*>([\s\S]*?)<\/section>/)
        const description = descMatch?.[1]?.replace(/<[^>]*>/g, '').replace(/QR Code Link to This Post/i, '').trim().slice(0, 300) || ''

        // Get JSON-LD for structured data
        const jsonLdMatch = detailHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)
        let streetAddr = '', zip = '', beds = '', baths = ''
        if (jsonLdMatch) {
          try {
            const ld = JSON.parse(jsonLdMatch[1])
            streetAddr = ld.address?.streetAddress || ''
            zip = ld.address?.postalCode || ''
            beds = ld.numberOfBedrooms || ''
            baths = ld.numberOfBathroomsTotal || ''
          } catch {}
        }

        const finalAddress = fullAddress || (streetAddr ? `${streetAddr}, Orlando, FL ${zip}` : item.location)
        const finalTitle = streetAddr || item.title

        leads.push({
          title: finalTitle,
          price: item.price,
          location: finalAddress,
          url: detailUrl,
          source: 'craigslist',
          description: description || (beds ? `${beds} bed, ${baths} bath` : undefined),
        })
      } catch {
        leads.push({ ...item, source: 'craigslist' })
      }
    }

    // Fallback: try JSON-LD or other patterns
    if (leads.length === 0) {
      const postingRegex = /<a[^>]*href="(\/[^"]*\.html)"[^>]*class="[^"]*posting-title[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/span>/g
      let match
      while ((match = postingRegex.exec(html)) !== null) {
        const url = 'https://orlando.craigslist.org' + match[1]
        const title = match[2]?.replace(/<[^>]*>/g, '').trim() || ''
        if (!title || isBlocked(title)) continue
        leads.push({ title, url, location: 'Orlando, FL', source: 'craigslist' })
      }
    }
  } catch (err) {
    console.error('[scrape-fsbo] Craigslist error:', err)
  }
  return leads
}

// ─── FORSALEBYOWNER.COM ─────────────────────────────────────────────────────
async function scrapeFSBOcom(): Promise<Lead[]> {
  const leads: Lead[] = []
  try {
    const res = await fetch('https://www.forsalebyowner.com/search/fl/orlando', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    })
    const html = await res.text()

    // Look for listing data in script tags or structured HTML
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)
    if (jsonLdMatch) {
      for (const script of jsonLdMatch) {
        try {
          const jsonStr = script.replace(/<[^>]*>/g, '')
          const data = JSON.parse(jsonStr)
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.name && item.url) {
                leads.push({
                  title: item.name,
                  price: extractPrice(item.price || item.offers?.price || ''),
                  location: `${item.address?.addressLocality || 'Orlando'}, FL`,
                  url: item.url,
                  source: 'forsalebyowner',
                })
              }
            }
          }
        } catch {}
      }
    }

    // Fallback: regex for listing cards
    const cardRegex = /<a[^>]*href="(\/listing\/[^"]*)"[^>]*>[\s\S]*?<[^>]*class="[^"]*price[^"]*"[^>]*>\$?([\d,]+)/g
    let match
    while ((match = cardRegex.exec(html)) !== null) {
      leads.push({
        title: `FSBO Listing — $${match[2]}`,
        price: parseFloat(match[2].replace(/,/g, '')),
        location: 'Orlando, FL',
        url: 'https://www.forsalebyowner.com' + match[1],
        source: 'forsalebyowner',
      })
    }
  } catch (err) {
    console.error('[scrape-fsbo] ForSaleByOwner error:', err)
  }
  return leads
}

// ─── ZILLOW FSBO ────────────────────────────────────────────────────────────
async function scrapeZillow(): Promise<Lead[]> {
  const leads: Lead[] = []
  try {
    // Zillow's internal API for search results
    const searchUrl = 'https://www.zillow.com/search/GetSearchPageState.htm'
    const params = new URLSearchParams({
      searchQueryState: JSON.stringify({
        usersSearchTerm: 'Orlando, FL',
        mapBounds: { west: -81.6, east: -81.1, south: 28.3, north: 28.7 },
        filterState: {
          fsbo: { value: true },
          isForSaleByAgent: { value: false },
          isForSaleByOwner: { value: true },
          isNewConstruction: { value: false },
          isAuction: { value: false },
          isComingSoon: { value: false },
          isForRent: { value: false },
          isRecentlySold: { value: false },
        },
        isMapVisible: false,
        isListVisible: true,
      }),
      wants: JSON.stringify({ cat1: ['listResults'] }),
      requestId: '1',
    })

    const res = await fetch(`${searchUrl}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.zillow.com/orlando-fl/fsbo/',
      },
    })

    if (res.ok) {
      const data = await res.json()
      const results = data?.cat1?.searchResults?.listResults || []
      for (const r of results.slice(0, 50)) {
        const addr = r.address || r.streetAddress || ''
        if (!addr || isBlocked(addr + ' ' + (r.statusText || ''))) continue
        leads.push({
          title: addr,
          price: r.unformattedPrice || r.price,
          location: `${r.addressCity || 'Orlando'}, ${r.addressState || 'FL'} ${r.addressZipcode || ''}`,
          url: r.detailUrl ? (r.detailUrl.startsWith('http') ? r.detailUrl : `https://www.zillow.com${r.detailUrl}`) : '',
          source: 'zillow_fsbo',
          description: `${r.beds || '?'} bed, ${r.baths || '?'} bath, ${r.area ? r.area + ' sqft' : ''}`.trim(),
        })
      }
    }

    // Fallback: try the HTML page
    if (leads.length === 0) {
      const htmlRes = await fetch('https://www.zillow.com/orlando-fl/fsbo/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      })
      const html = await htmlRes.text()
      const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
      if (nextDataMatch) {
        try {
          const pageData = JSON.parse(nextDataMatch[1])
          const results = pageData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults || []
          for (const r of results.slice(0, 50)) {
            if (isBlocked(r.statusText || '')) continue
            leads.push({
              title: r.address || r.streetAddress || 'Zillow FSBO',
              price: r.unformattedPrice || r.price,
              location: `${r.addressCity || 'Orlando'}, ${r.addressState || 'FL'}`,
              url: r.detailUrl ? `https://www.zillow.com${r.detailUrl}` : '',
              source: 'zillow_fsbo',
              description: `${r.beds || '?'} bed, ${r.baths || '?'} bath, ${r.area || '?'} sqft`,
            })
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('[scrape-fsbo] Zillow error:', err)
  }
  return leads
}

// ─── MAIN HANDLER ───────────────────────────────────────────────────────────
export async function GET() {
  const startTime = Date.now()

  // Scrape all sources
  const [craigslist, fsbocom, zillow] = await Promise.all([
    scrapeCraigslist(),
    scrapeFSBOcom(),
    scrapeZillow(),
  ])

  const allLeads = [...craigslist, ...fsbocom, ...zillow]
  const now = new Date().toISOString()
  let inserted = 0
  let skipped = 0
  const seen = new Set<string>()

  for (const lead of allLeads) {
    // Deduplicate
    const key = `${lead.title}_${lead.source}`
    if (seen.has(key)) { skipped++; continue }
    seen.add(key)

    // Block brokers/investors/rentals
    if (isBlocked(`${lead.title} ${lead.description || ''}`)) { skipped++; continue }

    // Skip likely rentals — homes for sale are $50K+
    if (lead.price && lead.price > 0 && lead.price < 20000) { skipped++; continue }

    // Check if already exists by source_id
    const sourceId = lead.url || key
    const { data: existing } = await supabase
      .from('pipeline')
      .select('id')
      .eq('source_id', sourceId)
      .limit(1)
    if (existing && existing.length > 0) { skipped++; continue }

    // Insert
    const { error } = await supabase
      .from('pipeline')
      .insert({
        agent_id: DEFAULT_AGENT_ID,
        lead_name: lead.title.slice(0, 100),
        stage: 'new_lead',
        last_contact: now,
        notes: lead.description || null,
        lead_source: lead.source,
        urgency: classifyUrgency(`${lead.title} ${lead.description || ''}`),
        arv: lead.price || null,
        property_address: lead.location || null,
        source_url: lead.url || null,
        source_id: sourceId,
        scraped_at: now,
        is_hot_lead: true,
      })

    if (!error) inserted++
    else { skipped++; console.error('[scrape-fsbo] insert error:', error.message) }
  }

  const duration = Date.now() - startTime

  // Update hot_lead_sources
  for (const src of ['craigslist', 'forsalebyowner', 'zillow_fsbo']) {
    const count = allLeads.filter(l => l.source === src).length
    await supabase
      .from('hot_lead_sources')
      .upsert({
        source_name: src,
        is_active: true,
        last_run_at: now,
        last_run_status: 'success',
        leads_found: count,
        run_frequency: 'daily',
        updated_at: now,
      }, { onConflict: 'source_name' })
  }

  return NextResponse.json({
    ok: true,
    duration: `${duration}ms`,
    sources: {
      craigslist: craigslist.length,
      forsalebyowner: fsbocom.length,
      zillow: zillow.length,
    },
    inserted,
    skipped,
    total: allLeads.length,
  })
}
