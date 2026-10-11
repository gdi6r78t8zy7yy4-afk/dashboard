import { getIodaOutages } from './telecomIoda.mjs'
import { getCloudflareOutages } from './telecomCloudflare.mjs'
import { getPtsCoverage, PTS_COVERAGE_PAGE } from './telecomPts.mjs'
import { getRipeRouting } from './telecomRipe.mjs'

const periods = new Set(['24h', '7d', '30d'])
const cache = new Map()
const cacheMs = 60 * 1000
const providerAdapters = { pts: getPtsCoverage, ripe: getRipeRouting, ioda: getIodaOutages, cloudflare: getCloudflareOutages }
const regionCountries = {
  se: ['SE'],
  no: ['NO'],
  dk: ['DK'],
  fi: ['FI'],
  is: ['IS'],
  nordics: ['DK', 'FI', 'IS', 'NO', 'SE'],
  europe: ['AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'TR', 'UA', 'GB', 'VA'],
}
const regionLabels = { se: 'Sweden', no: 'Norway', dk: 'Denmark', fi: 'Finland', is: 'Iceland', nordics: 'Nordics', europe: 'Europe' }

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
    resolution: 'This source has no data at the selected scope',
    quality: 'missing',
    data,
    note,
  })
}

function average(values) {
  const available = values.filter(Number.isFinite)
  return available.length ? available.reduce((total, value) => total + value, 0) / available.length : null
}

function aggregateRipe(results, region, now) {
  if (results.length === 1 && results[0]?.result) return results[0].result
  const successful = results.filter(({ result }) => result && (result.state === 'ok' || result.state === 'stale'))
  if (!successful.length) {
    return notApplicableSource(
      'RIPEstat / RIPE RIS',
      'https://stat.ripe.net/docs/data-api/ripestat-data-api',
      now,
      'Country-specific RIPEstat queries are not enabled for this selected region.',
      { history: [], latest: null, registeredAsns: null, routedAsns: null },
    )
  }
  const daily = new Map()
  for (const { country, result } of successful) {
    for (const point of result.data.history) {
      const day = point.date.slice(0, 10)
      const bucket = daily.get(day) ?? new Map()
      const current = bucket.get(country) ?? { ipv4: [], ipv6: [], asns: [] }
      if (Number.isFinite(point.ipv4Prefixes)) current.ipv4.push(point.ipv4Prefixes)
      if (Number.isFinite(point.ipv6Prefixes)) current.ipv6.push(point.ipv6Prefixes)
      if (Number.isFinite(point.routedAsns)) current.asns.push(point.routedAsns)
      bucket.set(country, current)
      daily.set(day, bucket)
    }
  }
  const history = [...daily].sort(([left], [right]) => left.localeCompare(right)).map(([date, countries]) => {
    const countryPoints = [...countries.values()]
    return {
      date,
      ipv4Prefixes: average(countryPoints.map((item) => average(item.ipv4))),
      ipv6Prefixes: average(countryPoints.map((item) => average(item.ipv6))),
      routedAsns: average(countryPoints.map((item) => average(item.asns))),
      countriesRepresented: countryPoints.length,
    }
  })
  const latest = history.at(-1) ?? null
  const states = successful.map(({ result }) => result.state)
  const state = !successful.length ? 'error' : successful.length < results.length ? 'partial' : states.includes('stale') ? 'stale' : 'ok'
  const retrievedAt = new Date(now).toISOString()
  return {
    state,
    provenance: {
      source: 'RIPEstat Data API / RIPE RIS',
      sourceUrl: 'https://stat.ripe.net/docs/data-api/ripestat-data-api',
      retrievedAt,
      observedAt: latest?.date ?? null,
      referencePeriod: region.period,
      geographicPrecision: 'multi-country',
      resolution: `Unweighted daily mean of available country-level route counts across ${successful.length} of ${results.length} queried countries; not a deduplicated regional total`,
      quality: 'routing-observation',
    },
    data: {
      history,
      latest,
      registeredAsns: null,
      routedAsns: null,
      countryObservations: successful.map(({ country, result }) => ({ country, latest: result.data.latest })),
    },
    note: `Each point is the unweighted mean of country-level RIPE RIS counts. A prefix or ASN can be visible in multiple countries; this is not a unique Europe-wide prefix or ASN total. ${results.length - successful.length} country query(s) failed.`,
  }
}

