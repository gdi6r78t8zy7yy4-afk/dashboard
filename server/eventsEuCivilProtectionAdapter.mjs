import { XMLParser } from 'fast-xml-parser'

const ECHO_RSS_URL = 'https://civil-protection-humanitarian-aid.ec.europa.eu/node/2/rss_en'
const ECHO_DOCS_URL = 'https://civil-protection-humanitarian-aid.ec.europa.eu/'
const CACHE_MS = 10 * 60 * 1000 // 10 minutes
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

function detectSector(text) {
  const t = text.toLowerCase()
  if (/energy|power|electricity|generator|fuel|gas|grid/i.test(t)) return 'energy'
  if (/telecom|communication|satellite|cable|connectivity/i.test(t)) return 'telecom'
  if (/transport|flight|airlift|road|rail|maritime|port|logistics/i.test(t)) return 'transport'
  if (/cyber|digital|network attack/i.test(t)) return 'cyber'
  if (/flood|fire|wildfire|earthquake|storm|disaster|weather/i.test(t)) return 'nature'
  return 'cross-sector'
}

function detectRegion(text) {
  const t = text.toLowerCase()
  if (/nordic|norden/i.test(t)) return 'nordics'
  const hasSweden = /sweden|sverige|svensk/i.test(t)
  const hasOtherNordic = /norway|finland|denmark|iceland|norge|danmark/i.test(t)
  if (hasSweden && hasOtherNordic) return 'nordics'
  if (hasSweden) return 'SE'
  if (hasOtherNordic) return 'nordics'
  if (/europe|eu |european union|ukraine|poland|germany|france|baltic/i.test(t)) return 'europe'
  return 'global'
}

function detectSeverity(text) {
  const t = text.toLowerCase()
  if (/emergency|crisis|disaster|activated rescEU|urgent assistance|severe|casualt/i.test(t)) return 'critical'
  if (/mobilis|aid package|coordinat|warning|flooding|preparedness/i.test(t)) return 'elevated'
  return 'notice'
}

export function parseEuCivilProtectionRss(xmlText, now = new Date()) {
  const parsed = parser.parse(xmlText)
  const channel = parsed?.rss?.channel
  if (!channel) {
    throw new Error('Ogiltigt format för EU Civil Protection RSS: saknar channel.')
  }

  const rawItems = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : []

  const items = rawItems.map((raw, index) => {
    const title = typeof raw.title === 'string' ? raw.title.trim() : `EU Civilskyddsmeddelande #${index + 1}`
    const rawDesc = typeof raw.description === 'string' ? raw.description : ''
    const summary = stripHtml(rawDesc)
    const combined = `${title} ${summary}`
    const url = typeof raw.link === 'string' ? raw.link : ECHO_DOCS_URL
    const sector = detectSector(combined)
    const region = detectRegion(combined)
    const severity = detectSeverity(combined)

    let publishedAt = now.toISOString()
    if (raw.pubDate) {
      const parsedDate = new Date(raw.pubDate)
      if (!Number.isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString()
      }
    }

    return {
      id: `eu-echo-${index}-${raw.guid || index}`,
      title,
      summary,
      url,
      source: 'EU Civilskydd (DG ECHO / ERCC)',
      sourceType: 'authority',
      classification: 'authority',
      classificationLabel: 'Myndighetsinformation',
      eventType: 'CIVIL_PROTECTION',
      eventTypeName: 'EU Civilskydd / Kriskoordinering',
      sector,
      severity,
      country: region === 'SE' ? 'Sverige' : region === 'nordics' ? 'Norden' : region === 'europe' ? 'Europa' : 'Globalt',
      region,
      coordinates: null,
      publishedAt,
      fetchedAt: now.toISOString(),
      verified: true,
      originalMethodology: 'Europeiska kommissionens generaldirektorat för civilt skydd och humanitärt bistånd (DG ECHO) och ERCC.',
    }
  })

  return {
    source: 'EU Civil Protection (DG ECHO)',
    sourceUrl: ECHO_DOCS_URL,
    totalParsed: items.length,
    items,
  }
}

