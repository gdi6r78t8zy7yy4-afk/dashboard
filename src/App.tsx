import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bell,
  Cable,
  Check,
  ChevronDown,
  CircleHelp,
  CloudSun,
  Database,
  ExternalLink,
  Gauge,
  Globe2,
  Info,
  LayoutDashboard,
  RadioTower,
  RefreshCw,
  ShieldAlert,
  Ship,
  TrainFront,
  Truck,
  Waves,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { siteConfig } from './config/siteConfig'
import { summarizeStatuses } from './services/statusSummary'
import type { ServiceStatus, StatusLevel } from './services/statusSummary'

const EnergyDashboard = lazy(() => import('./EnergyDashboard'))
const TelecomDashboard = lazy(() => import('./TelecomDashboard'))
const InternetDashboard = lazy(() => import('./InternetDashboard'))
const CyberDashboard = lazy(() => import('./CyberDashboard'))
const WorldEventsDashboard = lazy(() => import('./WorldEventsDashboard'))
const TransportDashboard = lazy(() => import('./TransportDashboard'))

type DashboardId =
  | 'overview'
  | 'events'
  | 'cyber'
  | 'weather'
  | 'finance'
  | 'roads'
  | 'rail'
  | 'aviation'
  | 'maritime'
  | 'power'
  | 'energy'
  | 'datacenters'
  | 'telecom'
  | 'networks'

type InfrastructureService = ServiceStatus & {
  id: Exclude<DashboardId, 'overview'>
  label: string
  description: string
  metric: string
  metricLabel: string
  updated: string
  category: string
}

export type ObservationKind =
  | 'verified_incident'
  | 'warning'
  | 'technical_observation'
  | 'risk_indicator'

type Incident = {
  id?: string
  severity: Exclude<StatusLevel, 'unknown'>
  service: string
  source?: string
  sourceUrl?: string
  title: string
  summary?: string
  location: string
  time: string
  retrievedAt?: string
  verified?: boolean
  kind?: ObservationKind
  note: string
  category?: string
}

type SourceStatus = {
  id: string
  label: string
  url?: string
  category: string
  status: 'ok' | 'warning' | 'error' | 'stale' | 'not_configured'
  lastSuccessfulUpdate: string | null
  updateInterval: string
  timeout: string
  lastError: string | null
  requiresAuth: boolean
  verified: boolean
  description?: string
}

type OverviewSector = {
  id: string
  label: string
  status: StatusLevel
  summary: string
  value: string
  region: string
  metricLabel?: string
  updated?: string
}

type MapRegion = {
  id: string
  label: string
  status: StatusLevel
  x: number
  y: number
  width: number
  height: number
  signalsCount?: number
}

type TimelineItem = {
  id: string
  title: string
  time: string
  timestamp?: string
  source: string
  sourceUrl?: string
  severity: Exclude<StatusLevel, 'unknown'>
  category: string
  kind?: ObservationKind
  location?: string
  summary?: string
}

type OverviewResponse = {
  mode: string
  region?: string
  regionLabel?: string
  retrievedAt?: string
  services: InfrastructureService[]
  incidents: Incident[]
  sectors: OverviewSector[]
  mapRegions: MapRegion[]
  timeline: TimelineItem[]
  sources: SourceStatus[]
}

type SectorObservation = {
  id: string
  title: string
  summary: string
  kind: ObservationKind
  quality: 'verified' | 'provisional' | 'stale' | 'missing'
  source: string
  location: string
  timestamp: string
  severity: 'critical' | 'elevated'
}

type SectorKpi = {
  label: string
  value: string
  trend: string
  status: StatusLevel
}

type SectorDashboardResponse = {
  mode: string
  id: string
  label: string
  headline: string
  status: StatusLevel
  qualityNote: string
  kpis: SectorKpi[]
  observations: SectorObservation[]
}

const regions = [
  { id: 'se', label: 'Sverige', detail: 'Nationell vy', flag: 'SE' },
  { id: 'no', label: 'Norge', detail: 'Nationell vy', flag: 'NO' },
  { id: 'dk', label: 'Danmark', detail: 'Nationell vy', flag: 'DK' },
  { id: 'fi', label: 'Finland', detail: 'Nationell vy', flag: 'FI' },
  { id: 'is', label: 'Island', detail: 'Nationell vy', flag: 'IS' },
  { id: 'nordics', label: 'Norden', detail: 'Regional översikt', flag: 'ND' },
  { id: 'europe', label: 'Europa', detail: 'Europeisk översikt', flag: 'EU' },
]

