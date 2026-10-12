import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SVK_API_BASE,
  SVK_RESOURCES,
  clearSvkCache,
  getSvkPortalStatus,
  getSvkPhysicalFlows,
  getSvkBalancingReserves,
  getSvkEnergyData,
} from './svkAdapter.mjs'

describe('Svenska kraftnät CKAN API adapter', () => {
  beforeEach(() => {
    clearSvkCache()
  })
  it('defines the correct base endpoint and resource IDs for Svenska kraftnät', () => {
    expect(SVK_API_BASE).toBe('https://data.svk.se/sv/api/3/action')
    expect(SVK_RESOURCES.flows).toBe('4aa94b88-9f42-4f0a-a6a8-8e47aadc782a')
    expect(SVK_RESOURCES.mfrr).toBe('0c56e30d-8fce-4c27-afc8-621c230ae34d')
    expect(SVK_RESOURCES.afrr).toBe('6351d2cc-1657-43eb-b112-b8408c700529')
  })

  it('queries status_show from data.svk.se and parses portal metadata', async () => {
    const mockFetch = vi.fn(async (url) => {
      expect(String(url)).toContain(`${SVK_API_BASE}/status_show`)
      return new Response(JSON.stringify({
        help: 'https://data.svk.se/sv/api/3/action/help_show?name=status_show',
        success: true,
        result: {
          site_title: 'Svenska Kraftnät Data Service',
          site_url: 'https://data.svk.se',
          ckan_version: '2.11.6',
        },
      }), { status: 200 })
    })

    const status = await getSvkPortalStatus({ fetchImpl: mockFetch })
    expect(status.status).toBe('ok')
    expect(status.endpoint).toBe(SVK_API_BASE)
    expect(status.siteTitle).toBe('Svenska Kraftnät Data Service')
    expect(status.ckanVersion).toBe('2.11.6')
  })

  it('handles portal network errors gracefully', async () => {
    const mockFetch = vi.fn(async () => {
      throw new Error('Network timeout')
    })

    const status = await getSvkPortalStatus({ fetchImpl: mockFetch })
    expect(status.status).toBe('error')
    expect(status.error).toContain('Network timeout')
  })

  it('fetches physical flows and groups them by neighbor for a bidding zone', async () => {
    const mockFetch = vi.fn(async (url) => {
      expect(String(url)).toContain(SVK_RESOURCES.flows)
      return new Response(JSON.stringify({
        success: true,
        result: {
          records: [
            {
              _id: 1,
              start_time_sweden: '2026-10-12T11:45:00',
              start_time_utc: '2026-10-12T09:45:00',
              from_bidding_zone: 'SE3',
              to_bidding_zone: 'SE4',
              power: 2314.48,
              power_unit: 'MW',
            },
            {
              _id: 2,
              start_time_sweden: '2026-10-12T11:45:00',
              start_time_utc: '2026-10-12T09:45:00',
              from_bidding_zone: 'SE2',
              to_bidding_zone: 'SE3',
              power: 6444.56,
              power_unit: 'MW',
            },
            {
              _id: 3,
              start_time_sweden: '2026-10-12T11:45:00',
              start_time_utc: '2026-10-12T09:45:00',
              from_bidding_zone: 'SE3',
              to_bidding_zone: 'DK1',
              power: 14.87,
              power_unit: 'MW',
            },
          ],
        },
      }), { status: 200 })
    })

    const flows = await getSvkPhysicalFlows({ zone: 'SE3', limit: 10, fetchImpl: mockFetch })
    expect(flows.status).toBe('ok')
    expect(flows.zone).toBe('SE3')
    expect(flows.neighbors.length).toBe(3)

    const se4Group = flows.neighbors.find((n) => n.neighbor === 'SE4')
    expect(se4Group).toBeDefined()
    expect(se4Group.latestExport.value).toBe(2314.48)
    expect(se4Group.latestExport.unit).toBe('MW')

    const se2Group = flows.neighbors.find((n) => n.neighbor === 'SE2')
    expect(se2Group).toBeDefined()
    expect(se2Group.latestImport.value).toBe(6444.56)
  })

  it('fetches balancing capacity market reserves (mFRR & aFRR)', async () => {
    const mockFetch = vi.fn(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes(SVK_RESOURCES.mfrr)) {
        return new Response(JSON.stringify({
          success: true,
          result: {
            records: [
              {
                bidding_zone: 'SE3',
                reserve_product: 'mFRRCapacityMarket',
                reserve_direction: 'up',
                price: 7.5,
                price_unit: 'EUR-MW',
                volume: 550,
                volume_unit: 'MW',
                start_time_sweden: '2026-10-12T23:00:00',
                start_time_utc: '2026-10-12T21:00:00',
              },
              {
                bidding_zone: 'SE3',
                reserve_product: 'mFRRCapacityMarket',
                reserve_direction: 'down',
                price: 1.0,
                price_unit: 'EUR-MW',
                volume: 157,
                volume_unit: 'MW',
                start_time_sweden: '2026-10-12T23:00:00',
                start_time_utc: '2026-10-12T21:00:00',
              },
            ],
          },
        }), { status: 200 })
      }
      if (urlStr.includes(SVK_RESOURCES.afrr)) {
        return new Response(JSON.stringify({
          success: true,
          result: {
            records: [
              {
                bidding_zone: 'SE3',
                reserve_product: 'aFRRCapacityMarket',
                reserve_direction: 'up',
                price: 4.0,
                price_unit: 'EUR-MW',
                volume: 1,
                volume_unit: 'MW',
                start_time_sweden: '2026-10-12T13:00:00',
                start_time_utc: '2026-10-12T11:00:00',
              },
            ],
          },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 })
    })

    const reserves = await getSvkBalancingReserves({ zone: 'SE3', fetchImpl: mockFetch })
    expect(reserves.status).toBe('ok')
    expect(reserves.mfrr.latest.latestUp.volume).toBe(550)
    expect(reserves.mfrr.latest.latestUp.price).toBe(7.5)
    expect(reserves.mfrr.latest.latestDown.volume).toBe(157)
    expect(reserves.afrr.latest.latestUp.volume).toBe(1)
  })

  it('aggregates complete Svenska kraftnät dataset bundle via getSvkEnergyData', async () => {
    const mockFetch = vi.fn(async (url) => {
      const urlStr = String(url)
      if (urlStr.includes('status_show')) {
        return new Response(JSON.stringify({
          success: true,
          result: { site_title: 'Svenska Kraftnät Data Service', site_url: 'https://data.svk.se', ckan_version: '2.11.6' },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        success: true,
        result: { records: [] },
      }), { status: 200 })
    })

    const bundle = await getSvkEnergyData({ zone: 'SE3', fetchImpl: mockFetch })
    expect(bundle.status).toBe('ok')
    expect(bundle.endpoint).toBe(SVK_API_BASE)
    expect(bundle.portal.siteTitle).toBe('Svenska Kraftnät Data Service')
  })
})
