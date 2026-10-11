import { describe, expect, it, vi } from 'vitest'
import { clearCertSeCache, getCertSeAdvisories, parseCertSeAtom } from './certSeAdapter.mjs'

const sampleAtomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>CERT-SE</title>
  <updated>2026-10-09T12:25:00+02:00</updated>
  <entry>
    <title>Kritisk sårbarhet i FortiMail</title>
    <id>https://www.cert.se/2026/10/kritisk-sarbarhet-i-fortimail.html</id>
    <updated>2026-10-02T13:30:00+02:00</updated>
    <published>2026-10-02T13:30:00+02:00</published>
    <link rel="alternate" href="https://www.cert.se/2026/10/kritisk-sarbarhet-i-fortimail.html" />
    <summary type="html">&lt;p&gt;CERT-SE har publicerat information om en kritisk sårbarhet i FortiMail. Sårbarheten har fått en CVSS-klassning på 9.8.&lt;/p&gt;</summary>
  </entry>
  <entry>
    <title>CERT-SE:s veckobrev v.41</title>
    <id>https://www.cert.se/2026/10/cert-se-veckobrev-v41.html</id>
    <updated>2026-10-09T12:25:00+02:00</updated>
    <published>2026-10-09T12:25:00+02:00</published>
    <link rel="alternate" href="https://www.cert.se/2026/10/cert-se-veckobrev-v41.html" />
    <summary type="html">&lt;p&gt;CERT-SE:s veckobrev innehåller som vanligt ett urval av nyheter och analyser.&lt;/p&gt;</summary>
  </entry>
  <entry>
    <title>Företag bekräftar omfattande dataintrång</title>
    <id>https://www.cert.se/2026/10/dataintrang.html</id>
    <updated>2026-10-07T10:00:00+02:00</updated>
    <published>2026-10-07T10:00:00+02:00</published>
    <link rel="alternate" href="https://www.cert.se/2026/10/dataintrang.html" />
    <summary type="html">&lt;p&gt;Dataintrång har drabbat kunddatabaser genom aktivt utnyttjande av stulna uppgifter.&lt;/p&gt;</summary>
  </entry>
</feed>`

describe('CERT-SE Atom adapter', () => {
  it('parses Atom entries and classifies verified incidents, critical warnings, and technical observations', () => {
    const parsed = parseCertSeAtom(sampleAtomXml, new Date('2026-10-10T12:00:00Z'))

    expect(parsed.items).toHaveLength(3)

    const incident = parsed.items.find((item) => item.title.includes('dataintrång'))
    expect(incident.kind).toBe('verified_incident')
    expect(incident.severity).toBe('critical')
    expect(incident.verified).toBe(true)

    const warning = parsed.items.find((item) => item.title.includes('FortiMail'))
    expect(warning.kind).toBe('warning')
    expect(warning.severity).toBe('critical')

    const observation = parsed.items.find((item) => item.title.includes('veckobrev'))
    expect(observation.kind).toBe('technical_observation')
    expect(observation.severity).toBe('elevated')
  })

  it('fetches live feed and preserves provenance with caching', async () => {
    clearCertSeCache()
    const fetchImpl = vi.fn(async () => new Response(sampleAtomXml, { status: 200, headers: { 'Content-Type': 'application/atom+xml' } }))

    const result = await getCertSeAdvisories({ fetchImpl, now: new Date('2026-10-10T12:00:00Z') })
    expect(result.state).toBe('ok')
    expect(result.items.length).toBe(3)
    expect(result.provenance.source).toBe('CERT-SE')
    expect(result.provenance.requiresAuth).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    // Second call uses cache
    const cachedResult = await getCertSeAdvisories({ fetchImpl, now: new Date('2026-10-10T12:02:00Z') })
    expect(cachedResult.cached).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('marks error state when network fails and no cache exists', async () => {
    clearCertSeCache()
    const fetchImpl = vi.fn(async () => new Response('Server error', { status: 500 }))

    const result = await getCertSeAdvisories({ fetchImpl, now: new Date('2026-10-10T12:00:00Z') })
    expect(result.state).toBe('error')
    expect(result.items).toEqual([])
    expect(result.lastError).toContain('HTTP 500')
  })
})
