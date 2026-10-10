import { describe, expect, it, vi } from 'vitest'
import { getIodaOutages, parseIodaEvents, parseIodaSignal } from './telecomIoda.mjs'
import { getRipeRouting, parseCountryRoutingStats } from './telecomRipe.mjs'

describe('RIPEstat telecom adapter', () => {
  it('normalizes country route statistics without implying mobile availability', () => {
    expect(parseCountryRoutingStats({ data: { stats: [
      { stats_date: '2026-10-09T00:00:00', v4_prefixes_ris: 5700, v6_prefixes_ris: 930, asns_ris: 640 },
    ] } })).toEqual([{ date: '2026-10-09T00:00:00', ipv4Prefixes: 5700, ipv6Prefixes: 930, routedAsns: 640 }])
  })

  it('requests bounded country routing history and latest ASN counts', async () => {
    const fetchImpl = vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('country-routing-stats')) {
        return Response.json({ status: 'ok', data: { resolution: '1d', stats: [{ stats_date: '2026-10-09T00:00:00', v4_prefixes_ris: 10, v6_prefixes_ris: 2, asns_ris: 4 }] } })
      }
      return Response.json({ status: 'ok', data: { countries: [{ resource: 'SE', stats: { registered: 5, routed: 4 } }], query_time: '2026-10-09T00:00:00' } })
    })
    const result = await getRipeRouting({ country: 'SE', period: '7d', fetchImpl, now: new Date('2026-10-10T12:00:00Z') })
    expect(result.state).toBe('ok')
    expect(result.data.latest?.ipv4Prefixes).toBe(10)
    expect(result.data.registeredAsns).toBe(5)
    expect(result.provenance.geographicPrecision).toBe('country')
    expect(result.note).toContain('do not measure mobile network availability')
    expect(fetchImpl.mock.calls.some(([input]) => String(input).includes('starttime='))).toBe(true)
  })
})

describe('IODA telecom adapter', () => {
  it('normalizes event times and deduplicates alerts from overlapping endpoints', () => {
    const event = { id: 'e1', entityName: 'Sweden', startTime: 1791500000, endTime: 1791501800, severity: 'warning', summary: 'Internet signal anomaly' }
    expect(parseIodaEvents([{ data: [event] }, { data: [event] }])).toEqual([{
      id: 'e1',
      entityName: 'Sweden',
      datasource: null,
      startedAt: new Date(1791500000 * 1000).toISOString(),
      endedAt: new Date(1791501800 * 1000).toISOString(),
      severity: 'warning',
      summary: 'Internet signal anomaly',
    }])
  })

  it('normalizes the country signal series at its provider step', () => {
    expect(parseIodaSignal({ data: [{ entityType: 'country', entityCode: 'SE', from: 100, step: 60, values: [0, 1] }] })).toEqual([
      { timestamp: new Date(100000).toISOString(), value: 0 },
      { timestamp: new Date(160000).toISOString(), value: 1 },
    ])
  })

  it('keeps an empty IODA period distinct from healthy operator status', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ type: 'ioda', error: null, data: [] }))
    const result = await getIodaOutages({ country: 'SE', period: '7d', fetchImpl, now: new Date('2026-10-10T12:00:00Z') })
    expect(result.state).toBe('unavailable')
    expect(result.data.events).toEqual([])
    expect(result.data.signal).toEqual([])
    expect(result.note).toContain('not confirmation')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(fetchImpl.mock.calls.every(([input]) => String(input).includes('179'))).toBe(true)
  })
})