/**
 * POST /api/campaigns/send-step
 * Trigger one email step for all eligible leads in a batch.
 * Uses SendGrid dynamic templates — personalized per lead.
 *
 * Requires: Authorization: Bearer <INTERNAL_API_TOKEN>
 * Body: { "batchId": "string", "step": number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logEvent, newRequestId } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getEligibleLeads, updateLeadAfterSend } from '@/lib/queries';
import { sendTemplate } from '@/lib/sendgrid/client';
import { getStepConfig, MAX_STEPS } from '@/lib/campaign/steps';

const ROUTE = '/api/campaigns/send-step';

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

  let batchId: string;
  let step: number;
  try {
    const body = await req.json();
    batchId = body?.batchId;
    step = Number(body?.step);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!batchId || typeof batchId !== 'string') {
    return NextResponse.json({ success: false, error: '"batchId" is required.' }, { status: 400 });
  }
  if (!Number.isInteger(step) || step < 1 || step > MAX_STEPS) {
    return NextResponse.json({ success: false, error: `"step" must be an integer between 1 and ${MAX_STEPS}.` }, { status: 400 });
  }

  const batchCtx = { ...ctx, batchId };

  let eligible;
  try {
    eligible = await getEligibleLeads(batchId, step);
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load leads from database.' }, { status: 500 });
  }

  if (eligible.length === 0) {
    return NextResponse.json({ success: true, data: { batchId, step, total: 0, sent: 0, failed: 0, message: `No eligible leads for step ${step}.` } });
  }

  const now = new Date().toISOString();
  let sent = 0;
  const failures: { email: string; reason: string }[] = [];

  for (const lead of eligible) {
    try {
      const firstName = lead.name?.split(' ')[0] || 'there';
      const brokerage = lead.brokerage || 'your brokerage';
      const { templateId, dynamicTemplateData } = getStepConfig(step, firstName, brokerage);
      await sendTemplate({ to: lead.email, templateId, dynamicTemplateData });
      await updateLeadAfterSend(lead.id, step, now);
      sent++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Send failed';
      failures.push({ email: lead.email, reason });
      logEvent('campaign.send.failed', batchCtx, { step, email: lead.email, reason });
    }
  }

  logEvent('campaign.step.sent', batchCtx, { step, total: eligible.length, sent, failed: failures.length });

  return NextResponse.json({
    success: true,
    data: { batchId, step, total: eligible.length, sent, failed: failures.length, failures: failures.length > 0 ? failures : undefined },
  });
}
