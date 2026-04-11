import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

const BUCKET = 'escrow-docs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const leadId = formData.get('leadId') as string | null
    const type = (formData.get('type') as string | null) ?? 'proof'

    if (!file || !leadId) {
      return NextResponse.json({ error: 'Missing file or leadId' }, { status: 400 })
    }

    const supabase = getSupabase()
    const ext = file.name.split('.').pop() ?? 'pdf'
    const storagePath = `${leadId}/${type}-${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Create a signed URL valid for 7 days
    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7)

    if (signError) throw signError

    const url = signedData.signedUrl

    // Update pipeline record with proof url and status
    const updateField = type === 'release'
      ? { escrow_release_doc_url: url }
      : { escrow_proof_url: url, escrow_proof_uploaded: true }

    await supabase.from('pipeline').update(updateField).eq('id', leadId)

    return NextResponse.json({ url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
