import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  ExternalLink,
  Info,
  Layers,
  MapPin,
  Newspaper,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Waves,
  X,
  Zap,
} from 'lucide-react'
import type {
  EventClassificationKind,
  EventClusterItem,
  EventSectorKind,
  EventSeverityKind,
  EventsDashboardResponse,
} from './services/eventsTypes'

interface WorldEventsDashboardProps {
  initialRegion?: string
}

const SECTOR_LABELS: Record<EventSectorKind, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  energy: { label: 'Energi & elnät', icon: Zap },
  telecom: { label: 'Telekom & fiber', icon: Radio },
  transport: { label: 'Transport & trafik', icon: Truck },
  cyber: { label: 'Cybersäkerhet', icon: ShieldAlert },
  nature: { label: 'Natur & katastrof', icon: Waves },
  'cross-sector': { label: 'Tvärsektoriell', icon: Layers },
}

const CLASSIFICATION_CONFIG: Record<
  EventClassificationKind,
  {
    label: string
    badgeClass: string
    borderClass: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    disclaimer: string
  }
> = {
  authority: {
    label: 'Myndighetsinformation',
    badgeClass: 'badge-authority',
    borderClass: 'border-authority',
    icon: Building2,
    disclaimer: 'Officiell varning eller meddelande från behörig myndighet / CSIRT.',
  },
  news: {
    label: 'Nyhetsrapportering',
    badgeClass: 'badge-news',
    borderClass: 'border-news',
    icon: Newspaper,
    disclaimer: 'Medierapportering. Utgör ej en automatiskt verifierad infrastrukturincident.',
  },
  unconfirmed: {
    label: 'Obekräftade uppgifter',
    badgeClass: 'badge-unconfirmed',
    borderClass: 'border-unconfirmed',
    icon: AlertTriangle,
    disclaimer: 'Preliminär signal eller mediarapport baserad på obekräftade källor.',
  },
}

const SEVERITY_CONFIG: Record<EventSeverityKind, { label: string; badgeClass: string }> = {
  critical: { label: 'Kritisk', badgeClass: 'severity-critical' },
  elevated: { label: 'Förhöjd risk', badgeClass: 'severity-elevated' },
  notice: { label: 'Information', badgeClass: 'severity-notice' },
}

