const STOP_WORDS = new Set([
  'och', 'i', 'på', 'för', 'om', 'av', 'till', 'en', 'ett', 'den', 'det', 'som', 'har', 'är', 'med', 'mot', 'efter',
  'vid', 'att', 'från', 'under', 'mer', 'fler', 'flera', 'nya', 'samt', 'hos', 'sig', 'vi', 'de', 'nu', 'kan',
  'the', 'and', 'in', 'on', 'of', 'to', 'for', 'a', 'an', 'with', 'from', 'at', 'by', 'as', 'is', 'are', 'was',
  'were', 'it', 'its', 'be', 'has', 'have', 'had', 'after', 'over', 'into', 'all', 'new', 'more', 'about'
])

export function extractTokens(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

export function computeJaccardSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0
  const setA = new Set(tokensA)
  const setB = new Set(tokensB)
  let intersectionSize = 0
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionSize += 1
    }
  }
  const unionSize = new Set([...setA, ...setB]).size
  return unionSize > 0 ? intersectionSize / unionSize : 0
}

const SEVERITY_RANK = {
  critical: 3,
  elevated: 2,
  notice: 1,
}

function resolveMaxSeverity(items) {
  let highest = 'notice'
  for (const item of items) {
    if (SEVERITY_RANK[item.severity] > SEVERITY_RANK[highest]) {
      highest = item.severity
    }
  }
  return highest
}

function resolveClassification(items) {
  const hasAuthority = items.some((i) => i.classification === 'authority')
  if (hasAuthority) {
    return {
      classification: 'authority',
      classificationLabel: 'Myndighetsinformation',
      verified: true,
    }
  }
  const hasUnconfirmed = items.some((i) => i.classification === 'unconfirmed')
  if (hasUnconfirmed) {
    return {
      classification: 'unconfirmed',
      classificationLabel: 'Obekräftade uppgifter',
      verified: false,
    }
  }
  return {
    classification: 'news',
    classificationLabel: 'Nyhetsrapportering',
    verified: false,
  }
}

/**
 * Checks if two items refer to the same real-world event:
 * - Shared high-specificity key phrases (e.g. sjökabel + östersjön, fortimail, gps-störning)
 * - Or high Jaccard similarity (>= 0.30)
 * - And published within 72 hours of each other
 */
export function areItemsSimilar(itemA, itemB, similarityThreshold = 0.28) {
  // If exact same ID, they are identical
  if (itemA.id === itemB.id) return true

  // Time proximity check: max 72 hours apart
  const timeA = new Date(itemA.publishedAt).getTime()
  const timeB = new Date(itemB.publishedAt).getTime()
  if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
    const diffHours = Math.abs(timeA - timeB) / (1000 * 3600)
    if (diffHours > 72) return false
  }

  const tokensA = extractTokens(`${itemA.title} ${itemA.summary || ''}`)
  const tokensB = extractTokens(`${itemB.title} ${itemB.summary || ''}`)

  // Specific multi-word keywords match
  const textA = `${itemA.title} ${itemA.summary || ''}`.toLowerCase()
  const textB = `${itemB.title} ${itemB.summary || ''}`.toLowerCase()

  const specificEntities = [
    ['östersjö', 'kabel'],
    ['sjökabel'],
    ['undervattenskabel'],
    ['finska viken', 'kabel'],
    ['gps-störning'],
    ['fortimail'],
    ['västra stambanan', 'signalfel'],
    ['elbe', 'översvämning'],
    ['donau', 'översvämning'],
    ['svenska kraftnät', 'stamnät'],
    ['nordlink'],
  ]

  for (const entityPair of specificEntities) {
    const aMatches = entityPair.every((kw) => textA.includes(kw))
    const bMatches = entityPair.every((kw) => textB.includes(kw))
    if (aMatches && bMatches) {
      return true
    }
  }

  const similarity = computeJaccardSimilarity(tokensA, tokensB)
  return similarity >= similarityThreshold
}

/**
 * Deduplicates and clusters events:
 * Combines multiple reports of the same incident into a single unified event cluster
 * while preserving all original sources, links, timestamps, and domains.
 */
