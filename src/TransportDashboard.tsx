import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  ExternalLink,
  MapPin,
  Plane,
  RefreshCw,
  Search,
  TrainFront,
  Truck,
  X,
} from 'lucide-react'

export type TransportMode = 'all' | 'road' | 'rail' | 'aviation'

export type TransportItem = {
  id: string
  mode: 'road' | 'rail' | 'aviation'
  transportType: string
  title: string
  summary: string
  location: string
  roadNumber?: string | null
  trainIdent?: string | null
  operator?: string | null
  isCanceled?: boolean
  callsign?: string | null
  altitudeMeters?: number | null
  velocityKmh?: number | null
  coordinates?: { latitude: number; longitude: number } | null
  severity: 'critical' | 'elevated' | 'operational'
  kind: string
  time: string
  retrievedAt: string
  source: string
  sourceUrl: string
  verified: boolean
}

export type TransportResponse = {
  mode: TransportMode
  region: string
  period: string
  retrievedAt: string
  sources: {
    trafikverketRoad: {
      status: string
      label: string
      count: number
      lastChecked: string
      error: string | null
      url: string
    }
    trafikverketRail: {
      status: string
      label: string
      count: number
      lastChecked: string
      error: string | null
      url: string
    }
    openSky: {
      status: string
      label: string
      count: number
      lastChecked: string
      error: string | null
      url: string
      note?: string | null
    }
  }
  metrics: {
    roadIncidents: number
    railDisruptions: number
    railCanceledCount: number
    observedAircraft: number
  }
  items: TransportItem[]
}

interface TransportDashboardProps {
  initialMode?: TransportMode
  region?: string
}

