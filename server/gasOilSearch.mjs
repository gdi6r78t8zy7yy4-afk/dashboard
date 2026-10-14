/**
 * Gas and Oil Search Index
 *
 * A bounded, documented search index over the data types that are actually
 * implemented in the gas/oil data model:
 *
 * - geographies:  country/region gazetteer used by /api/v1/gas-oil
 * - indicators:   the indicator set exposed by /api/v1/gas-oil/available
 * - benchmarks:   market price series (FRED-backed where configured)
 * - assets:       the demo facility index rendered by the map (country-level
 *                 storage + the pipeline layer). NOT a complete asset registry.
 * - sources:      the data source definitions from gasOilData.mjs
 *
 * Geographic name resolution uses this built-in reference gazetteer (country
 * and region center coordinates). No external geocoding service is called.
 *
 * Search coverage and limitations are returned with every response so the UI
 * never implies broader coverage than the index actually has.
 */

import { getGasOilSourceMetadata } from './gasOilData.mjs'

/**
 * Built-in reference gazetteer. Center coordinates are approximate
 * reference data (country centroids), not surveyed boundaries.
 */
const GEOGRAPHIES = [
  { name: 'Sweden', type: 'country', scope: 'Europe', aliases: ['Sverige', 'SE'], coordinates: [62.0, 15.0], zoom: 4 },
  { name: 'Norway', type: 'country', scope: 'Europe', aliases: ['Norge', 'NO'], coordinates: [62.0, 9.0], zoom: 4 },
  { name: 'Denmark', type: 'country', scope: 'Europe', aliases: ['Danmark', 'DK'], coordinates: [56.0, 10.0], zoom: 5 },
  { name: 'Finland', type: 'country', scope: 'Europe', aliases: ['Suomi', 'FI'], coordinates: [63.0, 26.0], zoom: 4 },
  { name: 'Germany', type: 'country', scope: 'Europe', aliases: ['Deutschland', 'DE'], coordinates: [51.1, 10.4], zoom: 4 },
  { name: 'United Kingdom', type: 'country', scope: 'Europe', aliases: ['UK', 'United Kingdom of Great Britain and Northern Ireland', 'GB'], coordinates: [54.0, -2.5], zoom: 4 },
  { name: 'United States', type: 'country', scope: 'North America', aliases: ['USA', 'US', 'United States of America'], coordinates: [39.8, -98.6], zoom: 3 },
  { name: 'Canada', type: 'country', scope: 'North America', aliases: ['CA'], coordinates: [56.1, -106.3], zoom: 3 },
  { name: 'Mexico', type: 'country', scope: 'North America', aliases: ['Mexico', 'MX'], coordinates: [23.6, -102.5], zoom: 4 },
  { name: 'Brazil', type: 'country', scope: 'South America', aliases: ['Brasil', 'BR'], coordinates: [-14.2, -51.9], zoom: 3 },
  { name: 'Russia', type: 'country', scope: 'Eurasia', aliases: ['Russian Federation', 'RU'], coordinates: [61.5, 90.0], zoom: 2 },
  { name: 'China', type: 'country', scope: 'Asia', aliases: ['People\'s Republic of China', 'CN'], coordinates: [35.9, 104.2], zoom: 3 },
  { name: 'Japan', type: 'country', scope: 'Asia', aliases: ['Nihon', 'JP'], coordinates: [36.2, 138.3], zoom: 4 },
  { name: 'India', type: 'country', scope: 'Asia', aliases: ['IN'], coordinates: [21.0, 78.0], zoom: 3 },
  { name: 'South Korea', type: 'country', scope: 'Asia', aliases: ['Republic of Korea', 'Korea', 'KR'], coordinates: [36.5, 127.9], zoom: 5 },
  { name: 'Iraq', type: 'country', scope: 'Middle East', aliases: ['IQ'], coordinates: [33.0, 43.8], zoom: 4 },
  { name: 'Saudi Arabia', type: 'country', scope: 'Middle East', aliases: ['Kingdom of Saudi Arabia', 'KSA', 'SA'], coordinates: [24.0, 45.0], zoom: 4 },
  { name: 'Europe', type: 'region', scope: 'Continent', aliases: ['EU', 'European continent'], coordinates: [54.5, 15.0], zoom: 3 },
  { name: 'North America', type: 'region', scope: 'Continent', aliases: [], coordinates: [45.0, -100.0], zoom: 3 },
  { name: 'Asia', type: 'region', scope: 'Continent', aliases: ['Asian continent'], coordinates: [30.0, 80.0], zoom: 2 },
  { name: 'Middle East', type: 'region', scope: 'Region', aliases: [], coordinates: [30.0, 45.0], zoom: 3 },
]

