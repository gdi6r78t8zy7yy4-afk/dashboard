import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCisaKevCache } from './cisaKevAdapter.mjs'
import { clearNvdCache } from './nvdAdapter.mjs'
import { clearMispCache } from './mispAdapter.mjs'
import {
  CLASSIFICATION_TIERS,
  getCyberCveDetails,
  getCyberDashboard,
} from './cyberService.mjs'

describe('cyberService', () => {
  beforeEach(() => {
    clearCisaKevCache()
    clearNvdCache()
    clearMispCache()
  })

  it('provides all 5 classification tiers with disambiguation rules', () => {
    expect(CLASSIFICATION_TIERS.published_warning.tier).toBe(1)
    expect(CLASSIFICATION_TIERS.exploited_vulnerability.tier).toBe(2)
    expect(CLASSIFICATION_TIERS.threat_indicator.tier).toBe(3)
    expect(CLASSIFICATION_TIERS.verified_incident.tier).toBe(4)
    expect(CLASSIFICATION_TIERS.derived_risk_assessment.tier).toBe(5)

    expect(CLASSIFICATION_TIERS.exploited_vulnerability.rule).toContain('Det innebär INTE automatiskt att sårbarheten utnyttjas i Sverige')
  })

  it('aggregates live security data and tags items with classification tiers and disambiguation', async () => {
    const dashboard = await getCyberDashboard()

    expect(dashboard.state).toBe('ok')
    expect(dashboard.kpis).toBeDefined()
    expect(dashboard.kpis.cisaKevTotal).toBeGreaterThan(1000)
    expect(dashboard.kpis.certSeTotal).toBeGreaterThan(0)
    expect(dashboard.timeline.length).toBeGreaterThan(0)

    // Check timeline items have proper classification
    const firstItem = dashboard.timeline[0]
    expect(firstItem.classificationTier).toBeDefined()
    expect(firstItem.disambiguationNotice).toBeDefined()
    expect(firstItem.source).toBeDefined()

    // Sources verification
    expect(dashboard.sources.some((s) => s.id === 'cert-se')).toBe(true)
    expect(dashboard.sources.some((s) => s.id === 'cisa-kev')).toBe(true)
    expect(dashboard.sources.some((s) => s.id === 'nvd-api')).toBe(true)
    expect(dashboard.sources.some((s) => s.id === 'mitre-attack')).toBe(true)
    expect(dashboard.sources.some((s) => s.id === 'misp')).toBe(true)
  })

  it('performs single CVE lookup and enriches with MITRE techniques', async () => {
    const detail = await getCyberCveDetails('CVE-2024-38077')
    expect(detail).toBeDefined()
    expect(detail.cveId).toBe('CVE-2024-38077')
    expect(detail.disambiguationNotice).toContain('En CVE-post visar teknisk potential')
    expect(Array.isArray(detail.mitreTechniques)).toBe(true)
  })
})
