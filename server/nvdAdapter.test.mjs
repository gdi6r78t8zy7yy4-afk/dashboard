import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearNvdCache,
  extractCvssMetrics,
  getNvdRecentCves,
  normalizeNvdCve,
} from './nvdAdapter.mjs'

describe('nvdAdapter', () => {
  beforeEach(() => {
    clearNvdCache()
  })

  it('extracts CVSS v3.1 metrics correctly', () => {
    const metrics = {
      cvssMetricV31: [
        {
          type: 'Primary',
          cvssData: {
            version: '3.1',
            vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
            baseScore: 9.8,
            baseSeverity: 'CRITICAL',
          },
        },
      ],
    }

    const cvss = extractCvssMetrics(metrics)
    expect(cvss.version).toBe('3.1')
    expect(cvss.baseScore).toBe(9.8)
    expect(cvss.baseSeverity).toBe('CRITICAL')
  })

  it('normalizes NVD CVE with disambiguation notice and classification', () => {
    const raw = {
      id: 'CVE-2024-38077',
      published: '2024-07-09T17:15:42.430',
      lastModified: '2024-07-10T12:00:00.000',
      descriptions: [
        { lang: 'en', value: 'Windows Remote Desktop Licensing Service Remote Code Execution Vulnerability' },
      ],
      metrics: {
        cvssMetricV31: [
          {
            type: 'Primary',
            cvssData: {
              version: '3.1',
              baseScore: 9.8,
              baseSeverity: 'CRITICAL',
            },
          },
        ],
      },
    }

    const normalized = normalizeNvdCve(raw, '2026-10-11T00:00:00Z')
    expect(normalized.cveId).toBe('CVE-2024-38077')
    expect(normalized.cvssScore).toBe(9.8)
    expect(normalized.severity).toBe('critical')
    expect(normalized.classificationKind).toBe('cve_record')
    expect(normalized.disambiguationNotice).toContain('Det innebär INTE att en svensk organisation eller infrastruktur har angripits')
  })

  it('fetches recent CVEs with date window and handles error gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        totalResults: 1,
        vulnerabilities: [
          {
            cve: {
              id: 'CVE-2024-9999',
              descriptions: [{ lang: 'en', value: 'Test description' }],
              metrics: {},
            },
          },
        ],
      }),
    })

    const res = await getNvdRecentCves({ fetchImpl: mockFetch })
    expect(res.state).toBe('ok')
    expect(res.items.length).toBe(1)
    expect(res.items[0].cveId).toBe('CVE-2024-9999')
  })
})
