import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearInternetCache,
  getAsnBgpActivity,
  getBackboneRoutingStatus,
  getInternetDashboard,
  getIodaOutageEvents,
  KEY_BACKBONES,
} from './internetService.mjs'

describe('internet infrastructure service', () => {
  beforeEach(() => {
    clearInternetCache()
  })

  it('aggregates RIPEstat, RIPE RIS, IODA and Cloudflare with source provenance', async () => {
    const mockFetch = vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('country-routing-stats')) {
        return Response.json({
          status: 'ok',
          data: {
            resolution: '1d',
            stats: [
              { stats_date: '2026-10-09T00:00:00', v4_prefixes_ris: 5720, v6_prefixes_ris: 935, asns_ris: 638 },
              { stats_date: '2026-10-10T00:00:00', v4_prefixes_ris: 5725, v6_prefixes_ris: 936, asns_ris: 639 },
            ],
          },
        })
      }
      if (url.includes('country-asns')) {
        return Response.json({
          status: 'ok',
          data: {
            countries: [{ resource: 'SE', stats: { registered: 864, routed: 672 } }],
            query_time: '2026-10-10T12:00:00Z',
          },
        })
      }
      if (url.includes('routing-status')) {
        return Response.json({
          status: 'ok',
          data: {
            visibility: {
              v4: { ris_peers_seeing: 326, total_ris_peers: 327 },
              v6: { ris_peers_seeing: 318, total_ris_peers: 318 },
            },
            query_time: '2026-10-10T12:00:00Z',
          },
        })
      }
      if (url.includes('as-overview')) {
        return Response.json({
          status: 'ok',
          data: {
            holder: 'SUNET - Vetenskapsradet / SUNET',
            announced: true,
          },
        })
      }
      if (url.includes('bgp-update-activity')) {
        return Response.json({
          status: 'ok',
          data: {
            sampling_resolution: '1h',
            updates: [
              { starttime: '2026-10-10T00:00:00', announcements: 12, withdrawals: 2 },
              { starttime: '2026-10-10T01:00:00', announcements: 15, withdrawals: 1 },
            ],
          },
        })
      }
      if (url.includes('outages/events')) {
        return Response.json({
          data: [
            {
              location: 'geoasn/1653-SE',
              location_name: 'SUNET -- Sweden',
              datasource: 'bgp',
              start: 1789892700,
              duration: 1800,
              score: 500,
            },
          ],
        })
      }
      if (url.includes('signals/events/country')) {
        return Response.json({
          data: [
            {
              entityType: 'country',
              entityCode: 'SE',
              from: 1789890000,
              step: 1800,
              values: [0.99, 1.0],
            },
          ],
        })
      }
      return Response.json({ data: [] })
    })

    const result = await getInternetDashboard({
      region: 'se',
      period: '7d',
      asn: '1653',
      fetchImpl: mockFetch,
      now: new Date('2026-10-10T12:00:00Z'),
    })

    expect(result.region).toBe('se')
    expect(result.regionLabel).toBe('Sverige')
    expect(result.sources).toHaveLength(4)

    // Check Cloudflare Radar auth requirement transparently reported
    const cf = result.sources.find((s) => s.id === 'cloudflare-radar')
    expect(cf).toBeDefined()
    expect(cf?.state).toBe('unavailable')
    expect(cf?.disclaimer).toContain('CLOUDFLARE_API_TOKEN')

    // Check RIPE RIS and RIPEstat
    expect(result.routing.state).toBe('ok')
    expect(result.routing.data.history).toHaveLength(2)
    expect(result.routing.data.latest?.ipv4Prefixes).toBe(5725)

    // Check backbone ASNs
    expect(result.backbones.length).toBeGreaterThanOrEqual(1)
    const sunet = result.backbones.find((b) => b.asn === '1653')
    expect(sunet).toBeDefined()
    expect(sunet?.announced).toBe(true)
    expect(sunet?.v4VisibilityPct).toBe(99.7)

    // Check BGP activity
    expect(result.asnActivity.state).toBe('ok')
    expect(result.asnActivity.updates).toHaveLength(2)

    // Check IODA events
    expect(result.iodaEvents.state).toBe('ok')
    expect(result.iodaEvents.events[0].locationName).toBe('SUNET -- Sweden')
  })

  it('separates routing observation from outage interpretation', async () => {
    const mockFetch = vi.fn(async () => Response.json({
      data: [{
        location: 'asn/1257',
        location_name: 'Tele2 SWIPnet',
        datasource: 'bgp',
        start: 1789892700,
        score: 1200,
      }],
    }))

    const events = await getIodaOutageEvents({
      region: 'se',
      period: '24h',
      fetchImpl: mockFetch,
      now: new Date('2026-10-10T12:00:00Z'),
    })

    expect(events.events).toHaveLength(1)
    expect(events.events[0].interpretation).toContain('BGP-routingförändring detekterad')
    expect(events.events[0].interpretation).toContain('inte nödvändigtvis ett avbrott hos slutanvändare')
  })

  it('supports regional aggregation for nordics and europe', async () => {
    const mockFetch = vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('country-routing-stats')) {
        return Response.json({
          status: 'ok',
          data: { stats: [{ stats_date: '2026-10-10T00:00:00', v4_prefixes_ris: 1000, v6_prefixes_ris: 200, asns_ris: 300 }] },
        })
      }
      if (url.includes('country-asns')) {
        return Response.json({ status: 'ok', data: { countries: [{ stats: { registered: 400, routed: 300 } }] } })
      }
      return Response.json({ data: [] })
    })

    const nordics = await getInternetDashboard({
      region: 'nordics',
      period: '7d',
      fetchImpl: mockFetch,
      now: new Date('2026-10-10T12:00:00Z'),
    })

    expect(nordics.region).toBe('nordics')
    expect(nordics.countries).toEqual(['DK', 'FI', 'IS', 'NO', 'SE'])
    expect(nordics.multiCountryRouting.length).toBeGreaterThanOrEqual(1)
  })

  it('rejects invalid regions gracefully', async () => {
    await expect(getInternetDashboard({ region: 'mars' })).rejects.toThrow('Ogiltigt geografiskt område')
  })
})
