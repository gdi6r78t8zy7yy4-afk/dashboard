import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Globe2, Search as SearchIcon, TrendingUp } from 'lucide-react'
import GasOilMap from './components/GasOilMap'
import GasOilDetailPanel from './components/GasOilDetailPanel'
import GasOilSearch from './components/GasOilSearch'
import GasOilPriceChart from './components/GasOilPriceChart'
import GasOilSupplyChart from './components/GasOilSupplyChart'
import type {
  GasOilDataset,
  GasOilDetailRecord,
  GasOilPoint,
  GasOilResponse,
  GasOilSearchItem,
  GasOilSource,
} from './types/gas-oil'
import {
  buildFeatureRecord,
  buildKpiRecord,
  buildObservationRecord,
  buildSourceRecord,
  datasetSourceLabel,
  formatCommodity,
  formatDateTime,
  formatIndicator,
  type GasOilFeatureLike,
  type KpiContext,
} from './lib/gasOilDetail'

/** Benchmark series offered by the price chart (demo bases only used offline). */
const BENCHMARK_OPTIONS = [
  { value: 'Brent Crude', seriesId: 'brent', unit: 'USD/barrel', commodity: 'crude_oil', scope: 'Global market', base: 75, spread: 6 },
  { value: 'WTI Crude', seriesId: 'wti', unit: 'USD/barrel', commodity: 'crude_oil', scope: 'Global market', base: 72, spread: 6 },
  { value: 'Henry Hub Natural Gas', seriesId: 'henry_hub', unit: 'USD/MMBtu', commodity: 'natural_gas', scope: 'North America market', base: 2.8, spread: 0.6 },
  { value: 'Dutch TTF Natural Gas', seriesId: 'ttf', unit: 'EUR/MWh', commodity: 'natural_gas', scope: 'European market', base: 34, spread: 8 },
] as const

const PERIOD_CONFIG: Record<string, { count: number; stepMs: number; label: string }> = {
  '24h': { count: 24, stepMs: 3_600_000, label: 'Last 24 hours' },
  '7d': { count: 28, stepMs: 6 * 3_600_000, label: 'Last 7 days' },
  '30d': { count: 30, stepMs: 24 * 3_600_000, label: 'Last 30 days' },
}

const INDICATOR_DEMO_BASE: Record<string, { base: number; spread: number; unit: string }> = {
  production: { base: 12000, spread: 4000, unit: 'barrels/day' },
  consumption: { base: 9000, spread: 3000, unit: 'barrels/day' },
  reserves: { base: 450000, spread: 120000, unit: 'barrels' },
  imports: { base: 3200, spread: 1500, unit: 'barrels/day' },
  exports: { base: 4100, spread: 1600, unit: 'barrels/day' },
  storage: { base: 120000, spread: 30000, unit: 'barrels' },
  capacity: { base: 8000, spread: 2500, unit: 'barrels/day' },
  flows: { base: 50000, spread: 20000, unit: 'barrels/day' },
}

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0
  return h
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Deterministic demo series. Seeded by key and anchored to the current UTC
 * day so values are stable across re-renders. Clearly marked as demo by the
 * caller — these are never presented as live observations.
 */
function demoPoints(seedKey: string, base: number, spread: number, count: number, stepMs: number): GasOilPoint[] {
  const day = new Date()
  day.setUTCHours(0, 0, 0, 0)
  const rnd = mulberry32(hashString(seedKey))
  const points: GasOilPoint[] = []
  for (let i = 0; i < count; i += 1) {
    const t = day.getTime() - (count - 1 - i) * stepMs
    points.push({
      timestamp: new Date(t).toISOString(),
      value: Math.round((base + (rnd() - 0.5) * spread) * 100) / 100,
      category: null,
    })
  }
  return points
}

function benchmarkValueFromTitle(title: string): string {
  const exact = BENCHMARK_OPTIONS.find((b) => b.value === title)
  if (exact) return exact.value
  const upper = title.toUpperCase()
  if (upper.includes('TTF')) return 'Dutch TTF Natural Gas'
  if (upper.includes('HENRY')) return 'Henry Hub Natural Gas'
  if (upper.includes('WTI')) return 'WTI Crude'
  return 'Brent Crude'
}

