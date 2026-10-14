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
  BarChart,
  Bar,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts'
import { ArrowUpRight, CloudSun, Info, Zap, TrendingUp, TrendingDown, Activity, Gauge } from 'lucide-react'

type Point = { timestamp: string; value: number; category: string | null; quality?: string | null }
type Dataset = { status: string; dataType: string; unit: string; points: Point[]; lastUpdated: string | null; note: string | null }
type WeatherObservation = { parameter: number; label: string; status: string; unit: string; station: string | null; points: Point[]; lastUpdated: string | null; note: string | null }

type SvkLatestReserve = {
  direction: string
  volume: number
  volumeUnit: string
  price: number
  priceUnit: string
  timeSweden: string
  timestamp: string | null
}

type SvkData = {
  status: string
  endpoint: string
  label: string
  url: string
  lastUpdated: string | null
  portal?: {
    status: string
    endpoint: string
    siteTitle: string
    siteUrl: string
    ckanVersion: string | null
    retrievedAt: string
  }
  flows?: {
    status: string
    zone: string
    lastUpdated: string | null
    neighbors: {
      neighbor: string
      exports: { timestamp: string; timeSweden: string; value: number; unit: string; from: string; to: string }[]
      imports: { timestamp: string; timeSweden: string; value: number; unit: string; from: string; to: string }[]
      latestExport: { timestamp: string; timeSweden: string; value: number; unit: string; from: string; to: string } | null
      latestImport: { timestamp: string; timeSweden: string; value: number; unit: string; from: string; to: string } | null
    }[]
    recentRawRecords: {
      start_time_sweden: string
      from_bidding_zone: string
      to_bidding_zone: string
      power: number
      power_unit: string
    }[]
  }
  reserves?: {
    status: string
    zone: string
    lastUpdated: string | null
    mfrr: {
      status: string
      productName: string
      latest: { latestUp: SvkLatestReserve | null; latestDown: SvkLatestReserve | null }
      records: {
        timeSweden: string
        timestamp: string | null
        direction: string
        volume: number
        volumeUnit: string
        price: number
        priceUnit: string
      }[]
    }
    afrr: {
      status: string
      productName: string
      latest: { latestUp: SvkLatestReserve | null; latestDown: SvkLatestReserve | null }
      records: {
        timeSweden: string
        timestamp: string | null
        direction: string
        volume: number
        volumeUnit: string
        price: number
        priceUnit: string
      }[]
    }
  }
}

type EnergyResponse = {
  mode: string
  market: { country: string; countryLabel: string; zone: string; eic: string; period: string; timezone: string; start: string; end: string }
  sources: {
    entsoe: { status: string; label: string; endpoint: string; lastUpdated: string | null }
    svk?: { status: string; label: string; endpoint: string; siteTitle?: string; ckanVersion?: string | null; lastUpdated: string | null; note?: string }
    smhi: { status: string; label: string; lastUpdated?: string | null }
    svkNotices: { status: string; label: string; url: string; note: string; endpoint?: string }
    smhiForecast: { status: string; label: string; note: string }
    elpris?: { status: string; label: string; endpoint: string; url?: string; lastUpdated: string | null; note?: string }
  }
  datasets: {
    dayAheadPrices: Dataset
    actualGeneration: Dataset
    generationForecast: Dataset
    actualLoad: Dataset
    loadForecast: Dataset
    crossBorderFlows: { neighbor: string; export: Dataset; import: Dataset }[]
  }
  svk?: SvkData | null
  weather: WeatherObservation[]
  gridDisturbances: { status: string; value: null; note: string }
  retrievedAt: string
  elpris?: Record<string, any> | null
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

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    ok: 'Tillgänglig',
    configured: 'Konfigurerad',
    partial: 'Delvis',
    unavailable: 'Ej tillgänglig',
    missing: 'Saknas',
    stale: 'Inaktuell',
    error: 'Fel',
    not_applicable: 'Ej tillämplig',
    not_configured: 'Ej konfigurerad'
  }
  return (
    <span className={`energy-status ${value}`}>
      <i />
      {labels[value] || value}
    </span>
  )
}

