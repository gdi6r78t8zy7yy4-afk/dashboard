import { describe, expect, it } from 'vitest'
import { parseGdacsRss } from './eventsGdacsAdapter.mjs'

const sampleGdacsXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:gdacs="http://www.gdacs.org" xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#">
  <channel>
    <title>GDACS RSS information</title>
    <item>
      <title>Red flood alert in Germany/Poland (Elbe basin)</title>
      <description>&lt;p&gt;Extreme water levels impacting transport and power infrastructure.&lt;/p&gt;</description>
      <link>https://www.gdacs.org/report.aspx?eventtype=FL&amp;eventid=1001</link>
      <pubDate>Sun, 11 Oct 2026 06:00:00 GMT</pubDate>
      <gdacs:eventid>1001</gdacs:eventid>
      <gdacs:eventtype>FL</gdacs:eventtype>
      <gdacs:alertlevel>Red</gdacs:alertlevel>
      <gdacs:country>Germany</gdacs:country>
      <geo:Point>
        <geo:lat>51.05</geo:lat>
        <geo:long>13.73</geo:long>
      </geo:Point>
    </item>
    <item>
      <title>Green earthquake (Magnitude 3.8M) in Norway</title>
      <description>Minor seismic event detected in Nordland.</description>
      <link>https://www.gdacs.org/report.aspx?eventtype=EQ&amp;eventid=1002</link>
      <pubDate>Sat, 10 Oct 2026 14:00:00 GMT</pubDate>
      <gdacs:eventid>1002</gdacs:eventid>
      <gdacs:eventtype>EQ</gdacs:eventtype>
      <gdacs:alertlevel>Green</gdacs:alertlevel>
      <gdacs:country>Norway</gdacs:country>
      <geo:Point>
        <geo:lat>67.28</geo:lat>
        <geo:long>14.40</geo:long>
      </geo:Point>
    </item>
  </channel>
</rss>`

describe('GDACS RSS parser', () => {
  it('parses GDACS items and maps alert levels, sectors, regions and coordinates', () => {
    const parsed = parseGdacsRss(sampleGdacsXml, new Date('2026-10-11T10:00:00Z'))
    expect(parsed.items).toHaveLength(2)

    const flood = parsed.items[0]
    expect(flood.title).toContain('Red flood alert')
    expect(flood.severity).toBe('critical')
    expect(flood.sector).toBe('nature')
    expect(flood.region).toBe('europe')
    expect(flood.coordinates).toEqual({ lat: 51.05, lon: 13.73 })
    expect(flood.classification).toBe('authority')
    expect(flood.verified).toBe(true)

    const eq = parsed.items[1]
    expect(eq.severity).toBe('notice')
    expect(eq.region).toBe('nordics')
    expect(eq.coordinates).toEqual({ lat: 67.28, lon: 14.4 })
  })
})
