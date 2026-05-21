/**
 * Single source of truth for admin/super-admin email lists.
 *
 * Replaces 5+ inline definitions that had drifted apart:
 * - different defaults (Bethanne sometimes included, sometimes not)
 * - inconsistent case-normalization
 * - inconsistent handling of "super admin is also admin"
 *
 * Env vars:
 * - SUPER_ADMIN_EMAILS  comma-separated list (default: bethanne@bearteam.com)
 * - ADMIN_EMAILS        comma-separated list (default: tom + thomas + veronica)
 *
 * Super admins are ALWAYS admins.
 */

function parseList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function getSuperAdminEmails(): string[] {
  return parseList(process.env.SUPER_ADMIN_EMAILS ?? 'bethanne@bearteam.com')
}

export function getAdminEmails(): string[] {
  return parseList(
    process.env.ADMIN_EMAILS ??
      'thomas.songer@gmail.com,tom@bearteam.com,veronica@bearteam.com'
  )
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return getSuperAdminEmails().includes(email.toLowerCase().trim())
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.toLowerCase().trim()
  return isSuperAdmin(e) || getAdminEmails().includes(e)
}
