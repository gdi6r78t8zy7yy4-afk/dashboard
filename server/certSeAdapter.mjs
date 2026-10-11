import { XMLParser } from 'fast-xml-parser'

const CERT_SE_URL = 'https://www.cert.se/feed/atom.xml'
const CERT_SE_PAGE = 'https://www.cert.se/'
const CACHE_MS = 5 * 60 * 1000 // 5 minutes
const TIMEOUT_MS = 10 * 1000 // 10 seconds

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
})

let memoryCache = null

function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function classifyCertSeEntry(title, summaryText) {
  const combined = `${title} ${summaryText}`.toLowerCase()

  // Verified incidents: active attacks, breaches, zero-days exploited in the wild
  if (
    /dataintrång|hackad|utnyttjats i attacker|nolldagarsattack|aktivt utnyttjas|aktivt angrepp|intrångsförsök|utpressningsaktör.*angripit/i.test(combined)
  ) {
    return {
      kind: 'verified_incident',
      severity: 'critical',
      note: 'Bekräftad cyberincident eller aktivt utnyttjad sårbarhet i produktion.',
    }
  }

  // Critical warnings: high severity vulnerabilities, urgent patches
  if (
    /kritisk sårbarhet|kritiska sårbarheter|brådskande uppdateringar|cvss (?:9\.|10)|fbi varnar/i.test(combined)
  ) {
    return {
      kind: 'warning',
      severity: 'critical',
      note: 'Kritisk säkerhetsvarning publicerad av CERT-SE.',
    }
  }

  // Elevated warnings: general security updates, advisories
  if (
    /sårbarhet|säkerhetsuppdatering|nätfiskekampanj|hotaktör|varning|advisory/i.test(combined)
  ) {
    return {
      kind: 'warning',
      severity: 'elevated',
      note: 'Säkerhetsuppdatering eller råd från nationell CSIRT.',
    }
  }

  // Technical observations: weekly letters, threat landscapes, analyses
  if (/veckobrev|rapport|analys|ctf|utmaning|översikt/i.test(combined)) {
    return {
      kind: 'technical_observation',
      severity: 'elevated',
      note: 'Teknisk observation och veckosammanställning från CERT-SE.',
    }
  }

  return {
    kind: 'technical_observation',
    severity: 'elevated',
    note: 'Observation från CERT-SE.',
  }
}

export function parseCertSeAtom(xmlText, now = new Date()) {
  const doc = parser.parse(xmlText)
  const feed = doc?.feed
  if (!feed) throw new Error('Ogiltigt Atom-flöde från CERT-SE.')

  const rawEntries = Array.isArray(feed.entry)
    ? feed.entry
    : feed.entry
      ? [feed.entry]
      : []

  const feedUpdated = feed.updated ? new Date(feed.updated).toISOString() : null
  const retrievedAt = new Date(now).toISOString()

  const observations = rawEntries.map((entry, index) => {
    const id = entry.id ?? `cert-se-${index}`
    const title = entry.title ?? 'CERT-SE Meddelande'
    const link = entry.link?.['@_href'] ?? (typeof entry.link === 'string' ? entry.link : CERT_SE_PAGE)
    const publishedRaw = entry.published ?? entry.updated
    const publishedAt = publishedRaw ? new Date(publishedRaw).toISOString() : retrievedAt
    const summaryRaw = typeof entry.summary === 'string' ? entry.summary : entry.summary?.['#text'] ?? ''
    const summaryText = stripHtml(summaryRaw).slice(0, 300)

    const classification = classifyCertSeEntry(title, summaryText)

    return {
      id: String(id),
      source: 'CERT-SE',
      sourceUrl: link,
      category: 'Cyber',
      service: 'CERT-SE',
      title,
      summary: summaryText || 'Nationellt säkerhetsmeddelande från CERT-SE.',
      location: 'Sverige / Norden',
      time: publishedAt,
      retrievedAt,
      verified: true,
      kind: classification.kind,
      severity: classification.severity,
      note: classification.note,
    }
  })

  // Deduplicate by ID
  const unique = new Map()
  for (const obs of observations) {
    if (!unique.has(obs.id)) {
      unique.set(obs.id, obs)
    }
  }

  const items = [...unique.values()].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return {
    feedUpdated,
    retrievedAt,
    items,
  }
}

/**
 * Fetches and normalizes CERT-SE Atom feed with in-memory caching and freshness checks.
 */
export async function getCertSeAdvisories({ fetchImpl = fetch, now = new Date() } = {}) {
  const currentTime = new Date(now).getTime()

  // Return cache if fresh
  if (memoryCache && currentTime - memoryCache.cachedAt < CACHE_MS) {
    return {
      ...memoryCache.data,
      cached: true,
      state: 'ok',
    }
  }

  try {
    const response = await fetchImpl(CERT_SE_URL, {
      headers: {
        Accept: 'application/atom+xml, application/xml, text/xml',
        'User-Agent': 'InfrastructureWatch/1.0 (CERT-SE feed subscriber)',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`CERT-SE svarade med HTTP ${response.status}`)
    }

    const xml = await response.text()
    const parsed = parseCertSeAtom(xml, now)

    const result = {
      state: 'ok',
      feedUpdated: parsed.feedUpdated,
      retrievedAt: parsed.retrievedAt,
      items: parsed.items,
      cached: false,
      provenance: {
        source: 'CERT-SE',
        sourceUrl: CERT_SE_URL,
        retrievedAt: parsed.retrievedAt,
        observedAt: parsed.feedUpdated,
        updateInterval: '5 min',
        timeout: '10 s',
        requiresAuth: false,
        verified: true,
        quality: 'official-csirt-feed',
      },
    }

    memoryCache = {
      cachedAt: currentTime,
      data: result,
    }

    return result
  } catch (error) {
    // If we have stale cache, return it with 'stale' status
    if (memoryCache) {
      return {
        ...memoryCache.data,
        state: 'stale',
        cached: true,
        lastError: error instanceof Error ? error.message : 'Kunde inte uppdatera CERT-SE.',
      }
    }

    // Otherwise return error state (never pretending it's operational)
    return {
      state: 'error',
      feedUpdated: null,
      retrievedAt: new Date(now).toISOString(),
      items: [],
      cached: false,
      lastError: error instanceof Error ? error.message : 'Kunde inte nå CERT-SE.',
      provenance: {
        source: 'CERT-SE',
        sourceUrl: CERT_SE_URL,
        retrievedAt: new Date(now).toISOString(),
        observedAt: null,
        updateInterval: '5 min',
        timeout: '10 s',
        requiresAuth: false,
        verified: false,
        quality: 'missing',
      },
    }
  }
}

export function clearCertSeCache() {
  memoryCache = null
}
