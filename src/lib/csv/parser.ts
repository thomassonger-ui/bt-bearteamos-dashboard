/**
 * CSV Parser — parses uploaded CSV, validates fields, deduplicates by email within batch.
 */

import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import type { Lead } from '@/types';

const BLOCKED_LOCAL_PARTS = new Set([
  'example','test','fake','noreply','no-reply','donotreply',
  'dummy','sample','placeholder','invalid','null','undefined',
]);

const BLOCKED_DOMAINS = new Set([
  'example.com','example.org','example.net','test.com','fake.com',
  'mailinator.com','guerrillamail.com','trashmail.com','yopmail.com',
  'tempmail.com','throwaway.email','sharklasers.com',
]);

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function validateEmail(email: string): string | null {
  if (!email || !email.includes('@')) return 'Missing or malformed email address';
  const [local, domain] = email.split('@');
  if (!local || !domain || !domain.includes('.')) return 'Malformed email address';
  if (BLOCKED_LOCAL_PARTS.has(local)) return `Email rejected: "${local}@..." appears to be a placeholder`;
  if (BLOCKED_DOMAINS.has(domain)) return `Email rejected: domain "${domain}" is not accepted`;
  return null;
}

export type CSVParseResult = {
  batchId: string;
  leads: Lead[];
  skipped: { row: number; reason: string; data: Record<string, string> }[];
  totalRows: number;
};

export function parseLeadsCSV(csvText: string): CSVParseResult {
  const batchId = uuidv4();
  const now = new Date().toISOString();
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const leads: Lead[] = [];
  const skipped: CSVParseResult['skipped'] = [];
  const seenEmails = new Set<string>();

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = row['name']?.trim();
    const email = normalizeEmail(row['email'] ?? '');
    const brokerage = row['brokerage']?.trim() || undefined;

    if (!name) { skipped.push({ row: rowNumber, reason: 'Missing required field: name', data: row }); return; }
    const emailError = validateEmail(email);
    if (emailError) { skipped.push({ row: rowNumber, reason: emailError, data: row }); return; }
    if (seenEmails.has(email)) { skipped.push({ row: rowNumber, reason: `Duplicate email: ${email}`, data: row }); return; }

    seenEmails.add(email);
    leads.push({ id: uuidv4(), name, email, brokerage, batchId, status: 'new', currentStep: 0, lastContactedAt: null, createdAt: now });
  });

  return { batchId, leads, skipped, totalRows: parsed.data.length };
}
