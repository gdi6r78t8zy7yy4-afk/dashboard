import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addSwedishDays,
  buildElPrisUrl,
  clearElPrisCache,
  getElPrisPricesForAllAreas,
  parseElPrisPrices,
  swedishDateParts,
} from './elPrisAdapter.mjs'

/**
 * Build a full quarter-hour day (96 points) as the API serves it:
 * local Swedish time with a +02:00 offset (winter time for the test dates).
 */
function makeDayRows(year, month, day) {
  const OFFSET_MS = 2 * 3600e3
  // Render an instant as a wall-clock string in the +02:00 zone.
  const toLocalIso = (instant) => new Date(instant.getTime() + OFFSET_MS).toISOString().replace('Z', '+02:00')
  const rows = []
  for (let i = 0; i < 96; i++) {
    const start = new Date(Date.UTC(year, month - 1, day) - OFFSET_MS + i * 15 * 60e3)
    const end = new Date(start.getTime() + 15 * 60e3)
    const eurPerKWh = 0.1 + i * 0.0001
    rows.push({
      SEK_per_kWh: Math.round(eurPerKWh * 11.211 * 1e5) / 1e5,
      EUR_per_kWh: eurPerKWh,
      EXR: 11.211,
      time_start: toLocalIso(start),
      time_end: toLocalIso(end),
    })
  }
  return rows
}

function rowsForUrl(url) {
  const match = /\/prices\/(\d{4})\/(\d{2})-(\d{2})_(SE\d)\.json/.exec(String(url))
  if (!match) throw new Error(`Unexpected URL: ${url}`)
  return makeDayRows(Number(match[1]), Number(match[2]), Number(match[3]))
}

describe('el pris adapter', () => {
  beforeEach(() => {
    clearElPrisCache()
  })

  it('builds documented static JSON URLs', () => {
    expect(buildElPrisUrl({ year: 2026, month: 10, day: 13 }, 'SE3'))
      .toBe('https://www.elprisetjustnu.se/api/v1/prices/2026/10-13_SE3.json')
    expect(buildElPrisUrl({ year: 2026, month: 1, day: 2 }, 'SE1'))
      .toBe('https://www.elprisetjustnu.se/api/v1/prices/2026/01-02_SE1.json')
  })

  it('computes calendar dates in Swedish time', () => {
    // 22:30 UTC on 13 Oct is 00:30 on 14 Oct in Stockholm (still CEST, UTC+2, until 25 Oct).
    expect(swedishDateParts(new Date('2026-10-13T22:30:00Z'))).toEqual({ year: 2026, month: 10, day: 14 })
    expect(swedishDateParts(new Date('2026-06-13T22:30:00Z'))).toEqual({ year: 2026, month: 6, day: 14 })
    expect(addSwedishDays({ year: 2026, month: 10, day: 13 }, 1)).toEqual({ year: 2026, month: 10, day: 14 })
    expect(addSwedishDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 })
  })

  it('parses prices into EUR/MWh points and skips malformed rows', () => {
    const points = parseElPrisPrices([
      { SEK_per_kWh: 1.50616, EUR_per_kWh: 0.13823, EXR: 10.896049, time_start: '2026-10-13T00:00:00+02:00', time_end: '2026-10-13T00:15:00+02:00' },
      { EUR_per_kWh: 'bad', time_start: '2026-10-13T00:15:00+02:00' },
      { SEK_per_kWh: 1.0, EUR_per_kWh: 0.09, time_start: 'not-a-date' },
    ])
    expect(points).toEqual([
      {
        timestamp: '2026-10-12T22:00:00.000Z',
        value: 138.23,
        sekPerKWh: 1.50616,
        eurPerKWh: 0.13823,
        exr: 10.896049,
      },
    ])
    expect(parseElPrisPrices(null)).toEqual([])
  })

  it('returns today and tomorrow for all Swedish zones with a current price', async () => {
    const fetchImpl = vi.fn(async (url) => new Response(JSON.stringify(rowsForUrl(url)), { status: 200 }))
    const now = new Date('2026-10-13T10:00:00Z') // 12:00 Swedish time
    const result = await getElPrisPricesForAllAreas({ fetchImpl, now })

    expect(Object.keys(result)).toEqual(['SE1', 'SE2', 'SE3', 'SE4'])
    expect(fetchImpl).toHaveBeenCalledTimes(8) // today + tomorrow × 4 zones

    const se3 = result.SE3
    expect(se3.state).toBe('ok')
    expect(se3.unit).toBe('EUR/MWh')
    expect(se3.data).toHaveLength(192)
    expect(se3.today.state).toBe('ok')
    expect(se3.tomorrow.state).toBe('ok')
    expect(se3.today.points).toHaveLength(96)
    expect(se3.tomorrow.points).toHaveLength(96)
    // 96 quarter-hour points on 13 Oct followed by 96 on 14 Oct, in order.
    expect(se3.data[0].timestamp).toBe('2026-10-12T22:00:00.000Z')
    expect(se3.data.at(-1).timestamp).toBe('2026-10-14T21:45:00.000Z')

    // Current price is the latest point that has started by now (12:00 Swedish time).
    expect(se3.current.timestamp).toBe('2026-10-13T10:00:00.000Z')
    expect(se3.lastUpdated).toBe(se3.current.timestamp)
  })

  it('treats an unpublished tomorrow as ok when today is available', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/10-14_')) return new Response('Not found', { status: 404 })
      return new Response(JSON.stringify(rowsForUrl(url)), { status: 200 })
    })
    const result = await getElPrisPricesForAllAreas({ fetchImpl, now: new Date('2026-10-13T10:00:00Z') })

    expect(result.SE1.state).toBe('ok')
    expect(result.SE1.today.state).toBe('ok')
    expect(result.SE1.tomorrow.state).toBe('missing')
    expect(result.SE1.data).toHaveLength(96)
    expect(result.SE1.note).toContain('Morgondagens priser ej publicerade')
  })

  it('reports errors per zone without rejecting the whole response', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('_SE2')) throw new Error('network down')
      return new Response(JSON.stringify(rowsForUrl(url)), { status: 200 })
    })
    const result = await getElPrisPricesForAllAreas({ fetchImpl, now: new Date('2026-10-13T10:00:00Z') })

    expect(result.SE2.state).toBe('error')
    expect(result.SE2.note).toContain('network down')
    expect(result.SE3.state).toBe('ok')
  })

  it('marks a zone missing when the source publishes nothing', async () => {
    const fetchImpl = vi.fn(async () => new Response('[]', { status: 200 }))
    const result = await getElPrisPricesForAllAreas({ fetchImpl, now: new Date('2026-10-13T10:00:00Z') })
    expect(result.SE4.state).toBe('missing')
    expect(result.SE4.current).toBeNull()
  })

  it('caches zone-day results so repeated calls do not refetch', async () => {
    const fetchImpl = vi.fn(async (url) => new Response(JSON.stringify(rowsForUrl(url)), { status: 200 }))
    const now = new Date('2026-10-13T10:00:00Z')

    await getElPrisPricesForAllAreas({ fetchImpl, now })
    const second = await getElPrisPricesForAllAreas({ fetchImpl, now })

    expect(fetchImpl).toHaveBeenCalledTimes(8)
    expect(second.SE3.data).toHaveLength(192)
  })
})