const dashboards: { id: DashboardId; label: string; icon: LucideIcon; group: string }[] = [
  { id: 'overview', label: 'Lägesbild', icon: LayoutDashboard, group: 'ÖVERSIKT' },
  { id: 'events', label: 'Omvärldshändelser', icon: Globe2, group: 'ÖVERSIKT' },
  { id: 'cyber', label: 'Cyberhot & sårbarheter', icon: ShieldAlert, group: 'CYBERSÄKERHET' },
  { id: 'power', label: 'Elnät & kraftsystem', icon: Zap, group: 'ENERGI' },
  { id: 'telecom', label: 'Telekomoperatörer', icon: RadioTower, group: 'DIGITAL INFRASTRUKTUR' },
  { id: 'networks', label: 'Internet & nätverksinfrastruktur', icon: Cable, group: 'DIGITAL INFRASTRUKTUR' },
  { id: 'roads', label: 'Vägtrafik', icon: Truck, group: 'TRANSPORT' },
  { id: 'rail', label: 'Järnvägstrafik', icon: TrainFront, group: 'TRANSPORT' },
  { id: 'weather', label: 'Väder & meteorologi', icon: CloudSun, group: 'SAMHÄLLSINFRAS' },
  { id: 'finance', label: 'Finansiella marknader', icon: Activity, group: 'SAMHÄLLSINFRAS' },
  { id: 'aviation', label: 'Luftfart', icon: Wind, group: 'TRANSPORT' },
  { id: 'maritime', label: 'Sjöfart & farleder', icon: Ship, group: 'TRANSPORT' },
  { id: 'energy', label: 'Gas- & oljelager', icon: Waves, group: 'ENERGI' },
  { id: 'datacenters', label: 'Datacenter', icon: Database, group: 'DIGITAL INFRASTRUKTUR' },
]

const sectorIcons: Record<string, LucideIcon> = {
  energy: Zap,
  telecom: RadioTower,
  internet: Cable,
  transport: Truck,
  cyber: ShieldAlert,
}

const levelLabels: Record<StatusLevel, string> = {
  operational: 'Operativ',
  elevated: 'Förhöjd risk',
  critical: 'Kritisk',
  unknown: 'Ingen data / Ej ansluten',
}

const sourceStatusLabels: Record<string, string> = {
  ok: 'Fungerande',
  stale: 'Föråldrad',
  error: 'Felaktig',
  not_configured: 'Ej konfigurerad',
  warning: 'Varning',
}