/**
 * Indicators exposed by /api/v1/gas-oil/available.
 * `provided` lists the (commodity, indicator) combinations the current
 * adapter actually produces data for; everything else is defined but has no
 * live source yet and must not be presented as a live observation.
 */
const INDICATORS = [
  { id: 'production', label: 'Production', definition: 'Volume of the selected commodity produced over the observation period.', unit: 'barrels/day (oil) · billion m³/day (gas)', provided: [['crude_oil', 'production']] },
  { id: 'consumption', label: 'Consumption', definition: 'Final consumption of the selected commodity by the selected geography.', unit: 'barrels/day (oil) · billion m³/day (gas)', provided: [] },
  { id: 'reserves', label: 'Reserves', definition: 'Estimated remaining recoverable reserves for the selected commodity.', unit: 'barrels (oil) · billion m³ (gas)', provided: [] },
  { id: 'imports', label: 'Imports', definition: 'Imports of the selected commodity into the selected geography.', unit: 'barrels/day', provided: [] },
  { id: 'exports', label: 'Exports', definition: 'Exports of the selected commodity from the selected geography.', unit: 'barrels/day', provided: [] },
  { id: 'storage', label: 'Storage', definition: 'Reported storage inventory level for the selected commodity.', unit: 'barrels (oil) · billion m³ (gas)', provided: [] },
  { id: 'capacity', label: 'Capacity', definition: 'Installed processing or transport capacity.', unit: 'barrels/day', provided: [] },
  { id: 'flows', label: 'Flows', definition: 'Cross-border or pipeline flow measurements.', unit: 'barrels/day', provided: [] },
  { id: 'prices', label: 'Market Prices', definition: 'Market price for the selected benchmark series.', unit: 'USD/barrel · USD/MMBtu · EUR/MWh', provided: [['crude_oil', 'prices'], ['natural_gas', 'prices']] },
]

const COMMODITIES = [
  { id: 'crude_oil', label: 'Crude Oil' },
  { id: 'natural_gas', label: 'Natural Gas' },
  { id: 'refined_products', label: 'Refined Products' },
  { id: 'lng', label: 'LNG' },
]

/**
 * Market price benchmarks. FRED series ids are the planned source; the
 * benchmark is only "live" when FRED_API_KEY (or an EIA key) is configured.
 */
const BENCHMARKS = [
  { id: 'brent', name: 'Brent Crude', unit: 'USD/barrel', description: 'North Sea Brent crude oil benchmark.', series: { fred: 'DCOILBRENTEU', eia: null }, scope: 'Global market' },
  { id: 'wti', name: 'WTI Crude', unit: 'USD/barrel', description: 'West Texas Intermediate crude oil benchmark.', series: { fred: 'DCOILWTICO', eia: 'pet' }, scope: 'Global market' },
  { id: 'henry_hub', name: 'Henry Hub Natural Gas', unit: 'USD/MMBtu', description: 'US natural gas benchmark at Henry Hub, Louisiana.', series: { fred: 'DHHNGSP', eia: 'NG' }, scope: 'North America market' },
  { id: 'ttf', name: 'Dutch TTF Natural Gas', unit: 'EUR/MWh', description: 'Title Transfer Facility (Netherlands) gas benchmark.', series: { fred: null, eia: null }, scope: 'European market' },
]

/**
 * Demo facility index rendered by the map. These are the "assets" of the
 * currently implemented data model; they are demo values, not verified
 * facility records. A verified registry (e.g. GIE AGSI+) is not yet connected.
 */
