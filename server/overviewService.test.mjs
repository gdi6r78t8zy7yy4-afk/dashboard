import { describe, expect, it } from 'vitest'
import { getAggregatedOverview } from './overviewService.mjs'

describe('overview service aggregation', () => {
  it('aggregates live sectors, interactive map, incidents, timeline, and source provenance', async () => {
    const overview = await getAggregatedOverview({ region: 'se', now: new Date('2026-10-10T12:00:00Z') })

    expect(overview.mode).toBe('live_aggregate')
    expect(overview.region).toBe('se')
    expect(overview.sectors).toHaveLength(5)
    expect(overview.sectors.map((s) => s.id)).toEqual(['energy', 'telecom', 'internet', 'transport', 'cyber'])

    // Interactive map
    expect(overview.mapRegions.length).toBeGreaterThanOrEqual(5)
    expect(overview.mapRegions.some((r) => r.id === 'se')).toBe(true)

    // Sources verification
    expect(overview.sources).toHaveLength(6)
    const certSource = overview.sources.find((s) => s.id === 'cert-se')
    expect(certSource).toBeDefined()
    expect(certSource.requiresAuth).toBe(false)
    expect(certSource.category).toBe('Cyber')

    const tvSource = overview.sources.find((s) => s.id === 'trafikverket')
    expect(tvSource).toBeDefined()
    expect(tvSource.requiresAuth).toBe(true)

    const entsoeSource = overview.sources.find((s) => s.id === 'entsoe')
    expect(entsoeSource).toBeDefined()
    expect(entsoeSource.requiresAuth).toBe(true)

    // Incidents deduplication and ordering
    if (overview.incidents.length > 1) {
      const first = overview.incidents[0]
      const second = overview.incidents[1]
      // Critical severity must come before or equal to elevated
      const severityRank = { critical: 2, elevated: 1 }
      expect(severityRank[first.severity] ?? 0).toBeGreaterThanOrEqual(severityRank[second.severity] ?? 0)
    }

    // Timeline
    expect(Array.isArray(overview.timeline)).toBe(true)
  }, 30000)

  it('handles non-Swedish regions gracefully and labels geographic coverage', async () => {
    const overview = await getAggregatedOverview({ region: 'no', now: new Date('2026-10-10T12:00:00Z') })
    expect(overview.region).toBe('no')
    expect(overview.regionLabel).toBe('Norge')
    expect(overview.sectors).toHaveLength(5)
  }, 30000)
})
