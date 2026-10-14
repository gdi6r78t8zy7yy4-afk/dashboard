import { describe, expect, it } from 'vitest'
import {
  ASSETS,
  BENCHMARKS,
  GEOGRAPHIES,
  INDICATORS,
  matchRank,
  searchGasOil,
  getGasOilSearchCoverage,
} from './gasOilSearch.mjs'

describe('gas oil search index', () => {
  it('matches partial names case-insensitively', () => {
    const result = searchGasOil('SWE')
    expect(result.results.geographies.map((g) => g.name)).toContain('Sweden')

    const brent = searchGasOil('bre')
    expect(brent.results.benchmarks.map((b) => b.name)).toContain('Brent Crude')
  })

  it('matches aliases and disambiguates duplicates across types', () => {
    // "UK" is an alias of United Kingdom
    const uk = searchGasOil('uk')
    expect(uk.results.geographies.some((g) => g.name === 'United Kingdom')).toBe(true)

    // "China" matches both a geography and the demo asset "China storage"
    const china = searchGasOil('china')
    const types = new Set([
      ...china.results.geographies.map((r) => r.type),
      ...china.results.assets.map((r) => r.type),
    ])
    expect(types.has('geography')).toBe(true)
    expect(types.has('asset')).toBe(true)

    // Each duplicate carries its own type label and scope for disambiguation
    for (const list of Object.values(china.results)) {
      for (const item of list) {
        expect(item.typeLabel).toBeTruthy()
        expect(item.scope).toBeTruthy()
        expect(item.detail.id).toBeTruthy()
        expect(item.detail.kind).toBe(item.type)
      }
    }
  })

  it('ranks exact matches above prefix and prefix above substring', () => {
    expect(matchRank('brent', 'Brent Crude')).toBe(1)
    expect(matchRank('brent crude', 'Brent Crude')).toBe(0)
    expect(matchRank('crude', 'Brent Crude')).toBe(2)
    expect(matchRank('zzz', 'Brent Crude')).toBeNull()

    const result = searchGasOil('russia')
    const names = result.results.geographies.map((g) => g.name)
    expect(names[0]).toBe('Russia') // exact match first
  })

  it('returns empty results with coverage for unknown queries', () => {
    const result = searchGasOil('zzznonexistent')
    expect(result.total).toBe(0)
    expect(Object.values(result.byType).every((n) => n === 0)).toBe(true)
    expect(result.coverage.geographies).toBeGreaterThan(0)
    expect(result.limitations.length).toBeGreaterThan(0)
  })

  it('honors the per-type limit option', () => {
    const unlimited = searchGasOil('storage')
    const limited = searchGasOil('storage', { limit: 1 })
    for (const key of Object.keys(limited.results)) {
      expect(limited.results[key].length).toBeLessThanOrEqual(1)
      expect(unlimited.results[key].length).toBeGreaterThanOrEqual(limited.results[key].length)
    }
  })

  it('reports coverage that matches the implemented index exactly', () => {
    const coverage = getGasOilSearchCoverage()
    expect(coverage.coverage.geographies).toBe(GEOGRAPHIES.length)
    expect(coverage.coverage.indicators).toBe(INDICATORS.length)
    expect(coverage.coverage.benchmarks).toBe(BENCHMARKS.length)
    expect(coverage.coverage.assets).toBe(ASSETS.length)
    expect(coverage.coverage.sources).toBe(7)
    expect(coverage.coverage.note).toContain(`${GEOGRAPHIES.length} geographies`)
  })

  it('returns detail records with coordinates for geographies', () => {
    const result = searchGasOil('sweden')
    const sweden = result.results.geographies.find((g) => g.name === 'Sweden')
    expect(sweden.detail.coordinates).toEqual([62.0, 15.0])
    expect(sweden.detail.kind).toBe('geography')
    expect(sweden.detail.source).toContain('gazetteer')
    expect(sweden.detail.methodology).toMatch(/No external geocoding service/)
  })

  it('exposes benchmark series references and status honestly', () => {
    const result = searchGasOil('brent')
    const brent = result.results.benchmarks.find((b) => b.name === 'Brent Crude')
    expect(brent.detail.recordRef).toBe('DCOILBRENTEU')
    expect(brent.detail.sourceUrl).toBe('https://fred.stlouisfed.org/')
    // Without FRED_API_KEY set the benchmark must not claim live data
    if (!process.env.FRED_API_KEY) {
      expect(brent.detail.status).toBe('not_configured')
    }
  })

  it('searches data sources by id and keeps their URLs', () => {
    const result = searchGasOil('eia')
    const eia = result.results.sources.find((s) => s.name === 'EIA')
    expect(eia).toBeDefined()
    expect(eia.detail.sourceUrl).toContain('eia.gov')
  })

  it('handles empty queries by returning coverage only', () => {
    const result = searchGasOil('   ')
    expect(result.total).toBe(0)
    expect(result.results).toEqual({ geographies: [], indicators: [], benchmarks: [], assets: [], sources: [] })
    expect(result.coverage.indicators).toBe(INDICATORS.length)
  })
})