const ASSETS = [
  { id: 'storage-united-states', name: 'United States storage', assetType: 'storage', country: 'United States', value: 120000, unit: 'barrels', coordinates: [39.8283, -98.5795] },
  { id: 'storage-saudi-arabia', name: 'Saudi Arabia storage', assetType: 'storage', country: 'Saudi Arabia', value: 100000, unit: 'barrels', coordinates: [24.7136, 46.6753] },
  { id: 'storage-russia', name: 'Russia storage', assetType: 'storage', country: 'Russia', value: 95000, unit: 'barrels', coordinates: [61.524, 105.3188] },
  { id: 'storage-china', name: 'China storage', assetType: 'storage', country: 'China', value: 85000, unit: 'barrels', coordinates: [35.8617, 104.1954] },
  { id: 'storage-canada', name: 'Canada storage', assetType: 'storage', country: 'Canada', value: 55000, unit: 'barrels', coordinates: [56.1304, -106.3468] },
  { id: 'pipeline-trans-eurasia', name: 'Trans-Eurasia Pipeline (demo layer)', assetType: 'pipeline', country: 'Eurasia', value: 50000, unit: 'barrels/day', coordinates: [40, 15] },
]

const TYPE_LABELS = {
  geography: 'Geography',
  indicator: 'Indicator',
  benchmark: 'Price benchmark',
  asset: 'Infrastructure asset',
  source: 'Data source',
}

const LIMITS = { geography: 6, indicator: 5, benchmark: 5, asset: 5, source: 5 }

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * Rank a match: 0 = exact, 1 = prefix, 2 = substring, null = no match.
 */
function matchRank(query, haystack) {
  const q = normalize(query)
  const h = normalize(haystack)
  if (!q || !h) return null
  if (h === q) return 0
  if (h.startsWith(q)) return 1
  if (h.includes(q)) return 2
  return null
}

function bestRank(query, ...haystacks) {
  let best = null
  for (const h of haystacks) {
    const rank = matchRank(query, h)
    if (rank !== null && (best === null || rank < best)) best = rank
  }
  return best
}

function scoreEntries(query, entries, fields, aliasField) {
  const scored = []
  for (const entry of entries) {
    const haystacks = fields.map((f) => entry[f])
    if (aliasField) haystacks.push(...(entry[aliasField] ?? []))
    const rank = bestRank(query, ...haystacks)
    if (rank !== null) scored.push({ entry, rank })
  }
  scored.sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name))
  return scored
}

