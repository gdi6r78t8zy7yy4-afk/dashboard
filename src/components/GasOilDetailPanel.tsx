import { useEffect, useRef } from 'react'
import {
  Gauge,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Clock,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react'
import type { GasOilDetailRecord } from '../types/gas-oil'
import {
  formatCommodity,
  formatIndicator,
  freshnessLabel,
} from '../lib/gasOilDetail'

interface GasOilDetailPanelProps {
  record: GasOilDetailRecord | null
  /** How many records are on the back stack (depth of the dashboard stack). */
  historyDepth: number
  onClose: () => void
  onBack: () => void
  onNavigate: (action: string, record: GasOilDetailRecord) => void
}

const STATUS_META: Record<string, { label: string; color: string; icon: 'ok' | 'warn' | 'error' | 'muted' }> = {
  ok: { label: 'Current', color: '#387c65', icon: 'ok' },
  stale: { label: 'Stale', color: '#c8893d', icon: 'warn' },
  error: { label: 'Error', color: '#bd6152', icon: 'error' },
  missing: { label: 'No data', color: '#858b84', icon: 'muted' },
  not_configured: { label: 'Not configured', color: '#858b84', icon: 'muted' },
}

function StatusBadge({ status }: { status: GasOilDetailRecord['status'] }) {
  if (!status) return null
  const meta = STATUS_META[status] ?? STATUS_META.missing
  const Icon =
    meta.icon === 'ok' ? CheckCircle : meta.icon === 'muted' ? CheckCircle : AlertTriangle
  return (
    <span className={`detail-status-badge ${status}`} style={{ color: meta.color }}>
      <Icon size={14} />
      {meta.label}
    </span>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="info-row">
      <span>{label}:</span>
      <strong>{children}</strong>
    </div>
  )
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Shared detail popup for the gas/oil dashboard.
 *
 * Used for map features, chart observations, KPI cards, table rows and
 * search results. Only fields that are actually known for the record are
 * rendered — there is no hardcoded fallback content that pretends to be a
 * real observation.
 */
export const GasOilDetailPanel = ({
  record,
  historyDepth,
  onClose,
  onBack,
  onNavigate,
}: GasOilDetailPanelProps) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Move focus into the dialog when a new record opens, and back to the
  // close button when the record changes.
  useEffect(() => {
    if (record) {
      closeRef.current?.focus()
    }
  }, [record?.id, record?.title]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes the panel (the back action is an explicit button so the
  // user is not accidentally popped off the history stack).
  useEffect(() => {
    if (!record) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [record, onClose])

  if (!record) {
    return (
      <div className="gas-oil-detail-panel empty" aria-label="Gas and oil details">
        <h3>Details</h3>
        <p>
          Click a map feature, a chart point, a summary card, a data-source
          row or a search result to see its details here.
        </p>
      </div>
    )
  }

  const valueKnown = record.value !== undefined && record.value !== null
  const observedAtText = formatDateTime(record.observedAt)
  const publishedAtText = formatDateTime(record.publishedAt)
  const freshness = freshnessLabel(record.publishedAt ?? record.observedAt)
  const history = record.history ?? []
  const related = record.related ?? []

  return (
    <div
      ref={panelRef}
      className="gas-oil-detail-panel"
      role="dialog"
      aria-label={`Details for ${record.title}`}
      aria-labelledby="gas-oil-detail-title"
    >
      <div className="detail-header">
        <div>
          <h3 id="gas-oil-detail-title">{record.title}</h3>
          <span className="detail-type">
            {record.typeLabel}
            {record.scope ? ` • ${record.scope}` : ''}
          </span>
        </div>
        <button
          ref={closeRef}
          className="close-button"
          onClick={onClose}
          aria-label="Close details"
        >
          ×
        </button>
      </div>

      <div className="detail-content">
        <StatusBadge status={record.status} />

        {valueKnown && (
          <div className="detail-metric">
            <Gauge size={20} />
            <div>
              <span className="metric-label">
                {record.kind === 'observation' ? 'Observed value' : 'Value'}
              </span>
              <strong>
                {record.value!.toLocaleString('en-GB', { maximumFractionDigits: 3 })}
                {record.unit ? ` ${record.unit}` : ''}
              </strong>
            </div>
          </div>
        )}

        <div className="detail-info">
          {formatCommodity(record.commodity) && (
            <InfoRow label="Commodity">{formatCommodity(record.commodity)}</InfoRow>
          )}
          {formatIndicator(record.indicator) && (
            <InfoRow label="Indicator">{formatIndicator(record.indicator)}</InfoRow>
          )}
          {record.scope && <InfoRow label="Scope">{record.scope}</InfoRow>}
          {Array.isArray(record.coordinates) && (
            <InfoRow label="Coordinates">
              {record.coordinates[0].toFixed(2)}°N, {record.coordinates[1].toFixed(2)}°E
            </InfoRow>
          )}
          {observedAtText && <InfoRow label="Observed">{observedAtText}</InfoRow>}
          {record.period && <InfoRow label="Period">{record.period}</InfoRow>}
          {publishedAtText && <InfoRow label="Published">{publishedAtText}</InfoRow>}
          {record.source && <InfoRow label="Source">{record.source}</InfoRow>}
          {record.recordRef && <InfoRow label="Record ref">{record.recordRef}</InfoRow>}
        </div>

        {(record.sourceUrl || freshness) && (
          <div className="detail-freshness">
            {freshness && (
              <span className="freshness-label">
                <Clock size={13} />
                {freshness}
              </span>
            )}
            {record.sourceUrl && (
              <a
                className="source-link"
                href={record.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Source site <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {record.definition && (
          <div className="detail-note">
            <h4>Definition</h4>
            <p>{record.definition}</p>
          </div>
        )}

        {record.methodology && (
          <div className="detail-note">
            <h4>Methodology</h4>
            <p>{record.methodology}</p>
          </div>
        )}

        {record.note && (
          <div className="detail-note">
            <h4>Note</h4>
            <p>{record.note}</p>
          </div>
        )}

        {history.length > 0 && (
          <div className="detail-history">
            <h4>Recent history</h4>
            <ul>
              {[...history]
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .slice(0, 5)
                .map((point) => (
                  <li key={point.timestamp}>
                    <span>{formatDateTime(point.timestamp) ?? point.timestamp}</span>
                    <strong>
                      {Number(point.value).toLocaleString('en-GB', { maximumFractionDigits: 2 })}
                      {record.unit ? ` ${record.unit}` : ''}
                    </strong>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {(related.length > 0 || historyDepth > 1) && (
          <div className="detail-actions">
            {historyDepth > 1 && (
              <button className="action-button secondary" onClick={onBack}>
                <ArrowLeft size={14} /> Back
              </button>
            )}
            {related.map((action) => (
              <button
                key={action.action + action.label}
                className="action-button"
                onClick={() => onNavigate(action.action, record)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="detail-kind-hint">
        <Calendar size={14} />
        <span>
          Kind: {record.kind}
          {record.kind === 'observation' ? ' · single point in a series' : ''}
        </span>
      </div>
    </div>
  )
}

export default GasOilDetailPanel
