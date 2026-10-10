import { describe, expect, it } from 'vitest'
import { getOverviewForRegion, getSectorForRegion } from './demoData.mjs'

describe('demo overview by region', () => {
  it('provides clearly scoped Swedish demo data', () => {
    const overview = getOverviewForRegion('se')

    expect(overview.mode).toBe('demo')
    expect(overview.services).toHaveLength(11)
    expect(overview.incidents).toHaveLength(2)
    expect(overview.sources.some((source) => source.id === 'cert-se')).toBe(true)
    expect(overview.timeline.length).toBeGreaterThan(0)
  })

  it('marks areas without connected feeds as unknown', () => {
    const overview = getOverviewForRegion('no')

    expect(overview.services).toHaveLength(11)
    expect(overview.services.every((service) => service.status === 'unknown')).toBe(true)
    expect(overview.services.every((service) => service.metric === 'No live feed')).toBe(true)
    expect(overview.incidents).toEqual([])
    expect(overview.sources.some((source) => source.status === 'not_configured')).toBe(true)
  })

  it('does not publish demo telecom incidents or reuse telecom data for unknown sectors', () => {
    const telecom = getSectorForRegion('se', 'telecom')
    const weather = getSectorForRegion('se', 'weather')

    expect(telecom.status).toBe('unknown')
    expect(telecom.observations).toEqual([])
    expect(telecom.headline).toContain('not connected')
    expect(weather.observations).toEqual([])
    expect(weather.label).toBe('Data unavailable')
  })
})