function buildGeographyRecord(geo) {
  return {
    id: `geography-${geo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    kind: 'geography',
    title: geo.name,
    typeLabel: TYPE_LABELS.geography,
    scope: geo.type === 'region' ? `Region · ${geo.scope}` : `Country · ${geo.scope}`,
    commodity: undefined,
    indicator: undefined,
    value: null,
    unit: null,
    observedAt: null,
    publishedAt: null,
    period: null,
    source: 'Built-in reference gazetteer',
    recordRef: geo.name,
    sourceUrl: null,
    status: 'ok',
    note: geo.aliases.length ? `Also known as: ${geo.aliases.join(', ')}.` : null,
    definition: geo.type === 'region' ? 'Geographic region used as a filter scope for gas and oil data.' : 'Country supported as a geography filter for gas and oil data.',
    methodology: 'Built-in reference gazetteer with approximate center coordinates. No external geocoding service is used.',
    history: null,
    coordinates: geo.coordinates,
    zoom: geo.zoom,
    related: [{ label: 'View on map', action: 'map' }],
  }
}

function buildIndicatorRecord(ind, available) {
  const providedFor = available.commodities.map((c) => ({
    commodity: c,
    provided: ind.provided.some(([commodity]) => commodity === c),
  }))
  return {
    id: `indicator-${ind.id}`,
    kind: 'indicator',
    title: ind.label,
    typeLabel: TYPE_LABELS.indicator,
    scope: 'All geographies (when provided by a source)',
    commodity: undefined,
    indicator: ind.id,
    value: null,
    unit: ind.unit,
    observedAt: null,
    publishedAt: null,
    period: null,
    source: 'Gas & oil data model',
    recordRef: ind.id,
    sourceUrl: null,
    status: providedFor.some((p) => p.provided) ? 'ok' : 'not_configured',
    note: providedFor.some((p) => p.provided)
      ? `Currently produced for: ${providedFor.filter((p) => p.provided).map((p) => p.commodity).join(', ')}.`
      : 'Defined in the data model, but no connected source produces this indicator yet.',
    definition: ind.definition,
    methodology: 'Indicator definition from the gas/oil data model. Availability per commodity is reported by the data adapter.',
    history: null,
    coordinates: null,
    related: [{ label: 'Show on dashboard', action: 'charts' }],
  }
}

function buildBenchmarkRecord(benchmark, live) {
  const seriesLabel = benchmark.series.fred ? `FRED series ${benchmark.series.fred}` : 'No open series connected yet'
  return {
    id: `benchmark-${benchmark.id}`,
    kind: 'benchmark',
    title: benchmark.name,
    typeLabel: TYPE_LABELS.benchmark,
    scope: benchmark.scope,
    commodity: benchmark.id === 'henry_hub' || benchmark.id === 'ttf' ? 'natural_gas' : 'crude_oil',
    indicator: 'prices',
    value: null,
    unit: benchmark.unit,
    observedAt: null,
    publishedAt: null,
    period: null,
    source: 'FRED (Federal Reserve Economic Data)',
    recordRef: benchmark.series.fred ?? null,
    sourceUrl: 'https://fred.stlouisfed.org/',
    status: live ? 'ok' : 'not_configured',
    note: live ? `Live via ${seriesLabel}.` : `${seriesLabel}. Set FRED_API_KEY on the server to enable live prices.`,
    definition: benchmark.description,
    methodology: 'Benchmark price series are fetched from FRED when an API key is configured; otherwise the benchmark is shown as not configured.',
    history: null,
    coordinates: null,
    related: [{ label: 'Show price chart', action: 'charts' }],
  }
}

function buildAssetRecord(asset) {
  return {
    id: `asset-${asset.id}`,
    kind: 'asset',
    title: asset.name,
    typeLabel: `${TYPE_LABELS.asset} · ${asset.assetType}`,
    scope: `Country · ${asset.country}`,
    commodity: 'crude_oil',
    indicator: asset.assetType === 'pipeline' ? 'flows' : 'storage',
    value: asset.value,
    unit: asset.unit,
    observedAt: null,
    publishedAt: null,
    period: null,
    source: 'Map demo facility index',
    recordRef: asset.id,
    sourceUrl: null,
    status: 'stale',
    note: 'Demo facility index bundled with the map. Values are illustrative, not verified facility records. A verified registry (e.g. GIE AGSI+) is not yet connected.',
    definition: asset.assetType === 'pipeline' ? 'Pipeline transport infrastructure.' : 'Strategic storage facility or inventory site.',
    methodology: 'Facility list maintained in the gas/oil search index; coordinates are approximate site locations.',
    history: null,
    coordinates: asset.coordinates,
    zoom: 5,
    related: [{ label: 'View on map', action: 'map' }],
  }
}

function buildSourceRecord(source) {
  return {
    id: `source-${source.id}`,
    kind: 'source',
    title: source.name,
    typeLabel: TYPE_LABELS.source,
    scope: 'Data provider',
    commodity: undefined,
    indicator: undefined,
    value: null,
    unit: null,
    observedAt: null,
    publishedAt: null,
    period: null,
    source: source.name,
    recordRef: source.id,
    sourceUrl: source.url,
    status: source.requiresAuth ? 'not_configured' : 'ok',
    note: source.description,
    definition: 'Upstream data provider for the gas and oil dashboard.',
    methodology: source.requiresAuth ? 'Requires an API key/token to be configured on the server.' : 'Open data, no authentication required.',
    history: null,
    coordinates: null,
    related: source.url ? [{ label: 'Open source site', action: 'source-url' }] : [],
  }
}

function buildIndex() {
  const sources = getGasOilSourceMetadata().map(buildSourceRecord)
  const geographies = GEOGRAPHIES.map((g) => ({ entry: g, record: buildGeographyRecord(g) }))
  const indicators = INDICATORS.map((ind) => ({ entry: ind, record: buildIndicatorRecord(ind, { commodities: COMMODITIES.map((c) => c.id) }) }))
  const fredLive = Boolean(process.env.FRED_API_KEY)
  const eiaLive = Boolean(process.env.EIA_API_KEY)
  const benchmarks = BENCHMARKS.map((b) => {
    const live = b.series.fred ? fredLive : b.series.eia ? eiaLive : false
    return { entry: b, record: buildBenchmarkRecord(b, live) }
  })
  const assets = ASSETS.map((a) => ({ entry: a, record: buildAssetRecord(a) }))
  return { geographies, indicators, benchmarks, assets, sources }
}

/**
 * Search the gas/oil index.
 *
 * @param {string} query - Free-text query (case-insensitive, partial match).
 * @param {Object} [options]
 * @param {number} [options.limit] - Max results per type (default per-type limits).
 * @returns {{ query, results, total, byType, coverage, limitations }}
 */
export function searchGasOil(query, { limit } = {}) {
  const q = normalize(query)
  const index = buildIndex()

  /**
   * Search one entry list. `fields` are the property names matched against
   * the query; `aliasField` optionally adds an array of alias strings.
   * Results keep their original order ranked by match quality, capped.
   */
  const searchType = ({ entries, fields, aliasField, cap }) =>
    scoreEntries(q, entries.map((e) => e.entry), fields, aliasField)
      .slice(0, limit ?? cap)
      .map(({ entry, rank }) => {
        const holder = entries.find((e) => e.entry === entry)
        return {
          id: holder.record.id,
          name: entry.name,
          type: holder.record.kind,
          typeLabel: holder.record.typeLabel,
          scope: holder.record.scope ?? null,
          aliases: entry[aliasField]?.length ? entry[aliasField] : null,
          rank,
          detail: holder.record,
        }
      })

  const results = {
    geographies: searchType({ entries: index.geographies, fields: ['name', 'scope'], aliasField: 'aliases', cap: LIMITS.geography }),
    indicators: searchType({ entries: index.indicators, fields: ['label', 'id', 'definition'], cap: LIMITS.indicator }),
    benchmarks: searchType({ entries: index.benchmarks, fields: ['name', 'id', 'description', 'scope'], cap: LIMITS.benchmark }),
    assets: searchType({ entries: index.assets, fields: ['name', 'country', 'assetType'], cap: LIMITS.asset }),
    sources: searchType({ entries: index.sources.map((record) => ({ entry: { name: record.title, id: record.id, aliases: [] }, record })), fields: ['name', 'id'], aliasField: 'aliases', cap: LIMITS.source }),
  }

  const total = Object.values(results).reduce((sum, list) => sum + list.length, 0)
  const byType = Object.fromEntries(Object.entries(results).map(([k, list]) => [k, list.length]))

  return {
    query: q,
    results,
    total,
    byType,
    coverage: {
      geographies: index.geographies.length,
      indicators: index.indicators.length,
      benchmarks: index.benchmarks.length,
      assets: index.assets.length,
      sources: index.sources.length,
      note: `Search covers ${index.geographies.length} geographies, ${index.indicators.length} indicators, ${index.benchmarks.length} price benchmarks, ${index.assets.length} demo assets and ${index.sources.length} data sources.`,
    },
    limitations: [
      'Geographic search uses a built-in reference gazetteer of 21 entries; it is not a full global geocoder.',
      'Asset results are the demo facility index rendered by the map, not a complete or verified asset registry.',
      'Benchmark prices are live only when a FRED (or EIA) API key is configured on the server.',
      'Indicators without a connected source are returned as definitions, not as live observations.',
    ],
  }
}

/**
 * Search index coverage metadata (returned by /api/v1/gas-oil/search?q=).
 */
export function getGasOilSearchCoverage() {
  const index = buildIndex()
  return {
    coverage: {
      geographies: index.geographies.length,
      indicators: index.indicators.length,
      benchmarks: index.benchmarks.length,
      assets: index.assets.length,
      sources: index.sources.length,
      note: `Search covers ${index.geographies.length} geographies, ${index.indicators.length} indicators, ${index.benchmarks.length} price benchmarks, ${index.assets.length} demo assets and ${index.sources.length} data sources.`,
    },
    limitations: [
      'Geographic search uses a built-in reference gazetteer; it is not a full global geocoder.',
      'Asset results are the demo facility index rendered by the map, not a verified asset registry.',
      'Benchmark prices are live only when a FRED (or EIA) API key is configured on the server.',
    ],
    typeLabels: TYPE_LABELS,
    commodities: COMMODITIES,
    indicators: INDICATORS.map((i) => ({ id: i.id, label: i.label, definition: i.definition, unit: i.unit })),
  }
}

export { GEOGRAPHIES, INDICATORS, BENCHMARKS, ASSETS, TYPE_LABELS, buildGeographyRecord, buildIndicatorRecord, buildBenchmarkRecord, buildAssetRecord, buildSourceRecord, matchRank }
