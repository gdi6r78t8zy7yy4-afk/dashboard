import type { ServiceStatus, StatusLevel } from './statusSummary'

type SectorService = ServiceStatus & {
  id?: string
  label?: string
  description?: string
  metric?: string
  metricLabel?: string
  updated?: string
  category?: string
}

export type SectorObservationKind =
  | 'verified_incident'
  | 'warning'
  | 'technical_observation'
  | 'risk_indicator'

export type SectorObservationQuality = 'verified' | 'provisional' | 'stale' | 'missing'

export type SectorObservation = {
  id: string
  title: string
  summary: string
  kind: SectorObservationKind
  quality: SectorObservationQuality
  source: string
  location: string
  timestamp: string
  severity: Exclude<StatusLevel, 'unknown'>
}

export type SectorKpi = {
  label: string
  value: string
  trend: string
  status: StatusLevel
}

export type SectorDashboardView = {
  id: string
  label: string
  headline: string
  status: StatusLevel
  qualityNote: string
  kpis: SectorKpi[]
  observations: SectorObservation[]
}

type RawIncident = {
  severity: 'critical' | 'elevated'
  service: string
  title: string
  location: string
  time: string
  note: string
}

const kindFromIncident = (incident: RawIncident): SectorObservationKind => {
  if (/verified|incident|outage|disruption/i.test(incident.note) || incident.severity === 'critical') return 'verified_incident'
  if (/warning|advisory|saturation|congestion/i.test(incident.note) || incident.severity === 'elevated') return 'warning'
  if (/telemetry|latency|routing|signal|backhaul/i.test(incident.note)) return 'technical_observation'
  return 'risk_indicator'
}

const qualityFromIncident = (incident: RawIncident): SectorObservationQuality => {
  if (/stale|delayed|not connected|missing|timeout/i.test(incident.note)) return 'stale'
  if (incident.severity === 'critical') return 'verified'
  return 'provisional'
}

export function buildSectorObservations(
  sectorId: string,
  services: SectorService[],
  incidents: RawIncident[],
  region: string,
): SectorDashboardView {
  const activeService = services.find((service) => service.id === sectorId) ?? null
  const label = activeService?.label ?? 'Sector'
  const status = activeService?.status ?? 'unknown'

  const observations = incidents
    .filter((incident) => qualityFromIncident(incident) !== 'stale')
    .slice(0, 4)
    .map((incident, index) => ({
      id: `${sectorId}-${index}`,
      title: incident.title,
      summary: incident.note,
      kind: kindFromIncident(incident),
      quality: qualityFromIncident(incident),
      source: incident.service,
      location: incident.location,
      timestamp: `${incident.time} CET`,
      severity: incident.severity,
    }))

  const verifiedCount = observations.filter((item) => item.quality === 'verified').length
  const warningCount = observations.filter((item) => item.kind === 'warning').length
  const technicalCount = observations.filter((item) => item.kind === 'technical_observation').length
  const riskCount = observations.filter((item) => item.kind === 'risk_indicator').length

  const kpis: SectorKpi[] = [
    { label: 'Verified incidents', value: String(verifiedCount), trend: 'last 24h', status: verifiedCount > 0 ? 'critical' : 'operational' },
    { label: 'Warnings', value: String(warningCount), trend: 'active', status: warningCount > 0 ? 'elevated' : 'operational' },
    { label: 'Technical observations', value: String(technicalCount), trend: 'last 4h', status: technicalCount > 0 ? 'elevated' : 'operational' },
    { label: 'Risk indicators', value: String(riskCount), trend: 'source quality', status: riskCount > 0 ? 'critical' : 'operational' },
  ]

  const headline = status === 'critical'
    ? 'Service degradation is material across the monitored network footprint.'
    : status === 'elevated'
      ? 'A limited set of warning conditions requires monitoring and follow-up.'
      : status === 'operational'
        ? 'The monitored service is stable and within expected operating limits.'
        : 'No verified feed is currently available for this sector in the selected region.'

  return {
    id: sectorId,
    label,
    headline,
    status,
    qualityNote: region === 'se'
      ? 'Demo data only — source quality is marked and stale values are excluded from the final summary.'
      : 'No verified regional feed is connected. Region output remains demo-only and should not be treated as operational status.',
    kpis,
    observations,
  }
}
