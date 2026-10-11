import { describe, expect, it, vi } from 'vitest'
import {
  buildTrafikverketQuery,
  clearTrafikverketCache,
  getTrafikverketSituations,
  parseTrafikverketSituations,
} from './trafikverketAdapter.mjs'

const mockTrafikverketJson = {
  RESPONSE: {
    RESULT: [
      {
        Situation: [
          {
            Id: 'sit-1',
            Deviation: [
              {
                Id: 'dev-1',
                Header: 'Olycka på E4 södergående',
                Message: 'Ett körfält avstängt på grund av trafikolycka.',
                SeverityCode: 4,
                LocationDescriptor: 'E4 vid Järva krog',
                StartTime: '2026-10-10T10:30:00Z',
              },
              {
                Id: 'dev-2',
                Header: 'Vägarbete E18',
                Message: 'Underhållsarbete nattetid.',
                SeverityCode: 3,
                LocationDescriptor: 'E18 Enköping',
                StartTime: '2026-10-10T08:00:00Z',
              },
            ],
          },
        ],
      },
    ],
  },
}

describe('Trafikverket adapter', () => {
  it('builds XML query with authentication key and requested severity codes', () => {
    const xml = buildTrafikverketQuery('my-api-key', 20)
    expect(xml).toContain('authenticationkey="my-api-key"')
    expect(xml).toContain('objecttype="Situation"')
    expect(xml).toContain('limit="20"')
    expect(xml).toContain('3,4,5')
  })

  it('marks state as not_configured without replacing with fake live values when API key is missing', async () => {
    clearTrafikverketCache()
    const fetchImpl = vi.fn()
    const result = await getTrafikverketSituations({ apiKey: '', fetchImpl, now: new Date('2026-10-10T12:00:00Z') })

    expect(result.state).toBe('not_configured')
    expect(result.incidents).toEqual([])
    expect(result.lastError).toContain('API-nyckel ej konfigurerad')
    expect(result.provenance.requiresAuth).toBe(true)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('parses valid response and maps deviations into normalized incidents', () => {
    const parsed = parseTrafikverketSituations(mockTrafikverketJson, new Date('2026-10-10T12:00:00Z'))
    expect(parsed.incidents).toHaveLength(2)

    const critical = parsed.incidents.find((i) => i.id.includes('dev-1'))
    expect(critical.severity).toBe('critical')
    expect(critical.kind).toBe('warning')
    expect(critical.location).toBe('E4 vid Järva krog')
    expect(critical.category).toBe('Transport')

    const elevated = parsed.incidents.find((i) => i.id.includes('dev-2'))
    expect(elevated.severity).toBe('elevated')
  })

  it('queries API when key is configured and caches responses', async () => {
    clearTrafikverketCache()
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(mockTrafikverketJson), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await getTrafikverketSituations({
      apiKey: 'valid-test-key',
      fetchImpl,
      now: new Date('2026-10-10T12:00:00Z'),
    })

    expect(result.state).toBe('ok')
    expect(result.incidents.length).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    // Cached call
    const cached = await getTrafikverketSituations({
      apiKey: 'valid-test-key',
      fetchImpl,
      now: new Date('2026-10-10T12:02:00Z'),
    })
    expect(cached.cached).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