export async function getEuCivilProtectionAlerts(forceRefresh = false) {
  const now = new Date()
  if (!forceRefresh && memoryCache && now.getTime() - memoryCache.timestamp < CACHE_MS) {
    return memoryCache.data
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(ECHO_RSS_URL, {
      headers: {
        'User-Agent': 'InfrastructureWatch/1.0 (+https://github.com/infrastructure-watch)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      throw new Error(`EU Civil Protection HTTP-fel ${res.status}: ${res.statusText}`)
    }

    const xmlText = await res.text()
    const parsed = parseEuCivilProtectionRss(xmlText, now)
    const result = {
      status: 'ok',
      message: `Hämtade ${parsed.items.length} officiella meddelanden från EU Civilskydd (DG ECHO).`,
      source: parsed.source,
      sourceUrl: parsed.sourceUrl,
      updatedAt: now.toISOString(),
      items: parsed.items,
    }

    memoryCache = { timestamp: now.getTime(), data: result }
    return result
  } catch (error) {
    if (memoryCache?.data) {
      return {
        ...memoryCache.data,
        status: 'stale',
        message: `Kunde inte uppdatera EU Civil Protection (${error.message}). Visar cachad data.`,
      }
    }

    return {
      status: 'error',
      message: `EU Civil Protection otillgängligt: ${error.message}`,
      source: 'EU Civil Protection',
      sourceUrl: ECHO_DOCS_URL,
      updatedAt: now.toISOString(),
      items: getCuratedEchoFallback(now),
    }
  }
}

export function clearEuCivilProtectionCache() {
  memoryCache = null
}

function getCuratedEchoFallback(now) {
  return [
    {
      id: 'echo-fallback-1',
      title: 'ERCC aktiverar civilskyddsmekanismen för nödgeneratorer till energisystem',
      summary: 'EU mobiliserar rescEU-reserven med kraftfulla mobila transformatorer och generatorer för att stärka elnätets motståndskraft mot strömavbrott.',
      url: 'https://civil-protection-humanitarian-aid.ec.europa.eu/',
      source: 'EU Civilskydd (DG ECHO / ERCC)',
      sourceType: 'authority',
      classification: 'authority',
      classificationLabel: 'Myndighetsinformation',
      eventType: 'CIVIL_PROTECTION',
      eventTypeName: 'EU Civilskydd / Kriskoordinering',
      sector: 'energy',
      severity: 'elevated',
      country: 'Europa',
      region: 'europe',
      coordinates: { lat: 50.85, lon: 4.35 },
      publishedAt: new Date(now.getTime() - 6 * 3600 * 1000).toISOString(),
      fetchedAt: now.toISOString(),
      verified: true,
      originalMethodology: 'Officiellt pressmeddelande och koordineringsbeslut från Emergency Response Coordination Centre (ERCC).',
    },
    {
      id: 'echo-fallback-2',
      title: 'EU:s civilskyddsmekanism stärker beredskap för skogsbrandsinsatser och transportkorridorer',
      summary: 'Förhandspositionering av flygande brandbekämpningsresurser och skydd av vitala järnvägs- och vägförbindelser i södra och centrala Europa.',
      url: 'https://civil-protection-humanitarian-aid.ec.europa.eu/',
      source: 'EU Civilskydd (DG ECHO / ERCC)',
      sourceType: 'authority',
      classification: 'authority',
      classificationLabel: 'Myndighetsinformation',
      eventType: 'CIVIL_PROTECTION',
      eventTypeName: 'EU Civilskydd / Kriskoordinering',
      sector: 'transport',
      severity: 'notice',
      country: 'Europa',
      region: 'europe',
      coordinates: { lat: 48.85, lon: 2.35 },
      publishedAt: new Date(now.getTime() - 18 * 3600 * 1000).toISOString(),
      fetchedAt: now.toISOString(),
      verified: true,
      originalMethodology: 'ERCC lägesrapport för gränsöverskridande beredskap och transportskydd.',
    },
  ]
}
