import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowUpRight, CloudSun, Info, Zap } from 'lucide-react'

type Point = { timestamp: string; value: number; category: string | null; quality?: string | null }
type Dataset = { status: string; dataType: string; unit: string; points: Point[]; lastUpdated: string | null; note: string | null }
type WeatherObservation = { parameter: number; label: string; status: string; unit: string; station: string | null; points: Point[]; lastUpdated: string | null; note: string | null }
type EnergyResponse = {
  mode: string
  market: { country: string; countryLabel: string; zone: string; eic: string; period: string; timezone: string; start: string; end: string }
  sources: {
    entsoe: { status: string; label: string; endpoint: string; lastUpdated: string | null }
    smhi: { status: string; label: string }
    svkNotices: { status: string; label: string; url: string; note: string }
    smhiForecast: { status: string; label: string; note: string }
  }
  datasets: {
    dayAheadPrices: Dataset
    actualGeneration: Dataset
    generationForecast: Dataset
    actualLoad: Dataset
    loadForecast: Dataset
    crossBorderFlows: { neighbor: string; export: Dataset; import: Dataset }[]
  }
  weather: WeatherObservation[]
  gridDisturbances: { status: string; value: null; note: string }
  retrievedAt: string
}

const countryOptions = [
  { id: 'se', label: 'Sweden', zones: ['SE1', 'SE2', 'SE3', 'SE4'] },
  { id: 'no', label: 'Norway', zones: ['NO1', 'NO2', 'NO3', 'NO4', 'NO5'] },
  { id: 'dk', label: 'Denmark', zones: ['DK1', 'DK2'] },
  { id: 'fi', label: 'Finland', zones: ['FI'] },
]

const chartColors = ['#387c65', '#c8893d', '#6483a2', '#b65f51', '#7c8c58', '#8b6c8c', '#4f99a0', '#b06f4e']
const statusLabels: Record<string, string> = {
  ok: 'Available',
  configured: 'Configured',
  partial: 'Partial data',
  not_configured: 'Not configured',
  not_applicable: 'Not applicable',
  unavailable: 'Unavailable',
  missing: 'No values',
  stale: 'Stale',
  error: 'Error',
}

function formatTime(value: string | null, timezone = 'Europe/Stockholm') {
  if (!value) return 'No update time'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function latestPoint(points: Point[]) {
  return [...points].sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0] ?? null
}

function latestByCategory(points: Point[]) {
  const byCategory = new Map<string, Point>()
  for (const point of points) {
    const category = point.category ?? 'Unspecified'
    const previous = byCategory.get(category)
    if (!previous || point.timestamp > previous.timestamp) byCategory.set(category, point)
  }
  return [...byCategory.entries()].map(([category, point]) => ({ ...point, category }))
}

function makeChartRows(series: { name: string; points: Point[] }[]) {
  const rows = new Map<string, Record<string, string | number>>()
  const available = series.filter((item) => item.points.length > 0)
  for (const item of available) {
    for (const point of item.points) {
      const row = rows.get(point.timestamp) ?? { timestamp: point.timestamp }
      row[item.name] = point.value
      rows.set(point.timestamp, row)
    }
  }
  return { rows: [...rows.values()].sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp))), series: available }
}

function Status({ value }: { value: string }) {
  return <span className={`energy-status ${value}`}><i />{statusLabels[value] ?? value}</span>
}

function EmptyData({ dataset }: { dataset: Dataset }) {
  return (
    <div className="energy-empty" role="status">
      <strong>{dataset.status === 'not_configured' ? 'Live data not configured' : dataset.status === 'error' ? 'Source request failed' : 'No values for this selection'}</strong>
      <span>{dataset.note ?? 'The selected period has no published values.'}</span>
    </div>
  )
}