function PriceChart({
  title,
  description,
  unit,
  series,
  timezone,
  emptyStatus,
  emptyNote,
  area,
  elprisData
}: {
  title: string
  description: string
  unit: string
  series: { name: string; points: Point[] }[]
  timezone: string
  emptyStatus?: string
  emptyNote?: string | null
  area: string
  period?: string
  elprisData?: Record<string, any> | null
}) {
  const chart = makeChartRows(series)
  
  // Get Elpriset just nu data if available
  const elprisSeries = []
  if (elprisData && elprisData[area]) {
    const elpris = elprisData[area]
    if (elpris && elpris.data && elpris.data.length > 0) {
      const points = elpris.data.map((point: any) => ({
        timestamp: point.timestamp,
        value: point.value
      }))
      elprisSeries.push({ name: 'Elpriset just nu', points })
    }
  }

  // Combine with existing series if available
  const allSeries = [...series, ...elprisSeries]
  
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
            <AreaChart data={chart.rows} margin={{ top: 10, right: 12, bottom: 2, left: 0 }}>
              <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => formatTime(String(value), timezone).replace(/,\s*/, ' ')} 
                minTickGap={26} 
                tick={{ fill: '#899188', fontSize: 9 }} 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis width={48} tick={{ fill: '#899188', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                labelFormatter={(value) => formatTime(String(value), timezone)}
                formatter={(value) => [`${Number(value).toLocaleString('en-GB')} ${unit}`]}
                contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 10 }}
              />
              {allSeries.length > 1 && <Legend wrapperStyle={{ fontSize: 9 }} />}
              {allSeries.map((item, index) => (
                <Area
                  key={item.name}
                  type="monotone"
                  dataKey={item.name}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2}
                  fill={chartColors[index % chartColors.length] + '33'}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
              {allSeries.length > 0 && (
                <ReferenceLine 
                  y={allSeries[0].points.length > 0 ? allSeries[0].points.reduce((sum: number, p: Point) => sum + p.value, 0) / allSeries[0].points.length : 0}
                  stroke="#899188"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label="Avg"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  )
}

// Helper function to calculate statistics
function calculatePriceStats(points: Point[]) {
  if (!points || points.length === 0) return null
  
  const values = points.map(p => p.value).filter(v => v !== undefined && v !== null)
  if (values.length === 0) return null
  
  const sorted = [...values].sort((a, b) => a - b)
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: values.reduce((sum, val) => sum + val, 0) / values.length,
    count: values.length
  }
}

function makeChartRows(series: { name: string; points: Point[] }[]) {
  const rows: Record<string, Record<string, number | string>> = {}
  for (const item of series) {
    for (const point of item.points) {
      const timestamp = point.timestamp
      if (!rows[timestamp]) rows[timestamp] = { timestamp }
      rows[timestamp][item.name] = point.value
    }
  }
  return { rows: Object.values(rows), series }
}

function SourceHealthSection({ sources, timezone }: { sources: EnergyResponse['sources']; timezone: string }) {
  const formatTime = (value: string | null) => {
    if (!value) return 'No update time'
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  }

  return (
    <article className="panel energy-source-health-panel">
      <div className="section-kicker">SOURCE HEALTH</div>
      <h2>Integration status</h2>
      
      <div className="energy-source-health-grid">
        {/* Svenska kraftnät */}
        {sources.svk && (
          <div className="energy-source-health-card">
            <div className="energy-source-health-header">
              <strong>Svenska kraftnät</strong>
              <small>Open data API</small>
            </div>
            <p className="energy-source-health-desc">Svenska kraftnät's open data platform providing real-time energy system information.</p>
            <div className="energy-source-health-meta">
              <div>
                <span>Status</span>
                <strong className="energy-status">{sources.svk.status}</strong>
              </div>
              <div>
                <span>Last update</span>
                <strong>{formatTime(sources.svk.lastUpdated)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Elpriset just nu */}
        {sources.elpris && (
          <div className="energy-source-health-card">
            <div className="energy-source-health-header">
              <strong>Elpriset just nu</strong>
              <small>Open price API</small>
            </div>
            <p className="energy-source-health-desc">Current Swedish spot prices for bidding zones SE1–SE4 (quarter-hour resolution).</p>
            <div className="energy-source-health-meta">
              <div>
                <span>Status</span>
                <strong className="energy-status">{sources.elpris.status}</strong>
              </div>
              <div>
                <span>Last update</span>
                <strong>{formatTime(sources.elpris.lastUpdated)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* ENTSO-E */}
        <div className="energy-source-health-card">
          <div className="energy-source-health-header">
            <strong>ENTSO-E</strong>
            <small>Transparency Platform</small>
          </div>
          <p className="energy-source-health-desc">European electricity market data for cross-border flows and generation.</p>
          <div className="energy-source-health-meta">
            <div>
              <span>Status</span>
              <strong className="energy-status">{sources.entsoe.status}</strong>
            </div>
            <div>
              <span>Last update</span>
              <strong>{formatTime(sources.entsoe.lastUpdated)}</strong>
            </div>
          </div>
        </div>

        {/* SMHI */}
        <div className="energy-source-health-card">
          <div className="energy-source-health-header">
            <strong>SMHI</strong>
            <small>Open Data</small>
          </div>
          <p className="energy-source-health-desc">Swedish Meteorological Institute weather observations.</p>
          <div className="energy-source-health-meta">
            <div>
              <span>Status</span>
              <strong className="energy-status">{sources.smhi.status}</strong>
            </div>
            <div>
              <span>Last update</span>
              <strong>{formatTime(sources.smhi.lastUpdated ?? null)}</strong>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function ForecastChart({
  title,
  description,
  unit,
  series,
  timezone,
  emptyStatus,
  emptyNote
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
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => formatTime(String(value), timezone).replace(/,\s*/, ' ')} 
                minTickGap={26} 
                tick={{ fill: '#899188', fontSize: 9 }} 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis width={48} tick={{ fill: '#899188', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                labelFormatter={(value) => formatTime(String(value), timezone)}
                formatter={(value) => [`${Number(value).toLocaleString('en-GB')} ${unit}`]}
                contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 10 }}
              />
              {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 9 }} />}
              {chart.series.map((item, index) => (
                <Line
                  key={item.name}
                  type="monotone"
                  dataKey={item.name}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  strokeDasharray={item.name.includes('forecast') || item.name.includes('Forecast') ? "5 5" : undefined}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  )
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
  
  // Calculate price statistics if available
  const priceStats = price ? calculatePriceStats(price.points) : null
  
  // Check if Elpriset just nu data is available for the current zone
  const elprisZone = data?.elpris?.[zone]
  const hasElPrisData = !!(elprisZone && elprisZone.data?.length > 0)
  const currentSpot = elprisZone?.current ?? null
  
  // Data for enhanced charts
  const elPrisPriceData = data?.elpris
  
  // Get all Swedish zones for price comparison
  const allZones = ['SE1', 'SE2', 'SE3', 'SE4']
  
  // Prepare per-zone price data: prefer Elpriset just nu (per zone), fall back to ENTSO-E day-ahead
  const priceDataByZone = allZones.map(zoneName => {
    const zonePrices = data?.elpris?.[zoneName]?.data
    return {
      zone: zoneName,
      priceData: zonePrices?.length ? zonePrices : (data?.datasets.dayAheadPrices?.points || []),
      unit: 'EUR/MWh'
    }
  })

  return (
    <section className="energy-dashboard" aria-label="Electricity market and system data">
      <div className="energy-controls">
        <div className="energy-heading">
          <div className="energy-heading-icon"><Zap size={18} /></div>
          <div><div className="section-kicker">ENERGY SYSTEM DATA</div><h2>Market and operations</h2></div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {data?.sources.svk && <Status value={data.sources.svk.status} />}
            <Status value={data?.sources.entsoe.status ?? 'unavailable'} />
          </div>
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
            <article className="energy-metric">
              <span>Current spot price ({zone})</span>
              <strong>{currentSpot ? (currentSpot.sekPerKWh != null ? `${Number(currentSpot.sekPerKWh).toFixed(3)} SEK/kWh` : `${Number(currentSpot.value).toFixed(1)} EUR/MWh`) : 'No data'}</strong>
              <small>{currentSpot ? `≈ ${Number(currentSpot.value).toFixed(1)} EUR/MWh · ${formatTime(currentSpot.timestamp, timezone)}` : 'Elpriset just nu.se'}</small>
            </article>
            <LatestMetric label="Latest measured load" dataset={data.datasets.actualLoad} timezone={timezone} />
            <LatestMetric label="Latest measured generation" dataset={data.datasets.actualGeneration} timezone={timezone} />
            {data.svk?.reserves && (
              <>
                <article className="energy-metric">
                  <span>SVK mFRR Uppreglering ({data.market.zone})</span>
                  <strong>
                    {data.svk.reserves.mfrr.latest.latestUp
                      ? `${data.svk.reserves.mfrr.latest.latestUp.volume} MW @ ${data.svk.reserves.mfrr.latest.latestUp.price} EUR/MW`
                      : 'Ej avropad'}
                  </strong>
                  <small>
                    {data.svk.reserves.mfrr.latest.latestUp?.timeSweden
                      ? `SVK kl ${data.svk.reserves.mfrr.latest.latestUp.timeSweden.slice(11, 16)}`
                      : 'Kapacitetsmarknad'}
                  </small>
                </article>
                <article className="energy-metric">
                  <span>SVK mFRR Nedreglering ({data.market.zone})</span>
                  <strong>
                    {data.svk.reserves.mfrr.latest.latestDown
                      ? `${data.svk.reserves.mfrr.latest.latestDown.volume} MW @ ${data.svk.reserves.mfrr.latest.latestDown.price} EUR/MW`
                      : 'Ej avropad'}
                  </strong>
                  <small>
                    {data.svk.reserves.mfrr.latest.latestDown?.timeSweden
                      ? `SVK kl ${data.svk.reserves.mfrr.latest.latestDown.timeSweden.slice(11, 16)}`
                      : 'Kapacitetsmarknad'}
                  </small>
                </article>
              </>
            )}
            <article className="energy-metric disturbance-metric">
              <span>Verified grid disturbances</span>
              <strong>No feed</strong>
              <small>{data.gridDisturbances.note}</small>
            </article>
          </div>

          {/* Enhanced Price Visualization */}
          <div className="energy-chart-grid">
            <PriceChart 
              title="Day-ahead prices" 
              description="MARKET PRICE · NOT GRID STABILITY" 
              unit={price?.unit ?? 'EUR/MWh'} 
              series={[{ name: 'Day-ahead', points: price?.points ?? [] }]} 
              timezone={timezone} 
              emptyStatus={price?.status} 
              emptyNote={price?.note}
              area={zone}
              period={period}
              elprisData={data.elpris}
            />
            
            <EnergyChart title="Generation by production type" description="ACTUAL AND FORECAST VALUES ARE SEPARATE SERIES" unit={actualGeneration?.unit ?? 'MW'} series={generationSeries} timezone={timezone} emptyStatus={actualGeneration?.status} emptyNote={actualGeneration?.note} />
            <EnergyChart title="Consumption and load" description="MEASURED LOAD VS FORECAST" unit={actualLoad?.unit ?? 'MW'} series={loadSeries} timezone={timezone} emptyStatus={actualLoad?.status} emptyNote={actualLoad?.note} />
            <EnergyChart title="Inter-area imports and exports" description="MEASURED CROSS-BORDER FLOWS" unit={data.datasets.crossBorderFlows[0]?.import.unit ?? 'MW'} series={flowSeries} timezone={timezone} emptyStatus={data.datasets.crossBorderFlows[0]?.import.status} emptyNote={data.datasets.crossBorderFlows[0]?.import.note} />
          </div>

          {/* New Enhanced Charts Section */}
          <div className="energy-charts-section">
            <h3>Price Statistics & Forecast</h3>
            {priceStats && (
              <div className="energy-price-stats">
                <div className="price-stat-card">
                  <TrendingUp size={16} />
                  <div>
                    <span className="stat-label">Lowest Price</span>
                    <strong>{priceStats.min?.toFixed(2)} {price?.unit}</strong>
                  </div>
                </div>
                <div className="price-stat-card">
                  <TrendingDown size={16} />
                  <div>
                    <span className="stat-label">Highest Price</span>
                    <strong>{priceStats.max?.toFixed(2)} {price?.unit}</strong>
                  </div>
                </div>
                <div className="price-stat-card">
                  <Gauge size={16} />
                  <div>
                    <span className="stat-label">Average Price</span>
                    <strong>{priceStats.avg?.toFixed(2)} {price?.unit}</strong>
                  </div>
                </div>
                <div className="price-stat-card">
                  <Activity size={16} />
                  <div>
                    <span className="stat-label">Data Points</span>
                    <strong>{priceStats.count}</strong>
                  </div>
                </div>
              </div>
            )}
            
            {/* Production Mix Chart */}
            {actualGeneration && actualGeneration.points.length > 0 && (
              <div className="energy-production-mix">
                <h3>Production Mix</h3>
                <div className="energy-chart">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={generationCategories.map(cat => ({ name: cat.category || 'Unknown', value: cat.value }))} margin={{ top: 10, right: 12, bottom: 2, left: 0 }}>
                      <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#899188', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis width={48} tick={{ fill: '#899188', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(value) => [`${Number(value).toLocaleString('en-GB')} ${actualGeneration.unit}`]}
                        contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 10 }}
                      />
                      <Bar dataKey="value" fill="#387c65" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            {/* Elpriset just nu – spot price for selected zone */}
            {hasElPrisData && (
              <div className="energy-production-mix">
                <h3>Elpriset just nu – spotpris ({zone})</h3>
                <div className="energy-chart">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart 
                      data={(elprisZone?.data || []).map((point: any) => ({
                        timestamp: point.timestamp,
                        value: point.value
                      }))} 
                      margin={{ top: 10, right: 12, bottom: 2, left: 0 }}
                    >
                      <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => formatTime(String(value), timezone).replace(/,\s*/, ' ')} 
                        minTickGap={26} 
                        tick={{ fill: '#899188', fontSize: 9 }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <YAxis width={48} tick={{ fill: '#899188', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        labelFormatter={(value) => formatTime(String(value), timezone)}
                        formatter={(value) => [`${Number(value).toLocaleString('en-GB')} ${price?.unit}`]}
                        contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 10 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#c8893d" 
                        strokeWidth={2} 
                        dot={false} 
                        connectNulls={false} 
                        isAnimationActive={false} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <small style={{ fontSize: '9px', color: '#889189' }}>{elprisZone?.note}</small>
              </div>
            )}
          </div>

          <div className="energy-detail-grid">
            {data.svk && (
              <article className="panel energy-svk-panel">
                <div className="energy-svk-header">
                  <div className="energy-svk-title">
                    <div className="section-kicker">SVENSKA KRAFTNÄT · ÖPPNA DATA</div>
                    <h2>
                      <Zap size={16} /> Frekvens- & kapacitetsmarknad ({data.market.zone})
                    </h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="energy-svk-endpoint-pill">
                      https://data.svk.se/sv/api/3/action/
                    </span>
                    <Status value={data.svk.status} />
                  </div>
                </div>

                <div className="energy-svk-grid">
                  {/* mFRR Card */}
                  <div className="energy-svk-card">
                    <div className="energy-svk-card-title">
                      <span>mFRR Kapacitetsmarknad</span>
                      <small style={{ fontSize: '9px', color: '#6e7770' }}>{data.market.zone}</small>
                    </div>
                    <span className="energy-svk-card-sub">Manuell frekvensåterställningsreserv (SVK CKAN)</span>
                    <div className="energy-svk-stat-row">
                      <span className="energy-svk-badge-up">Uppreglering</span>
                      <span className="energy-svk-stat-val">
                        {data.svk.reserves?.mfrr?.latest.latestUp
                          ? `${data.svk.reserves.mfrr.latest.latestUp.volume} MW @ ${data.svk.reserves.mfrr.latest.latestUp.price} EUR/MW`
                          : 'Ingen avropad'}
                      </span>
                    </div>
                    <div className="energy-svk-stat-row">
                      <span className="energy-svk-badge-down">Nedreglering</span>
                      <span className="energy-svk-stat-val">
                        {data.svk.reserves?.mfrr?.latest.latestDown
                          ? `${data.svk.reserves.mfrr.latest.latestDown.volume} MW @ ${data.svk.reserves.mfrr.latest.latestDown.price} EUR/MW`
                          : 'Ingen avropad'}
                      </span>
                    </div>
                    <small style={{ fontSize: '8px', color: '#889189', marginTop: '4px' }}>
                      Starttid svensk tid: {data.svk.reserves?.mfrr?.latest.latestUp?.timeSweden || data.svk.reserves?.mfrr?.latest.latestDown?.timeSweden || 'Senaste auktion'}
                    </small>
                  </div>

                  {/* aFRR Card */}
                  <div className="energy-svk-card">
                    <div className="energy-svk-card-title">
                      <span>aFRR Kapacitetsmarknad</span>
                      <small style={{ fontSize: '9px', color: '#6e7770' }}>{data.market.zone}</small>
                    </div>
                    <span className="energy-svk-card-sub">Automatisk frekvensåterställningsreserv (SVK CKAN)</span>
                    <div className="energy-svk-stat-row">
                      <span className="energy-svk-badge-up">Uppreglering</span>
                      <span className="energy-svk-stat-val">
                        {data.svk.reserves?.afrr?.latest.latestUp
                          ? `${data.svk.reserves.afrr.latest.latestUp.volume} MW @ ${data.svk.reserves.afrr.latest.latestUp.price} EUR/MW`
                          : 'Ej avropad denna timme'}
                      </span>
                    </div>
                    <div className="energy-svk-stat-row">
                      <span className="energy-svk-badge-down">Nedreglering</span>
                      <span className="energy-svk-stat-val">
                        {data.svk.reserves?.afrr?.latest.latestDown
                          ? `${data.svk.reserves.afrr.latest.latestDown.volume} MW @ ${data.svk.reserves.afrr.latest.latestDown.price} EUR/MW`
                          : 'Ej avropad denna timme'}
                      </span>
                    </div>
                    <small style={{ fontSize: '8px', color: '#889189', marginTop: '4px' }}>
                      Starttid svensk tid: {data.svk.reserves?.afrr?.latest.latestUp?.timeSweden || data.svk.reserves?.afrr?.latest.latestDown?.timeSweden || 'Senaste auktion'}
                    </small>
                  </div>

                  {/* Physical Flows Card */}
                  <div className="energy-svk-card">
                    <div className="energy-svk-card-title">
                      <span>Överföringsflöden i stamnätet</span>
                      <small style={{ fontSize: '9px', color: '#6e7770' }}>15-min mätning</small>
                    </div>
                    <span className="energy-svk-card-sub">Dataset: net_cross_border_physical_flows</span>
                    {data.svk.flows?.recentRawRecords && data.svk.flows.recentRawRecords.length > 0 ? (
                      <div style={{ display: 'grid', gap: '3px', marginTop: '2px' }}>
                        {data.svk.flows.recentRawRecords.slice(0, 4).map((r, i) => (
                          <div key={i} className="energy-svk-stat-row">
                            <span><b>{r.from_bidding_zone}</b> → <b>{r.to_bidding_zone}</b></span>
                            <span className="energy-svk-stat-val">{r.power} {r.power_unit}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '9px', color: '#889189' }}>Inga flöden registrerade</span>
                    )}
                    <small style={{ fontSize: '8px', color: '#889189', marginTop: '4px' }}>
                      Senaste mätning: {data.svk.flows?.recentRawRecords[0]?.start_time_sweden || 'Realtid'}
                    </small>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid #e5ebe7', paddingTop: '8px', fontSize: '9px', color: '#6d7770' }}>
                  <span>Kopplad till Svenska kraftnäts CKAN API: datastore_search & status_show</span>
                  <a className="source-link" style={{ marginTop: 0 }} href="https://data.svk.se" target="_blank" rel="noreferrer">
                    Öppna data.svk.se portal <ArrowUpRight size={13} />
                  </a>
                </div>
              </article>
            )}

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
              <small className="energy-flow-note">Flöden från Svenska kraftnät CKAN datastore (MW) eller ENTSO-E.</small>
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
              {data.sources.svk && (
                <>
                  <div className="energy-source-row">
                    <span>{data.sources.svk.label}</span>
                    <Status value={data.sources.svk.status} />
                  </div>
                  <div className="energy-source-row">
                    <span>SVK API-endpoint</span>
                    <strong style={{ fontFamily: 'monospace', fontSize: '8px' }}>https://data.svk.se/sv/api/3/action/</strong>
                  </div>
                  {data.sources.svk.ckanVersion && (
                    <div className="energy-source-row">
                      <span>CKAN Version</span>
                      <strong>{data.sources.svk.ckanVersion}</strong>
                    </div>
                  )}
                  <div className="energy-source-row">
                    <span>Senaste SVK-mätning</span>
                    <strong>{formatTime(data.sources.svk.lastUpdated)}</strong>
                  </div>
                </>
              )}
              <div className="energy-source-row"><span>{data.sources.entsoe.label}</span><Status value={data.sources.entsoe.status} /></div>
              <div className="energy-source-row"><span>{data.sources.smhi.label}</span><Status value={data.sources.smhi.status} /></div>
              {data.sources.elpris && (
                <div className="energy-source-row"><span>{data.sources.elpris.label}</span><Status value={data.sources.elpris.status} /></div>
              )}
              <div className="energy-source-row"><span>Latest ENTSO-E data</span><strong>{formatTime(data.sources.entsoe.lastUpdated)}</strong></div>
              <div className="energy-source-row"><span>Retrieved from backend</span><strong>{formatTime(data.retrievedAt)}</strong></div>
              <a className="source-link" href="https://data.svk.se" target="_blank" rel="noreferrer">Svenska kraftnät Dataportal (data.svk.se) <ArrowUpRight size={14} /></a>
              <a className="source-link" href="https://transparency.entsoe.eu/" target="_blank" rel="noreferrer">ENTSO-E Transparency Platform <ArrowUpRight size={14} /></a>
              {data.sources.elpris && (
                <a className="source-link" href={data.sources.elpris.url ?? data.sources.elpris.endpoint} target="_blank" rel="noreferrer">Elpriset just nu.se API <ArrowUpRight size={14} /></a>
              )}
            </article>
          </div>

          {/* Enhanced Visualization Sections */}
          
          {/* Electricity Prices Section */}
          <div className="energy-charts-section">
            <h3>Electricity Prices</h3>
            <div className="energy-chart-grid">
              <PriceComparisonChart 
                title="Day-ahead prices by area" 
                description="MARKET PRICE · NOT GRID STABILITY" 
                unit={price?.unit ?? 'EUR/MWh'} 
                series={priceDataByZone.map(zoneData => ({ name: zoneData.zone, points: zoneData.priceData }))} 
                timezone={timezone} 
                emptyStatus={price?.status} 
                emptyNote={price?.note}
                area={zone}
                period={period}
                elprisData={elPrisPriceData}
              />
              
              {priceStats && (
                <div className="energy-price-stats">
                  <div className="price-stat-card">
                    <TrendingUp size={16} />
                    <div>
                      <span className="stat-label">Lowest Price</span>
                      <strong>{priceStats.min?.toFixed(2)} {price?.unit}</strong>
                    </div>
                  </div>
                  <div className="price-stat-card">
                    <TrendingDown size={16} />
                    <div>
                      <span className="stat-label">Highest Price</span>
                      <strong>{priceStats.max?.toFixed(2)} {price?.unit}</strong>
                    </div>
                  </div>
                  <div className="price-stat-card">
                    <Gauge size={16} />
                    <div>
                      <span className="stat-label">Average Price</span>
                      <strong>{priceStats.avg?.toFixed(2)} {price?.unit}</strong>
                    </div>
                  </div>
                  <div className="price-stat-card">
                    <Activity size={16} />
                    <div>
                      <span className="stat-label">Data Points</span>
                      <strong>{priceStats.count}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Electricity Production and Consumption Section */}
          <div className="energy-charts-section">
            <h3>Production and Consumption</h3>
            <div className="energy-chart-grid">
              <EnergyChart 
                title="Generation by production type" 
                description="ACTUAL AND FORECAST VALUES ARE SEPARATE SERIES" 
                unit={actualGeneration?.unit ?? 'MW'} 
                series={generationSeries} 
                timezone={timezone} 
                emptyStatus={actualGeneration?.status} 
                emptyNote={actualGeneration?.note} 
              />
              <EnergyChart 
                title="Consumption and load" 
                description="MEASURED LOAD VS FORECAST" 
                unit={actualLoad?.unit ?? 'MW'} 
                series={loadSeries} 
                timezone={timezone} 
                emptyStatus={actualLoad?.status} 
                emptyNote={actualLoad?.note} 
              />
            </div>
          </div>

          {/* Forecasts Section */}
          <div className="energy-charts-section">
            <h3>Forecasts</h3>
            <div className="energy-chart-grid">
              <ForecastChart 
                title="Generation forecast" 
                description="PREDICTED FUTURE VALUES" 
                unit={data?.datasets.generationForecast.unit ?? 'MW'} 
                series={[
                  { name: 'Generation forecast', points: data?.datasets.generationForecast.points || [] }
                ]} 
                timezone={timezone} 
                emptyStatus={data?.datasets.generationForecast.status} 
                emptyNote={data?.datasets.generationForecast.note} 
              />
              <ForecastChart 
                title="Load forecast" 
                description="PREDICTED FUTURE VALUES" 
                unit={data?.datasets.loadForecast.unit ?? 'MW'} 
                series={[
                  { name: 'Load forecast', points: data?.datasets.loadForecast.points || [] }
                ]} 
                timezone={timezone} 
                emptyStatus={data?.datasets.loadForecast.status} 
                emptyNote={data?.datasets.loadForecast.note} 
              />
            </div>
          </div>

          {/* Transmission Capacity and Flows Section */}
          <div className="energy-charts-section">
            <h3>Transmission Capacity and Flows</h3>
            <div className="energy-chart-grid">
              <TransmissionCapacityChart 
                title="Cross-border flows" 
                description="MEASURED FLOWS BETWEEN AREAS" 
                unit={data?.datasets.crossBorderFlows[0]?.import.unit ?? 'MW'} 
                series={flowSeries} 
                timezone={timezone} 
                emptyStatus={data?.datasets.crossBorderFlows[0]?.import.status} 
                emptyNote={data?.datasets.crossBorderFlows[0]?.import.note} 
              />
            </div>
          </div>

          {/* Source Health Section */}
          <div className="energy-charts-section">
            <SourceHealthSection sources={data?.sources} timezone={timezone} />
          </div>
        </>
      )}
    </section>
  )
}

// New components for enhanced visualizations

function TransmissionCapacityChart({
  title,
  description,
  unit,
  series,
  timezone,
  emptyStatus,
  emptyNote
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
            <BarChart data={chart.rows} margin={{ top: 10, right: 12, bottom: 2, left: 0 }}>
              <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => formatTime(String(value), timezone).replace(/,\s*/, ' ')} 
                minTickGap={26} 
                tick={{ fill: '#899188', fontSize: 9 }} 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis width={48} tick={{ fill: '#899188', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                labelFormatter={(value) => formatTime(String(value), timezone)}
                formatter={(value) => [`${Number(value).toLocaleString('en-GB')} ${unit}`]}
                contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 10 }}
              />
              {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 9 }} />}
              {chart.series.map((item, index) => (
                <Bar
                  key={item.name}
                  dataKey={item.name}
                  fill={chartColors[index % chartColors.length]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  )
}

function PriceComparisonChart({
  title,
  description,
  unit,
  series,
  timezone,
  emptyStatus,
  emptyNote,
  area,
  elprisData
}: {
  title: string
  description: string
  unit: string
  series: { name: string; points: Point[] }[]
  timezone: string
  emptyStatus?: string
  emptyNote?: string | null
  area: string
  period?: string
  elprisData?: Record<string, any> | null
}) {
  const chart = makeChartRows(series)
  
  // Get Elpriset just nu data if available
  const elprisSeries = []
  if (elprisData && elprisData[area]) {
    const elpris = elprisData[area]
    if (elpris && elpris.data && elpris.data.length > 0) {
      const points = elpris.data.map((point: any) => ({
        timestamp: point.timestamp,
        value: point.value
      }))
      elprisSeries.push({ name: 'Elpriset just nu', points })
    }
  }

  // Combine with existing series if available
  const allSeries = [...series, ...elprisSeries]
  
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
            <AreaChart data={chart.rows} margin={{ top: 10, right: 12, bottom: 2, left: 0 }}>
              <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => formatTime(String(value), timezone).replace(/,\s*/, ' ')} 
                minTickGap={26} 
                tick={{ fill: '#899188', fontSize: 9 }} 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis width={48} tick={{ fill: '#899188', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                labelFormatter={(value) => formatTime(String(value), timezone)}
                formatter={(value) => [`${Number(value).toLocaleString('en-GB')} ${unit}`]}
                contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 10 }}
              />
              {allSeries.length > 1 && <Legend wrapperStyle={{ fontSize: 9 }} />}
              {allSeries.map((item, index) => (
                <Area
                  key={item.name}
                  type="monotone"
                  dataKey={item.name}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2}
                  fill={chartColors[index % chartColors.length] + '33'}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  )
}

export default EnergyDashboard