function aggregateIodaCountries(results, region, now) {
  if (results.length === 1 && results[0]?.result) return results[0].result
  const successful = results.filter(({ result }) => result && (result.state === 'ok' || result.state === 'stale' || result.state === 'unavailable'))
  if (!successful.length) {
    return notApplicableSource(
      'IODA',
      'https://api.ioda.inetintel.cc.gatech.edu/v2/docs',
      now,
      'IODA integration is currently enabled for Sweden only.',
      { events: [], signal: [], period: region.period, country: region.countries?.[0] ?? region.id },
    )
  }
  const hourly = new Map()
  const events = new Map()
  for (const { country, result } of successful) {
    for (const point of result.data.signal) {
      const hour = new Date(Math.floor(Date.parse(point.timestamp) / 3600000) * 3600000).toISOString()
      const bucket = hourly.get(hour) ?? new Map()
      const values = bucket.get(country) ?? []
      values.push(point.value)
      bucket.set(country, values)
      hourly.set(hour, bucket)
    }
    for (const event of result.data.events) events.set(`${country}:${event.id}`, { ...event, entityName: event.entityName || country })
  }
  const signal = [...hourly].sort(([left], [right]) => left.localeCompare(right)).map(([timestamp, countries]) => ({
    timestamp,
    value: average([...countries.values()].map(average)),
    countriesRepresented: countries.size,
  }))
  const retrievedAt = new Date(now).toISOString()
  const state = !successful.length ? 'error' : successful.length < results.length ? 'partial' : signal.length ? 'ok' : 'unavailable'
  return {
    state,
    provenance: {
      source: 'IODA Internet Outage Detection and Analysis',
      sourceUrl: 'https://api.ioda.inetintel.cc.gatech.edu/v2/docs',
      retrievedAt,
      observedAt: signal.at(-1)?.timestamp ?? null,
      referencePeriod: region.period,
      geographicPrecision: 'multi-country',
      resolution: `Unweighted mean of per-country IODA samples grouped into UTC hours across ${successful.length} of ${results.length} countries`,
      quality: 'internet-outage-indicator',
    },
    data: { events: [...events.values()].sort((left, right) => (right.startedAt ?? '').localeCompare(left.startedAt ?? '')), signal, period: region.period, country: 'Nordics' },
    note: `IODA country signals are averaged for a regional trend; this does not prove every country or network is affected. ${results.length - successful.length} country query(s) failed. An empty event list is not confirmation that all services were available.`,
  }
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
  const countries = regionCountries[selectedRegion]
  if (!countries) throw new Error('Unsupported telecom region. Choose a Nordic country, Nordics, or Europe.')

  const key = `${selectedRegion}:${period}`
  const cached = cache.get(key)
  if (cacheFresh(cached, now)) return { ...cached, retrievedAt: new Date(now).toISOString(), cached: true }

  const regionInfo = { id: selectedRegion, label: regionLabels[selectedRegion], period, countries }
  const isCountry = countries.length === 1
  const [ptsResult, countryRoutingResults, iodaResults, cloudflare] = await Promise.all([
    selectedRegion === 'se' ? adapters.pts({ fetchImpl, now }) : Promise.resolve(null),
    Promise.all(Array.from({ length: Math.ceil(countries.length / 4) }, async (_, batchIndex) => {
      const batch = countries.slice(batchIndex * 4, batchIndex * 4 + 4)
      return Promise.all(batch.map(async (country) => ({ country, result: await adapters.ripe({ country, period, fetchImpl, now }) })))
    })).then((batches) => batches.flat()),
    selectedRegion === 'europe'
      ? adapters.ioda({ country: 'EU', entityType: 'continent', period, fetchImpl, now }).then((result) => [{ country: 'EU', result }])
      : Promise.all(countries.map(async (country) => ({ country, result: await adapters.ioda({ country, period, fetchImpl, now }) }))),
    (adapters.cloudflare ?? getCloudflareOutages)({ region: regionInfo, fetchImpl, now }),
  ])
  const country = isCountry ? countries[0] : selectedRegion.toUpperCase()
  const coverage = ptsResult
    ? normalizePts(ptsResult)
    : notApplicableSource('PTS', PTS_COVERAGE_PAGE, now, 'PTS annual workbook contains Swedish administrative areas only.')
  const routing = aggregateRipe(countryRoutingResults, regionInfo, now)
  const internetIncidents = (selectedRegion === 'europe'
    ? iodaResults[0]?.result
    : isCountry
      ? iodaResults[0]?.result
      : aggregateIodaCountries(iodaResults, regionInfo, now)) ?? notApplicableSource('IODA', 'https://api.ioda.inetintel.cc.gatech.edu/v2/docs', now, 'IODA integration is currently enabled for Sweden only.', { events: [], signal: [], period, country })
  const successfulSources = [coverage, routing, internetIncidents].filter((item) => item?.state === 'ok' || item?.state === 'stale').length
  const mode = successfulSources === 3 ? 'live' : successfulSources ? 'partial' : 'no_data'
  const result = {
    country,
    region: selectedRegion,
    regionLabel: regionInfo.label,
    countries,
    period,
    retrievedAt: new Date(now).toISOString(),
    cached: false,
    coverage,
    routing,
    internetIncidents,
    cloudflare,
    operatorStatus: unavailableSource('Mobile network operator status', PTS_COVERAGE_PAGE, now, 'none', 'No operator-specific real-time availability feed is connected. RIPE RIS routing, IODA country/continent signals, and Cloudflare Radar annotations do not establish individual operator or tower availability.'),
    notices: unavailableSource('Public telecom notices', PTS_COVERAGE_PAGE, now, 'none', 'No verified public operator incident feed is connected. PTS annual statistics are not incident notices.'),
    mode,
  }
  cache.set(key, result)
  return result
}

export function clearTelecomCache() {
  cache.clear()
}