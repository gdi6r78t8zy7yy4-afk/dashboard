import { describe, expect, it } from 'vitest'
import { getEventsDashboard } from './eventsService.mjs'

describe('Events Service integration', () => {
  it(
    'aggregates events from CERT-SE, GDACS, EU Civil Protection, and GDELT with KPIs and source metadata',
    async () => {
    const dashboard = await getEventsDashboard({ sector: 'all', region: 'all' })

    expect(dashboard.state).toBe('ok')
    expect(dashboard.kpis.length).toBeGreaterThan(0)
    expect(dashboard.sources).toHaveLength(4)

    // Check that all 4 sources exist in source metadata
    const sourceIds = dashboard.sources.map((s) => s.id)
    expect(sourceIds).toContain('cert-se')
    expect(sourceIds).toContain('gdacs')
    expect(sourceIds).toContain('eu-civil-protection')
    expect(sourceIds).toContain('gdelt')

    // Check items exist
    expect(dashboard.items.length).toBeGreaterThan(0)

    // Check that items have separate publishedAt and fetchedAt
    const firstItem = dashboard.items[0]
    expect(firstItem.firstPublishedAt || firstItem.publishedAt).toBeDefined()
    expect(firstItem.fetchedAt).toBeDefined()

    // Test filtering by sector
    const energyOnly = await getEventsDashboard({ sector: 'energy' })
    for (const item of energyOnly.items) {
      expect(item.sector).toBe('energy')
    }

    // Test filtering by classification
    const authorityOnly = await getEventsDashboard({ classification: 'authority' })
    for (const item of authorityOnly.items) {
      expect(item.classification).toBe('authority')
    }
  }, 25000)
})
