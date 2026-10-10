import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Cable,
  ChevronDown,
  CircleHelp,
  CloudSun,
  Database,
  Gauge,
  Globe2,
  LayoutDashboard,
  RadioTower,
  Ship,
  TrainFront,
  Truck,
  Waves,
  Wind,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { siteConfig } from './config/siteConfig'
import { summarizeStatuses } from './services/statusSummary'
import type { ServiceStatus, StatusLevel } from './services/statusSummary'

const EnergyDashboard = lazy(() => import('./EnergyDashboard'))
const TelecomDashboard = lazy(() => import('./TelecomDashboard'))

type DashboardId =
  | 'overview'
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

type Incident = {
  severity: Exclude<StatusLevel, 'operational' | 'unknown'>
  service: string
  title: string
  location: string
  time: string
  note: string
}

type SourceStatus = {
  id: string
  label: string
  category: string
  status: 'ok' | 'warning' | 'error' | 'stale' | 'not_configured'
  lastSuccessfulUpdate: string
  updateInterval: string
  timeout: string
  lastError: string | null
  requiresAuth: boolean
  verified: boolean
}

type OverviewSector = {
  id: string
  label: string
  status: StatusLevel
  summary: string
  value: string
  region: string
}

type MapRegion = {
  id: string
  label: string
  status: StatusLevel
  x: number
  y: number
  width: number
  height: number
}

type TimelineItem = {
  id: string
  title: string
  time: string
  source: string
  severity: Exclude<StatusLevel, 'unknown'>
  category: string
}

type OverviewResponse = {
  mode: 'demo'
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
  kind: 'verified_incident' | 'warning' | 'technical_observation' | 'risk_indicator'
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
  mode: 'demo'
  id: string
  label: string
  headline: string
  status: StatusLevel
  qualityNote: string
  kpis: SectorKpi[]
  observations: SectorObservation[]
}

const regions = [
  { id: 'se', label: 'Sweden', detail: 'National view' },
  { id: 'no', label: 'Norway', detail: 'National view' },
  { id: 'dk', label: 'Denmark', detail: 'National view' },
  { id: 'fi', label: 'Finland', detail: 'National view' },
  { id: 'is', label: 'Iceland', detail: 'National view' },
  { id: 'nordics', label: 'Nordics', detail: 'Regional view' },
  { id: 'europe', label: 'Europe', detail: 'Regional view' },
]

const dashboards: { id: DashboardId; label: string; icon: LucideIcon; group: string }[] = [
  { id: 'overview', label: 'Situation overview', icon: LayoutDashboard, group: 'SITUATION' },
  { id: 'weather', label: 'Weather', icon: CloudSun, group: 'CIVIL INFRASTRUCTURE' },
  { id: 'finance', label: 'Financial markets', icon: Activity, group: 'CIVIL INFRASTRUCTURE' },
  { id: 'roads', label: 'Road traffic', icon: Truck, group: 'TRANSPORT' },
  { id: 'rail', label: 'Train traffic', icon: TrainFront, group: 'TRANSPORT' },
  { id: 'aviation', label: 'Air traffic', icon: Wind, group: 'TRANSPORT' },
  { id: 'maritime', label: 'Boat traffic', icon: Ship, group: 'TRANSPORT' },
  { id: 'power', label: 'Electricity grid', icon: Zap, group: 'ENERGY' },
  { id: 'energy', label: 'Oil & gas reserves', icon: Waves, group: 'ENERGY' },
  { id: 'datacenters', label: 'Datacenters', icon: Database, group: 'DIGITAL INFRASTRUCTURE' },
  { id: 'telecom', label: 'Telecom operators', icon: RadioTower, group: 'DIGITAL INFRASTRUCTURE' },
  { id: 'networks', label: 'Data networks', icon: Cable, group: 'DIGITAL INFRASTRUCTURE' },
]