function EnergyChart({
  title,
  description,
  unit,
  series,
  timezone,
  emptyStatus,
  emptyNote,
}: {
  title: string
  description: string
  unit: string
  series: { name: string; points: Point[] }[]
  timezone: string
  emptyStatus?: string
  emptyNote?: string | null
}) {
  const chart = makeChartRows(series)
  return (
    <article className="panel energy-chart-panel">
      <div className="panel-heading">
        <div><div className="section-kicker">{description}</div><h2>{title}</h2></div>
        <span className="energy-unit">{unit}</span>
      </div>
      {chart.rows.length === 0 ? (
        <div className="energy-chart-empty"><Status value={emptyStatus ?? 'missing'} /><span>{emptyNote ?? 'No published series for this area and period.'}</span></div>
      ) : (
        <div className="energy-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart.rows} margin={{ top: 10, right: 12, bottom: 2, left: 0 }}>
              <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={(value) => formatTime(String(value), timezone).replace(/,\s*/, ' ')} minTickGap={26} tick={{ fill: '#899188', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis width={48} tick={{ fill: '#899188', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                labelFormatter={(value) => formatTime(String(value), timezone)}
                formatter={(value) => [`${Number(value).toLocaleString('en-GB')} ${unit}`]}
                contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 10 }}
              />
              {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 9 }} />}
              {chart.series.map((item, index) => (
                <Line key={item.name} type="monotone" dataKey={item.name} stroke={chartColors[index % chartColors.length]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  )
}

function LatestMetric({ label, dataset, category, timezone }: { label: string; dataset: Dataset; category?: string; timezone: string }) {
  const point = latestPoint(dataset.points.filter((item) => !category || item.category === category))
  return (
    <article className="energy-metric">
      <span>{label}</span>
      <strong>{dataset.status === 'not_configured' || !point ? 'No data' : `${point.value.toLocaleString('en-GB')} ${dataset.unit}`}</strong>
      <small>{point ? `Latest ${formatTime(point.timestamp, timezone)}` : statusLabels[dataset.status] ?? dataset.status}</small>
    </article>
  )
}

function EnergyDashboard() {
  const [country, setCountry] = useState('se')
  const [zone, setZone] = useState('SE3')
  const [period, setPeriod] = useState('24h')
  const [data, setData] = useState<EnergyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const countryChoice = countryOptions.find((item) => item.id === country) ?? countryOptions[0]

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ country, zone, period })
    fetch(`/api/v1/energy?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Energy API returned ${response.status}`)
        return response.json() as Promise<EnergyResponse>
      })
      .then((response) => setData(response))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load energy data.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [country, zone, period])

  const price = data?.datasets.dayAheadPrices
  const actualLoad = data?.datasets.actualLoad
  const actualGeneration = data?.datasets.actualGeneration
  const generationCategories = actualGeneration ? latestByCategory(actualGeneration.points) : []
  const loadSeries = data ? [
    { name: 'Measured load', points: data.datasets.actualLoad.points },
    { name: 'Load forecast', points: data.datasets.loadForecast.points },
  ] : []
  const generationSeries = data ? [
    { name: 'Measured generation', points: data.datasets.actualGeneration.points },
    { name: 'Generation forecast', points: data.datasets.generationForecast.points },
  ] : []
  const flowSeries = data ? data.datasets.crossBorderFlows.flatMap((flow) => [
    { name: `${flow.neighbor} import`, points: flow.import.points },
    { name: `${flow.neighbor} export`, points: flow.export.points },
  ]) : []
  const latestFlows = data?.datasets.crossBorderFlows.map((flow) => ({
    neighbor: flow.neighbor,
    imported: latestPoint(flow.import.points),
    exported: latestPoint(flow.export.points),
    importStatus: flow.import.status,
    exportStatus: flow.export.status,
    importUnit: flow.import.unit,
    exportUnit: flow.export.unit,
  })) ?? []
  const timezone = data?.market.timezone ?? 'Europe/Stockholm'

  return (
    <section className="energy-dashboard" aria-label="Electricity market and system data">
      <div className="energy-controls">
        <div className="energy-heading">
          <div className="energy-heading-icon"><Zap size={18} /></div>
          <div><div className="section-kicker">ENERGY SYSTEM DATA</div><h2>Market and operations</h2></div>
          <Status value={data?.sources.entsoe.status ?? 'unavailable'} />
        </div>
        <div className="energy-selectors">
          <label>Country
            <select value={country} onChange={(event) => {
              const nextCountry = event.target.value
              setCountry(nextCountry)
              setZone(countryOptions.find((item) => item.id === nextCountry)?.zones[0] ?? '')
            }}>
              {countryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Bidding zone
            <select value={zone} onChange={(event) => setZone(event.target.value)}>
              {countryChoice.zones.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Period
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
          <div className="energy-updated"><small>Retrieved</small><strong>{formatTime(data?.retrievedAt ?? null)}</strong></div>
        </div>
      </div>

      {error && <div className="data-error" role="alert">Energy data is unavailable: {error}</div>}
      {loading && <p className="data-message" role="status">Loading market and weather data…</p>}

      {!loading && data && (
        <>
          <div className="energy-market-context">
            <span><strong>{data.market.countryLabel}</strong> · {data.market.zone}</span>
            <span>EIC {data.market.eic}</span>
            <span>Display timezone: {data.market.timezone}</span>
            <span>Range: {formatTime(data.market.start)} – {formatTime(data.market.end)}</span>
          </div>

          <div className="energy-metrics">
            <LatestMetric label="Day-ahead market price" dataset={data.datasets.dayAheadPrices} timezone={timezone} />
            <LatestMetric label="Latest measured load" dataset={data.datasets.actualLoad} timezone={timezone} />
            <LatestMetric label="Latest measured generation" dataset={data.datasets.actualGeneration} timezone={timezone} />
            <article className="energy-metric disturbance-metric">
              <span>Verified grid disturbances</span>
              <strong>No feed</strong>
              <small>{data.gridDisturbances.note}</small>
            </article>
          </div>

          <div className="energy-chart-grid">
            <EnergyChart title="Day-ahead prices" description="MARKET PRICE · NOT GRID STABILITY" unit={price?.unit ?? 'EUR/MWh'} series={[{ name: 'Day-ahead', points: price?.points ?? [] }]} timezone={timezone} emptyStatus={price?.status} emptyNote={price?.note} />
            <EnergyChart title="Generation by production type" description="ACTUAL AND FORECAST VALUES ARE SEPARATE SERIES" unit={actualGeneration?.unit ?? 'MW'} series={generationSeries} timezone={timezone} emptyStatus={actualGeneration?.status} emptyNote={actualGeneration?.note} />
            <EnergyChart title="Consumption and load" description="MEASURED LOAD VS FORECAST" unit={actualLoad?.unit ?? 'MW'} series={loadSeries} timezone={timezone} emptyStatus={actualLoad?.status} emptyNote={actualLoad?.note} />
            <EnergyChart title="Inter-area imports and exports" description="MEASURED CROSS-BORDER FLOWS" unit={data.datasets.crossBorderFlows[0]?.import.unit ?? 'MWh'} series={flowSeries} timezone={timezone} emptyStatus={data.datasets.crossBorderFlows[0]?.import.status} emptyNote={data.datasets.crossBorderFlows[0]?.import.note} />
          </div>

          <div className="energy-detail-grid">
            <article className="panel energy-production-panel">
              <div className="section-kicker">LATEST PRODUCTION VALUES</div>
              <h2>By production type</h2>
              {generationCategories.length ? (
                <div className="energy-production-list">
                  {generationCategories.map((item) => <div key={item.category}><span>{item.category}</span><strong>{item.value.toLocaleString('en-GB')} {actualGeneration?.unit}</strong><small>{formatTime(item.timestamp)}</small></div>)}
                </div>
              ) : <EmptyData dataset={data.datasets.actualGeneration} />}
            </article>

            <article className="panel energy-flow-panel">
              <div className="section-kicker">LATEST CROSS-BORDER VALUES</div>
              <h2>Imports and exports</h2>
              {latestFlows.length ? latestFlows.map((flow) => (
                <div className="energy-flow-row" key={flow.neighbor}>
                  <strong>{flow.neighbor}</strong>
                  <span>Import <b>{flow.imported ? `${flow.imported.value} ${flow.importUnit}` : statusLabels[flow.importStatus]}</b></span>
                  <span>Export <b>{flow.exported ? `${flow.exported.value} ${flow.exportUnit}` : statusLabels[flow.exportStatus]}</b></span>
                </div>
              )) : <div className="energy-empty">No adjacent-area flows are configured for this selection.</div>}
              <small className="energy-flow-note">ENTSO-E aggregated flow quantities are reported per interval; the provider's unit is shown.</small>
            </article>

            <article className="panel energy-weather-panel">
              <div className="panel-heading"><div><div className="section-kicker">WEATHER CONTEXT</div><h2><CloudSun size={15} /> SMHI observations</h2></div><Status value={data.sources.smhi.status} /></div>
              <p>Weather observations provide context only; they do not indicate or confirm power-system faults.</p>
              {data.weather.length ? data.weather.map((item) => {
                const latest = latestPoint(item.points)
                return <div className="energy-weather-row" key={item.parameter}><span>{item.label}</span><strong>{latest ? `${latest.value} ${item.unit}` : 'No data'}</strong><Status value={item.status} /><small>{item.station ?? item.note} · {formatTime(item.lastUpdated, timezone)}</small></div>
              }) : <div className="energy-empty">SMHI observations are available for Swedish stations only.</div>}
              <div className="energy-weather-note"><Info size={14} /><span>{data.sources.smhiForecast.note}</span></div>
            </article>

            <article className="panel energy-notice-panel">
              <div className="panel-heading"><div><div className="section-kicker">OFFICIAL NOTICES</div><h2>Svenska kraftnät</h2></div><Status value={data.sources.svkNotices.status} /></div>
              <p>{data.sources.svkNotices.note}</p>
              <a className="source-link" href={data.sources.svkNotices.url} target="_blank" rel="noreferrer">Open operating information <ArrowUpRight size={14} /></a>
              <div className="energy-grid-caveat"><strong>Network events</strong><span>{data.gridDisturbances.note}</span></div>
            </article>

            <article className="panel energy-source-panel">
              <div className="section-kicker">DATA PROVENANCE</div>
              <h2>Source health and freshness</h2>
              <div className="energy-source-row"><span>{data.sources.entsoe.label}</span><Status value={data.sources.entsoe.status} /></div>
              <div className="energy-source-row"><span>{data.sources.smhi.label}</span><Status value={data.sources.smhi.status} /></div>
              <div className="energy-source-row"><span>Latest ENTSO-E data</span><strong>{formatTime(data.sources.entsoe.lastUpdated)}</strong></div>
              <div className="energy-source-row"><span>Retrieved from backend</span><strong>{formatTime(data.retrievedAt)}</strong></div>
              <a className="source-link" href="https://transparency.entsoe.eu/" target="_blank" rel="noreferrer">ENTSO-E Transparency Platform <ArrowUpRight size={14} /></a>
            </article>
          </div>
        </>
      )}
    </section>
  )
}

export default EnergyDashboard