// Tracerfy Skip Trace API wrapper
// Docs: https://tracerfy.com/v1/api/trace/lookup/
// Returns owner name, best phone, best email for a property address.

export interface SkipTraceResult {
  owner_name: string
  phone1: string | null
  email: string | null
  hit: boolean
}

export async function skipTraceAddress(
  address: string,
  city: string,
  state: string,
  zip?: string
): Promise<SkipTraceResult | null> {
  const apiKey = process.env.TRACERFY_API_KEY
  if (!apiKey) {
    console.error('[skipTrace] TRACERFY_API_KEY not set')
    return null
  }

  try {
    const body: Record<string, string | boolean> = {
      address,
      city,
      state,
      find_owner: true,
    }
    if (zip) body.zip = zip

    const res = await fetch('https://tracerfy.com/v1/api/trace/lookup/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error('[skipTrace] API error:', res.status, await res.text())
      return null
    }

    const data = await res.json()

    if (!data.hit || !data.persons || data.persons.length === 0) {
      return null
    }

    // Find property owner in persons list
    const persons = data.persons as Array<{
      first_name?: string
      last_name?: string
      is_property_owner?: boolean
      phones?: Array<{ phone: string; rank?: number }>
      emails?: Array<{ email: string }>
    }>

    const owner = persons.find(p => p.is_property_owner) ?? persons[0]

    const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(' ') || 'Unknown Owner'

    // Best phone = lowest rank (rank 1 = best)
    const phones = (owner.phones ?? []).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    const phone1 = phones[0]?.phone ?? null

    const email = owner.emails?.[0]?.email ?? null

    return { owner_name: ownerName, phone1, email, hit: true }
  } catch (err) {
    console.error('[skipTrace] Exception:', err)
    return null
  }
}
