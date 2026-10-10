import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTelecomCache, getTelecomDashboard } from './telecomService.mjs'

const source = (data = [], state = 'ok') => ({
  state,
  provenance: { source: 'test source', sourceUrl: 'https://example.invalid', retrievedAt: '2026-10-10T12:00:00.000Z', observedAt: '2026-10-10T11:00:00.000Z', referencePeriod: 'test', geographicPrecision: 'country', resolution: 'test', quality: 'routing-observation' },
  data,
  note: null,
})

describe('telecom dashboard service', () => {
  beforeEach(() => clearTelecomCache())

  it('combines independent sources and leaves operator availability unavailable', async () => {
    const adapters = {
      pts: vi.fn(async () => ({ counties: [{ code: '01', name: 'Stockholms län', mobile5g8Db: { value: 92, qualifier: 'exact' } }], retrievedAt: '2026-10-10T12:00:00.000Z', requestedAt: '2026-10-10T12:00:00.000Z', referencePeriod: '2025-11' })),
      ripe: vi.fn(async () => source({ history: [], latest: null, registeredAsns: 5, routedAsns: 4 })),
      ioda: vi.fn(async () => source({ events: [], signal: [{ timestamp: '2026-10-10T11:00:00.000Z', value: 0 }] })),
    }
    const result = await getTelecomDashboard({ region: 'se', period: '7d', now: new Date('2026-10-10T12:00:00Z'), adapters })
    expect(result.mode).toBe('live')
    expect(result.coverage.data[0].name).toBe('Stockholms län')
    expect(result.coverage.provenance.referencePeriod).toBe('2025-11')
    expect(result.operatorStatus.state).toBe('unavailable')
    expect(result.notices.state).toBe('unavailable')
    expect(adapters.ripe).toHaveBeenCalledWith(expect.objectContaining({ country: 'SE', period: '7d' }))
  })

  it('does not relabel Swedish data as another region', async () => {
    const adapters = { pts: vi.fn(), ripe: vi.fn(), ioda: vi.fn() }
    const result = await getTelecomDashboard({ region: 'no', period: '24h', adapters })
    expect(result.mode).toBe('no_data')
    expect(result.coverage.state).toBe('not_applicable')
    expect(result.routing.state).toBe('not_applicable')
    expect(result.internetIncidents.state).toBe('not_applicable')
    expect(result.routing.data.history).toEqual([])
    expect(result.internetIncidents.data).toMatchObject({ events: [], signal: [], country: 'NO', period: '24h' })
    expect(result.operatorStatus.state).toBe('unavailable')
    expect(adapters.pts).not.toHaveBeenCalled()
  })

  it('rejects unsupported periods and briefly caches an identical successful query', async () => {
    const adapters = {
      pts: vi.fn(async () => ({ counties: [], retrievedAt: '2026-10-10T12:00:00.000Z', requestedAt: '2026-10-10T12:00:00.000Z', referencePeriod: '2025-11' })),
      ripe: vi.fn(async () => source({ history: [], latest: null, registeredAsns: null, routedAsns: null })),
      ioda: vi.fn(async () => source({ events: [], signal: [] }, 'unavailable')),
    }
    await expect(getTelecomDashboard({ region: 'se', period: '90d', adapters })).rejects.toThrow('Unsupported telecom period')
    await getTelecomDashboard({ region: 'se', period: '24h', now: new Date('2026-10-10T12:00:00Z'), adapters })
    const cached = await getTelecomDashboard({ region: 'se', period: '24h', now: new Date('2026-10-10T12:00:20Z'), adapters })
    expect(cached.cached).toBe(true)
    expect(adapters.pts).toHaveBeenCalledTimes(1)
  })
})