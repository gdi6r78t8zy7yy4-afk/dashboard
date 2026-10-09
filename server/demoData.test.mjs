import { describe, expect, it } from 'vitest'
import { getOverviewForRegion } from './demoData.mjs'

describe('demo overview by region', () => {
  it('provides clearly scoped Swedish demo data', () => {
    const overview = getOverviewForRegion('se')

    expect(overview.mode).toBe('demo')
    expect(overview.services).toHaveLength(11)
    expect(overview.incidents).toHaveLength(3)
  })

  it('marks areas without connected feeds as unknown', () => {
    const overview = getOverviewForRegion('no')

    expect(overview.services).toHaveLength(11)
    expect(overview.services.every((service) => service.status === 'unknown')).toBe(true)
    expect(overview.services.every((service) => service.metric === 'No live feed')).toBe(true)
    expect(overview.incidents).toEqual([])
  })
})
