import { describe, expect, it, vi } from 'vitest'
import { buildEntsoeUrl, getEnergyArea, getEnergyData, normalizeEntsoeUnit, parseEntsoeXml } from './energyData.mjs'

const priceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Publication_MarketDocument>
  <TimeSeries>
    <in_Domain><mRID>10Y1001A1001A46L</mRID></in_Domain>
    <Period>
      <timeInterval><start>2026-10-10T00:00Z</start><end>2026-10-10T01:00Z</end></timeInterval>
      <resolution>PT60M</resolution>
      <Point><position>1</position><price.amount>42.5</price.amount></Point>
    </Period>
  </TimeSeries>
  <currency_Unit.name>EUR</currency_Unit.name>
  <price_Measure_Unit.name>MWH</price_Measure_Unit.name>
</Publication_MarketDocument>`

describe('energy data adapter', () => {
  it('uses official EIC codes and validates country-area combinations', () => {
    expect(getEnergyArea('se', 'SE3').eic).toBe('10Y1001A1001A46L')
    expect(getEnergyArea('no', 'NO5').eic).toBe('10Y1001A1001A48H')
    expect(getEnergyArea('fi', 'FI').timezone).toBe('Europe/Helsinki')
    expect(() => getEnergyArea('se', 'DK1')).toThrow('does not belong')
  })

  it('builds a documented day-ahead price request with bounded UTC time parameters', () => {
    const url = buildEntsoeUrl({
      token: 'server-secret',
      documentType: 'A44',
      processType: 'A01',
      area: '10Y1001A1001A46L',
      start: '202610100000',
      end: '202610110000',
    })
    expect(url.origin + url.pathname).toBe('https://web-api.tp.entsoe.eu/api')
    expect(url.searchParams.get('documentType')).toBe('A44')
    expect(url.searchParams.get('processType')).toBe('A01')
    expect(url.searchParams.get('in_Domain')).toBe('10Y1001A1001A46L')
    expect(url.searchParams.get('out_Domain')).toBe('10Y1001A1001A46L')
    expect(url.searchParams.get('periodStart')).toBe('202610100000')
    expect(url.searchParams.get('periodEnd')).toBe('202610110000')
    const loadUrl = buildEntsoeUrl({ token: 'server-secret', documentType: 'A65', processType: 'A16', area: '10Y1001A1001A46L', start: '202610100000', end: '202610110000' })
    expect(loadUrl.searchParams.get('outBiddingZone_Domain')).toBe('10Y1001A1001A46L')
    expect(loadUrl.searchParams.has('in_Domain')).toBe(false)
  })

  it('parses ENTSO-E XML points and units', () => {
    expect(parseEntsoeXml(priceXml, 'market_price')).toEqual({
      points: [{ timestamp: '2026-10-10T00:00:00.000Z', value: 42.5, category: null, area: '10Y1001A1001A46L' }],
      unit: 'MWH',
      currency: 'EUR',
    })
  })

  it('normalizes provider unit codes without conflating price and energy units', () => {
    expect(normalizeEntsoeUnit({ unit: 'MWH', currency: 'EUR' }, 'market_price', 'EUR/MWh')).toBe('EUR/MWh')
    expect(normalizeEntsoeUnit({ unit: 'MAW', currency: null }, 'measured_load', 'MW')).toBe('MW')
    expect(normalizeEntsoeUnit({ unit: 'MWH', currency: null }, 'measured_flow', 'MWh')).toBe('MWh')
  })

  it('keeps ENTSO-E products explicitly unconfigured without a server token', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('Unexpected network request') })
    const result = await getEnergyData({ country: 'se', zone: 'SE3', period: '24h', token: '', fetchImpl, now: new Date('2026-10-10T12:00:00Z') })
    expect(result.mode).toBe('partial')
    expect(result.sources.entsoe.status).toBe('not_configured')
    expect(result.datasets.dayAheadPrices.status).toBe('not_configured')
    expect(result.datasets.actualGeneration.status).toBe('not_configured')
    expect(result.gridDisturbances.status).toBe('not_configured')
    expect(result.weather.every((item) => item.status === 'error')).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('uses active SMHI stations and labels the returned values as observations', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith('/station.json')) {
        return new Response(JSON.stringify({ station: [
          { key: 'old', name: 'Inactive nearby station', latitude: 59.34, longitude: 18.05, active: false },
          { key: 'active', name: 'Active nearby station', latitude: 59.35, longitude: 18.06, active: true },
        ] }), { status: 200 })
      }
      return new Response(JSON.stringify({ value: [{ date: 1791637200000, value: '12.5', quality: 'G' }] }), { status: 200 })
    })
    const result = await getEnergyData({ country: 'se', zone: 'SE3', token: '', fetchImpl, now: new Date('2026-10-10T12:00:00Z') })
    expect(result.weather.map((item) => item.status)).toEqual(['ok', 'ok', 'ok'])
    expect(result.weather[0].station).toBe('Active nearby station')
    expect(result.weather[0].points[0]).toMatchObject({ value: 12.5, quality: 'G' })
    expect(result.sources.smhi.status).toBe('ok')
    expect(result.datasets.dayAheadPrices.status).toBe('not_configured')
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })
})