const REGION_LABELS: Record<string, string> = {
  all: 'Alla regioner',
  SE: 'Sverige',
  nordics: 'Norden',
  europe: 'Europa',
  global: 'Globalt',
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

export default function WorldEventsDashboard({ initialRegion = 'all' }: WorldEventsDashboardProps) {
  const [data, setData] = useState<EventsDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [selectedRegion, setSelectedRegion] = useState<string>(initialRegion)
  const [selectedClassification, setSelectedClassification] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isGrouped, setIsGrouped] = useState<boolean>(true)

  // Detail Modal & Expanded Clusters
  const [selectedEvent, setSelectedEvent] = useState<EventClusterItem | null>(null)
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({})

  async function fetchData(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        sector: selectedSector,
        region: selectedRegion,
        classification: selectedClassification,
        severity: selectedSeverity,
        search: searchQuery,
        grouped: String(isGrouped),
      })
      if (forceRefresh) {
        params.append('refresh', 'true')
      }

      const res = await fetch(`/api/v1/events?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Kunde inte ladda händelsedata (HTTP ${res.status})`)
      }
      const json: EventsDashboardResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett oväntat fel uppstod.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedSector, selectedRegion, selectedClassification, selectedSeverity, isGrouped])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    fetchData()
  }

  function toggleExpandCluster(clusterId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedClusters((prev) => ({
      ...prev,
      [clusterId]: !prev[clusterId],
    }))
  }

  return (
    <div className="dashboard-content" role="region" aria-label="Omvärldshändelser Dashboard">
      {/* Header bar */}
      <div className="world-events-header">
        <div>
          <div className="section-kicker">OMVÄRLDSBEVAKNING</div>
          <h1>Omvärldshändelser & Infrastrukturpåverkan</h1>
          <p className="dashboard-lead">
            Aggregerad lägesbild för Sverige, Norden och Europa. Samkör myndighetsvarningar från CERT-SE, GDACS och EU
            Civilskydd (ERCC) med global nyhetsrapportering (GDELT).
          </p>
        </div>
        <div className="header-actions">
          <div className="refresh-status">
            <span className="live-pill">
              <span className="live-dot" /> LIVE FEED
            </span>
            {data?.updatedAt && (
              <small className="updated-text">
                Synkad: {formatDate(data.updatedAt)}
              </small>
            )}
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => fetchData(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} />
            {refreshing ? 'Uppdaterar…' : 'Uppdatera flöden'}
          </button>
        </div>
      </div>

      {/* Disambiguation & Classification Rules Banner */}
      <section className="classification-rules-banner" aria-label="Klassificeringsprinciper">
        <div className="rule-badge-item">
          <span className="rule-pill rule-pill-authority">
            <Building2 size={13} /> Myndighetsinformation
          </span>
          <span>Auktoritativa varningar från CERT-SE (MSB), GDACS och EU:s civilskyddsmekanism.</span>
        </div>
        <div className="rule-badge-item">
          <span className="rule-pill rule-pill-news">
            <Newspaper size={13} /> Nyhetsrapportering
          </span>
          <span>
            Mediebevakning via GDELT DOC API. <em>Utgör inte en verifierad incident.</em>
          </span>
        </div>
        <div className="rule-badge-item">
          <span className="rule-pill rule-pill-unconfirmed">
            <AlertTriangle size={13} /> Obekräftade uppgifter
          </span>
          <span>Preliminära uppgifter eller mediauppgifter baserade på anonyma källor.</span>
        </div>
      </section>

      {/* KPI Cards */}
      {data?.kpis && (
        <section className="kpi-grid-container" aria-label="Nyckeltal omvärldshändelser">
          {data.kpis.map((kpi) => (
            <div className="kpi-card" key={kpi.label}>
              <div className="kpi-top">
                <span className="kpi-label">{kpi.label}</span>
                <span className={`kpi-status-dot ${kpi.status}`} />
              </div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-detail">{kpi.detail}</div>
            </div>
          ))}
        </section>
      )}

      {/* Interactive Filter Toolbar */}
      <section className="filter-toolbar" aria-label="Filter och sökning">
        <form onSubmit={handleSearchSubmit} className="search-box-form">
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Sök på händelse, källa, nyckelord (t.ex. sjökabel, elnät, storm)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-button"
                onClick={() => {
                  setSearchQuery('')
                  setTimeout(() => fetchData(), 50)
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button type="submit" className="primary-button filter-submit-button">
            Sök
          </button>
        </form>

        <div className="filters-row">
          {/* Sector filter */}
          <div className="filter-group">
            <label htmlFor="filter-sector">Sektor:</label>
            <select
              id="filter-sector"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="filter-select"
            >
              <option value="all">Alla sektorer</option>
              <option value="energy">Energi & elnät</option>
              <option value="telecom">Telekom & fiber</option>
              <option value="transport">Transport & trafik</option>
              <option value="cyber">Cybersäkerhet</option>
              <option value="nature">Natur & katastrof</option>
              <option value="cross-sector">Tvärsektoriell</option>
            </select>
          </div>

          {/* Region filter */}
          <div className="filter-group">
            <label htmlFor="filter-region">Geografiskt område:</label>
            <select
              id="filter-region"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="filter-select"
            >
              <option value="all">Alla områden</option>
              <option value="SE">Sverige (SE)</option>
              <option value="nordics">Norden</option>
              <option value="europe">Europa</option>
              <option value="global">Globalt</option>
            </select>
          </div>

          {/* Classification filter */}
          <div className="filter-group">
            <label htmlFor="filter-classification">Klassificering:</label>
            <select
              id="filter-classification"
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="filter-select"
            >
              <option value="all">Alla källtyper</option>
              <option value="authority">Myndighetsinformation</option>
              <option value="news">Nyhetsrapportering</option>
              <option value="unconfirmed">Obekräftade uppgifter</option>
            </select>
          </div>

          {/* Severity filter */}
          <div className="filter-group">
            <label htmlFor="filter-severity">Allvarlighetsgrad:</label>
            <select
              id="filter-severity"
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="filter-select"
            >
              <option value="all">Alla nivåer</option>
              <option value="critical">Kritisk</option>
              <option value="elevated">Förhöjd risk</option>
              <option value="notice">Information / Varning</option>
            </select>
          </div>

          {/* Grouping switch */}
          <div className="grouping-toggle-container">
            <button
              type="button"
              className={`toggle-view-button ${isGrouped ? 'active' : ''}`}
              onClick={() => setIsGrouped(true)}
              title="Gruppera liknande mediarapporter om samma händelse i kluster"
            >
              <Layers size={13} /> Grupperade kluster
            </button>
            <button
              type="button"
              className={`toggle-view-button ${!isGrouped ? 'active' : ''}`}
              onClick={() => setIsGrouped(false)}
              title="Visa alla enskilda källartiklar separat"
            >
              Alla källartiklar
            </button>
          </div>
        </div>
      </section>

      {/* Loading & Error States */}
      {loading && !data && (
        <div className="loading-box" role="status">
          <div className="spinner" />
          <p>Laddar omvärldshändelser från CERT-SE, GDACS, EU Civilskydd och GDELT…</p>
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchData()} className="retry-button">
            Försök igen
          </button>
        </div>
      )}

      {/* Events List / Timeline */}
      {data && (
        <section className="events-feed-section" aria-label="Flöde med omvärldshändelser">
          <div className="feed-header-line">
            <h2>
              Händelseflöde{' '}
              <span className="count-pill">
                {data.displayedCount} {isGrouped ? 'händelser' : 'artiklar'}
                {isGrouped && data.deduplicatedCount > 0 && ` (${data.deduplicatedCount} dubbletter grupperade)`}
              </span>
            </h2>
          </div>

          {data.items.length === 0 ? (
            <div className="empty-feed-card">
              <Info size={24} />
              <p>Inga omvärldshändelser matchade de valda filtren.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedSector('all')
                  setSelectedRegion('all')
                  setSelectedClassification('all')
                  setSelectedSeverity('all')
                  setSearchQuery('')
                }}
              >
                Återställ filter
              </button>
            </div>
          ) : (
            <div className="events-card-list">
              {data.items.map((item) => {
                const classConfig = CLASSIFICATION_CONFIG[item.classification] || CLASSIFICATION_CONFIG.news
                const sevConfig = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.notice
                const sectorInfo = SECTOR_LABELS[item.sector] || SECTOR_LABELS['cross-sector']
                const SectorIcon = sectorInfo.icon
                const ClassIcon = classConfig.icon
                const isExpanded = !!expandedClusters[item.id]

                return (
                  <article
                    key={item.id}
                    className={`event-card ${classConfig.borderClass}`}
                    onClick={() => setSelectedEvent(item)}
                  >
                    <div className="event-card-topbar">
                      <div className="badges-cluster">
                        {/* Classification badge */}
                        <span className={`classification-badge ${classConfig.badgeClass}`}>
                          <ClassIcon size={12} /> {classConfig.label}
                        </span>

                        {/* Severity badge */}
                        <span className={`severity-badge ${sevConfig.badgeClass}`}>
                          {sevConfig.label}
                        </span>

                        {/* Sector badge */}
                        <span className="sector-tag">
                          <SectorIcon size={12} /> {sectorInfo.label}
                        </span>

                        {/* Region/Country badge */}
                        <span className="geo-badge">
                          <MapPin size={11} /> {item.country || REGION_LABELS[item.region] || item.region}
                        </span>
                      </div>

                      {/* Clustered multi-source tag */}
                      {item.isGrouped && item.sourcesCount > 1 && (
                        <button
                          type="button"
                          className="multi-source-toggle-btn"
                          onClick={(e) => toggleExpandCluster(item.id, e)}
                          title="Visa alla rapporterande mediekällor"
                        >
                          <Newspaper size={12} /> {item.sourcesCount} källor
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>

                    <h3 className="event-card-title">{item.title}</h3>

                    <p className="event-card-summary">{item.summary}</p>

                    {/* Metadata line: Timestamps and Source */}
                    <div className="event-card-metadata">
                      <div className="meta-times">
                        <span className="meta-time-item" title="Tidpunkt då händelsen publicerades av källan">
                          <Calendar size={12} />
                          <strong>Publicerad:</strong> {formatDate(item.firstPublishedAt || item.publishedAt)}
                        </span>
                        <span className="meta-time-item" title="Tidpunkt då uppgiften hämtades in i Infrastructure Watch">
                          <Clock size={12} />
                          <strong>Hämtad:</strong> {formatDate(item.fetchedAt)}
                        </span>
                      </div>

                      <div className="meta-source-info">
                        <span className="source-name-badge">
                          Källa: <strong>{item.primarySource}</strong>
                        </span>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="direct-source-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Öppna originalkälla <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Expanded Cluster Sources Drawer ("utan att källorna döljs") */}
                    {isExpanded && item.sources && item.sources.length > 0 && (
                      <div
                        className="cluster-sources-drawer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Alla källartiklar i klustret"
                      >
                        <div className="drawer-header">
                          <Newspaper size={13} />
                          <span>Samtliga {item.sources.length} rapporterande källor och artiklar:</span>
                        </div>
                        <div className="drawer-sources-list">
                          {item.sources.map((src) => (
                            <div className="drawer-source-item" key={src.id || src.url}>
                              <div className="drawer-source-top">
                                <span className="outlet-name">
                                  {src.outletDomain || src.source}
                                </span>
                                <span className="drawer-time">{formatDate(src.publishedAt)}</span>
                              </div>
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                className="drawer-article-link"
                              >
                                {src.title} <ExternalLink size={10} />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Sources Provenance & Technical Access Documentation */}
      {data?.sources && (
        <section className="sources-provenance-panel" aria-label="Datakällor och metodik">
          <div className="panel-headline">
            <div>
              <div className="section-kicker">KÄLLINTEGRATION & METODIK</div>
              <h2>Aktualitet och åtkomstvillkor för omvärldsdata</h2>
            </div>
          </div>

          <p className="provenance-intro">
            Infrastructure Watch skiljer strikt mellan myndighetsbeslut, meteorologiska observationer och redaktionell
            nyhetsrapportering. En nyhetsartikel utgör aldrig i sig ett bevis på en bekräftad cyber- eller fysisk
            infrastrukturincident.
          </p>

          <div className="source-cards-grid">
            {data.sources.map((src) => (
              <div className={`source-status-card ${src.status}`} key={src.id}>
                <div className="source-card-header">
                  <div>
                    <h4>{src.label}</h4>
                    <span className="source-type-pill">{src.type}</span>
                  </div>
                  <span className={`status-indicator-pill ${src.status}`}>
                    {src.status === 'ok'
                      ? 'Operativ'
                      : src.status === 'warning'
                      ? 'Kvotvarning'
                      : src.status === 'stale'
                      ? 'Cachad'
                      : 'Fel'}
                  </span>
                </div>

                <p className="source-message">{src.message}</p>

                <div className="source-specs">
                  <div className="spec-row">
                    <span>Täckning:</span>
                    <strong>{src.coverage}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Åtkomst:</span>
                    <strong>{src.rateLimitInfo}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Senast synkad:</span>
                    <strong>{formatDate(src.lastFetched)}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Aktiva poster:</span>
                    <strong>{src.itemsCount} st</strong>
                  </div>
                </div>

                <div className="source-card-actions">
                  <a href={src.url} target="_blank" rel="noreferrer" className="subtle-link">
                    Rådataflöde <ExternalLink size={10} />
                  </a>
                  <a href={src.docUrl} target="_blank" rel="noreferrer" className="subtle-link">
                    Dokumentation <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Detail Modal */}
      {selectedEvent && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={() => setSelectedEvent(null)}
        >
          <div className="modal-dialog event-detail-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-topline">
                <span
                  className={`classification-badge ${
                    CLASSIFICATION_CONFIG[selectedEvent.classification]?.badgeClass
                  }`}
                >
                  {CLASSIFICATION_CONFIG[selectedEvent.classification]?.label}
                </span>
                <span
                  className={`severity-badge ${
                    SEVERITY_CONFIG[selectedEvent.severity]?.badgeClass
                  }`}
                >
                  {SEVERITY_CONFIG[selectedEvent.severity]?.label}
                </span>
                <span className="geo-badge">
                  <MapPin size={11} /> {selectedEvent.country}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedEvent(null)}
                aria-label="Stäng modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <h2 id="modal-title" className="modal-event-title">
                {selectedEvent.title}
              </h2>

              <p className="modal-event-summary">{selectedEvent.summary}</p>

              {/* Classification methodology note */}
              <div className="detail-box methodology-box">
                <div className="box-title">
                  <ShieldCheck size={14} /> Klassificering och källtillförlitlighet
                </div>
                <p>
                  <strong>{CLASSIFICATION_CONFIG[selectedEvent.classification]?.label}:</strong>{' '}
                  {CLASSIFICATION_CONFIG[selectedEvent.classification]?.disclaimer}
                </p>
                <small className="methodology-text">{selectedEvent.originalMethodology}</small>
              </div>

              {/* Timing Comparison */}
              <div className="detail-box time-box">
                <div className="box-title">
                  <Clock size={14} /> Tidslinje och observationstid
                </div>
                <div className="time-comparison-grid">
                  <div>
                    <span className="time-label">Händelse- / Publiceringstid:</span>
                    <strong>{formatDate(selectedEvent.firstPublishedAt || selectedEvent.publishedAt)}</strong>
                  </div>
                  <div>
                    <span className="time-label">Hämtad & verifierad i systemet:</span>
                    <strong>{formatDate(selectedEvent.fetchedAt)}</strong>
                  </div>
                </div>
              </div>

              {/* Coordinates if available */}
              {selectedEvent.coordinates && (
                <div className="detail-box coords-box">
                  <div className="box-title">
                    <Compass size={14} /> Geografisk position
                  </div>
                  <p>
                    Lat: <code>{selectedEvent.coordinates.lat.toFixed(4)}</code>, Lon:{' '}
                    <code>{selectedEvent.coordinates.lon.toFixed(4)}</code> ({selectedEvent.country})
                  </p>
                </div>
              )}

              {/* Contributing Sources List */}
              <div className="detail-box sources-box">
                <div className="box-title">
                  <Newspaper size={14} /> Rapporterande källor ({selectedEvent.sources?.length || 1})
                </div>
                <div className="modal-sources-list">
                  {(selectedEvent.sources && selectedEvent.sources.length > 0
                    ? selectedEvent.sources
                    : [
                        {
                          id: selectedEvent.id,
                          url: selectedEvent.url,
                          source: selectedEvent.primarySource,
                          outletDomain: selectedEvent.primarySource,
                          publishedAt: selectedEvent.firstPublishedAt || selectedEvent.publishedAt || selectedEvent.lastPublishedAt,
                          title: selectedEvent.title,
                        },
                      ]
                  ).map((src) => (
                    <div className="modal-source-row" key={src.id || src.url}>
                      <div>
                        <strong>{src.outletDomain || src.source}</strong>
                        <span className="source-time-stamp">{formatDate(src.publishedAt)}</span>
                        <div className="source-headline">{src.title}</div>
                      </div>
                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="primary-button open-article-btn"
                        >
                          Öppna källa <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedEvent(null)}
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
