import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowUpRight,
  Cable,
  CheckCircle2,
  ExternalLink,
  Info,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'
import type {
  InternetDashboardResponse,
  InternetSourceMeta,
} from './services/internetTypes'

const regionLabels: Record<string, string> = {
  se: 'Sverige',
  no: 'Norge',
  dk: 'Danmark',
  fi: 'Finland',
  is: 'Island',
  nordics: 'Norden',
  europe: 'Europa',
}

const stateLabels: Record<string, string> = {
  ok: 'Fungerande',
  partial: 'Delvis data',
  stale: 'Föråldrad',
  unavailable: 'Ej tillgänglig',
  error: 'Fel',
  not_applicable: 'Ej tillämplig',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Ingen tidsstämpel'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SourceBadge({ state }: { state: string }) {
  return (
    <span className={`telecom-source-status ${state}`}>
      <i />
      {stateLabels[state] ?? state}
    </span>
  )
}

interface InternetDashboardProps {
  region: string
  onRegionChange?: (region: string) => void
}

export function InternetDashboard({ region, onRegionChange }: InternetDashboardProps) {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d')
  const [selectedAsn, setSelectedAsn] = useState('1653')
  const [indicatorFilter, setIndicatorFilter] = useState<'all' | 'routing' | 'outages' | 'backbones'>('all')
  const [data, setData] = useState<InternetDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [backboneSearch, setBackboneSearch] = useState('')
  const [showMethodology, setShowMethodology] = useState(false)
  const [selectedSourceForDetail, setSelectedSourceForDetail] = useState<InternetSourceMeta | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      region,
      period,
      asn: selectedAsn,
      indicator: indicatorFilter,
    })

    fetch(`/api/v1/internet?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Kunde inte hämta internetdata`)
        return res.json() as Promise<InternetDashboardResponse>
      })
      .then((json) => {
        setData(json)
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Ett nätverksfel uppstod.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [region, period, selectedAsn, indicatorFilter])

  // Filtered backbones
  const filteredBackbones = useMemo(() => {
    if (!data?.backbones) return []
    const q = backboneSearch.toLowerCase().trim()
    if (!q) return data.backbones
    return data.backbones.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.operator.toLowerCase().includes(q) ||
        b.asn.includes(q) ||
        b.category.toLowerCase().includes(q),
    )
  }, [data?.backbones, backboneSearch])

  const selectedBackbone = useMemo(() => {
    return data?.backbones.find((b) => b.asn === selectedAsn) ?? data?.backbones[0] ?? null
  }, [data?.backbones, selectedAsn])

  const routeHistory = data?.routing?.data?.history ?? []
  const iodaEvents = data?.iodaEvents?.events ?? []
  const asnUpdates = data?.asnActivity?.updates ?? []

  return (
    <section className="internet-dashboard" aria-label="Internet och nätverksinfrastruktur">
      {/* Top Header & Filter Controls */}
      <header className="internet-header-panel">
        <div className="internet-heading">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="internet-heading-icon">
              <Cable size={18} />
            </span>
            <div>
              <div className="section-kicker">INTERNET &amp; NÄTVERKSINFRASTRUKTUR</div>
              <h2>BGP-routing, autonoma system &amp; publika avbrottsindikatorer</h2>
            </div>
          </div>

          <div className="internet-filters">
            {/* Geographic scope selector */}
            <label className="internet-filter-label">
              Geografiskt område
              <select
                value={region}
                onChange={(e) => onRegionChange?.(e.target.value)}
                aria-label="Välj geografiskt område"
              >
                {Object.entries(regionLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {/* Time period */}
            <label className="internet-filter-label">
              Tidsintervall
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as '24h' | '7d' | '30d')}
                aria-label="Välj tidsintervall"
              >
                <option value="24h">Senaste 24 timmarna</option>
                <option value="7d">Senaste 7 dagarna</option>
                <option value="30d">Senaste 30 dagarna</option>
              </select>
            </label>

            {/* Indicator type filter */}
            <label className="internet-filter-label">
              Indikatortyp
              <select
                value={indicatorFilter}
                onChange={(e) => setIndicatorFilter(e.target.value as typeof indicatorFilter)}
                aria-label="Välj indikatorfilter"
              >
                <option value="all">Alla indikatorer</option>
                <option value="routing">BGP-routing &amp; prefix (RIPE RIS)</option>
                <option value="outages">Avbrottsindikatorer (IODA)</option>
                <option value="backbones">Ryggradsnät &amp; transit-AS</option>
              </select>
            </label>

            <button
              type="button"
              className="telecom-toggle-btn"
              onClick={() => setShowMethodology(!showMethodology)}
              style={{ height: '28px', marginTop: '13px' }}
            >
              <SlidersHorizontal size={12} style={{ display: 'inline', marginRight: 4 }} />
              {showMethodology ? 'Dölj metodik' : 'Metodik & källor'}
            </button>
          </div>
        </div>

        {/* Essential Guardrail & Interpretation Notice */}
        <div className="internet-caveat-card" role="note">
          <Info size={16} style={{ flexShrink: 0, marginTop: 1, color: '#917942' }} />
          <div>
            <strong>Observation och tolkning hålls strikt åtskilda:</strong> En routingförändring
            eller BGP-uppdatering är en normal del av internetprotokollets drift (peering-ändringar,
            trafikoptimering eller planerat underhåll) och är <em>inte automatiskt ett avbrott</em>. En
            avvikande signal i IODA mäter makroflöden och är <em>inte automatiskt ett cyberangrepp</em> utan
            oberoende forensisk bekräftelse. Datakällor utan koordinatprecision placeras inte som exakta
            punkter på kartan.
          </div>
        </div>
      </header>

      {error && (
        <div className="data-error" role="alert">
          Internetdata kunde inte laddas: {error}
        </div>
      )}

      {loading && (
        <p className="data-message" role="status">
          <RefreshCw size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />
          Hämtar data från RIPEstat, RIPE RIS och IODA…
        </p>
      )}

      {!loading && data && (
        <>
          {/* KPI Summary Cards */}
          <section className="internet-kpi-grid">
            <article className="internet-kpi-card">
              <span>Routade IPv4 / IPv6-prefix ({data.regionLabel})</span>
              <strong>
                {data.routing.data.latest
                  ? `${data.routing.data.latest.ipv4Prefixes?.toLocaleString('sv-SE')} / ${data.routing.data.latest.ipv6Prefixes?.toLocaleString('sv-SE')}`
                  : 'Ingen data'}
              </strong>
              <small>Källa: RIPE RIS route collectors ({formatDate(data.routing.data.latest?.date)})</small>
            </article>

            <article className="internet-kpi-card">
              <span>Aktiva autonoma system (ASN)</span>
              <strong>
                {data.routing.data.routedAsns
                  ? `${data.routing.data.routedAsns.toLocaleString('sv-SE')} st`
                  : 'Ingen data'}
              </strong>
              <small>
                {data.routing.data.registeredAsns
                  ? `av ${data.routing.data.registeredAsns.toLocaleString('sv-SE')} registrerade AS i ${data.regionLabel}`
                  : 'BGP autonoma system'}
              </small>
            </article>

            <article className="internet-kpi-card">
              <span>Övervakade ryggradsnät (Nordic/EU)</span>
              <strong>{data.backbones.length} st</strong>
              <small>
                Vald: AS{selectedBackbone?.asn} ({selectedBackbone?.name}) ·{' '}
                {selectedBackbone?.v4VisibilityPct ? `${selectedBackbone.v4VisibilityPct}% synlighet` : 'Synlig'}
              </small>
            </article>

            <article className="internet-kpi-card">
              <span>Registrerade IODA-händelser</span>
              <strong>{data.iodaEvents.filteredCount} st</strong>
              <small>Av {data.iodaEvents.totalFound} globala händelser i referensfönstret</small>
            </article>
          </section>

          {/* Section 1: Regional Time Series & BGP Routing Dynamics */}
          {(indicatorFilter === 'all' || indicatorFilter === 'routing') && (
            <div className="internet-grid-2col">
              {/* Panel 1A: Routing prefixes over time */}
              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">BGP-TIDSSERIE · RIPE RIS ({period.toUpperCase()})</div>
                    <h2>Annonserade prefix över tid ({data.regionLabel})</h2>
                  </div>
                  <SourceBadge state={data.routing.state} />
                </div>

                {routeHistory.length > 0 ? (
                  <div className="telecom-route-chart" style={{ height: '240px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={routeHistory} margin={{ top: 10, right: 10, bottom: 2, left: 0 }}>
                        <CartesianGrid stroke="#edf0eb" strokeDasharray="3 4" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => String(v).slice(5, 10)}
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
                        <Legend
                          verticalAlign="top"
                          height={28}
                          iconType="circle"
                          wrapperStyle={{ fontSize: 9, color: '#68736a' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="ipv4Prefixes"
                          name="IPv4-prefix"
                          stroke="#387c65"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="ipv6Prefixes"
                          name="IPv6-prefix"
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
                    Inga tidsserier för rutter returnerades för det valda tidsintervallet.
                  </div>
                )}

                <div className="interpretation-box">
                  <strong>Tolkning vs. observation:</strong> Linjen representerar antalet IP-prefix
                  som propageras globalt via BGP. Fluktuationer kan bero på nätverkskonsolidering, ruttaggregering
                  eller ändrade routing-policies mellan autonoma system, inte nödvändigtvis bortfall.
                </div>
              </article>

              {/* Panel 1B: Multi-country comparison if Nordics or Europe, otherwise ASN Update Activity */}
              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">
                      {data.multiCountryRouting.length
                        ? 'REGIONAL JÄMFÖRELSE · NORDEN & EUROPA'
                        : `BGP-AKTIVITET · AS${selectedAsn} (${selectedBackbone?.name ?? ''})`}
                    </div>
                    <h2>
                      {data.multiCountryRouting.length
                        ? 'Prefix & AS per land i regionen'
                        : `Ruttannonseringar & tillbakadraganden (${period.toUpperCase()})`}
                    </h2>
                  </div>
                  <SourceBadge state={data.asnActivity.state} />
                </div>

                {data.multiCountryRouting.length > 0 ? (
                  <div className="telecom-route-chart" style={{ height: '240px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.multiCountryRouting}
                        margin={{ top: 10, right: 10, bottom: 2, left: 0 }}
                      >
                        <CartesianGrid stroke="#edf0eb" vertical={false} />
                        <XAxis dataKey="country" tick={{ fill: '#49544c', fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#899188', fontSize: 8 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 9 }} />
                        <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="ipv4" name="IPv4-prefix" fill="#387c65" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="asns" name="Routade AS" fill="#4f99a0" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : asnUpdates.length > 0 ? (
                  <div className="telecom-route-chart" style={{ height: '240px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={asnUpdates} margin={{ top: 10, right: 10, bottom: 2, left: 0 }}>
                        <CartesianGrid stroke="#edf0eb" vertical={false} />
                        <XAxis
                          dataKey="starttime"
                          tickFormatter={(v) => String(v).slice(11, 16)}
                          tick={{ fill: '#899188', fontSize: 8 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis tick={{ fill: '#899188', fontSize: 8 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          labelFormatter={(v) => formatDate(String(v))}
                          contentStyle={{ borderColor: '#e2e8e1', borderRadius: 6, fontSize: 9 }}
                        />
                        <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="announcements" name="Announcements" fill="#387c65" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="withdrawals" name="Withdrawals" fill="#c8893d" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="telecom-empty">
                    Inga BGP-uppdateringshändelser registrerades för AS{selectedAsn} under denna tidsperiod.
                  </div>
                )}

                <div className="interpretation-box">
                  <strong>Metodbeskrivning (RIPE BGP updates):</strong> Visar volymen av ruttannonseringar
                  (announcements) och tillbakadraganden (withdrawals) observerade per tidssteg. Toppar uppstår ofta
                  vid normala BGP-sessionomstarter eller trafikomläggningar.
                </div>
              </article>
            </div>
          )}

          {/* Section 2: Backbone & Transit Networks Visibility */}
          {(indicatorFilter === 'all' || indicatorFilter === 'backbones') && (
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">BERÖRDA NÄTVERK &amp; AUTONOMA SYSTEM (ASN)</div>
                  <h2>Nordiska och europeiska ryggradsnät (RIPE Looking Glass)</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    className="telecom-search-box"
                    placeholder="Sök AS, operatör…"
                    value={backboneSearch}
                    onChange={(e) => setBackboneSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="backbone-list">
                {filteredBackbones.map((item) => {
                  const isSelected = item.asn === selectedAsn
                  return (
                    <div
                      key={item.asn}
                      className={`backbone-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedAsn(item.asn)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedAsn(item.asn)
                      }}
                    >
                      <div className="backbone-item-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '10px', color: '#2b362d' }}>
                            AS{item.asn} · {item.name}
                          </span>
                          <span className="telecom-table-qualifier">({item.category})</span>
                        </div>
                        <small>{item.operator} · Land: {item.country}</small>
                      </div>

                      <div className="backbone-item-stats">
                        <strong>
                          {item.v4VisibilityPct !== null ? `${item.v4VisibilityPct}% synlighet` : 'Aktiv'}
                        </strong>
                        <small>
                          {item.v4Peers !== null && item.v4Total !== null
                            ? `${item.v4Peers} / ${item.v4Total} RIS-peers ser AS:et`
                            : 'RIS looking glass'}
                        </small>
                      </div>
                    </div>
                  )
                })}
              </div>

              {selectedBackbone && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px',
                    borderRadius: '6px',
                    background: '#f8faf7',
                    border: '1px solid #d8e2d6',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '11px', color: '#28362d' }}>
                      Valt AS: AS{selectedBackbone.asn} – {selectedBackbone.name} ({selectedBackbone.operator})
                    </strong>
                    <a
                      href={`https://stat.ripe.net/ui2013/AS${selectedBackbone.asn}`}
                      target="_blank"
                      rel="noreferrer"
                      className="source-link"
                      style={{ margin: 0 }}
                    >
                      Öppna i RIPEstat UI <ExternalLink size={12} />
                    </a>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '20px',
                      marginTop: '8px',
                      fontSize: '9px',
                      color: '#49554c',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      IPv4 RIS-synlighet:{' '}
                      <strong>{selectedBackbone.v4VisibilityPct ?? '–'}%</strong> ({selectedBackbone.v4Peers}/{selectedBackbone.v4Total} peers)
                    </span>
                    <span>
                      IPv6 RIS-synlighet:{' '}
                      <strong>{selectedBackbone.v6VisibilityPct ?? '–'}%</strong> ({selectedBackbone.v6Peers}/{selectedBackbone.v6Total} peers)
                    </span>
                    <span>
                      Annonserad i BGP:{' '}
                      <strong style={{ color: selectedBackbone.announced ? '#387c65' : '#b25746' }}>
                        {selectedBackbone.announced ? 'Ja (Global routing tabell)' : 'Nej'}
                      </strong>
                    </span>
                    <span>Observerad: {formatDate(selectedBackbone.queryTime)}</span>
                  </div>
                </div>
              )}
            </article>
          )}

          {/* Section 3: Internet Outage Indicators & Event Observations (IODA) */}
          {(indicatorFilter === 'all' || indicatorFilter === 'outages') && (
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">INTERNETSTÖRNINGAR &amp; AVBROTTSINDIKATORER</div>
                  <h2>IODA makroobservationer &amp; routing-avvikelser</h2>
                </div>
                <SourceBadge state={data.iodaEvents.state} />
              </div>

              {iodaEvents.length > 0 ? (
                <div className="telecom-event-list" style={{ marginTop: '10px' }}>
                  {iodaEvents.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid #edf1eb',
                        borderRadius: '6px',
                        background: '#fcfdfa',
                        display: 'grid',
                        gap: '5px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: '10px', color: '#27342a' }}>
                          {event.locationName}
                        </strong>
                        <span className="telecom-table-qualifier" style={{ fontSize: '8px', textTransform: 'uppercase' }}>
                          Datakälla: {event.datasource}
                        </span>
                      </div>

                      <div style={{ fontSize: '8.5px', color: '#68736a', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span>Start: {formatDate(event.start)}</span>
                        {event.durationSeconds && (
                          <span>Varaktighet: {Math.round(event.durationSeconds / 60)} minuter</span>
                        )}
                        {event.score && <span>Anomalipoäng: {event.score}</span>}
                        {event.asn && <span>ASN: {event.asn}</span>}
                        {event.countryCode && <span>Land: {event.countryCode}</span>}
                      </div>

                      {/* Explicit separate interpretation */}
                      <div
                        style={{
                          background: '#f8faf7',
                          borderLeft: '3px solid #6483a2',
                          padding: '6px 9px',
                          fontSize: '8px',
                          color: '#414e44',
                          lineHeight: '1.45',
                        }}
                      >
                        <strong>Tolkning:</strong> {event.interpretation}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="telecom-empty compact">
                  <CheckCircle2 size={15} style={{ color: '#387c65', display: 'inline', marginRight: 6 }} />
                  Inga aktiva eller nyligen registrerade makroavbrott från IODA för {data.regionLabel} under tidsperioden ({period}).
                </div>
              )}

              <p className="telecom-panel-note">
                IODA övervakar storskaliga avbrott via tre oberoende källor: Border Gateway Protocol (BGP),
                Network Telescopes (mörknet) och Active Probing (ping/traceroute). IODA mäter nationella eller
                stora nätverksaggregeringar och visar inte lokala accessfel hos enskilda hushåll.
              </p>
            </article>
          )}

          {/* Section 4: Data Sources, Freshness, Methodology & Authentication Disclaimers */}
          <article className="panel">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">KÄLLSTATUS, METODIK &amp; AUTENTISERINGSKRAV</div>
                <h2>Datakällornas aktualitet och metodik</h2>
              </div>
              <span className="telecom-table-qualifier">Hämtad: {formatDate(data.retrievedAt)}</span>
            </div>

            <div className="source-health-grid">
              {data.sources.map((source) => (
                <div
                  key={source.id}
                  className="source-health-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedSourceForDetail(source)}
                >
                  <div className="source-health-header">
                    <div>
                      <strong>{source.name}</strong>
                      <small>Kvalitet: {source.quality} · Precision: {source.geographicPrecision}</small>
                    </div>
                    <SourceBadge state={source.state} />
                  </div>

                  <p className="source-health-desc">{source.methodology}</p>

                  <div className="source-health-meta">
                    <div>
                      <span>Senaste observation:</span>
                      <strong>{formatDate(source.observedAt)}</strong>
                    </div>
                    <div>
                      <span>Hämtad av servern:</span>
                      <strong>{formatDate(source.retrievedAt)}</strong>
                    </div>
                  </div>

                  {source.disclaimer && (
                    <div className="method-caution" style={{ marginTop: '4px' }}>
                      <strong>Viktig avgränsning:</strong> {source.disclaimer}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Cloudflare Radar Access Information Card */}
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #ebd9c2',
                background: '#fffdfa',
                fontSize: '8.5px',
                color: '#6e5e40',
                lineHeight: '1.5',
              }}
            >
              <strong style={{ color: '#564627' }}>Cloudflare Radar API – Autentisering och villkor:</strong>
              <p style={{ margin: '4px 0 0' }}>
                Cloudflare Radar API kräver autentisering via HTTP Bearer-token (<code>CLOUDFLARE_API_TOKEN</code>) med
                behörigheten <em>Account &gt; Radar &gt; Read</em>. När token inte är konfigurerad markeras källan transparent
                som <strong>ej tillgänglig</strong> utan att falska livevärden genereras. Radardata tillhandahålls under
                licensen CC BY-NC 4.0.
              </p>
            </div>
          </article>

          {/* Modal / Sheet for Source Detail if selected */}
          {selectedSourceForDetail && (
            <div
              className="detail-sheet"
              role="dialog"
              aria-modal="true"
              onClick={() => setSelectedSourceForDetail(null)}
            >
              <div className="detail-sheet-card" onClick={(e) => e.stopPropagation()}>
                <div className="panel-heading detail-header">
                  <div>
                    <div className="section-kicker">KÄLLSPECIFIKATION OCH METODIK</div>
                    <h2>{selectedSourceForDetail.name}</h2>
                  </div>
                  <button
                    type="button"
                    className="detail-close-btn"
                    onClick={() => setSelectedSourceForDetail(null)}
                    aria-label="Stäng detaljvy"
                  >
                    ×
                  </button>
                </div>

                <div className="detail-meta-list">
                  <div className="detail-meta-row">
                    <span>Status</span>
                    <SourceBadge state={selectedSourceForDetail.state} />
                  </div>
                  <div className="detail-meta-row">
                    <span>Geografisk precision</span>
                    <strong>{selectedSourceForDetail.geographicPrecision} (inte exakta kartkoordinater)</strong>
                  </div>
                  <div className="detail-meta-row">
                    <span>Datakvalitet</span>
                    <strong>{selectedSourceForDetail.quality}</strong>
                  </div>
                  <div className="detail-meta-row">
                    <span>Senaste observation</span>
                    <strong>{formatDate(selectedSourceForDetail.observedAt)}</strong>
                  </div>
                  <div className="detail-meta-row">
                    <span>Hämtad</span>
                    <strong>{formatDate(selectedSourceForDetail.retrievedAt)}</strong>
                  </div>
                </div>

                <div style={{ margin: '14px 0', fontSize: '9px', lineHeight: '1.6', color: '#404c42' }}>
                  <h3 style={{ fontSize: '10px', marginBottom: '4px', color: '#27342b' }}>Metodologi</h3>
                  <p>{selectedSourceForDetail.methodology}</p>

                  <h3 style={{ fontSize: '10px', margin: '10px 0 4px', color: '#27342b' }}>Tolkning och begränsningar</h3>
                  <p>{selectedSourceForDetail.disclaimer}</p>
                </div>

                <a
                  href={selectedSourceForDetail.url}
                  target="_blank"
                  rel="noreferrer"
                  className="source-link"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Officiell dokumentation <ArrowUpRight size={13} />
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default InternetDashboard
