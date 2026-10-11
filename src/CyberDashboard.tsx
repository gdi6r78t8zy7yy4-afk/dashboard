import React, { useEffect, useMemo, useState } from 'react'
import type {
  CyberDashboardResponse,
  TimelineEvent,
  CisaKevItem,
  NvdCveItem,
  MitreTechnique,
  CyberCveDetail,
  CertAdvisoryItem,
  MispIndicatorItem,
} from './services/cyberTypes'

interface CyberDashboardProps {
  onBackToOverview?: () => void
}

type CyberTab = 'timeline' | 'cert' | 'cisa' | 'nvd' | 'mitre' | 'misp' | 'sources'

export const CyberDashboard: React.FC<CyberDashboardProps> = ({ onBackToOverview }) => {
  const [data, setData] = useState<CyberDashboardResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string>('')
  const [classificationFilter, setClassificationFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<CyberTab>('timeline')
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [selectedCveId, setSelectedCveId] = useState<string | null>(null)
  const [detailedCve, setDetailedCve] = useState<CyberCveDetail | null>(null)
  const [loadingDetailedCve, setLoadingDetailedCve] = useState<boolean>(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (classificationFilter !== 'all') params.set('classification', classificationFilter)
      if (severityFilter !== 'all') params.set('severity', severityFilter)
      const res = await fetch(`/api/v1/cyber?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Kunde inte ladda cyberdata (status ${res.status})`)
      }
      const json: CyberDashboardResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett oväntat fel uppstod.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [classificationFilter, severityFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData()
  }

  const handleSelectCve = async (cveId: string) => {
    setSelectedCveId(cveId)
    setLoadingDetailedCve(true)
    try {
      const res = await fetch(`/api/v1/cyber/cve/${encodeURIComponent(cveId)}`)
      if (res.ok) {
        const details: CyberCveDetail = await res.json()
        setDetailedCve(details)
      } else {
        setDetailedCve(null)
      }
    } catch {
      setDetailedCve(null)
    } finally {
      setLoadingDetailedCve(false)
    }
  }

  const filteredEvents = useMemo(() => {
    if (!data?.timeline) return []
    return data.timeline.filter((ev: TimelineEvent) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchTitle = ev.title.toLowerCase().includes(q)
        const matchDesc = (ev.summary || '').toLowerCase().includes(q)
        const matchCve = ev.cves?.some((c) => c.toLowerCase().includes(q))
        const matchSrc = ev.source.toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchCve && !matchSrc) return false
      }
      return true
    })
  }, [data?.timeline, search])

  const filteredCisaItems = useMemo(() => {
    if (!data?.cisaKev?.items) return []
    if (!search.trim()) return data.cisaKev.items
    const q = search.toLowerCase()
    return data.cisaKev.items.filter(
      (item: CisaKevItem) =>
        item.cveID.toLowerCase().includes(q) ||
        item.vendor.toLowerCase().includes(q) ||
        item.product.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
    )
  }, [data?.cisaKev?.items, search])

  const filteredNvdItems = useMemo(() => {
    if (!data?.nvdCves?.items) return []
    if (!search.trim()) return data.nvdCves.items
    const q = search.toLowerCase()
    return data.nvdCves.items.filter(
      (cve: NvdCveItem) =>
        cve.cveId.toLowerCase().includes(q) ||
        cve.description.toLowerCase().includes(q) ||
        cve.vulnStatus.toLowerCase().includes(q)
    )
  }, [data?.nvdCves?.items, search])

  return (
    <div className="cyber-dashboard" data-testid="cyber-dashboard">
      {/* Header bar */}
      <section className="cyber-header-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {onBackToOverview && (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={onBackToOverview}
                  style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                >
                  ← Tillbaka
                </button>
              )}
              <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#1d2a20' }}>
                Cyberhot & Sårbarhetsbevakning
              </h1>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#455546', fontSize: '0.9rem' }}>
              Auktoritativa källor för nationella varningar, aktivt utnyttjade sårbarheter och hotindikatorer i kritisk infrastruktur.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="ghost-button"
              onClick={fetchData}
              disabled={loading}
              style={{ fontSize: '0.85rem' }}
            >
              {loading ? 'Hämtar data...' : '↻ Uppdatera källor'}
            </button>
          </div>
        </div>

        {/* 5-Tier Classification Separation Notice */}
        <div className="cyber-classification-banner">
          <div className="cyber-classification-title">
            <span>🛡️</span>
            <span>Auktoritativ klassificeringsmodell enligt gällande riktlinjer:</span>
          </div>
          <p className="cyber-classification-text">
            Information hålls strikt åtskild mellan 5 nivåer för att förhindra falska antaganden:
            <strong> En CVE med hög CVSS-poäng innebär inte att en svensk organisation har angripits.</strong> En post i CISA KEV innebär inte automatiskt att sårbarheten utnyttjas i Sverige. Observerade hotindikatorer och bekräftade incidenter separeras konsekvent från allmänna varningar och riskbedömningar.
          </p>
          <div className="cyber-tiers-pills">
            <span className="cyber-tier-pill tier-1">Nivå 1: Publicerad varning (CERT-SE m.fl.)</span>
            <span className="cyber-tier-pill tier-2">Nivå 2: Känd exploatering (CISA KEV)</span>
            <span className="cyber-tier-pill tier-3">Nivå 3: Hotindikator (MISP IoC)</span>
            <span className="cyber-tier-pill tier-4">Nivå 4: Bekräftad incident</span>
            <span className="cyber-tier-pill tier-5">Nivå 5: Härledd riskbedömning</span>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="cyber-kpi-grid">
        <div className="cyber-kpi-card">
          <div className="cyber-kpi-label">CERT-SE Varningar</div>
          <div className="cyber-kpi-value">{data?.kpis?.certSeTotal ?? '–'}</div>
          <div className="cyber-kpi-sub">
            {data?.kpis?.certSeCritical ?? 0} med kritisk allvarlighetsgrad
          </div>
        </div>

        <div className="cyber-kpi-card">
          <div className="cyber-kpi-label">CISA KEV Katalogen</div>
          <div className="cyber-kpi-value">{data?.kpis?.cisaKevTotal?.toLocaleString('sv-SE') ?? '–'}</div>
          <div className="cyber-kpi-sub">Aktivt utnyttjade sårbarheter</div>
        </div>

        <div className="cyber-kpi-card">
          <div className="cyber-kpi-label">Ransomware-kopplade KEV</div>
          <div className="cyber-kpi-value" style={{ color: '#8c2d19' }}>
            {data?.kpis?.cisaKevRansomware?.toLocaleString('sv-SE') ?? '–'}
          </div>
          <div className="cyber-kpi-sub">Kända utpressningskampanjer</div>
        </div>

        <div className="cyber-kpi-card">
          <div className="cyber-kpi-label">Kritiska NVD (CVSS &ge; 9.0)</div>
          <div className="cyber-kpi-value" style={{ color: '#b91c1c' }}>
            {data?.kpis?.nvdRecentCritical ?? '–'}
          </div>
          <div className="cyber-kpi-sub">Nya/ändrade i bevakningsfönstret</div>
        </div>

        <div className="cyber-kpi-card">
          <div className="cyber-kpi-label">MISP Hotindikatorer</div>
          <div className="cyber-kpi-value">
            {data?.misp?.isConfigured ? data.misp.indicators?.length : 'Ej konfigurerad'}
          </div>
          <div className="cyber-kpi-sub">
            {data?.misp?.isConfigured ? 'Aktiva IoC:er i flöde' : 'Kräver MISP_URL & MISP_API_KEY'}
          </div>
        </div>
      </section>

      {/* Filter and search bar */}
      <section className="cyber-filter-bar">
        <form onSubmit={handleSearchSubmit} className="cyber-search-box">
          <input
            type="text"
            className="cyber-search-input"
            placeholder="Sök CVE-id, produkt, leverantör, nyckelord eller teknik..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="cyber-btn cyber-btn-primary">
            Sök
          </button>
          {search && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setSearch('')
                setTimeout(fetchData, 10)
              }}
            >
              Rensa
            </button>
          )}
        </form>

        <div className="cyber-select-group">
          <label className="cyber-select-label" htmlFor="cyber-class-filter">
            Klassificering:
          </label>
          <select
            id="cyber-class-filter"
            className="cyber-select"
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value)}
          >
            <option value="all">Alla klassificeringar (Nivå 1–5)</option>
            <option value="published_warning">Nivå 1: Publicerad varning</option>
            <option value="exploited_vulnerability">Nivå 2: Känd exploatering (KEV)</option>
            <option value="threat_indicator">Nivå 3: Hotindikator (MISP IoC)</option>
            <option value="verified_incident">Nivå 4: Bekräftad incident</option>
            <option value="derived_risk_assessment">Nivå 5: Härledd riskbedömning</option>
            <option value="cve_record">NVD CVE-poster</option>
          </select>
        </div>

        <div className="cyber-select-group">
          <label className="cyber-select-label" htmlFor="cyber-sev-filter">
            Allvarlighetsgrad:
          </label>
          <select
            id="cyber-sev-filter"
            className="cyber-select"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="all">Alla nivåer</option>
            <option value="critical">Kritisk</option>
            <option value="elevated">Förhöjd</option>
            <option value="operational">Normal / Information</option>
          </select>
        </div>
      </section>

      {/* Tabs navigation */}
      <div className="cyber-tabs-nav">
        <button
          type="button"
          className={`cyber-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Samlad Tidslinje ({data?.timeline?.length ?? 0})
        </button>
        <button
          type="button"
          className={`cyber-tab-btn ${activeTab === 'cert' ? 'active' : ''}`}
          onClick={() => setActiveTab('cert')}
        >
          CERT-SE Varningar ({data?.certAdvisories?.length ?? 0})
        </button>
        <button
          type="button"
          className={`cyber-tab-btn ${activeTab === 'cisa' ? 'active' : ''}`}
          onClick={() => setActiveTab('cisa')}
        >
          CISA KEV Sårbarheter ({filteredCisaItems.length})
        </button>
        <button
          type="button"
          className={`cyber-tab-btn ${activeTab === 'nvd' ? 'active' : ''}`}
          onClick={() => setActiveTab('nvd')}
        >
          NVD CVE Databas ({filteredNvdItems.length})
        </button>
        <button
          type="button"
          className={`cyber-tab-btn ${activeTab === 'mitre' ? 'active' : ''}`}
          onClick={() => setActiveTab('mitre')}
        >
          MITRE ATT&CK Tekniker ({data?.mitreAttack?.techniques?.length ?? 0})
        </button>
        <button
          type="button"
          className={`cyber-tab-btn ${activeTab === 'misp' ? 'active' : ''}`}
          onClick={() => setActiveTab('misp')}
        >
          MISP Hotindikatorer ({data?.misp?.isConfigured ? data.misp.indicators?.length : '0'})
        </button>
        <button
          type="button"
          className={`cyber-tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          Källor & Metodik
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="callout callout-error" style={{ margin: '8px 0' }}>
          <strong>Ett fel uppstod:</strong> {error}
        </div>
      )}

      {/* Main Tab Views */}
      <div className="cyber-tab-content">
        {/* TAB 1: Unified Timeline */}
        {activeTab === 'timeline' && (
          <section className="cyber-timeline-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: '#1d2a20' }}>
                Samlad flödestidslinje med strikt klassificering
              </h2>
              <span style={{ fontSize: '0.85rem', color: '#526353' }}>
                Visar {filteredEvents.length} händelser
              </span>
            </div>

            {loading && !data && (
              <p style={{ color: '#526353', padding: '20px 0' }}>Hämtar och deduplicerar händelser...</p>
            )}

            {filteredEvents.length === 0 && !loading && (
              <p style={{ color: '#526353', padding: '20px 0' }}>
                Inga händelser matchar dina valda filter eller sökord.
              </p>
            )}

            <div className="cyber-events-list">
              {filteredEvents.map((ev: TimelineEvent) => (
                <div
                  key={ev.id}
                  className={`cyber-event-card ${ev.severity === 'critical' ? 'critical-border' : ''}`}
                  onClick={() => setSelectedEvent(ev)}
                >
                  <div className="cyber-event-header">
                    <div className="cyber-event-badges">
                      <span className={`cyber-tier-badge tier-${ev.classificationTier}`}>
                        Nivå {ev.classificationTier}: {ev.classificationLabel}
                      </span>
                      {ev.badgeText && (
                        <span className="cyber-badge-custom">{ev.badgeText}</span>
                      )}
                      {ev.cvssScore !== null && ev.cvssScore !== undefined && (
                        <span className={`cyber-cvss-tag ${ev.cvssScore >= 9.0 ? 'critical' : ev.cvssScore >= 7.0 ? 'high' : 'medium'}`}>
                          CVSS {ev.cvssScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <span className="cyber-event-time">
                      {new Date(ev.time).toLocaleDateString('sv-SE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <h3 className="cyber-event-title">{ev.title}</h3>
                  <p className="cyber-event-desc">{ev.summary}</p>

                  <div className="cyber-event-footer">
                    <div className="cyber-tag-list">
                      {ev.cves?.map((cve) => (
                        <button
                          key={cve}
                          type="button"
                          className="cyber-cve-pill"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectCve(cve)
                          }}
                        >
                          {cve}
                        </button>
                      ))}
                      {ev.mitreTechniques?.map((tech) => (
                        <span key={tech.id} className="cyber-mitre-pill">
                          {tech.id} - {tech.name}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="cyber-source-label">Källa: {ev.source}</span>
                      {ev.sourceUrl && (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="cyber-external-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Öppna källa ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 2: CERT-SE Advisories */}
        {activeTab === 'cert' && (
          <section className="cyber-cert-section">
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: '#1d2a20' }}>
                CERT-SE Nationella Cybersäkerhetsvarningar (Sverige)
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#526353', fontSize: '0.85rem' }}>
                Källa: MSB / CERT-SE officiellt Atom-flöde. Klassificeras som <em>Nivå 1: Publicerad varning</em>.
              </p>
            </div>

            <div className="cyber-events-list">
              {data?.certAdvisories?.map((item: CertAdvisoryItem) => (
                <div key={item.id} className="cyber-event-card">
                  <div className="cyber-event-header">
                    <span className="cyber-tier-badge tier-1">Nivå 1: Publicerad varning</span>
                    <span className="cyber-event-time">
                      {new Date(item.time).toLocaleDateString('sv-SE')}
                    </span>
                  </div>
                  <h3 className="cyber-event-title">{item.title}</h3>
                  <p className="cyber-event-desc">{item.summary}</p>
                  <div className="cyber-event-footer">
                    <div className="cyber-tag-list">
                      {item.cves?.map((cve: string) => (
                        <button
                          key={cve}
                          type="button"
                          className="cyber-cve-pill"
                          onClick={() => handleSelectCve(cve)}
                        >
                          {cve}
                        </button>
                      ))}
                    </div>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="cyber-external-link"
                      >
                        Läs på CERT-SE ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: CISA KEV Catalog */}
        {activeTab === 'cisa' && (
          <section className="cyber-cisa-section">
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: '#1d2a20' }}>
                CISA Known Exploited Vulnerabilities (KEV) Catalog
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#526353', fontSize: '0.85rem' }}>
                Officiell katalog från Cybersecurity & Infrastructure Security Agency. Klassificeras som <em>Nivå 2: Sårbarhet med känd exploatering</em>.
                Innebär inte automatiskt exploatering i Sverige.
              </p>
            </div>

            <div className="cyber-table-container">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>CVE-ID</th>
                    <th>Leverantör / Produkt</th>
                    <th>Sårbarhetsnamn</th>
                    <th>Tillagd i KEV</th>
                    <th>Ransomware</th>
                    <th>Åtgärdskrav</th>
                    <th>Detaljer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCisaItems.slice(0, 50).map((item: CisaKevItem) => (
                    <tr key={item.cveID}>
                      <td>
                        <button
                          type="button"
                          className="cyber-cve-pill"
                          onClick={() => handleSelectCve(item.cveID)}
                        >
                          {item.cveID}
                        </button>
                      </td>
                      <td>
                        <strong>{item.vendor}</strong>
                        <div style={{ color: '#526353', fontSize: '0.8rem' }}>{item.product}</div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '300px', whiteSpace: 'normal' }}>
                          {item.title}
                        </div>
                      </td>
                      <td>{item.dateAdded}</td>
                      <td>
                        {item.knownRansomwareCampaignUse === 'Known' ? (
                          <span className="cyber-tag-ransomware">Känd kampanj</span>
                        ) : (
                          <span style={{ color: '#7a8c7b', fontSize: '0.8rem' }}>Okänd</span>
                        )}
                      </td>
                      <td>
                        <div style={{ maxWidth: '250px', fontSize: '0.8rem', whiteSpace: 'normal' }}>
                          {item.requiredAction}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ghost-button"
                          style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                          onClick={() => handleSelectCve(item.cveID)}
                        >
                          Visa CVE ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCisaItems.length > 50 && (
              <p style={{ fontSize: '0.8rem', color: '#526353', marginTop: '6px' }}>
                Visar de 50 första av totalt {filteredCisaItems.length} matchande KEV-poster. Använd sökrutan för att avgränsa.
              </p>
            )}
          </section>
        )}

        {/* TAB 4: NVD API 2.0 */}
        {activeTab === 'nvd' && (
          <section className="cyber-nvd-section">
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: '#1d2a20' }}>
                National Vulnerability Database (NVD API 2.0)
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#526353', fontSize: '0.85rem' }}>
                Officiellt NVD-register från NIST. Visar CVSS v3.1 / v3.0, publiceringsdatum och CVE-status.
              </p>
            </div>

            <div className="cyber-events-list">
              {filteredNvdItems.map((cve: NvdCveItem) => (
                <div key={cve.id} className="cyber-event-card">
                  <div className="cyber-event-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="cyber-cve-pill"
                        onClick={() => handleSelectCve(cve.cveId)}
                      >
                        {cve.cveId}
                      </button>
                      <span className="cyber-status-tag">{cve.vulnStatus}</span>
                      {cve.cvssScore !== null && (
                        <span className={`cyber-cvss-tag ${cve.cvssScore >= 9.0 ? 'critical' : cve.cvssScore >= 7.0 ? 'high' : 'medium'}`}>
                          CVSS {cve.cvssScore.toFixed(1)} {cve.cvssSeverity ? `(${cve.cvssSeverity})` : ''}
                        </span>
                      )}
                    </div>
                    <span className="cyber-event-time">
                      Publicerad: {cve.published ? new Date(cve.published).toLocaleDateString('sv-SE') : 'N/A'}
                    </span>
                  </div>

                  <p className="cyber-event-desc" style={{ marginTop: '8px' }}>
                    {cve.description}
                  </p>

                  <div className="cyber-event-footer">
                    <div className="cyber-tag-list">
                      {cve.cwes?.map((cwe: string) => (
                        <span key={cwe} className="cyber-mitre-pill">
                          {cwe}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => handleSelectCve(cve.cveId)}
                      >
                        Granska korrelation
                      </button>
                      <a
                        href={cve.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="cyber-external-link"
                      >
                        NVD Portal ↗
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 5: MITRE ATT&CK Techniques */}
        {activeTab === 'mitre' && (
          <section className="cyber-mitre-section">
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: '#1d2a20' }}>
                MITRE ATT&CK Enterprise Tekniker & Taktiker
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#526353', fontSize: '0.85rem' }}>
                Strukturerad kunskapsbas för observerade angreppstekniker relevanta för kritisk infrastruktur, nätverksperimetrar och applikationssårbarheter.
              </p>
            </div>

            <div className="cyber-grid-2col">
              {data?.mitreAttack?.techniques?.map((tech: MitreTechnique) => (
                <div key={tech.id} className="cyber-event-card">
                  <div className="cyber-event-header">
                    <span className="cyber-mitre-pill" style={{ fontWeight: 600 }}>
                      {tech.id}
                    </span>
                    <span className="cyber-status-tag">{tech.tacticName}</span>
                  </div>
                  <h3 className="cyber-event-title" style={{ fontSize: '1rem', marginTop: '4px' }}>
                    {tech.name}
                  </h3>
                  <p className="cyber-event-desc">{tech.description}</p>
                  <div className="cyber-event-footer">
                    <div className="cyber-tag-list">
                      {tech.cwes?.map((cwe: string) => (
                        <span key={cwe} className="cyber-source-label">
                          {cwe}
                        </span>
                      ))}
                    </div>
                    <a
                      href={tech.url}
                      target="_blank"
                      rel="noreferrer"
                      className="cyber-external-link"
                    >
                      MITRE ATT&CK ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 6: MISP Threat Indicators */}
        {activeTab === 'misp' && (
          <section className="cyber-misp-section">
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: '#1d2a20' }}>
                MISP (Malware Information Sharing Platform) Hotindikatorer
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#526353', fontSize: '0.85rem' }}>
                Klassificeras som <em>Nivå 3: Hotindikator observerad i ett flöde (IoC)</em>. Inga hemligheter lagras i frontend.
              </p>
            </div>

            {!data?.misp?.isConfigured ? (
              <div className="cyber-misp-unconfigured-card">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔒</div>
                <h3 style={{ margin: 0, color: '#1d2a20' }}>MISP-instans ej konfigurerad</h3>
                <p style={{ color: '#526353', maxWidth: '550px', margin: '8px auto', fontSize: '0.9rem' }}>
                  {data?.misp?.message ||
                    'För att hämta hotindikatorer (IoC) från MISP måste miljövariablerna MISP_URL och MISP_API_KEY konfigureras på backend.'}
                </p>
                <div className="cyber-misp-guide-box">
                  <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '0.85rem' }}>
                    Konfigurationsguide (.env):
                  </div>
                  <code>
                    MISP_URL=https://misp.example.org{'\n'}
                    MISP_API_KEY=ditt_sakrade_misp_authkey
                  </code>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '8px', fontSize: '0.85rem', color: '#2e7d32' }}>
                  ✓ Ansluten till MISP-instans: <strong>{data.misp.instanceHost}</strong> (Hämtade {data.misp.indicators?.length} indikatorer)
                </div>
                <div className="cyber-table-container">
                  <table className="cyber-table">
                    <thead>
                      <tr>
                        <th>Typ</th>
                        <th>Värde (IoC)</th>
                        <th>Kategori</th>
                        <th>Datum</th>
                        <th>Händelse-ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.misp.indicators?.map((attr: MispIndicatorItem) => (
                        <tr key={attr.id}>
                          <td><code>{attr.type}</code></td>
                          <td><strong>{attr.value}</strong></td>
                          <td>{attr.category}</td>
                          <td>{attr.timestamp}</td>
                          <td>Event #{attr.eventId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 7: Sources & Methodology */}
        {activeTab === 'sources' && (
          <section className="cyber-sources-section">
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 12px 0', color: '#1d2a20' }}>
              Datakällornas Aktualitet, Täckning och Metodik
            </h2>

            <div className="cyber-sources-grid">
              <div className="cyber-source-card">
                <h3>CERT-SE (MSB)</h3>
                <p>Nationell CSIRT för Sverige. Publicerar officiella cybersäkerhetsvarningar, råd och incidentanalyser.</p>
                <dl className="cyber-source-meta">
                  <dt>URL:</dt>
                  <dd><a href="https://www.cert.se/feed/atom.xml" target="_blank" rel="noreferrer">cert.se/feed/atom.xml</a></dd>
                  <dt>Format:</dt>
                  <dd>Atom 1.0 XML / HTTPS</dd>
                  <dt>Klassificering:</dt>
                  <dd><strong>Nivå 1: Publicerad varning</strong></dd>
                  <dt>Status:</dt>
                  <dd><span className="cyber-status-tag live">Aktiv & live</span></dd>
                </dl>
              </div>

              <div className="cyber-source-card">
                <h3>CISA KEV Catalog</h3>
                <p>Officiell katalog från amerikanska CISA över sårbarheter med bekräftad aktiv exploatering av angripare.</p>
                <dl className="cyber-source-meta">
                  <dt>URL:</dt>
                  <dd><a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noreferrer">cisa.gov KEV Catalog</a></dd>
                  <dt>Format:</dt>
                  <dd>JSON / CISA CDN</dd>
                  <dt>Klassificering:</dt>
                  <dd><strong>Nivå 2: Känd exploatering</strong></dd>
                  <dt>Status:</dt>
                  <dd><span className="cyber-status-tag live">Aktiv & live ({data?.kpis?.cisaKevTotal} poster)</span></dd>
                </dl>
              </div>

              <div className="cyber-source-card">
                <h3>NVD API 2.0 (NIST)</h3>
                <p>National Vulnerability Database tillhandahålls av amerikanska NIST med CVSS-scoring och CWE-mappningar.</p>
                <dl className="cyber-source-meta">
                  <dt>URL:</dt>
                  <dd><a href="https://nvd.nist.gov/developers/vulnerabilities" target="_blank" rel="noreferrer">services.nvd.nist.gov/rest/json/cves/2.0</a></dd>
                  <dt>Format:</dt>
                  <dd>REST JSON / Rate-limited cache</dd>
                  <dt>Klassificering:</dt>
                  <dd>NVD CVE-register</dd>
                  <dt>Status:</dt>
                  <dd><span className="cyber-status-tag live">Aktiv & live</span></dd>
                </dl>
              </div>

              <div className="cyber-source-card">
                <h3>MITRE ATT&CK</h3>
                <p>Global kunskapsbas över motståndares taktiker och tekniker baserad på verkliga observationer.</p>
                <dl className="cyber-source-meta">
                  <dt>URL:</dt>
                  <dd><a href="https://attack.mitre.org/" target="_blank" rel="noreferrer">attack.mitre.org</a></dd>
                  <dt>Täckning:</dt>
                  <dd>Enterprise Matrix (Initial Access, Execution, Persistence, m.fl.)</dd>
                  <dt>Klassificering:</dt>
                  <dd>Teknikkatalog & referensramverk</dd>
                  <dt>Status:</dt>
                  <dd><span className="cyber-status-tag live">Strukturerat referensverk</span></dd>
                </dl>
              </div>

              <div className="cyber-source-card">
                <h3>MISP (Threat Sharing)</h3>
                <p>Open-source hotunderrättelseplattform för utbyte av tekniska IoC:er och hotaktörsattribut.</p>
                <dl className="cyber-source-meta">
                  <dt>URL:</dt>
                  <dd><a href="https://www.misp-project.org/" target="_blank" rel="noreferrer">misp-project.org</a></dd>
                  <dt>Format:</dt>
                  <dd>REST API via serverproxy (inga frontendnycklar)</dd>
                  <dt>Klassificering:</dt>
                  <dd><strong>Nivå 3: Hotindikator i flöde (IoC)</strong></dd>
                  <dt>Status:</dt>
                  <dd>{data?.misp?.isConfigured ? <span className="cyber-status-tag live">Ansluten</span> : <span className="cyber-status-tag">Konfigurerbar via env</span>}</dd>
                </dl>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Modal / Detail Drawer for selected CVE */}
      {selectedCveId && (
        <div className="cyber-modal-overlay" onClick={() => setSelectedCveId(null)}>
          <div className="cyber-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cyber-modal-header">
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1d2a20' }}>
                Sårbarhetsanalys: {selectedCveId}
              </h2>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setSelectedCveId(null)}
              >
                ✕ Stäng
              </button>
            </div>

            {loadingDetailedCve && (
              <p style={{ color: '#526353', padding: '20px 0' }}>Hämtar data från NVD och CISA KEV...</p>
            )}

            {detailedCve && !loadingDetailedCve && (
              <div className="cyber-modal-body">
                <div className="cyber-modal-grid">
                  <div>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      CISA KEV Status:
                    </div>
                    {detailedCve.inCisaKev ? (
                      <span className="cyber-tier-badge tier-2">
                        ✓ Bekräftad aktiv exploatering i CISA KEV
                      </span>
                    ) : (
                      <span style={{ color: '#526353', fontSize: '0.85rem' }}>
                        Ej listad i CISA KEV som aktivt exploaterad
                      </span>
                    )}
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      CVSS Allvarlighetsgrad:
                    </div>
                    {detailedCve.nvd?.cvssScore !== null && detailedCve.nvd?.cvssScore !== undefined ? (
                      <span className={`cyber-cvss-tag ${detailedCve.nvd.cvssScore >= 9.0 ? 'critical' : detailedCve.nvd.cvssScore >= 7.0 ? 'high' : 'medium'}`}>
                        CVSS {detailedCve.nvd.cvssScore.toFixed(1)} ({detailedCve.nvd.cvssSeverity || 'NVD'})
                      </span>
                    ) : (
                      <span style={{ color: '#526353', fontSize: '0.85rem' }}>Väntar på CVSS-analys</span>
                    )}
                  </div>
                </div>

                {detailedCve.cisaKev && (
                  <div className="cyber-modal-cisa-box">
                    <h4 style={{ margin: '0 0 6px 0', color: '#8c2d19' }}>CISA KEV Katalogdata:</h4>
                    <p><strong>Produkt:</strong> {detailedCve.cisaKev.vendor} - {detailedCve.cisaKev.product}</p>
                    <p><strong>Beskrivning:</strong> {detailedCve.cisaKev.summary}</p>
                    <p><strong>Obligatorisk åtgärd:</strong> {detailedCve.cisaKev.requiredAction}</p>
                    {detailedCve.cisaKev.dueDate && (
                      <p><strong>Tidsfrist:</strong> {detailedCve.cisaKev.dueDate}</p>
                    )}
                  </div>
                )}

                {detailedCve.nvd?.description && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Officiell NVD-beskrivning:
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#2b3a2d', lineHeight: '1.45' }}>
                      {detailedCve.nvd.description}
                    </p>
                  </div>
                )}

                {detailedCve.mitreTechniques && detailedCve.mitreTechniques.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Relevanta MITRE ATT&CK Tekniker:
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {detailedCve.mitreTechniques.map((tech: MitreTechnique) => (
                        <div key={tech.id} className="cyber-modal-mitre-row">
                          <span className="cyber-mitre-pill">{tech.id}</span>
                          <strong>{tech.name}</strong>
                          <span style={{ color: '#526353', fontSize: '0.8rem' }}>({tech.tacticName})</span>
                          <a href={tech.url} target="_blank" rel="noreferrer" className="cyber-external-link">
                            Info ↗
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="cyber-modal-footer">
                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(selectedCveId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cyber-btn cyber-btn-primary"
                  >
                    Öppna på NVD NIST ↗
                  </a>
                  <a
                    href={`https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${encodeURIComponent(selectedCveId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ghost-button"
                  >
                    Sök i CISA Catalog ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal / Detail Drawer for selected Timeline Event */}
      {selectedEvent && !selectedCveId && (
        <div className="cyber-modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="cyber-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cyber-modal-header">
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1d2a20' }}>
                Händelsedetaljer
              </h2>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setSelectedEvent(null)}
              >
                ✕ Stäng
              </button>
            </div>

            <div className="cyber-modal-body">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <span className={`cyber-tier-badge tier-${selectedEvent.classificationTier}`}>
                  Nivå {selectedEvent.classificationTier}: {selectedEvent.classificationLabel}
                </span>
                <span className="cyber-source-label">Källa: {selectedEvent.source}</span>
              </div>

              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>{selectedEvent.title}</h3>
              <p style={{ fontSize: '0.9rem', color: '#2b3a2d', lineHeight: '1.5' }}>
                {selectedEvent.summary}
              </p>

              {selectedEvent.cves?.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Refererade CVE-poster:
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {selectedEvent.cves.map((cve: string) => (
                      <button
                        key={cve}
                        type="button"
                        className="cyber-cve-pill"
                        onClick={() => handleSelectCve(cve)}
                      >
                        {cve}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="cyber-modal-footer">
                {selectedEvent.sourceUrl && (
                  <a
                    href={selectedEvent.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="cyber-btn cyber-btn-primary"
                  >
                    Öppna originalkälla ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CyberDashboard
