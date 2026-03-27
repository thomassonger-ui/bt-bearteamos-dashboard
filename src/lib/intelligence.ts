import type { Pipeline } from '@/types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface RankedLead extends Pipeline {
  priorityScore: number
}

export interface LeadAlert {
  type: 'high' | 'stale' | 'low'
  message: string
  leadId: string
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STAGE_WEIGHT: Record<string, number> = {
  new: 1,
  engaged: 5,
  qualified: 10,
}

// ─── RANK LEADS ───────────────────────────────────────────────────────────────

export function rankLeads(leads: Pipeline[]): RankedLead[] {
  return leads
    .map((lead) => {
      const engagementScore = lead.engagement_score ?? 0
      const stageWeight = STAGE_WEIGHT[lead.stage] ?? 1

      // Inactivity penalty: last_contact > 72h → +5 penalty
      let inactivityPenalty = 0
      const lastContact = lead.scout_last_interaction ?? lead.last_contact
      if (lastContact) {
        const hoursSince = (Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60)
        if (hoursSince > 72) inactivityPenalty = 5
      }

      const priorityScore =
        engagementScore * 0.6 +
        stageWeight * 0.3 -
        inactivityPenalty * 0.1

      return { ...lead, priorityScore: Math.round(priorityScore * 100) / 100 }
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
}

// ─── GENERATE ALERTS ──────────────────────────────────────────────────────────

export function generateAlerts(leads: Pipeline[]): LeadAlert[] {
  const alerts: LeadAlert[] = []

  for (const lead of leads) {
    const engagementScore = lead.engagement_score ?? 0
    const lastContact = lead.scout_last_interaction ?? lead.last_contact

    const hoursSince = lastContact
      ? (Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60)
      : Infinity

    // 🔴 HIGH — high intent but not yet closed
    if (engagementScore >= 70 && lead.stage !== 'qualified') {
      alerts.push({
        type: 'high',
        message: 'High intent lead not closed',
        leadId: lead.id,
      })
    }

    // 🟡 STALE — engaged but gone cold
    if (hoursSince > 72 && lead.stage === 'engaged') {
      alerts.push({
        type: 'stale',
        message: 'Engaged lead gone cold',
        leadId: lead.id,
      })
    }

    // 🔵 LOW — low engagement on new lead
    if (engagementScore <= 20 && lead.stage === 'new') {
      alerts.push({
        type: 'low',
        message: 'Low-quality lead',
        leadId: lead.id,
      })
    }
  }

  return alerts
}
