/**
 * POST /api/leads/upload
 * Accepts a CSV file, parses leads, validates fields,
 * deduplicates within batch, and stores in Supabase.
 *
 * Requires: Authorization: Bearer <INTERNAL_API_TOKEN>
 * Body: multipart/form-data with field "file" (CSV)
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseLeadsCSV } from '@/lib/csv/parser';
import { requireAuth } from '@/lib/auth';
import { logEvent, newRequestId } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { insertBatch, insertLeads } from '@/lib/queries';

const ROUTE = '/api/leads/upload';

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const ctx = { requestId, route: ROUTE };

  const authError = requireAuth(req);
  if (authError) return authError;

  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ROUTE, ip);
  if (!rateCheck.allowed) {
    logEvent('rate_limit.rejected', ctx, { ip });
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please wait before retrying.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to parse form data.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ success: false, error: 'No file provided. Use field name "file".' }, { status: 400 });
  if (!file.name.endsWith('.csv')) return NextResponse.json({ success: false, error: 'Only .csv files are accepted.' }, { status: 400 });

  let csvText: string;
  try {
    csvText = await file.text();
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to read file contents.' }, { status: 400 });
  }

  let result;
  try {
    result = parseLeadsCSV(csvText);
  } catch {
    logEvent('leads.upload.failed', ctx, { error: 'CSV parse error' });
    return NextResponse.json({ success: false, error: 'Failed to parse CSV file.' }, { status: 400 });
  }

  const batchCtx = { ...ctx, batchId: result.batchId };
  try {
    await insertBatch(result.batchId, result.totalRows, result.skipped);
    await insertLeads(result.leads);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    logEvent('leads.upload.db_failed', batchCtx, { error: message });
    return NextResponse.json({ success: false, error: 'Failed to save leads to database.' }, { status: 500 });
  }

  logEvent('leads.upload.success', batchCtx, { totalRows: result.totalRows, accepted: result.leads.length, skipped: result.skipped.length });

  return NextResponse.json({
    success: true,
    data: { batchId: result.batchId, accepted: result.leads.length, skipped: result.skipped.length, totalRows: result.totalRows, skippedDetails: result.skipped },
  });
}