const observationKindLabels: Record<ObservationKind, string> = {
  verified_incident: 'Bekräftad incident',
  warning: 'Publicerad varning',
  technical_observation: 'Teknisk observation',
  risk_indicator: 'Beräknad riskindikator',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Ingen uppgift'
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

function App() {
  const [activeDashboard, setActiveDashboard] = useState<DashboardId>('overview')
  const [activeRegion, setActiveRegion] = useState('se')
  const [showNotifications, setShowNotifications] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [selectedKindFilter, setSelectedKindFilter] = useState<'all' | ObservationKind>('all')
  const [services, setServices] = useState<InfrastructureService[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null)
  const [sectorData, setSectorData] = useState<SectorDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const notificationRef = useRef<HTMLDivElement>(null)

  function loadOverview() {
    setIsLoading(true)
    setDataError(null)

    fetch(`/api/v1/overview?region=${encodeURIComponent(activeRegion)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`API svarade med ${response.status}`)
        return response.json() as Promise<OverviewResponse>
      })
      .then((overview) => {
        setServices(overview.services ?? [])
        setIncidents(overview.incidents ?? [])
        setOverviewData(overview)
        setLastRefreshedAt(new Date())
      })
      .catch((error: unknown) => {
        setDataError(error instanceof Error ? error.message : 'Kunde inte ladda lägesdata.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    loadOverview()
  }, [activeRegion])

  // Sector-specific fetch when selecting another dashboard
  useEffect(() => {
    if (
      activeDashboard === 'overview' ||
      activeDashboard === 'events' ||
      activeDashboard === 'power' ||
      activeDashboard === 'telecom' ||
      activeDashboard === 'networks' ||
      activeDashboard === 'cyber'
    ) {
      setSectorData(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setDataError(null)

    fetch(`/api/v1/sector?region=${encodeURIComponent(activeRegion)}&id=${encodeURIComponent(activeDashboard)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Sektor-API svarade med ${response.status}`)
        return response.json() as Promise<SectorDashboardResponse>
      })
      .then((response) => {
        if (cancelled) return
        setSectorData(response)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDataError(error instanceof Error ? error.message : 'Kunde inte hämta sektordata.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeDashboard, activeRegion])

  // Outside click for notifications
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNotifications])

  const selectedRegion = regions.find((region) => region.id === activeRegion) ?? regions[0]
  const currentDashboard = dashboards.find((dashboard) => dashboard.id === activeDashboard) ?? dashboards[0]
  const isProviderDashboard = activeDashboard === 'power' || activeDashboard === 'telecom'

  const summary = useMemo(() => summarizeStatuses(services, siteConfig.statusSummary), [services])

  const statusCounts = useMemo(() => {
    return services.reduce(
      (counts, service) => ({ ...counts, [service.status]: counts[service.status] + 1 }),
      { operational: 0, elevated: 0, critical: 0, unknown: 0 },
    )
  }, [services])

  // Filter incidents by kind
  const filteredIncidents = useMemo(() => {
    if (selectedKindFilter === 'all') return incidents
    return incidents.filter((incident) => incident.kind === selectedKindFilter)
  }, [incidents, selectedKindFilter])

  const criticalCount = useMemo(() => incidents.filter((i) => i.severity === 'critical').length, [incidents])
  const elevatedCount = useMemo(() => incidents.filter((i) => i.severity === 'elevated').length, [incidents])

  function selectDashboard(id: DashboardId) {
    setActiveDashboard(id)
  }

  function handleMapRegionClick(regionId: string) {
    setActiveRegion(regionId)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => selectDashboard('overview')}>
          <span className="brand-mark"><Globe2 size={19} strokeWidth={2} /></span>
          <span>Northwatch<span className="brand-period">.</span></span>
        </a>
        <p className="brand-subtitle">INFRASTRUCTURE WATCH</p>

        <label className="region-label" htmlFor="region-select">BEVAKNINGSOMRÅDE</label>
        <div className="region-picker">
          <span className="region-flag"><Globe2 size={15} /></span>
          <select id="region-select" value={activeRegion} onChange={(event) => setActiveRegion(event.target.value)}>
            {regions.map((region) => <option key={region.id} value={region.id}>{region.label}</option>)}
          </select>
          <ChevronDown size={15} />
        </div>
        <div className="region-detail">{selectedRegion.detail} <span>·</span> Europa/Stockholm (CET)</div>

        <nav className="dashboard-nav" aria-label="Infrastrukturöversikt">
          {dashboards.map(({ id, label, icon: Icon, group }, index) => {
            const previousGroup = dashboards[index - 1]?.group
            return (
              <div key={id}>
                {group !== previousGroup && <div className="nav-label">{group}</div>}
                <button
                  aria-current={activeDashboard === id ? 'page' : undefined}
                  className={`nav-item ${activeDashboard === id ? 'active' : ''}`}
                  onClick={() => selectDashboard(id)}
                  type="button"
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{label}</span>
                  {id !== 'overview' && services.find((service) => service.id === id)?.status === 'critical' && <span className="nav-alert" />}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-state">
            <span className="connection-dot" />
            <span>
              <strong>Backend-aggregator aktiv</strong>
              <small>CERT-SE · RIPEstat · IODA · ENTSO-E</small>
            </span>
          </div>
          <a className="help-link" href="#data-provenance"><CircleHelp size={16} />Källor & metodik</a>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              type="button"
              className="breadcrumb-link"
              onClick={() => selectDashboard('overview')}
              style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: 'inherit' }}
            >
              Lägescentral
            </button>
            <span className="breadcrumb-divider">/</span>
            <strong>{currentDashboard.label}</strong>
          </div>
          <div className="topbar-actions" ref={notificationRef}>
            <button
              type="button"
              className="icon-button"
              title="Uppdatera lägesbild"
              onClick={loadOverview}
              aria-label="Uppdatera lägesbild"
            >
              <RefreshCw size={15} />
            </button>
            <span className="demo-indicator">
              <span /> {overviewData?.mode === 'live_aggregate' ? 'LIVE AGGREGAT' : 'BLANDAT FLÖDE'}
            </span>
            <button
              className="icon-button notification-button"
              type="button"
              aria-label="Aviseringar"
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={17} />
              {incidents.length > 0 && <span />}
            </button>
            <span className="topbar-divider" />
            <time className="updated-at" dateTime={lastRefreshedAt.toISOString()}>
              {formatDate(lastRefreshedAt.toISOString())}
              <span>CET</span>
            </time>
            {showNotifications && (
              <div className="notification-popover" role="status">
                <strong>{incidents.length} aktiva observationer</strong>
                <span>{criticalCount} kritiska · {elevatedCount} förhöjda</span>
              </div>
            )}
          </div>
        </header>

        <div className="dashboard-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> NATIONELL OCH EUROPEISK INFRASTRUKTURBILD</div>
              <h1>{activeDashboard === 'overview' ? 'Samlad lägesbild' : currentDashboard.label}<span className="heading-period">.</span></h1>
              <p>
                {activeDashboard === 'power'
                  ? 'Välj land, elområde och period. Källkvalitet och mätvärden visas nedan.'
                  : activeDashboard === 'telecom'
                    ? 'Årlig PTS-täckningsstatistik, RIPE RIS BGP-observationer och IODA-avbrottssignaler.'
                    : `Koordinerad status för samhällsviktiga funktioner i ${selectedRegion.label}.`}
              </p>
              {activeDashboard !== 'overview' && (
                <button
                  type="button"
                  className="back-link"
                  onClick={() => selectDashboard('overview')}
                  style={{ marginTop: '8px', background: 'transparent', border: 0, padding: 0, color: 'var(--green)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                >
                  ← Tillbaka till samlad lägesbild
                </button>
              )}
            </div>
            <div className="last-updated">
              <span className={`live-dot ${isProviderDashboard ? 'muted' : ''}`} />
              Aggregerat <span>·</span> {lastRefreshedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} CET
            </div>
          </section>

          {!isProviderDashboard && (
            <section className={`situation-banner ${summary.level}`} aria-label="Samlad situationsbedömning">
              <div className="banner-symbol">
                {summary.level === 'critical' ? <AlertTriangle size={21} /> : <Gauge size={21} />}
              </div>
              <div className="banner-copy">
                <span className="banner-overline">KONFIGURERAD RISKBEDÖMNING</span>
                <strong>{summary.label}</strong>
                <span>{summary.description}</span>
              </div>
              <div className="banner-stats">
                <div><strong>{statusCounts.critical}</strong><span>Kritiska</span></div>
                <div><strong>{statusCounts.elevated}</strong><span>Förhöjd</span></div>
                <div><strong>{statusCounts.operational}</strong><span>Operativa</span></div>
                <div><strong>{statusCounts.unknown}</strong><span>Ej ansluten</span></div>
              </div>
              <span className="summary-config">{siteConfig.statusSummary.method}</span>
            </section>
          )}

          {dataError && <div className="data-error" role="alert">Lägesdata är för närvarande inte tillgänglig: {dataError}</div>}
          {isLoading && <p className="data-message" role="status">Laddar aktuell lägesbild och verifierade datakällor…</p>}

          {/* 5 Core Sectors: Energi, Telekom, Internet, Transport, Cyber */}
          {activeDashboard === 'overview' && overviewData?.sectors && (
            <section style={{ marginBottom: '24px' }}>
              <div className="section-heading">
                <div>
                  <div className="section-kicker">INFRASTRUKTURSEKTORER</div>
                  <h2>Samlad status: Energi, Telekom, Internet, Transport & Cyber</h2>
                </div>
                <span className="scope-label"><Globe2 size={14} /> {selectedRegion.label}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '11px' }}>
                {overviewData.sectors.map((sector) => {
                  const Icon = sectorIcons[sector.id] ?? Activity
                  return (
                    <article
                      key={sector.id}
                      className={`service-card ${sector.status} sector-summary-card`}
                      tabIndex={0}
                      role="button"
                      onClick={() => {
                        if (sector.id === 'energy') selectDashboard('power')
                        else if (sector.id === 'telecom') selectDashboard('telecom')
                        else if (sector.id === 'internet') selectDashboard('networks')
                        else if (sector.id === 'transport') selectDashboard('roads')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (sector.id === 'energy') selectDashboard('power')
                          else if (sector.id === 'telecom') selectDashboard('telecom')
                          else if (sector.id === 'internet') selectDashboard('networks')
                          else if (sector.id === 'transport') selectDashboard('roads')
                        }
                      }}
                    >
                      <div className="service-card-heading">
                        <span className="service-icon"><Icon size={18} strokeWidth={1.8} /></span>
                        <span className={`status-badge ${sector.status}`}><span />{levelLabels[sector.status]}</span>
                      </div>
                      <h3>{sector.label}</h3>
                      <p className="service-description" title={sector.summary}>{sector.summary}</p>
                      <div className="service-metric">{sector.value}</div>
                      <div className="service-metric-label">{sector.metricLabel ?? 'Aktuell indikator'}</div>
                      <div className="service-card-footer">
                        <span>{sector.region}</span>
                        <span>{sector.updated ?? 'Senast uppdaterad'}</span>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {/* Interactive Geography Map & Overview Grid */}
          {activeDashboard === 'overview' && overviewData && (
            <section className="overview-aggregate-grid" aria-label="Interaktiv geografisk karta och översikt">
              <article className="panel map-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">INTERAKTIV GEOGRAFI</div>
                    <h2>Sverige, Norden och Europa</h2>
                  </div>
                  <span className="incident-count">
                    {regions.find((r) => r.id === activeRegion)?.label ?? 'Sverige'} aktiv
                  </span>
                </div>
                <p style={{ margin: '8px 0 12px', fontSize: '9.5px', color: '#858b84' }}>
                  Klicka på ett landområde på kartan eller välj i listan för att byta bevakningsområde.
                </p>

                <svg viewBox="0 0 420 260" className="map-svg" aria-label="Karta över Norden och Europa">
                  <rect x="0" y="0" width="420" height="260" fill="#f5f7f3" rx="12" />
                  {/* Continental landmass approximations */}
                  <path d="M70 80 L120 50 L192 58 L235 85 L208 125 L175 145 L120 138 L78 110 Z" fill="#edf2ed" stroke="#d5ddd5" strokeWidth="1.5" />
                  <path d="M205 52 L258 69 L295 102 L276 142 L224 152 L196 120 Z" fill="#edf2ed" stroke="#d5ddd5" strokeWidth="1.5" />
                  <path d="M155 150 L185 175 L210 195 L188 228 L146 221 L130 186 Z" fill="#edf2ed" stroke="#d5ddd5" strokeWidth="1.5" />
                  <path d="M300 165 L332 173 L352 186 L343 203 L314 208 L301 192 Z" fill="#edf2ed" stroke="#d5ddd5" strokeWidth="1.5" />

                  {/* Interactive Region Nodes */}
                  {overviewData.mapRegions.map((region) => {
                    const isSelected = activeRegion === region.id
                    const fillColor = region.status === 'critical'
                      ? '#f5dfdc'
                      : region.status === 'elevated'
                        ? '#fcf1de'
                        : region.status === 'unknown'
                          ? '#ebedea'
                          : '#e5eee7'
                    const strokeColor = isSelected
                      ? '#28634f'
                      : region.status === 'critical'
                        ? '#c36d60'
                        : region.status === 'elevated'
                          ? '#cc9340'
                          : '#b5c0b6'

                    return (
                      <g
                        key={region.id}
                        className={`map-region-node ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleMapRegionClick(region.id)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${region.label}: ${levelLabels[region.status]}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleMapRegionClick(region.id)
                          }
                        }}
                      >
                        <rect
                          x={region.x}
                          y={region.y}
                          width={region.width}
                          height={region.height}
                          rx="8"
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />
                        <text
                          x={region.x + region.width / 2}
                          y={region.y + region.height / 2 + 4}
                          textAnchor="middle"
                          fontSize="10"
                          fill={isSelected ? '#204336' : '#45514a'}
                          fontWeight={isSelected ? '800' : '700'}
                        >
                          {region.label}
                        </text>
                        {region.signalsCount && region.signalsCount > 0 ? (
                          <circle
                            cx={region.x + region.width - 4}
                            cy={region.y + 4}
                            r="4"
                            fill="#bd6152"
                          />
                        ) : null}
                      </g>
                    )
                  })}
                </svg>

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {regions.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      className={`kind-filter-btn ${activeRegion === reg.id ? 'active' : ''}`}
                      onClick={() => setActiveRegion(reg.id)}
                    >
                      {reg.label}
                    </button>
                  ))}
                </div>
              </article>

              {/* Event Timeline */}
              <article className="panel timeline-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">KRONOLOGISK TIDSLINJE</div>
                    <h2>Händelseförlopp</h2>
                  </div>
                  <span className="incident-count">{overviewData.timeline.length} händelser</span>
                </div>
                <div className="timeline-list">
                  {overviewData.timeline.map((event) => (
                    <div
                      key={event.id}
                      className="timeline-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        setSelectedIncident({
                          id: event.id,
                          title: event.title,
                          time: event.timestamp ?? event.time,
                          service: event.source,
                          source: event.source,
                          sourceUrl: event.sourceUrl,
                          severity: event.severity,
                          category: event.category,
                          location: event.location ?? selectedRegion.label,
                          summary: event.summary ?? event.title,
                          note: `${event.source} ${event.category}`,
                          kind: event.kind ?? 'warning',
                        })
                      }
                    >
                      <span className={`incident-severity ${event.severity}`}>
                        <AlertTriangle size={13} />
                      </span>
                      <div>
                        <strong>{event.title}</strong>
                        <small>{event.source} · {event.category}</small>
                      </div>
                      <time>{event.time}</time>
                    </div>
                  ))}
                  {overviewData.timeline.length === 0 && (
                    <p className="data-message">Inga tidsstämplade händelser i bevakningsfönstret.</p>
                  )}
                </div>
              </article>
            </section>
          )}

          {/* Incidents & Advisories Panel (Sorted by severity & time with kind filter) */}
          {activeDashboard !== 'power' && activeDashboard !== 'telecom' && (
            <section className="lower-grid">
              <article className="panel incident-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">PÅKALLAR UPPMÄRKSAMHET</div>
                    <h2>Aktuella incidenter och varningar</h2>
                  </div>
                  <span className="incident-count">{filteredIncidents.length} aktiva</span>
                </div>

                {/* Filter buttons: Bekräftad incident, Publicerad varning, Teknisk observation, Beräknad riskindikator */}
                <div className="kind-filter-bar">
                  <button
                    type="button"
                    className={`kind-filter-btn ${selectedKindFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedKindFilter('all')}
                  >
                    Alla <span>{incidents.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`kind-filter-btn ${selectedKindFilter === 'verified_incident' ? 'active' : ''}`}
                    onClick={() => setSelectedKindFilter('verified_incident')}
                  >
                    Bekräftad incident <span>{incidents.filter((i) => i.kind === 'verified_incident').length}</span>
                  </button>
                  <button
                    type="button"
                    className={`kind-filter-btn ${selectedKindFilter === 'warning' ? 'active' : ''}`}
                    onClick={() => setSelectedKindFilter('warning')}
                  >
                    Publicerad varning <span>{incidents.filter((i) => i.kind === 'warning').length}</span>
                  </button>
                  <button
                    type="button"
                    className={`kind-filter-btn ${selectedKindFilter === 'technical_observation' ? 'active' : ''}`}
                    onClick={() => setSelectedKindFilter('technical_observation')}
                  >
                    Teknisk observation <span>{incidents.filter((i) => i.kind === 'technical_observation').length}</span>
                  </button>
                  <button
                    type="button"
                    className={`kind-filter-btn ${selectedKindFilter === 'risk_indicator' ? 'active' : ''}`}
                    onClick={() => setSelectedKindFilter('risk_indicator')}
                  >
                    Riskindikator <span>{incidents.filter((i) => i.kind === 'risk_indicator').length}</span>
                  </button>
                </div>

                <div className="incident-list">
                  {filteredIncidents.map((incident) => (
                    <div
                      className="incident-row"
                      key={`${incident.id ?? incident.title}-${incident.time}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedIncident(incident)}
                    >
                      <span className={`incident-severity ${incident.severity}`}>
                        <AlertTriangle size={15} />
                      </span>
                      <div className="incident-main">
                        <div>
                          <span className={`incident-tag ${incident.severity}`}>
                            {incident.kind ? observationKindLabels[incident.kind] : levelLabels[incident.severity]}
                          </span>
                          <span className="incident-service">{incident.service}</span>
                          {incident.verified && <span className="provenance-pill"><Check size={10} /> Verifierad</span>}
                        </div>
                        <strong>{incident.title}</strong>
                        <span className="incident-note">{incident.summary ?? incident.note}</span>
                      </div>
                      <div className="incident-location">
                        {incident.location}
                        <span>{formatDate(incident.time)}</span>
                      </div>
                    </div>
                  ))}
                  {filteredIncidents.length === 0 && (
                    <p className="data-message">Inga aktiva händelser matchar det valda filtret.</p>
                  )}
                </div>
              </article>

              {/* Data Provenance & Source Health Overview */}
              <article className="panel source-panel" id="data-provenance">
                <div className="section-kicker">KÄLLSTATUS & PROVENIENS</div>
                <h2>Datakällornas hälsa</h2>
                <p>Status för varje ansluten leverantör: fungerande, föråldrad, felaktig eller ej konfigurerad.</p>

                <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                  {overviewData?.sources.map((source) => (
                    <div key={source.id} className="source-status-row">
                      <div>
                        <strong>{source.label}</strong>
                        <small>{source.category} · Kadens: {source.updateInterval}</small>
                      </div>
                      <div className="source-status-meta">
                        <span className={`status-badge ${source.status}`}>
                          <span />
                          {sourceStatusLabels[source.status] ?? source.status}
                        </span>
                        <small>
                          {source.lastSuccessfulUpdate ? formatDate(source.lastSuccessfulUpdate) : 'Ingen data'}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '16px', borderTop: '1px solid #f0f2ee', paddingTop: '12px' }}>
                  <div className="source-meter">
                    <div>
                      <span>Fungerande källor</span>
                      <strong>
                        {overviewData?.sources.filter((s) => s.status === 'ok').length ?? 0}{' '}
                        <small>/ {overviewData?.sources.length ?? 0} källor</small>
                      </strong>
                    </div>
                    <span className="meter-track">
                      <i
                        style={{
                          width: `${Math.max(
                            8,
                            ((overviewData?.sources.filter((s) => s.status === 'ok').length ?? 0) /
                              (overviewData?.sources.length || 1)) *
                              100,
                          )}%`,
                        }}
                      />
                    </span>
                  </div>
                </div>
              </article>
            </section>
          )}

          {/* Comprehensive Source Catalog Grid */}
          {activeDashboard === 'overview' && overviewData?.sources && (
            <section style={{ marginTop: '24px' }}>
              <div className="section-heading">
                <div>
                  <div className="section-kicker">LEVERANTÖRSÖVERSIKT</div>
                  <h2>Detaljerad källstatus & uppdateringsfrekvens</h2>
                </div>
                <span className="scope-label"><Info size={14} /> Fullständig proveniens</span>
              </div>

              <div className="source-health-grid">
                {overviewData.sources.map((source) => (
                  <div key={source.id} className="source-health-card">
                    <div className="source-health-header">
                      <div>
                        <strong>{source.label}</strong>
                        <small>{source.category}</small>
                      </div>
                      <span className={`status-badge ${source.status}`}>
                        <span />
                        {sourceStatusLabels[source.status] ?? source.status}
                      </span>
                    </div>

                    <p className="source-health-desc">
                      {source.description ?? 'Officiell infrastruktur- och telemetridatakälla.'}
                    </p>

                    <div className="source-health-meta">
                      <div>
                        <span>Senaste lyckade uppdatering:</span>
                        <strong>{formatDate(source.lastSuccessfulUpdate)}</strong>
                      </div>
                      <div>
                        <span>Uppdateringsintervall:</span>
                        <strong>{source.updateInterval}</strong>
                      </div>
                      <div>
                        <span>Timeout:</span>
                        <strong>{source.timeout}</strong>
                      </div>
                      <div>
                        <span>Autentisering:</span>
                        <strong>{source.requiresAuth ? 'Kräver API-nyckel' : 'Öppen / Ingen nyckel'}</strong>
                      </div>
                      {source.lastError && (
                        <div style={{ color: '#b65f51', marginTop: '4px' }}>
                          <span>Felmeddelande:</span>
                          <strong>{source.lastError}</strong>
                        </div>
                      )}
                      {source.url && (
                        <div style={{ marginTop: '4px' }}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="source-link"
                            style={{ margin: 0 }}
                          >
                            Öppna källans dokumentation <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sub-Dashboards */}
          {activeDashboard === 'power' && (
            <Suspense fallback={<p className="data-message" role="status">Laddar elnäts- och energidata…</p>}>
              <EnergyDashboard />
            </Suspense>
          )}
          {activeDashboard === 'telecom' && (
            <Suspense fallback={<p className="data-message" role="status">Laddar telekomkällor…</p>}>
              <TelecomDashboard region={activeRegion} />
            </Suspense>
          )}
          {activeDashboard === 'networks' && (
            <Suspense fallback={<p className="data-message" role="status">Laddar internet- och nätverksinfrastruktur…</p>}>
              <InternetDashboard region={activeRegion} onRegionChange={(reg) => setActiveRegion(reg)} />
            </Suspense>
          )}
          {activeDashboard === 'cyber' && (
            <Suspense fallback={<p className="data-message" role="status">Laddar cyberhot och sårbarhetsflöden…</p>}>
              <CyberDashboard />
            </Suspense>
          )}
          {activeDashboard === 'events' && (
            <Suspense fallback={<p className="data-message" role="status">Laddar omvärldshändelser…</p>}>
              <WorldEventsDashboard initialRegion={activeRegion} />
            </Suspense>
          )}
          {activeDashboard === 'roads' && (
            <Suspense fallback={<p className="data-message" role="status">Laddar vägtrafikdata från Trafikverket…</p>}>
              <TransportDashboard initialMode="road" region={activeRegion} />
            </Suspense>
          )}
          {activeDashboard === 'rail' && (
            <Suspense fallback={<p className="data-message" role="status">Laddar järnvägstrafik från Trafikverket…</p>}>
              <TransportDashboard initialMode="rail" region={activeRegion} />
            </Suspense>
          )}
          {activeDashboard === 'aviation' && (
            <Suspense fallback={<p className="data-message" role="status">Laddar flygdata från OpenSky Network…</p>}>
              <TransportDashboard initialMode="aviation" region={activeRegion} />
            </Suspense>
          )}

          {/* Sector panel if sub-dashboard opened without dedicated interactive view */}
          {activeDashboard !== 'overview' && activeDashboard !== 'events' && activeDashboard !== 'power' && activeDashboard !== 'telecom' && activeDashboard !== 'networks' && activeDashboard !== 'cyber' && activeDashboard !== 'roads' && activeDashboard !== 'rail' && activeDashboard !== 'aviation' && sectorData && (
            <section className="sector-panel" aria-live="polite">
              <div className="sector-panel-header">
                <div>
                  <div className="section-kicker">SEKTORVY</div>
                  <h2>{sectorData.label}</h2>
                </div>
                <span className={`status-badge ${sectorData.status}`}><span />{levelLabels[sectorData.status]}</span>
              </div>
              <p className="sector-headline">{sectorData.headline}</p>

              <div className="sector-kpi-grid">
                {sectorData.kpis.map((kpi) => (
                  <div className="sector-kpi" key={kpi.label}>
                    <div className="sector-kpi-topline">
                      <span>{kpi.label}</span>
                      <span className={`status-badge ${kpi.status}`}><span />{levelLabels[kpi.status]}</span>
                    </div>
                    <strong>{kpi.value}</strong>
                    <small>{kpi.trend}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Observation / Incident Detail Modal */}
          {selectedIncident && (
            <div
              className="detail-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="detail-modal-title"
              onClick={() => setSelectedIncident(null)}
            >
              <div className="detail-sheet-card" onClick={(e) => e.stopPropagation()}>
                <div className="panel-heading detail-header">
                  <div>
                    <div className="section-kicker">DETALJVISNING OCH PROVENIENS</div>
                    <h2 id="detail-modal-title">{selectedIncident.title}</h2>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setSelectedIncident(null)}
                    aria-label="Stäng detaljvy"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="detail-body">
                  <div className="detail-badges">
                    <span className={`incident-tag ${selectedIncident.severity}`}>
                      {selectedIncident.kind ? observationKindLabels[selectedIncident.kind] : levelLabels[selectedIncident.severity]}
                    </span>
                    <span className="provenance-pill">
                      {selectedIncident.verified ? 'Verifierad källa' : 'Provisorisk observation'}
                    </span>
                    {selectedIncident.category && (
                      <span className="quality-pill">{selectedIncident.category}</span>
                    )}
                  </div>

                  <p>{selectedIncident.summary ?? selectedIncident.note}</p>

                  <dl className="detail-meta">
                    <div>
                      <dt>Källa</dt>
                      <dd>
                        {selectedIncident.sourceUrl ? (
                          <a
                            href={selectedIncident.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--green-dark)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {selectedIncident.source ?? selectedIncident.service} <ExternalLink size={12} />
                          </a>
                        ) : (
                          selectedIncident.source ?? selectedIncident.service
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Geografisk plats</dt>
                      <dd>{selectedIncident.location}</dd>
                    </div>
                    <div>
                      <dt>Observationstidpunkt</dt>
                      <dd>{formatDate(selectedIncident.time)}</dd>
                    </div>
                    {selectedIncident.retrievedAt && (
                      <div>
                        <dt>Hämtningstid (backend)</dt>
                        <dd>{formatDate(selectedIncident.retrievedAt)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Verifieringsstatus</dt>
                      <dd>{selectedIncident.verified ? 'Auktoritativ leverantör (MSB / CERT / TSO)' : 'Automatisk telemetri'}</dd>
                    </div>
                  </dl>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="kind-filter-btn active"
                      onClick={() => setSelectedIncident(null)}
                    >
                      Stäng
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <footer className="page-footer">
            <span>Situationsmedvetenhet · inte ett operativt styrsystem</span>
            <span>Källdata måste verifieras före operativ användning.</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App
