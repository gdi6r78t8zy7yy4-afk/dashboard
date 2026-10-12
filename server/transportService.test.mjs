import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearTransportCache,
  getTransportAviationData,
  getTransportDashboard,
  getTransportRailData,
  getTransportRoadData,
  parseWgs84Geometry,
} from './transportService.mjs'

describe('Transport Service & Adapters', () => {
  beforeEach(() => {
    clearTransportCache()
  })

  it('parses WGS84 LineString and Point geometries correctly', () => {
    const point = parseWgs84Geometry('POINT (18.06 59.33)')
    expect(point).toEqual({ longitude: 18.06, latitude: 59.33 })

    const line = parseWgs84Geometry('LINESTRING (20.96 64.75, 20.97 64.75)')
    expect(line).toEqual({ longitude: 20.96, latitude: 64.75 })

    expect(parseWgs84Geometry(null)).toBeNull()
    expect(parseWgs84Geometry('INVALID')).toBeNull()
  })

  it('handles missing Trafikverket API key cleanly as not_configured', async () => {
    const result = await getTransportRoadData({ apiKey: '', now: new Date('2026-10-10T12:00:00Z') })
    expect(result.status).toBe('not_configured')
    expect(result.items).toHaveLength(0)
    expect(result.error).toContain('Trafikverket API-nyckel saknas')
    expect(result.provenance.requiresAuth).toBe(true)

    const railResult = await getTransportRailData({ apiKey: '', now: new Date('2026-10-10T12:00:00Z') })
    expect(railResult.status).toBe('not_configured')
    expect(railResult.items).toHaveLength(0)
  })

  it('fetches and normalizes road conditions from Trafikverket RoadCondition API', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({
        RESPONSE: {
          RESULT: [
            {
              RoadCondition: [
                {
                  Id: '101',
                  ConditionCode: 2,
                  ConditionText: 'Besvärligt',
                  RoadNumber: 'Väg 372',
                  LocationText: 'Skelleftehamn - Skellefteå',
                  Warning: ['Risk för halka'],
                  ConditionInfo: ['Halka', 'Frost'],
                  Geometry: { WGS84: 'LINESTRING (20.96 64.75, 21.00 64.75)' },
                  StartTime: '2026-10-12T06:00:00Z',
                },
              ],
            },
          ],
        },
      }), { status: 200 })
    })

    const road = await getTransportRoadData({ apiKey: 'test-key', fetchImpl: mockFetch, now: new Date('2026-10-12T12:00:00Z') })
    expect(road.status).toBe('ok')
    expect(road.items).toHaveLength(1)
    expect(road.items[0].roadNumber).toBe('Väg 372')
    expect(road.items[0].severity).toBe('elevated')
    expect(road.items[0].coordinates).toEqual({ longitude: 20.96, latitude: 64.75 })
  })

  it('fetches and normalizes rail cancellations and deviations from TrainAnnouncement API', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({
        RESPONSE: {
          RESULT: [
            {
              TrainAnnouncement: [
                {
                  ActivityId: 'act-1',
                  AdvertisedTrainIdent: '11159',
                  Canceled: true,
                  InformationOwner: 'Öresundståg',
                  LocationSignature: 'Fabp',
                  Deviation: [{ Description: 'Buss ersätter' }],
                  AdvertisedTimeAtLocation: '2026-10-09T21:47:00Z',
                },
              ],
            },
          ],
        },
      }), { status: 200 })
    })

    const rail = await getTransportRailData({ apiKey: 'test-key', fetchImpl: mockFetch, now: new Date('2026-10-12T12:00:00Z') })
    expect(rail.status).toBe('ok')
    expect(rail.items).toHaveLength(1)
    expect(rail.items[0].isCanceled).toBe(true)
    expect(rail.items[0].severity).toBe('critical')
    expect(rail.items[0].trainIdent).toBe('11159')
    expect(rail.items[0].operator).toBe('Öresundståg')
  })

  it('handles OpenSky rate limiting without pretending traffic is absent', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response('Rate limited', { status: 429 })
    })

    const aviation = await getTransportAviationData({ fetchImpl: mockFetch, now: new Date('2026-10-12T12:00:00Z') })
    expect(aviation.status).toBe('rate_limited')
    expect(aviation.items).toHaveLength(0)
    expect(aviation.error).toContain('hastighetsbegränsning')
  })

  it('aggregates all transport modes and filters by mode in getTransportDashboard', async () => {
    const mockFetch = vi.fn(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('api.trafikinfo.trafikverket.se')) {
        return new Response(JSON.stringify({
          RESPONSE: {
            RESULT: [
              {
                RoadCondition: [{ Id: 'r1', ConditionCode: 3, Warning: ['Halka'] }],
                TrainAnnouncement: [{ ActivityId: 't1', Canceled: true, AdvertisedTrainIdent: '99' }],
              },
            ],
          },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        time: 1700000000,
        states: [
          ['icao1', 'SAS101', 'Sweden', 1700000000, null, 18.0, 59.0, 8000, false, 220, 90],
        ],
      }), { status: 200 })
    })

    const all = await getTransportDashboard({ mode: 'all', apiKey: 'key', fetchImpl: mockFetch })
    expect(all.sources.trafikverketRoad).toBeDefined()
    expect(all.sources.trafikverketRail).toBeDefined()
    expect(all.sources.openSky).toBeDefined()
    expect(all.metrics.roadIncidents).toBeGreaterThanOrEqual(1)
    expect(all.metrics.railCanceledCount).toBeGreaterThanOrEqual(1)
    expect(all.metrics.observedAircraft).toBe(1)
  })
})
