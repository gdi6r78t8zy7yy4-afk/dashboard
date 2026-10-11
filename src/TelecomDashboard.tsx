import { useEffect, useMemo, useState } from 'react'
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
import {
  ArrowUpRight,
  Info,
  RadioTower,
  ShieldCheck,
} from 'lucide-react'
import type {
  TelecomDashboardResponse,
  TelecomSource,
} from './services/telecomTypes'

const stateLabels: Record<string, string> = {
  ok: 'Fungerande',
  partial: 'Delvis data',
  stale: 'Föråldrad',
  unavailable: 'Ej tillgänglig',
  error: 'Fel',
  not_applicable: 'Ej tillämplig',
}

function formatDate(value: string | null) {
  if (!value) return 'Ingen tidsstämpel'
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number)
    return new Intl.DateTimeFormat('sv-SE', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1)))
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function SourceBadge({ state }: { state: string }) {
  return (
    <span className={`telecom-source-status ${state}`}>
      <i />
      {stateLabels[state] ?? state}
    </span>
  )
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
        <small>
          {formatDate(
            source.provenance.observedAt ??
              source.provenance.referencePeriod ??
              source.provenance.retrievedAt,
          )}
        </small>
      </div>
    </div>
  )
}

type SortField = 'name' | 'fiveG' | 'broadband100' | 'broadband10'

