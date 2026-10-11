import { describe, expect, it } from 'vitest'
import { parseGdeltArticles } from './eventsGdeltAdapter.mjs'

const sampleArticles = [
  {
    title: 'Svenska kraftnät varnar för ansträngt läge i elnätet efter fel i SE3',
    domain: 'svt.se',
    url: 'https://www.svt.se/nyheter/ekonomi/svenska-kraftnat-elnat',
    seendate: '20261011T073000Z',
    language: 'swe',
  },
  {
    title: 'Obekräftade uppgifter om misstänkt sabotage mot sjökabel i Östersjön',
    domain: 'dn.se',
    url: 'https://www.dn.se/nyheter/sjokabel-utredning',
    seendate: '20261011T051500Z',
    language: 'swe',
  },
]

describe('GDELT DOC 2.0 articles parser', () => {
  it('parses articles and distinguishes between standard news and unconfirmed reports', () => {
    const items = parseGdeltArticles(sampleArticles, new Date('2026-10-11T10:00:00Z'))
    expect(items).toHaveLength(2)

    const newsItem = items[0]
    expect(newsItem.sector).toBe('energy')
    expect(newsItem.region).toBe('SE')
    expect(newsItem.classification).toBe('news')
    expect(newsItem.verified).toBe(false)
    expect(newsItem.outletDomain).toBe('svt.se')

    const unconfirmedItem = items[1]
    expect(unconfirmedItem.sector).toBe('telecom')
    expect(unconfirmedItem.classification).toBe('unconfirmed')
    expect(unconfirmedItem.classificationLabel).toBe('Obekräftade uppgifter')
    expect(unconfirmedItem.verified).toBe(false)
  })
})
