import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowUpRight, Info, RadioTower } from 'lucide-react'
import type { PtsCountyCoverage, TelecomDashboardResponse, TelecomSource } from './services/telecomTypes'

const stateLabels: Record<string, string> = {
  ok: 'Available',
  partial: 'Partial',
  stale: 'Stale',
  unavailable: 'Unavailable',
  error: 'Error',
  not_applicable: 'Not applicable',
}

function formatDate(value: string | null) {
  if (!value) return 'No source timestamp'
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number)
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function SourceBadge({ state }: { state: string }) {
  return <span className={`telecom-source-status ${state}`}><i />{stateLabels[state] ?? state}</span>
}

function SourceRow({ source }: { source: TelecomSource<unknown> }) {
  return (
    <div className="telecom-source-row">
      <div>
        <strong>{source.provenance.source}</strong>
        <small>{source.provenance.resolution}</small>
      </div>
      <div className="telecom-source-row-meta">
        <SourceBadge state={source.state} />
        <small>{formatDate(source.provenance.observedAt ?? source.provenance.referencePeriod ?? source.provenance.retrievedAt)}</small>
      </div>
    </div>
  )
}

function CoverageChart({ counties }: { counties: PtsCountyCoverage[] }) {
  const data = counties.map((county) => ({
    name: county.name.replace(/ län$/, ''),
    code: county.code,
    fiveG: county.mobile5g8Db.value,
    broadband100: county.mobile100Mbps8Db.value,
  }))

  if (!data.length) return <div className="telecom-empty">No regional PTS statistics are available.</div>

  return (
    <div className="telecom-coverage-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 14, bottom: 2, left: 0 }} barCategoryGap={5}>
          <CartesianGrid stroke="#edf0eb" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#899188', fontSize: 8 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={125} tick={{ fill: '#5c665e', fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value) => value === null ? 'No data' : `${Number(value).toFixed(2)}%`} labelFormatter={(label) => `${label} county`} contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 9 }} />
          <Bar dataKey="fiveG" name="5G coverage (8 dB)" fill="#387c65" radius={[0, 3, 3, 0]} maxBarSize={8} />
          <Bar dataKey="broadband100" name="Mobile >=100 Mbit/s (8 dB)" fill="#c8893d" radius={[0, 3, 3, 0]} maxBarSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TelecomDashboard({ region }: { region: string }) {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d')
  const [data, setData] = useState<TelecomDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ region, period })
    fetch(`/api/v1/telecom?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Telecom API returned ${response.status}`)
        return response.json() as Promise<TelecomDashboardResponse>
      })
      .then((response) => setData(response))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load telecom data.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [region, period])

  const routeHistory = data?.routing.data.history ?? []
  const iodaHistory = data?.internetIncidents.data.signal ?? []
  const routeLatest = data?.routing.data.latest ?? null

  return (
    <section className="telecom-dashboard" aria-label="Telecom coverage and public internet indicators">
      <div className="telecom-header-panel">
        <div className="telecom-heading">
          <span className="telecom-heading-icon"><RadioTower size={18} /></span>
          <div><div className="section-kicker">TELECOM AND INTERNET INDICATORS</div><h2>Coverage and routing signals</h2></div>
          <label className="telecom-period">Routing and outage period
            <select value={period} onChange={(event) => setPeriod(event.target.value as '24h' | '7d' | '30d')}>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
        </div>
        <p>PTS coverage is an annual estimate; RIPEstat and IODA describe country-level internet observations, not mobile operator availability.</p>
      </div>

      {error && <div className="data-error" role="alert">Telecom data is unavailable: {error}</div>}
      {loading && <p className="data-message" role="status">Loading PTS, RIPEstat, and IODA sources…</p>}

      {!loading && data && (
        <>
          <div className="telecom-caveat" role="note"><Info size={15} /><span><strong>Operator-specific availability is not available.</strong> This dashboard cannot identify an offline mobile tower, operator outage, or failed geographic area from the connected sources.</span></div>

          <div className="telecom-metric-grid">
            <article className="telecom-metric">
              <span>PTS counties in this snapshot</span>
              <strong>{data.coverage.data.length || 'No data'}</strong>
              <small>Annual reference: November 2025</small>
            </article>
            <article className="telecom-metric">
              <span>RIPE RIS IPv4 prefixes</span>
              <strong>{routeLatest?.ipv4Prefixes?.toLocaleString('en-GB') ?? 'No data'}</strong>
              <small>Observed {formatDate(routeLatest?.date ?? null)}</small>
            </article>
            <article className="telecom-metric">
              <span>RIPE RIS IPv6 prefixes</span>
              <strong>{routeLatest?.ipv6Prefixes?.toLocaleString('en-GB') ?? 'No data'}</strong>
              <small>Observed {formatDate(routeLatest?.date ?? null)}</small>
            </article>
            <article className="telecom-metric">
              <span>Routed ASNs in RIPE RIS</span>
              <strong>{data.routing.data.routedAsns?.toLocaleString('en-GB') ?? 'No data'}</strong>
              <small>Registered: {data.routing.data.registeredAsns?.toLocaleString('en-GB') ?? 'No data'}</small>
            </article>
          </div>

          <div className="telecom-visual-grid">
            <article className="panel telecom-coverage-panel">
              <div className="panel-heading">
                <div><div className="section-kicker">OFFICIAL PTS STATISTICS · NOVEMBER 2025</div><h2>Mobile coverage by county</h2></div>
                <SourceBadge state={data.coverage.state} />
              </div>
              <div className="telecom-chart-legend"><span><i className="fiveg-swatch" />5G service coverage, 8 dB</span><span><i className="fast-mobile-swatch" />Mobile &gt;=100 Mbit/s, 8 dB</span></div>
              <CoverageChart counties={data.coverage.data} />
              <p className="telecom-panel-note">County aggregates from PTS workbook. These are annual coverage estimates, not real-time measurements. 8 dB is PTS's stated signal attenuation threshold; values are not tower states.</p>
              {data.coverage.note && <small className="telecom-source-note">{data.coverage.note}</small>}
              <a className="source-link" href="https://statistik.pts.se/mobiltacknings-och-bredbandskartlaggning/dokument-rapporter" target="_blank" rel="noreferrer">PTS source workbook and method <ArrowUpRight size={14} /></a>
            </article>

            <article className="panel telecom-routing-panel">
              <div className="panel-heading">
                <div><div className="section-kicker">PUBLIC BGP OBSERVATIONS · {period.toUpperCase()}</div><h2>RIPE RIS routing history</h2></div>
                <SourceBadge state={data.routing.state} />
              </div>
              {routeHistory.length ? (
                <div className="telecom-route-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={routeHistory} margin={{ top: 10, right: 10, bottom: 2, left: 0 }}>
                      <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5, 10)} minTickGap={24} tick={{ fill: '#899188', fontSize: 8 }} axisLine={false} tickLine={false} />
                      <YAxis width={44} tick={{ fill: '#899188', fontSize: 8 }} axisLine={false} tickLine={false} />
                      <Tooltip labelFormatter={(value) => formatDate(String(value))} contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 9 }} />
                      <Line type="monotone" dataKey="ipv4Prefixes" name="IPv4 prefixes" stroke="#387c65" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="ipv6Prefixes" name="IPv6 prefixes" stroke="#c8893d" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="telecom-empty">{data.routing.note ?? 'No RIPEstat routing points are available for this period.'}</div>}
              <p className="telecom-panel-note">BGP routes seen by RIPE RIS collectors; daily history and periodic collector snapshots. Routing visibility is not a direct test of mobile access or user experience.</p>
              <a className="source-link" href="https://stat.ripe.net/docs/data-api/ripestat-data-api" target="_blank" rel="noreferrer">RIPEstat Data API documentation <ArrowUpRight size={14} /></a>
            </article>
          </div>

          <div className="telecom-detail-grid">
            <article className="panel telecom-ioda-panel">
              <div className="panel-heading">
                <div><div className="section-kicker">COUNTRY-LEVEL INTERNET SIGNAL · {period.toUpperCase()}</div><h2>IODA outage indicator</h2></div>
                <SourceBadge state={data.internetIncidents.state} />
              </div>
              {iodaHistory.length ? (
                <div className="telecom-ioda-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={iodaHistory} margin={{ top: 10, right: 10, bottom: 2, left: 0 }}>
                      <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={(value) => formatDate(String(value)).slice(0, 6)} minTickGap={28} tick={{ fill: '#899188', fontSize: 8 }} axisLine={false} tickLine={false} />
                      <YAxis width={40} tick={{ fill: '#899188', fontSize: 8 }} axisLine={false} tickLine={false} />
                      <Tooltip labelFormatter={(value) => formatDate(String(value))} contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 9 }} />
                      <Line type="stepAfter" dataKey="value" name="IODA indicator" stroke="#6483a2" strokeWidth={1.7} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="telecom-empty">No IODA time-series values were returned for this period.</div>}
              <p className="telecom-panel-note">IODA signals are indicators of internet disruption at country level. They are not a complete outage feed and do not establish mobile operator or tower status.</p>
              {data.internetIncidents.data.events.length ? (
                <div className="telecom-event-list">
                  {data.internetIncidents.data.events.map((event) => <div key={event.id}><strong>{event.summary}</strong><span>{event.entityName} · {event.datasource ?? 'IODA'} · {formatDate(event.startedAt)}</span></div>)}
                </div>
              ) : <div className="telecom-empty compact">{data.internetIncidents.note}</div>}
              <a className="source-link" href="https://api.ioda.inetintel.cc.gatech.edu/v2/docs" target="_blank" rel="noreferrer">IODA API documentation <ArrowUpRight size={14} /></a>
            </article>

            <article className="panel telecom-quality-panel">
              <div className="section-kicker">SOURCE QUALITY AND COVERAGE</div>
              <h2>Provenance and freshness</h2>
              <SourceRow source={data.coverage} />
              <SourceRow source={data.routing} />
              <SourceRow source={data.internetIncidents} />
              <div className="telecom-unavailable">
                <strong>Operator-specific status: unavailable</strong>
                <span>{data.operatorStatus.note}</span>
              </div>
              <div className="telecom-unavailable">
                <strong>Public operator notices: unavailable</strong>
                <span>{data.notices.note}</span>
              </div>
              <p className="telecom-panel-note">Retrieved by backend: {formatDate(data.retrievedAt)}. Retrieval time is distinct from observation and publication time.</p>
            </article>
          </div>
        </>
      )}
    </section>
  )
}

export default TelecomDashboard