function formatDateTime(val: string | null) {
  if (!val) return 'Tid saknas'
  return new Intl.DateTimeFormat('sv-SE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(val))
}

const TRAFIKVERKET_PORTAL_URL = 'https://bransch.trafikverket.se/tjanster/data-kartor-och-geodatatjanster/'

const statusColors: Record<string, string> = {
  ok: '#2a7b54',
  not_configured: '#966d35',
  rate_limited: '#b36224',
  timeout: '#825941',
  error: '#b9382f',
  unknown: '#747c75',
}

const statusText: Record<string, string> = {
  ok: 'Aktiv',
  not_configured: 'Ej konfigurerad',
  rate_limited: 'Hastighetsbegränsad',
  timeout: 'Tidsgräns nådd',
  error: 'Fel',
  unknown: 'Okänd',
}

export default function TransportDashboard({ initialMode = 'all', region = 'se' }: TransportDashboardProps) {
  const [selectedMode, setSelectedMode] = useState<TransportMode>(initialMode)
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d'>('24h')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState<TransportItem | null>(null)

  const [data, setData] = useState<TransportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Sync mode if initialMode changes
  useEffect(() => {
    setSelectedMode(initialMode)
  }, [initialMode])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        mode: selectedMode,
        region,
        period: selectedPeriod,
      })
      const res = await fetch(`/api/v1/transport?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status} vid hämtning av transportdata`)
      const json: TransportResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte ladda transportdata')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedMode, selectedPeriod, region])

  const filteredItems = (data?.items || []).filter((item) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      item.title.toLowerCase().includes(term) ||
      item.summary.toLowerCase().includes(term) ||
      item.location.toLowerCase().includes(term) ||
      (item.roadNumber && item.roadNumber.toLowerCase().includes(term)) ||
      (item.trainIdent && item.trainIdent.toLowerCase().includes(term)) ||
      (item.callsign && item.callsign.toLowerCase().includes(term))
    )
  })

  return (
    <section className="transport-dashboard" aria-label="Transportövervakning">
      {/* Top Filter and Controls Bar */}
      <div className="energy-controls" style={{ marginBottom: '14px' }}>
        <div className="energy-heading">
          <div className="energy-heading-icon" style={{ background: '#edf4f1', color: '#27694f' }}>
            {selectedMode === 'road' ? (
              <Truck size={18} />
            ) : selectedMode === 'rail' ? (
              <TrainFront size={18} />
            ) : selectedMode === 'aviation' ? (
              <Plane size={18} />
            ) : (
              <Truck size={18} />
            )}
          </div>
          <div>
            <div className="section-kicker">INFRASTRUCTURE WATCH · TRANSPORT</div>
            <h2>
              {selectedMode === 'road'
                ? 'Vägtrafik och väglagsstörningar'
                : selectedMode === 'rail'
                  ? 'Järnvägstrafik och tågförseningar'
                  : selectedMode === 'aviation'
                    ? 'Luftfart och flygobservationer'
                    : 'Transportinfrastruktur (Väg, Järnväg, Flyg)'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span
              className="energy-status"
              style={{
                backgroundColor: '#edf5f0',
                color: statusColors[data?.sources.trafikverketRoad.status || 'unknown'],
              }}
            >
              <i style={{ backgroundColor: statusColors[data?.sources.trafikverketRoad.status || 'unknown'] }} />
              Trafikverket: {statusText[data?.sources.trafikverketRoad.status || 'unknown']}
            </span>
            <span
              className="energy-status"
              style={{
                backgroundColor: '#edf5f0',
                color: statusColors[data?.sources.openSky.status || 'unknown'],
              }}
            >
              <i style={{ backgroundColor: statusColors[data?.sources.openSky.status || 'unknown'] }} />
              OpenSky: {statusText[data?.sources.openSky.status || 'unknown']}
            </span>
          </div>
        </div>

        <div className="energy-selectors">
          <label>
            Transportslag
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as TransportMode)}
            >
              <option value="all">Alla transportslag</option>
              <option value="road">Vägtrafik (Trafikverket)</option>
              <option value="rail">Järnvägstrafik (Trafikverket)</option>
              <option value="aviation">Luftfart (OpenSky ADS-B)</option>
            </select>
          </label>

          <label>
            Tidsperiod
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as '24h' | '7d')}
            >
              <option value="24h">Senaste 24 timmarna</option>
              <option value="7d">Senaste 7 dagarna</option>
            </select>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="icon-button"
              onClick={fetchData}
              title="Uppdatera data"
              disabled={loading}
              style={{ padding: '6px', height: '32px', width: '32px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="energy-updated">
            <small>Senast kontrollerad</small>
            <strong>{formatDateTime(data?.retrievedAt || null)}</strong>
          </div>
        </div>
      </div>

      {error && <div className="data-error" role="alert" style={{ marginBottom: '14px' }}>Transportdata är inte tillgänglig: {error}</div>}

      {/* Real-time KPI Metric Cards */}
      <div className="energy-metrics" style={{ marginBottom: '16px' }}>
        <article className="energy-metric">
          <span>Trafikverket vägavvikelser</span>
          <strong>{data?.metrics.roadIncidents ?? 0} händelser</strong>
          <small>
            {data?.sources.trafikverketRoad.status === 'ok'
              ? `Kontrollerad ${formatDateTime(data.sources.trafikverketRoad.lastChecked)}`
              : 'Källa: ' + (data?.sources.trafikverketRoad.error || 'Ej tillgänglig')}
          </small>
        </article>

        <article className="energy-metric">
          <span>Inställda tåg (Trafikverket)</span>
          <strong style={{ color: (data?.metrics.railCanceledCount ?? 0) > 0 ? '#b83f32' : 'inherit' }}>
            {data?.metrics.railCanceledCount ?? 0} avgångar
          </strong>
          <small>
            Totalt {data?.metrics.railDisruptions ?? 0} avvikelser och förseningar
          </small>
        </article>

        <article className="energy-metric">
          <span>Observerade flygplan (OpenSky)</span>
          <strong>{data?.metrics.observedAircraft ?? 0} observationer</strong>
          <small>
            {data?.sources.openSky.status === 'ok'
              ? 'ADS-B transpondertelemetri'
              : data?.sources.openSky.status === 'rate_limited'
                ? 'Rate limited (OpenSky API)'
                : 'ADS-B täckning'}
          </small>
        </article>

        <article className="energy-metric">
          <span>Datastatus & källintegritet</span>
          <strong style={{ fontSize: '11px', color: '#324b3c' }}>Verifierade källor</strong>
          <small>Frånvaro av händelser tolkas ej som normal trafik</small>
        </article>
      </div>

      {/* Caveat and Access Notice Banner */}
      <div className="telecom-caveat" style={{ marginBottom: '14px' }}>
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Källtillgång och licensvillkor:</strong> Trafikverket kräver registrering och acceptans
          av öppna data-licensen för produktion. OpenSky Network tillhandahåller transpondertelemetri (ADS-B)
          av observerade flygplan och inte fullständiga kommersiella flygplatstidtabeller. Om inga händelser visas
          redovisas exakt tidpunkt då källan kontrollerades.
        </div>
      </div>

      {/* Main Content Layout: Map View & Timeline View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '14px' }}>
        {/* Left Column: Interactive Map View */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="panel-heading">
            <div>
              <div className="section-kicker">GEOGRAFISKT LÄGE</div>
              <h2>Översiktskarta (Sverige & Norden)</h2>
            </div>
            <span style={{ fontSize: '9px', color: '#7a857b' }}>
              {filteredItems.filter((i) => i.coordinates).length} geokodade
            </span>
          </div>

          {/* SVG Map representing Scandinavian airspace and transit corridors */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '360px',
              backgroundColor: '#f6f9f7',
              borderRadius: '6px',
              border: '1px solid #e1e7e3',
              overflow: 'hidden',
            }}
          >
            <svg
              viewBox="10 54 15 16"
              style={{ width: '100%', height: '100%', transform: 'scaleY(-1)' }}
            >
              {/* Simplified outlines for Sweden/Nordics */}
              <path
                d="M 12 56 L 14 55.5 L 13 58 L 11 59 L 12 63 L 14 65 L 18 69 L 23 68 L 24 65 L 21 64 L 18 60 L 16 57 Z"
                fill="#e4ede7"
                stroke="#cbd8cf"
                strokeWidth="0.12"
              />

              {/* Geographic plot points */}
              {filteredItems.map((item) => {
                if (!item.coordinates) return null
                const { latitude, longitude } = item.coordinates
                if (latitude < 54 || latitude > 71 || longitude < 9 || longitude > 26) return null

                const isRoad = item.mode === 'road'
                const isRail = item.mode === 'rail'
                const isAviation = item.mode === 'aviation'

                const fillColor =
                  item.severity === 'critical'
                    ? '#b83f32'
                    : isRoad
                      ? '#be7228'
                      : isRail
                        ? '#2f6892'
                        : '#357f5c'

                return (
                  <g
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={longitude}
                      cy={latitude}
                      r={item.severity === 'critical' ? '0.35' : '0.24'}
                      fill={fillColor}
                      stroke="#ffffff"
                      strokeWidth="0.06"
                    />
                    {isAviation && (
                      <text
                        x={longitude + 0.3}
                        y={latitude}
                        fontSize="0.25"
                        fill="#2a3f33"
                        transform={`scale(1, -1) translate(0, ${-2 * latitude})`}
                      >
                        {item.callsign || 'Flyg'}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Map Legend */}
            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                right: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.92)',
                borderRadius: '4px',
                padding: '6px 8px',
                fontSize: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
                border: '1px solid #dce2de',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#be7228' }} />
                Vägstörning
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2f6892' }} />
                Järnvägsavvikelse
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#357f5c' }} />
                ADS-B Flygplan
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#b83f32' }} />
                Kritisk / Inställd
              </span>
            </div>
          </div>

          {/* Source Provenance Info in Map Column */}
          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #edf1ee', fontSize: '9px', color: '#68736a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Trafikverket licens</span>
              <strong style={{ color: '#27382d' }}>Öppna data licens</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>OpenSky Network</span>
              <strong style={{ color: '#27382d' }}>ADS-B telemetri</strong>
            </div>
            <a
              href={TRAFIKVERKET_PORTAL_URL}
              target="_blank"
              rel="noreferrer"
              className="source-link"
              style={{ marginTop: '6px', fontSize: '9px' }}
            >
              Trafikverkets API-portal <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Right Column: Timeline & Incident Feed */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="panel-heading">
            <div>
              <div className="section-kicker">HÄNDELSETIDSLINJE</div>
              <h2>Rapporterade trafikstörningar & observationer</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Search filter input */}
              <div style={{ position: 'relative', width: '180px' }}>
                <Search size={12} style={{ position: 'absolute', left: '7px', top: '9px', color: '#88938a' }} />
                <input
                  type="text"
                  placeholder="Filtrera tåg, väg, flyg..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    height: '28px',
                    paddingLeft: '24px',
                    paddingRight: '6px',
                    fontSize: '9px',
                    borderRadius: '4px',
                    border: '1px solid #dbe2dd',
                    background: '#fcfdfc',
                  }}
                />
              </div>
              <span style={{ fontSize: '9px', color: '#778279' }}>
                {filteredItems.length} händelser
              </span>
            </div>
          </div>

          {/* List of Incidents / Observations */}
          <div style={{ display: 'grid', gap: '8px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredItems.length === 0 ? (
              <div className="energy-empty" style={{ margin: '12px 0' }}>
                <strong>Inga aktiva händelser matchar filtret</strong>
                <span>
                  Källorna kontrollerades senast {formatDateTime(data?.retrievedAt || null)}. Om inga störningar
                  rapporteras indikerar det att inga avvikelser registrerats i datakällorna vid kontrolltillfället.
                </span>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isRoad = item.mode === 'road'
                const isRail = item.mode === 'rail'

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    style={{
                      display: 'grid',
                      gap: '4px',
                      padding: '10px 12px',
                      border: '1px solid #e3e8e4',
                      borderRadius: '6px',
                      backgroundColor: item.severity === 'critical' ? '#fff9f8' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '8px',
                            fontWeight: 600,
                            backgroundColor: isRoad ? '#fef4eb' : isRail ? '#edf4fa' : '#eaf6ee',
                            color: isRoad ? '#9e5618' : isRail ? '#215c87' : '#276f4c',
                          }}
                        >
                          {isRoad ? (
                            <Truck size={10} />
                          ) : isRail ? (
                            <TrainFront size={10} />
                          ) : (
                            <Plane size={10} />
                          )}
                          {item.transportType}
                        </span>

                        <span
                          className={`incident-tag ${item.severity}`}
                          style={{ fontSize: '8px', padding: '1px 5px' }}
                        >
                          {item.severity === 'critical'
                            ? 'Kritisk'
                            : item.severity === 'elevated'
                              ? 'Förhöjd'
                              : 'Operativ'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '8px', color: '#889189' }}>
                        <Clock size={10} />
                        <span>{formatDateTime(item.time)}</span>
                      </div>
                    </div>

                    <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#233227' }}>
                      {item.title}
                    </h4>

                    <p style={{ margin: 0, fontSize: '9px', color: '#5a665d', lineHeight: 1.45 }}>
                      {item.summary}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', fontSize: '8px', color: '#778278' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={10} />
                        {item.location}
                      </span>
                      <span>Källa: {item.source}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal Dialog */}
      {selectedItem && (
        <div
          className="detail-sheet"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedItem(null)}
        >
          <div className="detail-sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-heading detail-header">
              <div>
                <div className="section-kicker">TRANSPORTHÄNDELSE · DETALJVISNING</div>
                <h2>{selectedItem.title}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedItem(null)}
                aria-label="Stäng detaljvy"
              >
                <X size={16} />
              </button>
            </div>

            <div className="detail-body">
              <div className="detail-badges">
                <span className={`incident-tag ${selectedItem.severity}`}>
                  {selectedItem.severity === 'critical'
                    ? 'Kritisk incident'
                    : selectedItem.severity === 'elevated'
                      ? 'Förhöjd risk'
                      : 'Observation'}
                </span>
                <span className="provenance-pill">{selectedItem.transportType}</span>
                <span className="quality-pill">{selectedItem.source}</span>
              </div>

              <p style={{ fontSize: '11px', lineHeight: 1.55, margin: '10px 0' }}>
                {selectedItem.summary}
              </p>

              <dl className="detail-meta">
                <div>
                  <dt>Transportslag</dt>
                  <dd>{selectedItem.transportType}</dd>
                </div>
                <div>
                  <dt>Geografisk plats</dt>
                  <dd>{selectedItem.location}</dd>
                </div>
                {selectedItem.coordinates && (
                  <div>
                    <dt>Koordinater</dt>
                    <dd>
                      {selectedItem.coordinates.latitude.toFixed(4)}°N,{' '}
                      {selectedItem.coordinates.longitude.toFixed(4)}°E
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Händelsetidpunkt</dt>
                  <dd>{formatDateTime(selectedItem.time)}</dd>
                </div>
                <div>
                  <dt>Hämtad från källa</dt>
                  <dd>{formatDateTime(selectedItem.retrievedAt)}</dd>
                </div>
                <div>
                  <dt>Källa & dokumentation</dt>
                  <dd>
                    <a
                      href={selectedItem.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#27694f', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      {selectedItem.source} <ArrowUpRight size={11} />
                    </a>
                  </dd>
                </div>
              </dl>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button
                  type="button"
                  className="kind-filter-btn active"
                  onClick={() => setSelectedItem(null)}
                >
                  Stäng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
