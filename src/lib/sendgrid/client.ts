/**
 * SendGrid client wrapper.
 * Supports both dynamic template sending and raw HTML sending.
 */

import sgMail from '@sendgrid/mail';
import { getEnv } from '@/config/env/validate';

const RATE_LIMIT = {
  maxPerMinute: 10,
  windowMs: 60_000,
  sent: 0,
  windowStart: Date.now(),
};

function initClient(): void {
  const apiKey = getEnv('SENDGRID_API_KEY');
  sgMail.setApiKey(apiKey);
}

function checkRateLimit(): void {
  const now = Date.now();
  if (now - RATE_LIMIT.windowStart > RATE_LIMIT.windowMs) {
    RATE_LIMIT.sent = 0;
    RATE_LIMIT.windowStart = now;
  }
  if (RATE_LIMIT.sent >= RATE_LIMIT.maxPerMinute) {
    throw new Error(`[SendGrid] Rate limit reached: max ${RATE_LIMIT.maxPerMinute} emails/minute.`);
  }
}

export type SendTemplateParams = {
  to: string;
  templateId: string;
  dynamicTemplateData: Record<string, string>;
};

export async function sendTemplate(params: SendTemplateParams): Promise<void> {
  initClient();
  checkRateLimit();
  const from = {
    email: getEnv('SENDGRID_FROM_EMAIL'),
    name: process.env.SENDGRID_FROM_NAME ?? 'Tom Songer',
  };
  await sgMail.send({
    to: params.to,
    from,
    templateId: params.templateId,
    dynamicTemplateData: params.dynamicTemplateData,
  });
  RATE_LIMIT.sent++;
}

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<void> {
  initClient();
  checkRateLimit();
  const from = {
    email: getEnv('SENDGRID_FROM_EMAIL'),
    name: process.env.SENDGRID_FROM_NAME ?? 'Tom Songer',
  };
  await sgMail.send({
    to: params.to,
    from,
    subject: params.subject,
    text: params.text,
    html: params.html ?? `<p>${params.text}</p>`,
  });
  RATE_LIMIT.sent++;
}