const serviceIcons: Record<Exclude<DashboardId, 'overview'>, LucideIcon> = {
  weather: CloudSun,
  finance: Activity,
  roads: Truck,
  rail: TrainFront,
  aviation: Wind,
  maritime: Ship,
  power: Zap,
  energy: Waves,
  datacenters: Database,
  telecom: RadioTower,
  networks: Cable,
}

const levelLabels: Record<StatusLevel, string> = {
  operational: 'Operational',
  elevated: 'Elevated',
  critical: 'Critical',
  unknown: 'No data',
}

const observationKindLabels: Record<SectorObservation['kind'], string> = {
  verified_incident: 'Verified incident',
  warning: 'Warning',
  technical_observation: 'Technical observation',
  risk_indicator: 'Risk indicator',
}

const observationQualityLabels: Record<SectorObservation['quality'], string> = {
  verified: 'Verified',
  provisional: 'Provisional',
  stale: 'Stale',
  missing: 'Missing',
}

function App() {
  const [activeDashboard, setActiveDashboard] = useState<DashboardId>('overview')
  const [activeRegion, setActiveRegion] = useState('se')
  const [showNotifications, setShowNotifications] = useState(false)
  const [services, setServices] = useState<InfrastructureService[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null)
  const [sectorData, setSectorData] = useState<SectorDashboardResponse | null>(null)
  const [selectedObservation, setSelectedObservation] = useState<SectorObservation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setDataError(null)
    setServices([])
    setIncidents([])
    setSectorData(null)

    fetch(`/api/v1/overview?region=${encodeURIComponent(activeRegion)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`)
        return response.json() as Promise<OverviewResponse>
      })
      .then((overview) => {
        if (cancelled) return
        setServices(overview.services)
        setIncidents(overview.incidents)
        setOverviewData(overview)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDataError(error instanceof Error ? error.message : 'Unable to load situation data.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeRegion])

  useEffect(() => {
    if (activeDashboard === 'overview' || activeDashboard === 'power' || activeDashboard === 'telecom') {
      setSectorData(null)
      setSelectedObservation(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setDataError(null)

    fetch(`/api/v1/sector?region=${encodeURIComponent(activeRegion)}&id=${encodeURIComponent(activeDashboard)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Sector API returned ${response.status}`)
        return response.json() as Promise<SectorDashboardResponse>
      })
      .then((response) => {
        if (cancelled) return
        setSectorData(response)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDataError(error instanceof Error ? error.message : 'Unable to load sector data.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeDashboard, activeRegion])

  const selectedRegion = regions.find((region) => region.id === activeRegion) ?? regions[0]
  const visibleServices = activeDashboard === 'overview'
    ? services
    : services.filter((service) => service.id === activeDashboard)
  const summary = useMemo(() => summarizeStatuses(services, siteConfig.statusSummary), [services])
  const currentDashboard = dashboards.find((dashboard) => dashboard.id === activeDashboard) ?? dashboards[0]
  const isProviderDashboard = activeDashboard === 'power' || activeDashboard === 'telecom'
  const statusCounts = services.reduce(
    (counts, service) => ({ ...counts, [service.status]: counts[service.status] + 1 }),
    { operational: 0, elevated: 0, critical: 0, unknown: 0 },
  )
  const sectorStatus = sectorData?.status ?? 'unknown'
  const sortedIncidents = useMemo(() => [...incidents].sort((left, right) => {
    const severityRank = { critical: 3, elevated: 2 }
    const leftRank = severityRank[left.severity] ?? 1
    const rightRank = severityRank[right.severity] ?? 1
    if (leftRank !== rightRank) return rightRank - leftRank
    return new Date(right.time).getTime() - new Date(left.time).getTime()
  }), [incidents])

  function selectDashboard(id: DashboardId) {
    setActiveDashboard(id)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => selectDashboard('overview')}>
          <span className="brand-mark"><Globe2 size={19} strokeWidth={2} /></span>
          <span>Northwatch<span className="brand-period">.</span></span>
        </a>
        <p className="brand-subtitle">INFRASTRUCTURE MONITOR</p>

        <label className="region-label" htmlFor="region-select">AREA OF INTEREST</label>
        <div className="region-picker">
          <span className="region-flag"><Globe2 size={15} /></span>
          <select id="region-select" value={activeRegion} onChange={(event) => setActiveRegion(event.target.value)}>
            {regions.map((region) => <option key={region.id} value={region.id}>{region.label}</option>)}
          </select>
          <ChevronDown size={15} />
        </div>
        <div className="region-detail">{selectedRegion.detail} <span>·</span> Europe/CET</div>

        <nav className="dashboard-nav" aria-label="Infrastructure dashboards">
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
          <div className="connection-state"><span className="connection-dot" /><span><strong>{isProviderDashboard ? 'Mixed source data' : 'Demo data'}</strong><small>{activeDashboard === 'power' ? 'SMHI observations · ENTSO-E status below' : activeDashboard === 'telecom' ? 'PTS annual data · RIPEstat and IODA live' : 'No live sources connected'}</small></span></div>
          <a className="help-link" href="#data-provenance"><CircleHelp size={16} />Data & methodology</a>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Situation room</span><span className="breadcrumb-divider">/</span><strong>{currentDashboard.label}</strong></div>
          <div className="topbar-actions">
            <span className="demo-indicator"><span /> {isProviderDashboard ? 'MIXED SOURCE DATA' : 'SIMULATED DATA'}</span>
            <button className="icon-button notification-button" type="button" aria-label="Notifications" aria-expanded={showNotifications} onClick={() => setShowNotifications(!showNotifications)}><Bell size={17} /><span /></button>
            <span className="topbar-divider" />
            <time className="updated-at" dateTime={isProviderDashboard ? undefined : '2026-10-09T18:47:00+02:00'}>{isProviderDashboard ? <>Provider timestamps<span>Shown below</span></> : <>09 Oct 2026 <span>18:47 CET</span></>}</time>
            {showNotifications && <div className="notification-popover" role="status"><strong>3 active signals</strong><span>1 critical · 2 elevated</span></div>}
          </div>
        </header>

        <div className="dashboard-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> NORDIC INFRASTRUCTURE PICTURE</div>
              <h1>{activeDashboard === 'overview' ? 'Situation overview' : currentDashboard.label}<span className="heading-period">.</span></h1>
              <p>{activeDashboard === 'power' ? 'Choose a country, bidding zone, and period; source quality and freshness are shown below.' : activeDashboard === 'telecom' ? 'Annual coverage and public routing/outage indicators are shown with their geographic precision and data limits.' : `Coordinated view of essential services across ${selectedRegion.label}.`}</p>
            </div>
            <div className="last-updated"><span className={`live-dot ${isProviderDashboard ? 'muted' : ''}`} />{isProviderDashboard ? 'Provider updates shown below' : <>Demo snapshot <span>·</span> 18:47 CET</>}</div>
          </section>

          {!isProviderDashboard && <section className={`situation-banner ${summary.level}`} aria-label="Overall situation summary">
            <div className="banner-symbol">
              {summary.level === 'critical' ? <AlertTriangle size={21} /> : <Gauge size={21} />}
            </div>
            <div className="banner-copy">
              <span className="banner-overline">CONFIGURABLE SITUATION SUMMARY</span>
              <strong>{summary.label}</strong>
              <span>{summary.description}</span>
            </div>
            <div className="banner-stats">
              <div><strong>{statusCounts.critical}</strong><span>Critical</span></div>
              <div><strong>{statusCounts.elevated}</strong><span>Elevated</span></div>
              <div><strong>{statusCounts.operational}</strong><span>Operational</span></div>
              <div><strong>{statusCounts.unknown}</strong><span>No data</span></div>
            </div>
            <span className="summary-config">{siteConfig.statusSummary.method}</span>
          </section>}
          {dataError && <div className="data-error" role="alert">Situation data is unavailable: {dataError}</div>}

          <section className="section-heading">
            <div><div className="section-kicker">SERVICE HEALTH</div><h2>{activeDashboard === 'overview' ? 'Critical infrastructure' : `${currentDashboard.label} status`}</h2></div>
            <span className="scope-label"><Globe2 size={14} /> {selectedRegion.label}</span>
          </section>

          <section className="service-grid" aria-label="Infrastructure service health">
            {isLoading && <p className="data-message" role="status">Loading situation data…</p>}
            {!isLoading && !dataError && visibleServices.length === 0 && <p className="data-message">No service data is available for this dashboard.</p>}
            {visibleServices.map((service) => {
              const Icon = serviceIcons[service.id]
              return (
                <article className={`service-card ${service.status}`} key={service.id}>
                  <div className="service-card-heading">
                    <span className="service-icon"><Icon size={18} strokeWidth={1.8} /></span>
                    <span className={`status-badge ${service.status}`}><span />{levelLabels[service.status]}</span>
                  </div>
                  <h3>{service.label}</h3>
                  <p className="service-description">{service.description}</p>
                  <div className="service-metric">{service.metric}</div>
                  <div className="service-metric-label">{service.metricLabel}</div>
                  <div className="service-card-footer"><span>{service.category}</span><span>{service.updated}</span></div>
                </article>
              )
            })}
          </section>

          {activeDashboard !== 'overview' && sectorData && (
            <section className="sector-panel" aria-live="polite">
              <div className="sector-panel-header">
                <div>
                  <div className="section-kicker">SECTOR VIEW</div>
                  <h2>{sectorData.label}</h2>
                </div>
                <span className={`status-badge ${sectorStatus}`}><span />{levelLabels[sectorStatus]}</span>
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

              <div className="sector-detail-grid">
                <article className="panel observation-panel">
                  <div className="panel-heading">
                    <div><div className="section-kicker">OBSERVATIONS</div><h2>Operational signal stream</h2></div>
                    <span className="incident-count">{sectorData.observations.length} items</span>
                  </div>
                  <div className="observation-list">
                    {sectorData.observations.map((observation) => (
                      <button
                        key={observation.id}
                        className="observation-row"
                        type="button"
                        onClick={() => setSelectedObservation(observation)}
                      >
                        <span className={`incident-severity ${observation.severity}`}><AlertTriangle size={14} /></span>
                        <span className="observation-copy">
                          <span className="observation-meta">
                            <span className={`incident-tag ${observation.severity}`}>{observationKindLabels[observation.kind]}</span>
                            <span className="incident-service">{observation.source}</span>
                          </span>
                          <strong>{observation.title}</strong>
                          <small>{observation.summary}</small>
                        </span>
                        <span className="observation-side">
                          <span className="quality-pill">{observationQualityLabels[observation.quality]}</span>
                          <span>{observation.timestamp}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="panel source-panel" id="data-provenance">
                  <div className="section-kicker">SOURCE QUALITY</div>
                  <h2>Connected data sources</h2>
                  <p>{sectorData.qualityNote}</p>
                  <ul className="source-list">
                    <li><span>Primary feed</span><strong>Official API / RSS</strong></li>
                    <li><span>Update cadence</span><strong>Every 5–15 minutes</strong></li>
                    <li><span>Validation</span><strong>Demo mode; verification required</strong></li>
                    <li><span>Problem handling</span><strong>Stale and missing values are flagged</strong></li>
                  </ul>
                  <a className="source-link" href="/api/v1/overview?region=se" rel="noreferrer" target="_blank">Inspect demo API response <ArrowUpRight size={14} /></a>
                </article>
              </div>
            </section>
          )}

          {activeDashboard === 'power' && <Suspense fallback={<p className="data-message" role="status">Loading energy dashboard…</p>}><EnergyDashboard /></Suspense>}
          {activeDashboard === 'telecom' && <Suspense fallback={<p className="data-message" role="status">Loading telecom sources…</p>}><TelecomDashboard region={activeRegion} /></Suspense>}

          {activeDashboard === 'overview' && overviewData && (
            <>
              <section className="overview-aggregate-grid" aria-label="Cross-sector infrastructure overview">
                <article className="panel map-panel">
                  <div className="panel-heading">
                    <div><div className="section-kicker">GEOGRAPHY</div><h2>Nordic and European view</h2></div>
                    <span className="incident-count">{overviewData.mapRegions.length} regions</span>
                  </div>
                  <svg viewBox="0 0 420 260" className="map-svg" aria-label="Map of Nordic region and Europe">
                    <rect x="0" y="0" width="420" height="260" fill="#f5f7f3" rx="12" />
                    <path d="M70 80 L120 50 L192 58 L235 85 L208 125 L175 145 L120 138 L78 110 Z" fill="#edf2ed" stroke="#d5ddd5" strokeWidth="1.5" />
                    <path d="M205 52 L258 69 L295 102 L276 142 L224 152 L196 120 Z" fill="#edf2ed" stroke="#d5ddd5" strokeWidth="1.5" />
                    <path d="M155 150 L185 175 L210 195 L188 228 L146 221 L130 186 Z" fill="#edf2ed" stroke="#d5ddd5" strokeWidth="1.5" />
                    <path d="M300 165 L332 173 L352 186 L343 203 L314 208 L301 192 Z" fill="#edf2ed" stroke="#d5ddd5" strokeWidth="1.5" />
                    {overviewData.mapRegions.map((region) => (
                      <g key={region.id}>
                        <rect
                          x={region.x}
                          y={region.y}
                          width={region.width}
                          height={region.height}
                          rx="8"
                          fill={region.status === 'critical' ? '#f3e4df' : region.status === 'elevated' ? '#f7ead7' : region.status === 'unknown' ? '#f0f2ef' : '#ebf0eb'}
                          stroke={region.status === 'critical' ? '#c36d60' : region.status === 'elevated' ? '#cc9340' : '#c9d1ca'}
                          strokeWidth="1.5"
                        />
                        <text x={region.x + region.width / 2} y={region.y + region.height / 2 + 4} textAnchor="middle" fontSize="10" fill="#45514a" fontWeight="700">{region.label}</text>
                      </g>
                    ))}
                  </svg>
                </article>

                <article className="panel sector-summary-panel">
                  <div className="section-kicker">SECTOR STATUS</div>
                  <h2>Cross-sector overview</h2>
                  <div className="sector-summary-list">
                    {overviewData.sectors.map((sector) => (
                      <div className="sector-summary-row" key={sector.id}>
                        <div>
                          <strong>{sector.label}</strong>
                          <small>{sector.summary}</small>
                        </div>
                        <span className={`status-badge ${sector.status}`}><span />{sector.value}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="timeline-source-grid">
                <article className="panel timeline-panel">
                  <div className="panel-heading">
                    <div><div className="section-kicker">TIMELINE</div><h2>Event history</h2></div>
                    <span className="incident-count">{overviewData.timeline.length} events</span>
                  </div>
                  <div className="timeline-list">
                    {overviewData.timeline.map((event) => (
                      <div key={event.id} className="timeline-item">
                        <span className={`incident-severity ${event.severity}`}><AlertTriangle size={13} /></span>
                        <div>
                          <strong>{event.title}</strong>
                          <small>{event.source} · {event.category}</small>
                        </div>
                        <time>{event.time}</time>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="panel source-panel" id="data-provenance">
                  <div className="section-kicker">SOURCE STATUS</div>
                  <h2>Source health and freshness</h2>
                  <div className="source-status-list">
                    {overviewData.sources.map((source) => (
                      <div key={source.id} className="source-status-row">
                        <div>
                          <strong>{source.label}</strong>
                          <small>{source.category}</small>
                        </div>
                        <div className="source-status-meta">
                          <span className={`status-badge ${source.status === 'ok' ? 'operational' : source.status === 'not_configured' ? 'unknown' : source.status === 'stale' ? 'elevated' : 'critical'}`}><span />{source.status === 'ok' ? 'OK' : source.status === 'not_configured' ? 'Not configured' : source.status === 'stale' ? 'Stale' : source.status === 'warning' ? 'Warning' : 'Error'}</span>
                          <small>{source.lastSuccessfulUpdate}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <a className="source-link" href="/api/v1/overview?region=se" rel="noreferrer" target="_blank">Inspect demo API response <ArrowUpRight size={14} /></a>
                </article>
              </section>
            </>
          )}

          {activeDashboard !== 'power' && activeDashboard !== 'telecom' && <section className="lower-grid">
            <article className="panel incident-panel">
              <div className="panel-heading">
                <div><div className="section-kicker">NEEDS ATTENTION</div><h2>Active incidents & advisories</h2></div>
                <span className="incident-count">{sortedIncidents.length} active</span>
              </div>
              <div className="incident-list">
                {sortedIncidents.map((incident) => (
                  <div className="incident-row" key={`${incident.title}-${incident.time}`}>
                    <span className={`incident-severity ${incident.severity}`}><AlertTriangle size={15} /></span>
                    <div className="incident-main"><div><span className={`incident-tag ${incident.severity}`}>{levelLabels[incident.severity]}</span><span className="incident-service">{incident.service}</span></div><strong>{incident.title}</strong><span className="incident-note">{incident.note}</span></div>
                    <div className="incident-location">{incident.location}<span>{new Date(incident.time).toLocaleString('sv-SE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span></div>
                  </div>
                ))}
                {sortedIncidents.length === 0 && <p className="data-message">No incident feeds are connected for this area.</p>}
              </div>
            </article>

            <article className="panel source-panel" id="data-provenance">
              <div className="section-kicker">DATA PROVENANCE</div>
              <h2>Source connectivity</h2>
              <p>Connect trusted national and European feeds through the backend integration layer.</p>
              <div className="source-meter"><div><span>Connected sources</span><strong>{overviewData?.sources.filter((source) => source.status === 'ok').length ?? 0} <small>/ {overviewData?.sources.length ?? 0} domains</small></strong></div><span className="meter-track"><i style={{ width: `${Math.max(10, ((overviewData?.sources.filter((source) => source.status === 'ok').length ?? 0) / (overviewData?.sources.length || 1)) * 100)}%` }} /></span></div>
              <a className="source-link" href="/api/v1/overview?region=se" rel="noreferrer" target="_blank">Inspect demo API response <ArrowUpRight size={14} /></a>
            </article>
          </section>}

          {selectedObservation && (
            <div className="detail-sheet" role="dialog" aria-modal="true" aria-label={selectedObservation.title}>
              <div className="detail-sheet-card">
                <div className="panel-heading detail-header">
                  <div>
                    <div className="section-kicker">DETAIL VIEW</div>
                    <h2>{selectedObservation.title}</h2>
                  </div>
                  <button type="button" className="icon-button" onClick={() => setSelectedObservation(null)} aria-label="Close detail view">×</button>
                </div>

                <div className="detail-body">
                  <div className="detail-badges">
                    <span className={`incident-tag ${selectedObservation.severity}`}>{observationKindLabels[selectedObservation.kind]}</span>
                    <span className="quality-pill">{observationQualityLabels[selectedObservation.quality]}</span>
                  </div>
                  <p>{selectedObservation.summary}</p>
                  <dl className="detail-meta">
                    <div><dt>Source</dt><dd>{selectedObservation.source}</dd></div>
                    <div><dt>Location</dt><dd>{selectedObservation.location}</dd></div>
                    <div><dt>Timestamp</dt><dd>{selectedObservation.timestamp}</dd></div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          <footer className="page-footer"><span>Situational awareness · not an operational control system</span><span>Source data must be verified before operational use.</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
