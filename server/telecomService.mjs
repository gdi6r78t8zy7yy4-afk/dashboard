import { getIodaOutages } from './telecomIoda.mjs'
import { getPtsCoverage, PTS_COVERAGE_PAGE } from './telecomPts.mjs'
import { getRipeRouting } from './telecomRipe.mjs'

const periods = new Set(['24h', '7d', '30d'])
const cache = new Map()
const cacheMs = 60 * 1000
const providerAdapters = { pts: getPtsCoverage, ripe: getRipeRouting, ioda: getIodaOutages }

function source({ state, source, sourceUrl, retrievedAt, observedAt = null, referencePeriod = null, geographicPrecision, resolution, quality, data, note }) {
  return {
    state,
    provenance: { source, sourceUrl, retrievedAt, observedAt, referencePeriod, geographicPrecision, resolution, quality },
    data,
    note,
  }
}

function unavailableSource(label, sourceUrl, now, precision, note) {
  const timestamp = new Date(now).toISOString()
  return source({
    state: 'unavailable',
    source: label,
    sourceUrl,
    retrievedAt: timestamp,
    geographicPrecision: precision,
    resolution: 'No connected provider feed',
    quality: 'missing',
    data: [],
    note,
  })
}

function notApplicableSource(label, sourceUrl, now, note, data = []) {
  const timestamp = new Date(now).toISOString()
  return source({
    state: 'not_applicable',
    source: label,
    sourceUrl,
    retrievedAt: timestamp,
    geographicPrecision: 'none',
    resolution: 'This integration is currently scoped to Sweden',
    quality: 'missing',
    data,
    note,
  })
}

function normalizePts(result) {
  return source({
    state: result.error ? 'error' : result.counties.length ? 'ok' : 'unavailable',
    source: 'PTS Mobiltäcknings- och bredbandskartläggning',
    sourceUrl: PTS_COVERAGE_PAGE,
    retrievedAt: result.retrievedAt ?? result.requestedAt,
    observedAt: null,
    referencePeriod: result.referencePeriod,
    geographicPrecision: 'county',
    resolution: 'County and municipality; this dashboard shows county aggregates. Annual snapshot, November 2025.',
    quality: result.counties.length ? 'official-statistic' : 'missing',
    data: result.counties,
    note: result.error ?? 'Official annual coverage estimate. Signal-threshold coverage is not proof of service at a site and must not be used to declare a tower or region out of service.',
  })
}

function cacheFresh(entry, now) {
  return entry && new Date(now).getTime() - Date.parse(entry.retrievedAt) < cacheMs
}

/** @param {{ region?: string, period?: string, fetchImpl?: typeof fetch, now?: Date, adapters?: typeof providerAdapters }} options */
export async function getTelecomDashboard({ region = 'se', period = '7d', fetchImpl = fetch, now = new Date(), adapters = providerAdapters } = {}) {
  const selectedRegion = region.toLowerCase()
  if (!periods.has(period)) throw new Error('Unsupported telecom period. Choose 24h, 7d, or 30d.')
  if (selectedRegion !== 'se') {
    return {
      country: selectedRegion.toUpperCase(),
      period,
      retrievedAt: new Date(now).toISOString(),
      coverage: notApplicableSource('PTS', PTS_COVERAGE_PAGE, now, 'PTS coverage workbook contains Swedish administrative areas only.'),
      routing: notApplicableSource('RIPEstat / RIPE RIS', 'https://stat.ripe.net/docs/data-api/ripestat-data-api', now, 'Country-specific RIPEstat queries are not enabled for this selected region.', { history: [], latest: null, registeredAsns: null, routedAsns: null }),
      internetIncidents: notApplicableSource('IODA', 'https://api.ioda.inetintel.cc.gatech.edu/v2/docs', now, 'IODA integration is currently enabled for Sweden only.', { events: [], signal: [], period, country: selectedRegion.toUpperCase() }),
      operatorStatus: unavailableSource('Mobile network operator status', PTS_COVERAGE_PAGE, now, 'none', 'No operator-specific real-time availability feed is connected.'),
      notices: unavailableSource('Public telecom notices', PTS_COVERAGE_PAGE, now, 'none', 'No verified public operator incident feed is connected.'),
      mode: 'no_data',
    }
  }

  const key = `${selectedRegion}:${period}`
  const cached = cache.get(key)
  if (cacheFresh(cached, now)) return { ...cached, retrievedAt: new Date(now).toISOString(), cached: true }

  const [ptsResult, routing, internetIncidents] = await Promise.all([
    adapters.pts({ fetchImpl, now }),
    adapters.ripe({ country: 'SE', period, fetchImpl, now }),
    adapters.ioda({ country: 'SE', period, fetchImpl, now }),
  ])
  const coverage = normalizePts(ptsResult)
  const successfulSources = [coverage, routing, internetIncidents].filter((item) => item.state === 'ok' || item.state === 'stale').length
  const mode = successfulSources === 3 ? 'live' : successfulSources ? 'partial' : 'no_data'
  const result = {
    country: 'SE',
    period,
    retrievedAt: new Date(now).toISOString(),
    cached: false,
    coverage,
    routing,
    internetIncidents,
    operatorStatus: unavailableSource('Mobile network operator status', PTS_COVERAGE_PAGE, now, 'none', 'No operator-specific real-time availability feed is connected. RIPE RIS routing and IODA country-level internet outage signals do not establish individual operator or tower availability.'),
    notices: unavailableSource('Public telecom notices', PTS_COVERAGE_PAGE, now, 'none', 'No verified public operator incident feed is connected. PTS annual statistics are not incident notices.'),
    mode,
  }
  cache.set(key, result)
  return result
}

export function clearTelecomCache() {
  cache.clear()
}