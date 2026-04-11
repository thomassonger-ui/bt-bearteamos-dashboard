// ─── Tracerfy Skip Trace Service ─────────────────────────────────────────────
// Uses Tracerfy Instant Trace Lookup — real-time, single address, no queue.
// Cost: 5 credits per hit ($0.10), 0 credits on miss.
// Called automatically when an agent accepts a hot lead.
//
// SETUP: Add this to your Vercel environment variables:
//   TRACERFY_API_KEY = <your token from tracerfy.com account settings>

const TRACERFY_API_KEY = process.env.TRACERFY_API_KEY ?? ''
const TRACERFY_URL = 'https://tracerfy.com/v1/api/trace/lookup/'

export interface SkipTraceResult {
  owner_name?: string
  phone1?: string
  phone2?: string
  phone3?: string
  email?: string
  mailing_address?: string
}

export async function skipTraceAddress(
  address: string,
  city?: string,
  state = 'FL',
  zip?: string
): Promise<SkipTraceResult | null> {
  if (!TRACERFY_API_KEY) {
    console.warn('[skipTrace] TRACERFY_API_KEY not set — skipping enrichment')
    return null
  }

  try {
    const res = await fetch(TRACERFY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRACERFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        city: city ?? 'Orlando',
        state,
        zip: zip ?? undefined,
        find_owner: true,   // we only have the address, not the owner's name
      }),
    })

    if (!res.ok) {
      console.error('[skipTrace] Tracerfy API error:', res.status, await res.text())
      return null
    }

    const data = await res.json()

    // No hit — owner not found (0 credits charged)
    if (!data.hit || !data.persons?.length) {
      console.log('[skipTrace] No hit for address:', address)
      return null
    }

    // Use the first person marked as property owner, fallback to first result
    const person = data.persons.find((p: any) => p.property_owner) ?? data.persons[0]

    const phones = (person.phones ?? [])
      .sort((a: any, b: any) => a.rank - b.rank)
      .map((p: any) => p.number)

    const emails = (person.emails ?? [])
      .sort((a: any, b: any) => a.rank - b.rank)
      .map((e: any) => e.email)

    const mailingAddr = person.mailing_address
      ? `${person.mailing_address.street}, ${person.mailing_address.city}, ${person.mailing_address.state} ${person.mailing_address.zip}`
      : undefined

    return {
      owner_name: (person.full_name ?? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()) || undefined,
      phone1: phones[0],
      phone2: phones[1],
      phone3: phones[2],
      email: emails[0],
      mailing_address: mailingAddr,
    }
  } catch (err) {
    console.error('[skipTrace] Fetch failed:', err)
    return null
  }
}