/** Raw feature shape emitted by GasOilMap (coordinate clicks carry lat/lng). */
interface MapFeature {
  id?: string
  name?: string
  type: 'country' | 'field' | 'terminal' | 'pipeline' | 'storage' | 'coordinates'
  lat?: number
  lng?: number
  commodity?: string
  indicator?: string
  value?: number
  unit?: string
  coordinates?: [number, number]
  country?: string
  source?: string
  lastUpdated?: string
  status?: 'ok' | 'stale' | 'error' | 'missing'
  note?: string
}

interface IndicatorDefinition {
  id: string
  label: string
  definition: string
  unit: string
}

interface ReferenceData {
  indicatorDefinitions: Record<string, IndicatorDefinition>
  coverage: {
    geographies: number
    indicators: number
    benchmarks: number
    assets: number
    sources: number
    note: string
  } | null
  limitations: string[] | null
}

const GasOilDashboard = () => {
  const [commodity, setCommodity] = useState('crude_oil')
  const [indicator, setIndicator] = useState('production')
  const [timePeriod, setTimePeriod] = useState('24h')
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>('Brent Crude')
  const [geographyName, setGeographyName] = useState<string | null>(null)

  const [apiData, setApiData] = useState<GasOilResponse | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reference, setReference] = useState<ReferenceData>({
    indicatorDefinitions: {},
    coverage: null,
    limitations: null,
  })

  const [detailStack, setDetailStack] = useState<GasOilDetailRecord[]>([])
  const [mapFocus, setMapFocus] = useState<{ coordinates: [number, number]; zoom: number; token: number } | null>(null)

  const detailRecord = detailStack.length ? detailStack[detailStack.length - 1] : null

  // Fetch the dataset from the backend; the UI falls back to labeled demo
  // data when the API is unreachable or the source is not configured.
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setApiError(null)
    const params = new URLSearchParams({ commodity, indicator, period: timePeriod })
    if (geographyName) params.set('geography', JSON.stringify({ type: 'country', name: geographyName }))
    fetch(`/api/v1/gas-oil?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Gas & oil API returned ${res.status}`)
        return res.json() as Promise<GasOilResponse>
      })
      .then((data) => {
        setApiData(data)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('Gas & oil data fetch failed:', err)
        setApiData(null)
        setApiError('The gas & oil API is unreachable — showing locally generated demo data.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [commodity, indicator, timePeriod, geographyName])

  // Reference metadata: indicator definitions and search index coverage.
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const [availableRes, searchRes] = await Promise.all([
          fetch('/api/v1/gas-oil/available', { signal: controller.signal }),
          fetch('/api/v1/gas-oil/search', { signal: controller.signal }),
        ])
        const next: ReferenceData = { indicatorDefinitions: {}, coverage: null, limitations: null }
        if (availableRes.ok) {
          const data = (await availableRes.json()) as { indicatorDefinitions?: IndicatorDefinition[] }
          if (Array.isArray(data.indicatorDefinitions)) {
            for (const def of data.indicatorDefinitions) next.indicatorDefinitions[def.id] = def
          }
        }
        if (searchRes.ok) {
          const data = (await searchRes.json()) as {
            coverage?: ReferenceData['coverage']
            limitations?: string[]
          }
          next.coverage = data.coverage ?? null
          next.limitations = data.limitations ?? null
        }
        setReference(next)
      } catch {
        // Reference data is optional; demo mode works without it.
      }
    }
    void load()
    return () => controller.abort()
  }, [])

  const periodConfig = PERIOD_CONFIG[timePeriod] ?? PERIOD_CONFIG['24h']

  const dataset: GasOilDataset | null = useMemo(() => {
    if (!apiData) return null
    const key = indicator === 'prices' ? 'prices' : indicator
    return (apiData.datasets as Record<string, GasOilDataset | undefined>)[key] ?? null
  }, [apiData, indicator])

  const isDemo = !(dataset && dataset.status === 'ok' && dataset.points.length > 0)
  const benchmark = BENCHMARK_OPTIONS.find((b) => b.value === selectedBenchmark) ?? BENCHMARK_OPTIONS[0]
  const allSourcesUnconfigured = (apiData?.sources ?? []).length > 0 &&
    (apiData?.sources ?? []).every((s) => s.status === 'not_configured')
  const sourceLabel = isDemo
    ? 'Demo data (generated locally)'
    : allSourcesUnconfigured
      ? 'Demo data (generated by backend)'
      : (datasetSourceLabel(apiData?.sources) ?? 'Unknown source')

  const priceData = useMemo<GasOilPoint[]>(() => {
    if (indicator !== 'prices') return []
    if (!isDemo && dataset) return dataset.points
    return demoPoints(
      `price-${benchmark.seriesId}-${timePeriod}`,
      benchmark.base,
      benchmark.spread,
      periodConfig.count,
      periodConfig.stepMs,
    )
  }, [indicator, isDemo, dataset, benchmark, timePeriod, periodConfig])

  const supplyData = useMemo<GasOilPoint[]>(() => {
    if (indicator === 'prices') return []
    if (!isDemo && dataset) return dataset.points
    const spec = INDICATOR_DEMO_BASE[indicator] ?? { base: 10000, spread: 3000, unit: 'units' }
    return demoPoints(
      `supply-${indicator}-${commodity}-${geographyName ?? 'global'}-${timePeriod}`,
      spec.base,
      spec.spread,
      periodConfig.count,
      periodConfig.stepMs,
    )
  }, [indicator, isDemo, dataset, commodity, geographyName, timePeriod, periodConfig])

  const unit =
    indicator === 'prices'
      ? benchmark.unit
      : (dataset?.unit || INDICATOR_DEMO_BASE[indicator]?.unit || '')

  const chartData = indicator === 'prices' ? priceData : supplyData

  // Honest KPI cards: metric definition, latest observation, source and
  // history — never fabricated aggregate numbers.
  const kpis = useMemo<KpiContext[]>(() => {
    const latest = chartData.length ? chartData[chartData.length - 1] : null
    const def = reference.indicatorDefinitions[indicator]
    const indicatorLabel = formatIndicator(indicator) ?? indicator
    const demoNote = isDemo
      ? 'Demo value generated locally — no connected source produces this indicator yet.'
      : null

    const sources = apiData?.sources ?? []
    const okCount = sources.filter((s) => s.status === 'ok').length
    const coverage = reference.coverage
    const coverageTotal = coverage
      ? coverage.geographies + coverage.indicators + coverage.benchmarks + coverage.assets + coverage.sources
      : null

    return [
      {
        id: `latest-${indicator}`,
        label: `Latest ${indicatorLabel}`,
        definition:
          def?.definition ??
          `${indicatorLabel} for ${formatCommodity(commodity) ?? commodity}${geographyName ? ` in ${geographyName}` : ''}.`,
        latest: latest ? { value: latest.value, unit, timestamp: latest.timestamp } : null,
        source: sourceLabel,
        status: latest ? 'ok' : 'missing',
        scope: geographyName ? `Country · ${geographyName}` : 'Global',
        period: periodConfig.label,
        note: demoNote,
        history: chartData.length ? chartData.slice(-10) : null,
      },
      {
        id: 'geography',
        label: 'Active geography',
        definition:
          'Country scope applied to the current dataset. Change it from global search or by selecting a country on the map.',
        latest: null,
        source: 'Built-in reference gazetteer',
        status: 'ok',
        scope: geographyName ? `Country · ${geographyName}` : 'Default · Sweden',
        note: geographyName ? null : 'No country filter is active; the backend default (Sweden) applies.',
      },
      {
        id: 'data-sources',
        label: 'Data sources',
        definition:
          'Upstream providers behind the current dataset. A source counts as active only when it is configured and producing data.',
        latest: sources.length
          ? { value: okCount, unit: `of ${sources.length} sources`, timestamp: null }
          : null,
        source: 'Gas & oil data model',
        status: okCount > 0 ? 'ok' : 'missing',
        note: apiData
          ? sources.length
            ? sources.map((s) => `${s.name}: ${s.status}`).join(' · ')
            : 'Source metadata unavailable.'
          : 'Backend offline — source metadata unavailable.',
      },
      {
        id: 'search-index',
        label: 'Search index',
        definition:
          'Entries the global search can resolve. Search covers a bounded reference index, not every asset or market in the world.',
        latest: coverageTotal !== null ? { value: coverageTotal, unit: 'indexed entries', timestamp: null } : null,
        source: 'Gas & oil search index',
        status: coverage ? 'ok' : 'missing',
        note: coverage?.note ?? 'Coverage metadata unavailable while the API is offline.',
        methodology: reference.limitations?.length ? reference.limitations.join(' ') : null,
      },
    ]
  }, [chartData, reference, indicator, commodity, geographyName, isDemo, unit, sourceLabel, periodConfig, apiData])

  const openDetail = useCallback((record: GasOilDetailRecord) => {
    setDetailStack((stack) => [...stack.slice(-9), record])
  }, [])

  const closeDetail = useCallback(() => setDetailStack([]), [])
  const backDetail = useCallback(() => setDetailStack((stack) => stack.slice(0, -1)), [])

  const focusMap = useCallback((coordinates: [number, number], zoom = 5) => {
    setMapFocus({ coordinates, zoom, token: Date.now() })
  }, [])

  const handleNavigate = (action: string, record: GasOilDetailRecord) => {
    switch (action) {
      case 'map':
        if (Array.isArray(record.coordinates)) focusMap(record.coordinates, record.zoom ?? 5)
        break
      case 'charts':
        document.getElementById('gas-oil-charts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      case 'source-url':
        if (record.sourceUrl) window.open(record.sourceUrl, '_blank', 'noopener,noreferrer')
        break
      default:
        break
    }
  }

  const handlePricePointSelect = (point: { timestamp: string; value: number }) => {
    openDetail(
      buildObservationRecord(point, {
        title: benchmark.value,
        scope: benchmark.scope,
        commodity: benchmark.commodity,
        indicator: 'prices',
        unit: benchmark.unit,
        source: sourceLabel,
        recordRef: benchmark.seriesId,
        sourceUrl: 'https://fred.stlouisfed.org/',
        status: 'ok',
        period: periodConfig.label,
        note: isDemo
          ? 'Demo observation generated locally — no live source is connected for this benchmark yet.'
          : (dataset?.note ?? null),
        history: priceData,
        publishedAt: isDemo ? null : (dataset?.lastUpdated ?? null),
      }),
    )
  }

  const handleSupplyPointSelect = (point: { timestamp: string; value: number }) => {
    openDetail(
      buildObservationRecord(point, {
        title: `${formatCommodity(commodity) ?? ''} ${formatIndicator(indicator) ?? ''}`.trim(),
        scope: geographyName ? `Country · ${geographyName}` : 'Global',
        commodity,
        indicator,
        unit,
        source: sourceLabel,
        recordRef: indicator,
        status: 'ok',
        period: periodConfig.label,
        note: isDemo
          ? 'Demo observation generated locally — the selected indicator has no connected source yet.'
          : (dataset?.note ?? null),
        history: supplyData,
        publishedAt: isDemo ? null : (dataset?.lastUpdated ?? null),
      }),
    )
  }

  const handleFeatureSelect = (feature: MapFeature) => {
    const lat = feature.type === 'coordinates' ? feature.lat : (feature.coordinates?.[0] ?? null)
    const lng = feature.type === 'coordinates' ? feature.lng : (feature.coordinates?.[1] ?? null)
    const normalized: GasOilFeatureLike = {
      id: feature.id,
      name:
        feature.name ??
        (typeof lat === 'number' && typeof lng === 'number'
          ? `${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`
          : 'Map location'),
      type: feature.type,
      commodity: feature.commodity ?? commodity,
      indicator: feature.indicator,
      value: feature.value ?? null,
      unit: feature.unit ?? null,
      coordinates:
        feature.coordinates ??
        (typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : null),
      country: feature.country ?? null,
      source: feature.source ?? null,
      lastUpdated: feature.lastUpdated ?? null,
      status: feature.status ?? 'ok',
      note: feature.note ?? null,
    }
    openDetail(
      buildFeatureRecord(normalized, {
        source: normalized.source ?? sourceLabel,
        publishedAt: isDemo ? null : (dataset?.lastUpdated ?? null),
        note:
          normalized.note ??
          (isDemo
            ? 'Demo value from the map layer — not a verified facility record.'
            : (dataset?.note ?? null)),
        history: dataset ? dataset.points : null,
        period: periodConfig.label,
      }),
    )
  }

  const handleSearchSelect = (item: GasOilSearchItem) => {
    const record = item.detail
    if (item.type === 'geography' && record.scope?.startsWith('Country')) {
      setGeographyName(record.title)
    } else if (item.type === 'indicator' && record.indicator) {
      setIndicator(record.indicator)
    } else if (item.type === 'benchmark') {
      setIndicator('prices')
      setSelectedBenchmark(benchmarkValueFromTitle(record.title))
    }
    if (Array.isArray(record.coordinates)) {
      focusMap(record.coordinates, record.zoom ?? (item.type === 'geography' ? 4 : 5))
    }
    openDetail(record)
  }

  const datasetEntries: [string, GasOilDataset][] = apiData
    ? (Object.entries(apiData.datasets) as [string, GasOilDataset][]).filter(([, d]) => d)
    : []

  const buildDatasetRecord = (key: string, d: GasOilDataset): GasOilDetailRecord => {
    const def = reference.indicatorDefinitions[key]
    const latest = d.points.length
      ? d.points.reduce((a, b) => (b.timestamp > a.timestamp ? b : a))
      : null
    return {
      id: `dataset-${key}`,
      kind: 'indicator',
      title: formatIndicator(key) ?? key,
      typeLabel: 'Indicator dataset',
      scope: geographyName ? `Country · ${geographyName}` : 'Global',
      commodity,
      indicator: key,
      value: latest?.value ?? null,
      unit: d.unit || null,
      observedAt: latest?.timestamp ?? null,
      publishedAt: d.lastUpdated,
      period: periodConfig.label,
      source: datasetSourceLabel(apiData?.sources),
      recordRef: key,
      sourceUrl: null,
      status: d.status,
      note: d.note ?? (d.points.length === 0 ? 'No points in the current response.' : null),
      definition: def?.definition ?? null,
      methodology: null,
      history: d.points.length ? d.points.slice(-20) : null,
      coordinates: null,
      related: [{ label: 'Show on charts', action: 'charts' }],
    }
  }

  const kpiIcons = [TrendingUp, Globe2, Activity, SearchIcon]

  const statusText = loading
    ? 'Updating data…'
    : isDemo
      ? 'Showing locally generated demo data — no live gas & oil source is configured yet.'
      : `Data for ${formatCommodity(commodity) ?? commodity} ${formatIndicator(indicator) ?? indicator} (${apiData?.mode ?? 'partial'} mode).`

  return (
    <div className="gas-oil-dashboard" aria-label="Gas and Oil Dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Global Gas & Oil Dashboard</h1>
          <p>{statusText}</p>
          {apiError && (
            <div className="dashboard-api-warning" role="status">
              {apiError}
            </div>
          )}
        </div>
        <div className="dashboard-controls">
          <GasOilSearch onSelect={handleSearchSelect} />
          <label htmlFor="commodity-select">Commodity:</label>
          <select id="commodity-select" value={commodity} onChange={(e) => setCommodity(e.target.value)}>
            <option value="crude_oil">Crude Oil</option>
            <option value="natural_gas">Natural Gas</option>
            <option value="refined_products">Refined Products</option>
            <option value="lng">LNG</option>
          </select>

          <label htmlFor="indicator-select">Indicator:</label>
          <select id="indicator-select" value={indicator} onChange={(e) => setIndicator(e.target.value)}>
            <option value="production">Production</option>
            <option value="consumption">Consumption</option>
            <option value="reserves">Reserves</option>
            <option value="imports">Imports</option>
            <option value="exports">Exports</option>
            <option value="storage">Storage</option>
            <option value="capacity">Capacity</option>
            <option value="flows">Flows</option>
            <option value="prices">Market Prices</option>
          </select>

          <span className="geography-badge" title="Geography filter — change via search or map">
            {geographyName ?? 'Sweden (default)'}
          </span>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="map-section">
          <GasOilMap
            onFeatureSelect={handleFeatureSelect}
            commodity={commodity}
            indicator={indicator}
            focus={mapFocus}
          />
        </div>

        <div className={`detail-section ${detailRecord ? 'open' : ''}`}>
          <GasOilDetailPanel
            record={detailRecord}
            historyDepth={detailStack.length}
            onClose={closeDetail}
            onBack={backDetail}
            onNavigate={handleNavigate}
          />
        </div>
      </div>

      <div className="dashboard-charts" id="gas-oil-charts">
        <div className="chart-section-header">
          <h2>
            {indicator === 'prices'
              ? `Market Prices — ${benchmark.value}`
              : `${formatCommodity(commodity) ?? ''} ${formatIndicator(indicator) ?? ''}`}
          </h2>
          <div className="chart-controls">
            {indicator === 'prices' && (
              <select
                value={selectedBenchmark}
                onChange={(e) => setSelectedBenchmark(e.target.value)}
                aria-label="Price benchmark"
              >
                {BENCHMARK_OPTIONS.map((b) => (
                  <option key={b.seriesId} value={b.value}>
                    {b.value}
                  </option>
                ))}
              </select>
            )}
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
              aria-label="Time period"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>

        {indicator === 'prices' && priceData.length > 0 && (
          <div className="chart-container">
            <GasOilPriceChart
              data={priceData}
              benchmark={benchmark.value}
              unit={benchmark.unit}
              timePeriod={timePeriod}
              onPointSelect={handlePricePointSelect}
            />
          </div>
        )}

        {indicator !== 'prices' && supplyData.length > 0 && (
          <div className="chart-container">
            <GasOilSupplyChart
              data={supplyData}
              indicator={indicator}
              unit={unit}
              timePeriod={timePeriod}
              onPointSelect={handleSupplyPointSelect}
            />
          </div>
        )}
      </div>

      {/* KPI / summary cards — click opens the shared detail panel */}
      <div className="dashboard-summary">
        <div className="summary-grid">
          {kpis.map((kpi, idx) => {
            const Icon = kpiIcons[idx] ?? Activity
            const latest = kpi.latest
            let valueText = '—'
            if (latest && latest.value !== null && latest.value !== undefined) {
              valueText = latest.value.toLocaleString('en-GB', { maximumFractionDigits: 2 })
            } else if (kpi.status === 'missing') {
              valueText = 'No data'
            }
            return (
              <button
                key={kpi.id}
                type="button"
                className="summary-card kpi-card"
                onClick={() => openDetail(buildKpiRecord(kpi))}
                title="Open details"
              >
                <Icon size={20} />
                <div>
                  <span>{kpi.label}</span>
                  <strong>
                    {valueText}
                    {latest && latest.value !== null && latest.unit ? (
                      <small className="kpi-unit"> {latest.unit}</small>
                    ) : null}
                  </strong>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sources & datasets — click a row to open its detail record */}
      <div className="dashboard-sources">
        <div className="chart-section-header">
          <h2>Sources & datasets</h2>
        </div>
        {apiData ? (
          <div className="sources-table-wrapper">
            <table className="sources-table">
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last updated</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {apiData.sources.map((source: GasOilSource) => (
                  <tr
                    key={source.id}
                    className="sources-table-row"
                    tabIndex={0}
                    onClick={() => openDetail(buildSourceRecord(source))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openDetail(buildSourceRecord(source))
                    }}
                  >
                    <td>
                      <strong>{source.name}</strong>
                      {source.requiresAuth ? ' (API key required)' : ''}
                    </td>
                    <td>
                      <span className={`status-badge ${source.status}`}>{source.status}</span>
                    </td>
                    <td>{formatDateTime(source.lastUpdated) ?? '—'}</td>
                    <td className="sources-table-note">{source.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="sources-table">
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col">Status</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Points</th>
                  <th scope="col">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {datasetEntries.map(([key, d]) => (
                  <tr
                    key={key}
                    className="sources-table-row"
                    tabIndex={0}
                    onClick={() => openDetail(buildDatasetRecord(key, d))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openDetail(buildDatasetRecord(key, d))
                    }}
                  >
                    <td>
                      <strong>{formatIndicator(key) ?? key}</strong>
                    </td>
                    <td>
                      <span className={`status-badge ${d.status}`}>{d.status}</span>
                    </td>
                    <td>{d.unit || '—'}</td>
                    <td>{d.points.length}</td>
                    <td>{formatDateTime(d.lastUpdated) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="sources-table-empty">
            The gas &amp; oil API is offline — source and dataset metadata are unavailable.
            Restart the backend to load live metadata.
          </p>
        )}
      </div>
    </div>
  )
}

export default GasOilDashboard
