import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearMispCache,
  getMispThreatData,
  isMispConfigured,
  normalizeMispAttribute,
} from './mispAdapter.mjs'

describe('mispAdapter', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    clearMispCache()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('reports not_configured when MISP_URL or MISP_API_KEY are missing', async () => {
    delete process.env.MISP_URL
    delete process.env.MISP_API_KEY

    expect(isMispConfigured()).toBe(false)
    const result = await getMispThreatData()
    expect(result.state).toBe('not_configured')
    expect(result.isConfigured).toBe(false)
    expect(result.indicators).toEqual([])
    expect(result.message).toContain('Ingen MISP-instans är konfigurerad')
  })

  it('normalizes MISP attributes with classification tier 3 (hotindikator) and disambiguation notice', () => {
    const raw = {
      id: '12345',
      event_id: '99',
      category: 'Network activity',
      type: 'ip-dst',
      value: '198.51.100.42',
      timestamp: '1700000000',
      comment: 'C2 IP observed in adversary activity',
      to_ids: true,
    }

    const item = normalizeMispAttribute(raw, '2026-10-11T00:00:00Z')
    expect(item.id).toBe('12345')
    expect(item.type).toBe('ip-dst')
    expect(item.value).toBe('198.51.100.42')
    expect(item.classificationKind).toBe('threat_indicator')
    expect(item.classificationLabel).toBe('Hotindikator observerad i ett flöde')
    expect(item.disambiguationNotice).toContain('Det innebär INTE att ditt nätverk har komprometterats')
  })

  it('fetches and normalizes threat indicators when configured', async () => {
    process.env.MISP_URL = 'https://misp.example.org'
    process.env.MISP_API_KEY = 'secret-test-key-12345'

    expect(isMispConfigured()).toBe(true)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          Attribute: [
            {
              id: '42',
              event_id: '10',
              category: 'Payload delivery',
              type: 'sha256',
              value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              comment: 'Ransomware binary hash',
              to_ids: true,
            },
          ],
        },
      }),
    })

    const res = await getMispThreatData({ fetchImpl: mockFetch })
    expect(res.state).toBe('ok')
    expect(res.isConfigured).toBe(true)
    expect(res.instanceHost).toBe('misp.example.org')
    expect(res.indicators.length).toBe(1)
    expect(res.indicators[0].value).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    // Ensure the secret key was never returned in the response object
    expect(JSON.stringify(res)).not.toContain('secret-test-key-12345')
  })
})