export function clusterEvents(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      clusters: [],
      totalItems: 0,
      clusterCount: 0,
      deduplicatedCount: 0,
    }
  }

  const clusters = []

  for (const item of items) {
    let matchedCluster = null

    for (const cluster of clusters) {
      // Check similarity against canonical item or any source in the cluster
      const isMatch = areItemsSimilar(cluster.canonicalItem, item)
      if (isMatch) {
        matchedCluster = cluster
        break
      }
    }

    if (matchedCluster) {
      // Avoid duplicate source links within the same cluster
      const exists = matchedCluster.sources.some((s) => s.url === item.url || s.id === item.id)
      if (!exists) {
        matchedCluster.sources.push({
          id: item.id,
          title: item.title,
          summary: item.summary,
          url: item.url,
          source: item.source,
          outletDomain: item.outletDomain || item.source,
          sourceType: item.sourceType,
          classification: item.classification,
          publishedAt: item.publishedAt,
          fetchedAt: item.fetchedAt,
          verified: item.verified,
        })

        // Update timestamps
        const itemTime = new Date(item.publishedAt).getTime()
        const firstTime = new Date(matchedCluster.firstPublishedAt).getTime()
        const lastTime = new Date(matchedCluster.lastPublishedAt).getTime()

        if (!Number.isNaN(itemTime)) {
          if (itemTime < firstTime) matchedCluster.firstPublishedAt = item.publishedAt
          if (itemTime > lastTime) matchedCluster.lastPublishedAt = item.publishedAt
        }

        // Prefer authority item as canonical title/summary if available
        if (item.classification === 'authority' && matchedCluster.canonicalItem.classification !== 'authority') {
          matchedCluster.canonicalItem = item
          matchedCluster.canonicalTitle = item.title
          matchedCluster.canonicalSummary = item.summary
        }
      }
    } else {
      // Create new cluster
      clusters.push({
        id: `cluster-${item.id}`,
        canonicalItem: item,
        canonicalTitle: item.title,
        canonicalSummary: item.summary,
        sector: item.sector,
        region: item.region,
        country: item.country,
        coordinates: item.coordinates || null,
        firstPublishedAt: item.publishedAt,
        lastPublishedAt: item.publishedAt,
        fetchedAt: item.fetchedAt,
        sources: [
          {
            id: item.id,
            title: item.title,
            summary: item.summary,
            url: item.url,
            source: item.source,
            outletDomain: item.outletDomain || item.source,
            sourceType: item.sourceType,
            classification: item.classification,
            publishedAt: item.publishedAt,
            fetchedAt: item.fetchedAt,
            verified: item.verified,
          },
        ],
      })
    }
  }

  // Finalize each cluster: resolve combined severity, classification and formatting
  const finalizedClusters = clusters.map((c) => {
    const { classification, classificationLabel, verified } = resolveClassification(c.sources)
    const severity = resolveMaxSeverity(c.sources)
    const sourcesCount = c.sources.length

    return {
      id: c.id,
      title: c.canonicalTitle,
      summary: c.canonicalSummary,
      url: c.canonicalItem.url,
      primarySource: c.canonicalItem.source,
      sourcesCount,
      isGrouped: sourcesCount > 1,
      classification,
      classificationLabel,
      severity,
      sector: c.sector,
      region: c.region,
      country: c.country,
      coordinates: c.coordinates,
      firstPublishedAt: c.firstPublishedAt,
      lastPublishedAt: c.lastPublishedAt,
      fetchedAt: c.fetchedAt,
      verified,
      sources: c.sources.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
      originalMethodology: c.canonicalItem.originalMethodology || 'Aggregerat flöde.',
    }
  })

  // Sort clusters by latest published time desc
  finalizedClusters.sort((a, b) => new Date(b.lastPublishedAt).getTime() - new Date(a.lastPublishedAt).getTime())

  return {
    clusters: finalizedClusters,
    totalItems: items.length,
    clusterCount: finalizedClusters.length,
    deduplicatedCount: items.length - finalizedClusters.length,
  }
}
