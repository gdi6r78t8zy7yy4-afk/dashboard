import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCisaKevCache,
  getCisaKevData,
  normalizeCisaKevItem,
} from './cisaKevAdapter.mjs'

describe('cisaKevAdapter', () => {
  beforeEach(() => {
    clearCisaKevCache()
  })

  it('normalizes CISA KEV item with classification tier and disambiguation notice', () => {
    const raw = {
      cveID: 'CVE-2024-38077',
      vendorProject: 'Microsoft',
      product: 'Windows Remote Desktop Licensing Service',
      vulnerabilityName: 'Windows RDL Heap Overflow Vulnerability',
      dateAdded: '2024-07-10',
      shortDescription: 'Heap-based buffer overflow allowing remote code execution.',
      requiredAction: 'Apply mitigations per vendor instructions.',
      dueDate: '2024-07-31',
      knownRansomwareCampaignUse: 'Known',
      cwes: ['CWE-122'],
      notes: 'https://nvd.nist.gov/vuln/detail/CVE-2024-38077',
    }

    const item = normalizeCisaKevItem(raw, '2026-10-11T00:00:00.000Z')

    expect(item.cveID).toBe('CVE-2024-38077')
    expect(item.vendor).toBe('Microsoft')
    expect(item.product).toBe('Windows Remote Desktop Licensing Service')
    expect(item.isRansomwareKnown).toBe(true)
    expect(item.severity).toBe('critical')
    expect(item.classificationKind).toBe('exploited_vulnerability')
    expect(item.classificationLabel).toBe('Sårbarhet med känd exploatering')
    expect(item.disambiguationNotice).toContain('Det innebär inte automatiskt att sårbarheten utnyttjas i Sverige')
  })

  it('fetches and parses CISA KEV JSON with mock fetch', async () => {
    const mockJson = {
      title: 'CISA Known Exploited Vulnerabilities',
      catalogVersion: '2026.10.08',
      dateReleased: '2026-10-08T00:00:00Z',
      count: 2,
      vulnerabilities: [
        {
          cveID: 'CVE-2023-38606',
          vendorProject: 'Apple',
          product: 'iOS',
          vulnerabilityName: 'Apple iOS Privilege Escalation',
          dateAdded: '2023-07-25',
          shortDescription: 'Kernel vulnerability allowing root access.',
          knownRansomwareCampaignUse: 'Unknown',
          cwes: ['CWE-269'],
        },
        {
          cveID: 'CVE-2024-21413',
          vendorProject: 'Microsoft',
          product: 'Outlook',
          vulnerabilityName: 'Microsoft Outlook Remote Code Execution',
          dateAdded: '2024-02-14',
          shortDescription: 'MonikerLink vulnerability in Outlook.',
          knownRansomwareCampaignUse: 'Known',
          cwes: ['CWE-78'],
        },
      ],
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockJson,
    })

    const res = await getCisaKevData({ fetchImpl: mockFetch, now: new Date('2026-10-11T10:00:00Z') })

    expect(res.state).toBe('ok')
    expect(res.catalogVersion).toBe('2026.10.08')
    expect(res.count).toBe(2)
    expect(res.items.length).toBe(2)
    expect(res.items[0].cveID).toBe('CVE-2024-21413') // Sorted newest dateAdded first
    expect(res.items[0].isRansomwareKnown).toBe(true)
    expect(res.cached).toBe(false)
  })

  it('falls back to secondary URL when primary fails', async () => {
    const mockFetch = vi.fn()
      // First call fails
      .mockRejectedValueOnce(new Error('Connection reset'))
      // Second call succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          catalogVersion: '2026.10.08-mirror',
          count: 1,
          vulnerabilities: [
            {
              cveID: 'CVE-2024-1111',
              vendorProject: 'TestVendor',
              product: 'TestProd',
              dateAdded: '2024-01-01',
            },
          ],
        }),
      })

    const res = await getCisaKevData({ fetchImpl: mockFetch })
    expect(res.state).toBe('ok')
    expect(res.catalogVersion).toBe('2026.10.08-mirror')
    expect(res.items[0].cveID).toBe('CVE-2024-1111')
  })
})
