import { describe, expect, it } from 'vitest'
import { parseEuCivilProtectionRss } from './eventsEuCivilProtectionAdapter.mjs'

const sampleEchoXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>European Civil Protection and Humanitarian Aid Operations | News</title>
    <item>
      <title>Commission mobilises emergency power generators for energy grid resilience</title>
      <link>https://civil-protection-humanitarian-aid.ec.europa.eu/news/generators-2026</link>
      <pubDate>Fri, 09 Oct 2026 10:00:00 +0200</pubDate>
      <guid>https://civil-protection-humanitarian-aid.ec.europa.eu/node/991</guid>
      <description>&lt;p&gt;Under rescEU, high-capacity electricity generators are deployed to support critical power infrastructure.&lt;/p&gt;</description>
    </item>
    <item>
      <title>EU Civil Protection Forum: Strengthening transport corridors in the Nordic region</title>
      <link>https://civil-protection-humanitarian-aid.ec.europa.eu/news/nordic-transport-2026</link>
      <pubDate>Wed, 07 Oct 2026 15:30:00 +0200</pubDate>
      <guid>https://civil-protection-humanitarian-aid.ec.europa.eu/node/992</guid>
      <description>&lt;p&gt;Cooperation between Sweden and Norway on road and rail supply continuity.&lt;/p&gt;</description>
    </item>
  </channel>
</rss>`

describe('EU Civil Protection RSS parser', () => {
  it('parses DG ECHO alerts and detects energy and transport infrastructure sectors', () => {
    const parsed = parseEuCivilProtectionRss(sampleEchoXml, new Date('2026-10-11T10:00:00Z'))
    expect(parsed.items).toHaveLength(2)

    const energyItem = parsed.items[0]
    expect(energyItem.title).toContain('emergency power generators')
    expect(energyItem.sector).toBe('energy')
    expect(energyItem.classification).toBe('authority')
    expect(energyItem.verified).toBe(true)

    const transportItem = parsed.items[1]
    expect(transportItem.title).toContain('transport corridors')
    expect(transportItem.sector).toBe('transport')
    expect(transportItem.region).toBe('nordics')
  })
})
