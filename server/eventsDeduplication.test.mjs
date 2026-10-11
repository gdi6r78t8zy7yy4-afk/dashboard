import { describe, expect, it } from 'vitest'
import {
  areItemsSimilar,
  clusterEvents,
  computeJaccardSimilarity,
  extractTokens,
} from './eventsDeduplication.mjs'

describe('Events deduplication & clustering', () => {
  it('extracts meaningful tokens and filters stopwords', () => {
    const tokens = extractTokens('Svenska kraftnät och elnätet i SE3 förbereder för vintern')
    expect(tokens).toContain('svenska')
    expect(tokens).toContain('kraftnät')
    expect(tokens).toContain('elnätet')
    expect(tokens).not.toContain('och')
    expect(tokens).not.toContain('i')
    expect(tokens).not.toContain('för')
  })

  it('computes Jaccard similarity accurately', () => {
    const tokensA = ['sjökabel', 'östersjön', 'avbrott', 'telekom']
    const tokensB = ['sjökabel', 'östersjön', 'utredning', 'telekom']
    const sim = computeJaccardSimilarity(tokensA, tokensB)
    expect(sim).toBeGreaterThanOrEqual(0.6)
  })

  it('detects similar items referencing the same event across outlets', () => {
    const item1 = {
      id: 'news-1',
      title: 'Skador på sjökabel i Östersjön utreds',
      summary: 'Telekomförbindelse mellan Sverige och Finland påverkad.',
      publishedAt: '2026-10-11T08:00:00Z',
    }
    const item2 = {
      id: 'news-2',
      title: 'Polisen undersöker sjökabel i Östersjön efter tekniskt fel',
      summary: 'Dataflöden leds om via alternativa fibersträckor.',
      publishedAt: '2026-10-11T09:30:00Z',
    }
    const itemDifferent = {
      id: 'news-3',
      title: 'Nytt vindkraftverk invigs i Skåne',
      summary: 'Lokal elproduktion ökar.',
      publishedAt: '2026-10-11T08:00:00Z',
    }

    expect(areItemsSimilar(item1, item2)).toBe(true)
    expect(areItemsSimilar(item1, itemDifferent)).toBe(false)
  })

  it('clusters duplicate reports into a single event while preserving all individual sources', () => {
    const items = [
      {
        id: 'svt-1',
        title: 'Östersjökablar: Utredning fortsätter efter teknisk indikation på sjökabel',
        summary: 'SVT rapporterar om händelsen.',
        url: 'https://svt.se/1',
        source: 'svt.se',
        outletDomain: 'svt.se',
        sourceType: 'news',
        classification: 'news',
        sector: 'telecom',
        region: 'nordics',
        severity: 'elevated',
        publishedAt: '2026-10-11T08:00:00Z',
        fetchedAt: '2026-10-11T10:00:00Z',
        verified: false,
      },
      {
        id: 'yle-1',
        title: 'Misstänkt skada på sjökabel i Östersjön undersöks',
        summary: 'YLE rapporterar om samma telekomkabel.',
        url: 'https://yle.fi/1',
        source: 'yle.fi',
        outletDomain: 'yle.fi',
        sourceType: 'news',
        classification: 'news',
        sector: 'telecom',
        region: 'nordics',
        severity: 'elevated',
        publishedAt: '2026-10-11T08:45:00Z',
        fetchedAt: '2026-10-11T10:00:00Z',
        verified: false,
      },
      {
        id: 'echo-1',
        title: 'EU mobiliserar rescEU generatorer till energisystem',
        summary: 'Officiell krisreserv aktiverad.',
        url: 'https://europa.eu/1',
        source: 'EU Civil Protection',
        outletDomain: 'europa.eu',
        sourceType: 'authority',
        classification: 'authority',
        sector: 'energy',
        region: 'europe',
        severity: 'elevated',
        publishedAt: '2026-10-11T07:00:00Z',
        fetchedAt: '2026-10-11T10:00:00Z',
        verified: true,
      },
    ]

    const result = clusterEvents(items)

    expect(result.totalItems).toBe(3)
    // The two cable articles should be clustered together
    expect(result.clusterCount).toBe(2)
    expect(result.deduplicatedCount).toBe(1)

    const cableCluster = result.clusters.find((c) => c.sector === 'telecom')
    expect(cableCluster).toBeDefined()
    expect(cableCluster.sourcesCount).toBe(2)
    expect(cableCluster.isGrouped).toBe(true)
    expect(cableCluster.sources.map((s) => s.source)).toEqual(expect.arrayContaining(['svt.se', 'yle.fi']))
  })
})
