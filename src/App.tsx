import { useEffect, useMemo, useState } from 'react'
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

type OverviewResponse = {
  mode: 'demo'
  services: InfrastructureService[]
  incidents: Incident[]
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

function App() {
  const [activeDashboard, setActiveDashboard] = useState<DashboardId>('overview')
  const [activeRegion, setActiveRegion] = useState('se')
  const [showNotifications, setShowNotifications] = useState(false)
  const [services, setServices] = useState<InfrastructureService[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setDataError(null)
    setServices([])
    setIncidents([])

    fetch(`/api/v1/overview?region=${encodeURIComponent(activeRegion)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`)
        return response.json() as Promise<OverviewResponse>
      })
      .then((overview) => {
        if (cancelled) return
        setServices(overview.services)
        setIncidents(overview.incidents)
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
  const selectedRegion = regions.find((region) => region.id === activeRegion) ?? regions[0]
  const visibleServices = activeDashboard === 'overview'
    ? services
    : services.filter((service) => service.id === activeDashboard)
  const summary = useMemo(() => summarizeStatuses(services, siteConfig.statusSummary), [services])
  const currentDashboard = dashboards.find((dashboard) => dashboard.id === activeDashboard) ?? dashboards[0]
  const statusCounts = services.reduce(
    (counts, service) => ({ ...counts, [service.status]: counts[service.status] + 1 }),
    { operational: 0, elevated: 0, critical: 0, unknown: 0 },
  )

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
          <div className="connection-state"><span className="connection-dot" /><span><strong>Demo data</strong><small>No live sources connected</small></span></div>
          <a className="help-link" href="#data-provenance"><CircleHelp size={16} />Data & methodology</a>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Situation room</span><span className="breadcrumb-divider">/</span><strong>{currentDashboard.label}</strong></div>
          <div className="topbar-actions">
            <span className="demo-indicator"><span /> SIMULATED DATA</span>
            <button className="icon-button notification-button" type="button" aria-label="Notifications" aria-expanded={showNotifications} onClick={() => setShowNotifications(!showNotifications)}><Bell size={17} /><span /></button>
            <span className="topbar-divider" />
            <time className="updated-at" dateTime="2026-10-09T18:47:00+02:00">09 Oct 2026 <span>18:47 CET</span></time>
            {showNotifications && <div className="notification-popover" role="status"><strong>3 active signals</strong><span>1 critical · 2 elevated</span></div>}
          </div>
        </header>

        <div className="dashboard-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> NORDIC INFRASTRUCTURE PICTURE</div>
              <h1>{activeDashboard === 'overview' ? 'Situation overview' : currentDashboard.label}<span className="heading-period">.</span></h1>
              <p>Coordinated view of essential services across {selectedRegion.label}.</p>
            </div>
            <div className="last-updated"><span className="live-dot" /> Demo snapshot <span>·</span> 18:47 CET</div>
          </section>

          <section className={`situation-banner ${summary.level}`} aria-label="Overall situation summary">
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
          </section>
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

          <section className="lower-grid">
            <article className="panel incident-panel">
              <div className="panel-heading">
                <div><div className="section-kicker">NEEDS ATTENTION</div><h2>Active incidents & advisories</h2></div>
                <span className="incident-count">{incidents.length} active</span>
              </div>
              <div className="incident-list">
                {incidents.map((incident) => (
                  <div className="incident-row" key={incident.title}>
                    <span className={`incident-severity ${incident.severity}`}><AlertTriangle size={15} /></span>
                    <div className="incident-main"><div><span className={`incident-tag ${incident.severity}`}>{levelLabels[incident.severity]}</span><span className="incident-service">{incident.service}</span></div><strong>{incident.title}</strong><span className="incident-note">{incident.note}</span></div>
                    <div className="incident-location">{incident.location}<span>{incident.time} CET</span></div>
                  </div>
                ))}
                {incidents.length === 0 && <p className="data-message">No incident feeds are connected for this area.</p>}
              </div>
            </article>

            <article className="panel source-panel" id="data-provenance">
              <div className="section-kicker">DATA PROVENANCE</div>
              <h2>Source connectivity</h2>
              <p>Connect trusted national and European feeds through the backend integration layer.</p>
              <div className="source-meter"><div><span>Connected sources</span><strong>0 <small>/ 11 domains</small></strong></div><span className="meter-track"><i /></span></div>
              <a className="source-link" href="/api/v1/overview?region=se" rel="noreferrer" target="_blank">Inspect demo API response <ArrowUpRight size={14} /></a>
            </article>
          </section>

          <footer className="page-footer"><span>Situational awareness · not an operational control system</span><span>Source data must be verified before operational use.</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