function TelecomDashboard({ region }: { region: string }) {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d')
  const [data, setData] = useState<TelecomDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // County interactive states
  const [countySearch, setCountySearch] = useState('')
  const [ptsViewMode, setPtsViewMode] = useState<'chart' | 'table'>('chart')
  const [sortField, setSortField] = useState<SortField>('fiveG')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedCountyCode, setSelectedCountyCode] = useState<string | null>(null)
  const [show10Mbps, setShow10Mbps] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ region, period })
    fetch(`/api/v1/telecom?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Telekom-API returnerade HTTP ${response.status}`)
        return response.json() as Promise<TelecomDashboardResponse>
      })
      .then((res) => setData(res))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Kunde inte ladda telekomdata.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [region, period])

  const counties = useMemo(() => data?.coverage.data ?? [], [data?.coverage.data])

  // Calculated PTS regional statistics
  const ptsStats = useMemo(() => {
    if (!counties.length) return null
    const valid5G = counties.map((c) => c.mobile5g8Db.value).filter((v): v is number => v !== null)
    const valid100 = counties
      .map((c) => c.mobile100Mbps8Db.value)
      .filter((v): v is number => v !== null)
    const valid10 = counties
      .map((c) => c.mobile10Mbps8Db.value)
      .filter((v): v is number => v !== null)

    const avg5G = valid5G.length ? valid5G.reduce((a, b) => a + b, 0) / valid5G.length : null
    const avg100 = valid100.length ? valid100.reduce((a, b) => a + b, 0) / valid100.length : null
    const avg10 = valid10.length ? valid10.reduce((a, b) => a + b, 0) / valid10.length : null

    // Best and lowest county for 5G
    const sortedBy5G = [...counties].sort(
      (a, b) => (b.mobile5g8Db.value ?? 0) - (a.mobile5g8Db.value ?? 0),
    )
    const topCounty = sortedBy5G[0]
    const lowestCounty = sortedBy5G[sortedBy5G.length - 1]

    return {
      avg5G,
      avg100,
      avg10,
      topCounty,
      lowestCounty,
      countyCount: counties.length,
    }
  }, [counties])

  // Filtered and sorted counties for chart and table
  const filteredCounties = useMemo(() => {
    let list = [...counties]
    if (countySearch.trim()) {
      const q = countySearch.toLowerCase().trim()
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
      )
    }

    list.sort((a, b) => {
      let diff = 0
      if (sortField === 'name') {
        diff = a.name.localeCompare(b.name, 'sv')
      } else if (sortField === 'fiveG') {
        diff = (a.mobile5g8Db.value ?? 0) - (b.mobile5g8Db.value ?? 0)
      } else if (sortField === 'broadband100') {
        diff = (a.mobile100Mbps8Db.value ?? 0) - (b.mobile100Mbps8Db.value ?? 0)
      } else if (sortField === 'broadband10') {
        diff = (a.mobile10Mbps8Db.value ?? 0) - (b.mobile10Mbps8Db.value ?? 0)
      }
      return sortAsc ? diff : -diff
    })

    return list
  }, [counties, countySearch, sortField, sortAsc])

  const chartData = useMemo(() => {
    return filteredCounties.map((c) => ({
      name: c.name.replace(/ län$/, ''),
      code: c.code,
      fiveG: c.mobile5g8Db.value,
      broadband100: c.mobile100Mbps8Db.value,
      broadband10: c.mobile10Mbps8Db.value,
    }))
  }, [filteredCounties])

  const selectedCounty = useMemo(() => {
    if (!selectedCountyCode) return null
    return counties.find((c) => c.code === selectedCountyCode) ?? null
  }, [counties, selectedCountyCode])

  const routeHistory = data?.routing.data.history ?? []
  const iodaHistory = data?.internetIncidents.data.signal ?? []
  const routeLatest = data?.routing.data.latest ?? null
  const iodaEvents = data?.internetIncidents.data.events ?? []

  return (
    <section
      className="telecom-dashboard"
      aria-label="Telekomtäckning, routing och publika internetindikatorer"
    >
      {/* Top Header Panel */}
      <div className="telecom-header-panel">
        <div className="telecom-heading">
          <span className="telecom-heading-icon">
            <RadioTower size={18} />
          </span>
          <div>
            <div className="section-kicker">TELEKOM &amp; DIGITAL INFRASTRUKTUR</div>
            <h2>Täckningsstatistik, BGP-routing och driftindikatorer</h2>
          </div>
          <label className="telecom-period">
            Tidsintervall (BGP &amp; IODA)
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as '24h' | '7d' | '30d')}
            >
              <option value="24h">Senaste 24 timmarna</option>
              <option value="7d">Senaste 7 dagarna</option>
              <option value="30d">Senaste 30 dagarna</option>
            </select>
          </label>
        </div>
        <p>
          Officiell täckningsdata baseras på PTS årliga kartläggning (november 2025). RIPE RIS och
          IODA visar internetrouting och makrostörningar på nationell nivå, inte mobiloperatörers
          enskilda driftstatus.
        </p>
      </div>

      {error && (
        <div className="data-error" role="alert">
          Telekomdata kunde inte hämtas: {error}
        </div>
      )}
      {loading && (
        <p className="data-message" role="status">
          Hämtar data från PTS, RIPEstat och IODA…
        </p>
      )}

      {!loading && data && (
        <>
          {/* Explicit Boundary / Limitation Caveat */}
          <div className="telecom-caveat" role="note">
            <Info size={16} />
            <span>
              <strong>Operatörsspecifik realtidsinformation är ej tillgänglig.</strong> Inga öppna
              API:er publiceras av mobiloperatörerna (Telia, Telenor, Tele2, Tre) för basstationsstatus
              eller driftstörningar. Varken PTS, RIPEstat eller IODA tillåter slutsatsen att en
              mobilmast eller ett visst län är ur funktion. Inga geografiska områden eller master
              markeras därför som defekta.
            </span>
          </div>

          {/* Key Metric Highlights */}
          <div className="telecom-metric-grid">
            <article className="telecom-metric">
              <span>PTS 5G-täckning (Rikssnitt, 8 dB)</span>
              <strong>
                {ptsStats?.avg5G !== null && ptsStats?.avg5G !== undefined
                  ? `${ptsStats.avg5G.toFixed(1)}%`
                  : data.coverage.state === 'not_applicable'
                    ? 'Ej tillämplig'
                    : 'Ingen data'}
              </strong>
              <small>
                {ptsStats
                  ? `${ptsStats.countyCount} län i kartläggningen (nov 2025)`
                  : 'PTS avser enbart Sverige'}
              </small>
            </article>

            <article className="telecom-metric">
              <span>Mobil ≥100 Mbit/s (Rikssnitt, 8 dB)</span>
              <strong>
                {ptsStats?.avg100 !== null && ptsStats?.avg100 !== undefined
                  ? `${ptsStats.avg100.toFixed(1)}%`
                  : data.coverage.state === 'not_applicable'
                    ? 'Ej tillämplig'
                    : 'Ingen data'}
              </strong>
              <small>
                {ptsStats?.avg10 !== null && ptsStats?.avg10 !== undefined
                  ? `Basband ≥10 Mbit/s: ${ptsStats.avg10.toFixed(1)}%`
                  : 'Officiell PTS-statistik'}
              </small>
            </article>

            <article className="telecom-metric">
              <span>RIPE RIS IPv4 / IPv6-prefix</span>
              <strong>
                {routeLatest?.ipv4Prefixes
                  ? `${routeLatest.ipv4Prefixes.toLocaleString('sv-SE')} / ${(routeLatest.ipv6Prefixes ?? 0).toLocaleString('sv-SE')}`
                  : 'Ingen data'}
              </strong>
              <small>Observerad {formatDate(routeLatest?.date ?? null)}</small>
            </article>

            <article className="telecom-metric">
              <span>Routade AS-nummer i RIPE RIS</span>
              <strong>
                {data.routing.data.routedAsns
                  ? data.routing.data.routedAsns.toLocaleString('sv-SE')
                  : 'Ingen data'}
              </strong>
              <small>
                {data.routing.data.registeredAsns
                  ? `Av ${data.routing.data.registeredAsns.toLocaleString('sv-SE')} registrerade AS`
                  : 'BGP autonoma system'}
              </small>
            </article>
          </div>

          {/* Main Visual Panels: PTS Coverage & RIPE Routing */}
          <div className="telecom-visual-grid">
            {/* Panel 1: PTS Mobile & Broadband Coverage */}
            <article className="panel telecom-coverage-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">OFFICIELL PTS-KARTLÄGGNING · NOVEMBER 2025</div>
                  <h2>Mobil- och bredbandstäckning per län</h2>
                </div>
                <SourceBadge state={data.coverage.state} />
              </div>

              {data.coverage.state === 'not_applicable' ? (
                <div className="telecom-empty">
                  {data.coverage.note ??
                    'PTS-kartläggningen omfattar enbart Sveriges 21 län. Välj Sverige som bevakningsområde för regional täckningsdata.'}
                </div>
              ) : (
                <>
                  {/* Summary Variance Banner */}
                  {ptsStats && (
                    <div className="telecom-stats-banner">
                      <div className="telecom-stat-item">
                        <span>Högsta 5G-täckning</span>
                        <strong>
                          {ptsStats.topCounty?.name.replace(/ län$/, '')}:{' '}
                          {ptsStats.topCounty?.mobile5g8Db.value?.toFixed(1)}%
                        </strong>
                        <small>Högst andel yttäckning vid 8 dB</small>
                      </div>
                      <div className="telecom-stat-item">
                        <span>Lägsta 5G-täckning</span>
                        <strong>
                          {ptsStats.lowestCounty?.name.replace(/ län$/, '')}:{' '}
                          {ptsStats.lowestCounty?.mobile5g8Db.value?.toFixed(1)}%
                        </strong>
                        <small>Glesbygd / fjällterräng</small>
                      </div>
                    </div>
                  )}

                  {/* Controls: Search, View Mode Toggle, Metric Toggles */}
                  <div className="telecom-controls">
                    <div className="telecom-toggle-group">
                      <button
                        type="button"
                        className={`telecom-toggle-btn ${ptsViewMode === 'chart' ? 'active' : ''}`}
                        onClick={() => setPtsViewMode('chart')}
                      >
                        Stapeldiagram
                      </button>
                      <button
                        type="button"
                        className={`telecom-toggle-btn ${ptsViewMode === 'table' ? 'active' : ''}`}
                        onClick={() => setPtsViewMode('table')}
                      >
                        Länstabell
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className={`telecom-toggle-btn ${show10Mbps ? 'active' : ''}`}
                        onClick={() => setShow10Mbps(!show10Mbps)}
                        title="Växla visning av ≥10 Mbit/s"
                      >
                        {show10Mbps ? 'Dölj ≥10 Mbit/s' : 'Visa ≥10 Mbit/s'}
                      </button>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="telecom-search-box"
                          placeholder="Filtrera län…"
                          value={countySearch}
                          onChange={(e) => setCountySearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Chart Legend */}
                  <div className="telecom-chart-legend">
                    <span>
                      <i className="fiveg-swatch" />
                      5G-täckning (8 dB)
                    </span>
                    <span>
                      <i className="fast-mobile-swatch" />
                      Mobil &ge;100 Mbit/s (8 dB)
                    </span>
                    {show10Mbps && (
                      <span>
                        <i className="basic-mobile-swatch" />
                        Mobil &ge;10 Mbit/s (8 dB)
                      </span>
                    )}
                  </div>

                  {ptsViewMode === 'chart' ? (
                    <div className="telecom-coverage-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          layout="vertical"
                          margin={{ top: 4, right: 14, bottom: 2, left: 0 }}
                          barCategoryGap={4}
                        >
                          <CartesianGrid stroke="#edf0eb" horizontal={false} />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fill: '#899188', fontSize: 8 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={110}
                            tick={{ fill: '#49544c', fontSize: 8.5 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            formatter={(val) =>
                              val === null ? 'Ingen data' : `${Number(val).toFixed(2)}%`
                            }
                            labelFormatter={(l) => `${l} län`}
                            contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 9 }}
                          />
                          <Bar
                            dataKey="fiveG"
                            name="5G-täckning"
                            fill="#387c65"
                            radius={[0, 3, 3, 0]}
                            maxBarSize={7}
                          />
                          <Bar
                            dataKey="broadband100"
                            name="Mobil ≥100 Mbit/s"
                            fill="#c8893d"
                            radius={[0, 3, 3, 0]}
                            maxBarSize={7}
                          />
                          {show10Mbps && (
                            <Bar
                              dataKey="broadband10"
                              name="Mobil ≥10 Mbit/s"
                              fill="#4f99a0"
                              radius={[0, 3, 3, 0]}
                              maxBarSize={7}
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="telecom-table-container">
                      <table className="telecom-table">
                        <thead>
                          <tr>
                            <th
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                if (sortField === 'name') setSortAsc(!sortAsc)
                                else {
                                  setSortField('name')
                                  setSortAsc(true)
                                }
                              }}
                            >
                              Län {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                            </th>
                            <th>Kod</th>
                            <th
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                if (sortField === 'fiveG') setSortAsc(!sortAsc)
                                else {
                                  setSortField('fiveG')
                                  setSortAsc(false)
                                }
                              }}
                            >
                              5G (8 dB) {sortField === 'fiveG' ? (sortAsc ? '▲' : '▼') : ''}
                            </th>
                            <th
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                if (sortField === 'broadband100') setSortAsc(!sortAsc)
                                else {
                                  setSortField('broadband100')
                                  setSortAsc(false)
                                }
                              }}
                            >
                              ≥100 Mbit/s {sortField === 'broadband100' ? (sortAsc ? '▲' : '▼') : ''}
                            </th>
                            <th
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                if (sortField === 'broadband10') setSortAsc(!sortAsc)
                                else {
                                  setSortField('broadband10')
                                  setSortAsc(false)
                                }
                              }}
                            >
                              ≥10 Mbit/s {sortField === 'broadband10' ? (sortAsc ? '▲' : '▼') : ''}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCounties.map((c) => (
                            <tr
                              key={c.code}
                              style={{
                                cursor: 'pointer',
                                background: selectedCountyCode === c.code ? '#edf4ef' : undefined,
                              }}
                              onClick={() =>
                                setSelectedCountyCode(
                                  selectedCountyCode === c.code ? null : c.code,
                                )
                              }
                            >
                              <td>
                                <strong>{c.name}</strong>
                              </td>
                              <td>{c.code}</td>
                              <td>
                                {c.mobile5g8Db.value !== null
                                  ? `${c.mobile5g8Db.value.toFixed(2)}%`
                                  : '–'}
                                {c.mobile5g8Db.qualifier === 'greater-than' && (
                                  <span className="telecom-table-qualifier">(&gt;)</span>
                                )}
                              </td>
                              <td>
                                {c.mobile100Mbps8Db.value !== null
                                  ? `${c.mobile100Mbps8Db.value.toFixed(2)}%`
                                  : '–'}
                                {c.mobile100Mbps8Db.qualifier === 'greater-than' && (
                                  <span className="telecom-table-qualifier">(&gt;)</span>
                                )}
                              </td>
                              <td>
                                {c.mobile10Mbps8Db.value !== null
                                  ? `${c.mobile10Mbps8Db.value.toFixed(2)}%`
                                  : '–'}
                                {c.mobile10Mbps8Db.qualifier === 'greater-than' && (
                                  <span className="telecom-table-qualifier">(&gt;)</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedCounty && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px',
                        border: '1px solid #d5e0d4',
                        borderRadius: '6px',
                        background: '#f6faf7',
                      }}
                    >
                      <strong style={{ fontSize: '10px', color: '#2c3930' }}>
                        Valt län: {selectedCounty.name} (Kod {selectedCounty.code})
                      </strong>
                      <div
                        style={{
                          display: 'flex',
                          gap: '16px',
                          marginTop: '6px',
                          fontSize: '8.5px',
                          color: '#4f5c53',
                        }}
                      >
                        <span>
                          5G (8 dB):{' '}
                          <strong>{selectedCounty.mobile5g8Db.value?.toFixed(2)}%</strong>
                        </span>
                        <span>
                          ≥100 Mbit/s (8 dB):{' '}
                          <strong>{selectedCounty.mobile100Mbps8Db.value?.toFixed(2)}%</strong>
                        </span>
                        <span>
                          ≥10 Mbit/s (8 dB):{' '}
                          <strong>{selectedCounty.mobile10Mbps8Db.value?.toFixed(2)}%</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="telecom-panel-note">
                    Uppgifterna avser beräknad yttäckning vid 8 dB dämpning för alla operatörer
                    sammanvägt. Dämpningsvärdet 8 dB motsvarar PTS standard för täckning i handhållen
                    mobiltelefon. Värdena är statistiska årsberäkningar, inte realtidsstatus för master.
                  </p>
                  <a
                    className="source-link"
                    href="https://statistik.pts.se/mobiltacknings-och-bredbandskartlaggning/dokument-rapporter"
                    target="_blank"
                    rel="noreferrer"
                  >
                    PTS metodbeskrivning och officiella tabeller <ArrowUpRight size={14} />
                  </a>
                </>
              )}
            </article>

            {/* Panel 2: RIPE RIS Public BGP Routing History */}
            <article className="panel telecom-routing-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">
                    PUBLIKA BGP-OBSERVATIONER · {period.toUpperCase()}
                  </div>
                  <h2>RIPE RIS internetrouting och prefix</h2>
                </div>
                <SourceBadge state={data.routing.state} />
              </div>

              {routeHistory.length ? (
                <div className="telecom-route-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={routeHistory}
                      margin={{ top: 10, right: 10, bottom: 2, left: 0 }}
                    >
                      <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => String(v).slice(5, 10)}
                        minTickGap={24}
                        tick={{ fill: '#899188', fontSize: 8 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        width={44}
                        tick={{ fill: '#899188', fontSize: 8 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        labelFormatter={(v) => formatDate(String(v))}
                        contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 9 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ipv4Prefixes"
                        name="IPv4-prefix (RIS)"
                        stroke="#387c65"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="ipv6Prefixes"
                        name="IPv6-prefix (RIS)"
                        stroke="#c8893d"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="telecom-empty">
                  {data.routing.note ??
                    'Inga RIPEstat-routingpunkter är tillgängliga för detta tidsfönster.'}
                </div>
              )}

              <p className="telecom-panel-note">
                BGP-rutter observerade av RIPE NCC:s globala RIS route collectors. BGP-synlighet mäter
                annonserade IP-block och global nåbarhet på nätverksnivå. Detta mäter inte
                mobilmasttäckning eller lokal access.
              </p>
              <a
                className="source-link"
                href="https://stat.ripe.net/docs/data-api/ripestat-data-api"
                target="_blank"
                rel="noreferrer"
              >
                RIPEstat Data API dokumentation <ArrowUpRight size={14} />
              </a>
            </article>
          </div>

          {/* Lower Grid: IODA Internet Disruption Signal & Provenance/Quality */}
          <div className="telecom-detail-grid">
            {/* Panel 3: IODA Internet Outage Indicator */}
            <article className="panel telecom-ioda-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">
                    MAKRONIVÅ AVBROTTSINDIKATOR · {period.toUpperCase()}
                  </div>
                  <h2>IODA internetstörningssignal</h2>
                </div>
                <SourceBadge state={data.internetIncidents.state} />
              </div>

              {iodaHistory.length ? (
                <div className="telecom-ioda-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={iodaHistory}
                      margin={{ top: 10, right: 10, bottom: 2, left: 0 }}
                    >
                      <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(v) => formatDate(String(v)).slice(0, 6)}
                        minTickGap={28}
                        tick={{ fill: '#899188', fontSize: 8 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        width={40}
                        tick={{ fill: '#899188', fontSize: 8 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        labelFormatter={(v) => formatDate(String(v))}
                        contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 9 }}
                      />
                      <Line
                        type="stepAfter"
                        dataKey="value"
                        name="IODA-signal"
                        stroke="#6483a2"
                        strokeWidth={1.8}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="telecom-empty">
                  Inga IODA-tidsserievärden returnerades för detta tidsintervall.
                </div>
              )}

              <p className="telecom-panel-note">
                IODA sammanställer tre oberoende mätkällor (BGP-flöden, darknet/telescope och active
                probing). Det är en indikator för större nationella avbrott och ger ingen information
                om specifika mobiloperatörers basstationer.
              </p>

              {iodaEvents.length > 0 ? (
                <div className="telecom-event-list">
                  <strong style={{ fontSize: '9px', color: '#333e36' }}>
                    Registrerade avbrottshändelser ({iodaEvents.length} st)
                  </strong>
                  {iodaEvents.map((event) => (
                    <div key={event.id}>
                      <strong>{event.summary}</strong>
                      <span>
                        {event.entityName} · Källa: {event.datasource ?? 'IODA'} · Start:{' '}
                        {formatDate(event.startedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="telecom-empty compact">
                  <ShieldCheck size={14} style={{ color: '#387c65', display: 'inline', marginRight: 4 }} />
                  {data.internetIncidents.note ??
                    'Inga publicerade IODA-avbrottshändelser i detta tidsfönster.'}
                </div>
              )}

              <a
                className="source-link"
                href="https://api.ioda.inetintel.cc.gatech.edu/v2/docs"
                target="_blank"
                rel="noreferrer"
              >
                IODA API dokumentation <ArrowUpRight size={14} />
              </a>
            </article>

            {/* Panel 4: Source Provenance, Freshness & Unavailable Operators */}
            <article className="panel telecom-quality-panel">
              <div className="section-kicker">KÄLLSTATUS, KVALITET &amp; AKTUALITET</div>
              <h2>Datakällornas proveniens</h2>
              <SourceRow source={data.coverage} />
              <SourceRow source={data.routing} />
              <SourceRow source={data.internetIncidents} />

              <div className="telecom-unavailable">
                <strong>Operatörsspecifik realtidsdrift: Ej tillgänglig</strong>
                <span>
                  {data.operatorStatus.note ??
                    'Ingen mobiloperatör tillhandahåller ett öppet realtids-API för driftstörningar. Egna webbkartor kräver inloggning eller skyddas mot automatiska anrop.'}
                </span>
              </div>

              <div className="telecom-unavailable">
                <strong>Officiella incidentmeddelanden: Ej tillgänglig</strong>
                <span>
                  {data.notices.note ??
                    'Ingen samlad öppen incidentfeed för telekomavbrott finns tillgänglig. PTS publicerar statistik men inte löpande driftlarm.'}
                </span>
              </div>

              <p className="telecom-panel-note">
                Hämtat av backend-aggregator: {formatDate(data.retrievedAt)}. Hämtningstidpunkt är
                åtskild från källornas faktiska observationstid och referensperiod.
              </p>
            </article>
          </div>
        </>
      )}
    </section>
  )
}

export default TelecomDashboard