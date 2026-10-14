import { describe, expect, it, vi } from 'vitest'
import { buildEntsoeUrl, getEnergyArea, getEnergyData, intervalFor, normalizeEntsoeUnit, parseEntsoeXml, utcParameter } from './energyData.mjs'

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
    const result = await getEnergyData({ country: 'se', zone: 'SE3', period: '24h', token: '', fetchImpl, now: new Date('2026-10-10T12:00:00Z'), enableSvk: false })
    expect(result.mode).toBe('partial')
    expect(result.sources.entsoe.status).toBe('not_configured')
    expect(result.datasets.dayAheadPrices.status).toBe('not_configured')
    expect(result.datasets.actualGeneration.status).toBe('not_configured')
    expect(result.gridDisturbances.status).toBe('not_configured')
    expect(result.weather.every((item) => item.status === 'error')).toBe(true)
    // ENTSO-E must never be contacted without a token (elpris and SMHI are attempted separately).
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes('web-api.tp.entsoe.eu')).length).toBe(0)
    // Elpriset just nu is tried for all four zones and degrades to errors per zone.
    expect(result.sources.elpris.status).toBe('error')
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
    const result = await getEnergyData({ country: 'se', zone: 'SE3', token: '', fetchImpl, now: new Date('2026-10-10T12:00:00Z'), enableSvk: false })
    expect(result.weather.map((item) => item.status)).toEqual(['ok', 'ok', 'ok'])
    expect(result.weather[0].station).toBe('Active nearby station')
    expect(result.weather[0].points[0]).toMatchObject({ value: 12.5, quality: 'G' })
    expect(result.sources.smhi.status).toBe('ok')
    expect(result.datasets.dayAheadPrices.status).toBe('not_configured')
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes('opendata-download-metobs.smhi.se')).length).toBe(6)
  })

  it('integrates Svenska kraftnät CKAN API data (data.svk.se) into sources and flows', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('status_show')) {
        return new Response(JSON.stringify({
          success: true,
          result: { site_title: 'Svenska Kraftnät Data Service', site_url: 'https://data.svk.se', ckan_version: '2.11.6' },
        }), { status: 200 })
      }
      if (urlStr.includes('4aa94b88-9f42-4f0a-a6a8-8e47aadc782a')) {
        // Physical flows
        return new Response(JSON.stringify({
          success: true,
          result: {
            records: [
              {
                from_bidding_zone: 'SE3',
                to_bidding_zone: 'SE4',
                power: 1850.5,
                power_unit: 'MW',
                start_time_sweden: '2026-10-12T11:00:00',
                start_time_utc: '2026-10-12T09:00:00',
              },
            ],
          },
        }), { status: 200 })
      }
      if (urlStr.includes('0c56e30d-8fce-4c27-afc8-621c230ae34d')) {
        // mFRR
        return new Response(JSON.stringify({
          success: true,
          result: {
            records: [
              {
                bidding_zone: 'SE3',
                reserve_direction: 'up',
                price: 15,
                price_unit: 'EUR-MW',
                volume: 450,
                volume_unit: 'MW',
                start_time_sweden: '2026-10-12T23:00:00',
                start_time_utc: '2026-10-12T21:00:00',
              },
            ],
          },
        }), { status: 200 })
      }
      if (urlStr.includes('6351d2cc-1657-43eb-b112-b8408c700529')) {
        // aFRR
        return new Response(JSON.stringify({
          success: true,
          result: {
            records: [],
          },
        }), { status: 200 })
      }
      // Weather mock
      if (urlStr.includes('station.json')) {
        return new Response(JSON.stringify({ station: [{ key: 's1', latitude: 59.33, longitude: 18.06, active: true }] }), { status: 200 })
      }
      return new Response(JSON.stringify({ value: [{ date: 1791637200000, value: '10.0' }] }), { status: 200 })
    })

    const result = await getEnergyData({ country: 'se', zone: 'SE3', token: '', fetchImpl, now: new Date('2026-10-10T12:00:00Z') })
    expect(result.mode).toBe('live')
    expect(result.sources.svk.status).toBe('ok')
    expect(result.sources.svk.endpoint).toBe('https://data.svk.se/sv/api/3/action/')
    expect(result.sources.svk.siteTitle).toBe('Svenska Kraftnät Data Service')
    expect(result.svk).toBeDefined()
    expect(result.svk.reserves.mfrr.latest.latestUp.volume).toBe(450)

    // Check that crossBorderFlows for SE4 was populated from Svenska kraftnät
    const se4Flow = result.datasets.crossBorderFlows.find((f) => f.neighbor === 'SE4')
    expect(se4Flow).toBeDefined()
    expect(se4Flow.export.status).toBe('ok')
    expect(se4Flow.export.unit).toBe('MW')
    expect(se4Flow.export.points[0].value).toBe(1850.5)
  })

  it('formats UTC parameters strictly as 12-digit yyyyMMddHHmm without T character', () => {
    const testDate = new Date('2026-10-13T08:30:45.000Z')
    const formatted = utcParameter(testDate)
    expect(formatted).toBe('202610130830')
    expect(formatted.length).toBe(12)
    expect(formatted).not.toContain('T')
    expect(/^[0-9]{12}$/.test(formatted)).toBe(true)

    const interval = intervalFor('24h', testDate)
    expect(interval.start).toBe('202610120800')
    expect(interval.end).toBe('202610130800')
    expect(/^[0-9]{12}$/.test(interval.start)).toBe(true)
    expect(/^[0-9]{12}$/.test(interval.end)).toBe(true)
  })

  it('surfaces detailed Reason text from ENTSO-E XML error responses when HTTP 400 is returned', async () => {
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<Acknowledgement_MarketDocument xmlns="urn:iec62325.351:tc57wg16:451-1:acknowledgementdocument:7:0">
  <Reason>
    <code>999</code>
    <text>The input parameter periodStart is not valid. Valid format: yyyyMMddHHmm</text>
  </Reason>
</Acknowledgement_MarketDocument>`

    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('web-api.tp.entsoe.eu')) {
        return new Response(errorXml, { status: 400, headers: { 'Content-Type': 'application/xml' } })
      }
      return new Response('{}', { status: 200 })
    })

    const result = await getEnergyData({
      country: 'se',
      zone: 'SE3',
      period: '24h',
      token: 'valid-token',
      fetchImpl,
      now: new Date('2026-10-10T12:00:00Z'),
      enableSvk: false,
    })

    expect(result.datasets.dayAheadPrices.status).toBe('error')
    expect(result.datasets.dayAheadPrices.note).toContain('The input parameter periodStart is not valid')
  })
})