import { getCertSeAdvisories } from './certSeAdapter.mjs'
import { getGdacsAlerts } from './eventsGdacsAdapter.mjs'
import { getEuCivilProtectionAlerts } from './eventsEuCivilProtectionAdapter.mjs'
import { getGdeltArticles } from './eventsGdeltAdapter.mjs'
import { clusterEvents } from './eventsDeduplication.mjs'

export async function getEventsDashboard({
  sector = 'all',
  region = 'all',
  classification = 'all',
  severity = 'all',
  search = '',
  grouped = true,
  forceRefresh = false,
} = {}) {
  const now = new Date()

  // Parallel fetch from all 4 sources with individual catch handling
  const [certSeRes, gdacsRes, echoRes, gdeltRes] = await Promise.all([
    getCertSeAdvisories(forceRefresh).catch((err) => ({
      status: 'error',
      message: err.message,
      items: [],
      source: 'CERT-SE',
      sourceUrl: 'https://www.cert.se/',
      updatedAt: now.toISOString(),
    })),
    getGdacsAlerts(forceRefresh).catch((err) => ({
      status: 'error',
      message: err.message,
      items: [],
      source: 'GDACS',
      sourceUrl: 'https://www.gdacs.org/',
      updatedAt: now.toISOString(),
    })),
    getEuCivilProtectionAlerts(forceRefresh).catch((err) => ({
      status: 'error',
      message: err.message,
      items: [],
      source: 'EU Civil Protection',
      sourceUrl: 'https://civil-protection-humanitarian-aid.ec.europa.eu/',
      updatedAt: now.toISOString(),
    })),
    getGdeltArticles(forceRefresh).catch((err) => ({
      status: 'error',
      message: err.message,
      items: [],
      source: 'GDELT DOC 2.0 API',
      sourceUrl: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/',
      updatedAt: now.toISOString(),
    })),
  ])

  // Map CERT-SE advisories to world events schema
  const certSeItems = (certSeRes.items || []).map((advisory) => ({
    id: `certse-${advisory.id || advisory.title}`,
    title: advisory.title,
    summary: advisory.summary,
    url: advisory.link,
    source: 'CERT-SE (MSB)',
    sourceType: 'authority',
    classification: 'authority',
    classificationLabel: 'Myndighetsinformation',
    eventType: 'CYBER_ADVISORY',
    eventTypeName: 'Cybersäkerhetsvarning',
    sector: 'cyber',
    severity: advisory.severity === 'critical' ? 'critical' : 'elevated',
    country: 'Sverige',
    region: 'SE',
    coordinates: { lat: 59.33, lon: 18.06 },
    publishedAt: advisory.publishedAt || advisory.timestamp || now.toISOString(),
    fetchedAt: certSeRes.updatedAt || now.toISOString(),
    verified: true,
    outletDomain: 'cert.se',
    originalMethodology: 'Officiell svensk nationell CSIRT-varning publicerad av Myndigheten för samhällsskydd och beredskap (MSB).',
  }))

  const gdacsItems = gdacsRes.items || []
  const echoItems = echoRes.items || []
  const gdeltItems = gdeltRes.items || []

  // Combine all items
  const allItems = [...certSeItems, ...gdacsItems, ...echoItems, ...gdeltItems]

  // Deduplicate and group into clusters
  const { clusters, totalItems, deduplicatedCount } = clusterEvents(allItems)

  // Calculate high-level KPIs across all items
  const kpis = [
    {
      label: 'Myndighetsvarningar',
      value: String(allItems.filter((i) => i.classification === 'authority').length),
      detail: 'CERT-SE, GDACS, ERCC/EU',
      status: allItems.some((i) => i.classification === 'authority' && i.severity === 'critical')
        ? 'critical'
        : 'operational',
    },
    {
      label: 'Naturhändelser (Europa/Norden)',
      value: String(allItems.filter((i) => i.sector === 'nature' && (i.region === 'SE' || i.region === 'nordics' || i.region === 'europe')).length),
      detail: 'Översvämningar, storm, seismik',
      status: allItems.some((i) => i.sector === 'nature' && i.severity === 'critical') ? 'critical' : 'operational',
    },
    {
      label: 'Energiinfrastruktur',
      value: String(allItems.filter((i) => i.sector === 'energy').length),
      detail: 'Elnät, gas, reservkraft',
      status: allItems.some((i) => i.sector === 'energy' && i.severity === 'critical') ? 'critical' : 'operational',
    },
    {
      label: 'Telekom & Transport',
      value: String(allItems.filter((i) => i.sector === 'telecom' || i.sector === 'transport').length),
      detail: 'Sjökablar, järnväg, GPS',
      status: allItems.some((i) => (i.sector === 'telecom' || i.sector === 'transport') && i.severity === 'critical')
        ? 'critical'
        : 'operational',
    },
    {
      label: 'Nyhetsrapporteringar',
      value: String(allItems.filter((i) => i.classification === 'news' || i.classification === 'unconfirmed').length),
      detail: `${deduplicatedCount} dubblettrapporter samlade`,
      status: 'operational',
    },
  ]

  // Filter items or clusters according to user query
  const targetList = grouped ? clusters : allItems

  const filtered = targetList.filter((entry) => {
    // Sector filter
    if (sector !== 'all' && entry.sector !== sector) {
      return false
    }

    // Region filter
    if (region !== 'all') {
      // Convert region to lowercase for consistent comparison
      const lowerRegion = region.toLowerCase();
      if (lowerRegion === 'se' && entry.region !== 'SE') return false
      if (lowerRegion === 'nordics' && entry.region !== 'SE' && entry.region !== 'nordics') return false
      if (lowerRegion === 'europe' && entry.region !== 'SE' && entry.region !== 'nordics' && entry.region !== 'europe') {
        return false
      }
      if (lowerRegion === 'global' && entry.region !== 'global') {
        // keep global
      }
    }

    // Classification filter
    if (classification !== 'all' && entry.classification !== classification) {
      return false
    }

    // Severity filter
    if (severity !== 'all' && entry.severity !== severity) {
      return false
    }

    // Free text search
    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim()
      const haystack = `${entry.title} ${entry.summary || ''} ${entry.country || ''} ${entry.sector || ''} ${entry.primarySource || entry.source || ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }

    return true
  })

  // Data sources status and access details
  const sources = [
    {
      id: 'cert-se',
      label: 'CERT-SE (MSB)',
      url: 'https://www.cert.se/feed/atom.xml',
      docUrl: 'https://www.cert.se/',
      status: certSeRes.status || 'ok',
      message: certSeRes.message || 'Hämtning lyckades via officiell Atom-feed.',
      type: 'Myndighet / CSIRT',
      classification: 'authority',
      authRequired: false,
      rateLimitInfo: 'Ingen strikt kvot, standard cache (5 min)',
      coverage: 'Sverige (Nationella cybervarningar & incidenter)',
      lastFetched: certSeRes.updatedAt || now.toISOString(),
      itemsCount: certSeItems.length,
    },
    {
      id: 'gdacs',
      label: 'GDACS (Global Disaster Alert)',
      url: 'https://www.gdacs.org/xml/rss.xml',
      docUrl: 'https://www.gdacs.org/',
      status: gdacsRes.status || 'ok',
      message: gdacsRes.message || 'Hämtning lyckades via officiell GeoRSS-feed.',
      type: 'Internationellt partnerskap (FN OCHA / Europeiska kommissionen)',
      classification: 'authority',
      authRequired: false,
      rateLimitInfo: 'Öppen feed, standard cache (5 min)',
      coverage: 'Globalt med fokus på Europa och Norden (Naturkatastrofer)',
      lastFetched: gdacsRes.updatedAt || now.toISOString(),
      itemsCount: gdacsItems.length,
    },
    {
      id: 'eu-civil-protection',
      label: 'EU Civilskydd (DG ECHO / ERCC)',
      url: 'https://civil-protection-humanitarian-aid.ec.europa.eu/node/2/rss_en',
      docUrl: 'https://civil-protection-humanitarian-aid.ec.europa.eu/',
      status: echoRes.status || 'ok',
      message: echoRes.message || 'Hämtning lyckades via officiellt RSS-flöde.',
      type: 'EU-myndighet (Europeiska kommissionen)',
      classification: 'authority',
      authRequired: false,
      rateLimitInfo: 'Öppen RSS, cache (10 min)',
      coverage: 'Europa & internationellt (Civilskydd, rescEU, krisinsatser)',
      lastFetched: echoRes.updatedAt || now.toISOString(),
      itemsCount: echoItems.length,
    },
    {
      id: 'gdelt',
      label: 'GDELT DOC 2.0 API',
      url: 'https://api.gdeltproject.org/api/v2/doc/doc',
      docUrl: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/',
      status: gdeltRes.status || 'ok',
      message: gdeltRes.message || 'Hämtning lyckades från global mediadatabas.',
      type: 'Global nyhets- och mediabevakning',
      classification: 'news',
      authRequired: false,
      rateLimitInfo: 'Strikt: Max 1 anrop per 5 sekunder per IP. Automatisk cache (15 min) och kretsbrytare aktiv.',
      coverage: 'Internationella och nordiska medier (SVT, YLE, Reuters, m.fl.)',
      lastFetched: gdeltRes.updatedAt || now.toISOString(),
      itemsCount: gdeltItems.length,
    },
  ]

  return {
    state: 'ok',
    updatedAt: now.toISOString(),
    totalRawItems: totalItems,
    deduplicatedCount,
    displayedCount: filtered.length,
    grouped,
    kpis,
    sources,
    items: filtered,
  }
}
