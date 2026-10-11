export type EventClassificationKind = 'authority' | 'news' | 'unconfirmed'

export type EventSectorKind = 'energy' | 'telecom' | 'transport' | 'cyber' | 'nature' | 'cross-sector'

export type EventSeverityKind = 'critical' | 'elevated' | 'notice'

export type EventRegionKind = 'SE' | 'nordics' | 'europe' | 'global'

export interface EventCoordinates {
  lat: number
  lon: number
}

export interface EventSourceItem {
  id: string
  title: string
  summary: string
  url: string
  source: string
  outletDomain?: string
  sourceType: EventClassificationKind
  classification: EventClassificationKind
  publishedAt: string
  fetchedAt: string
  verified: boolean
}

export interface EventClusterItem {
  id: string
  title: string
  summary: string
  url: string
  primarySource: string
  sourcesCount: number
  isGrouped: boolean
  classification: EventClassificationKind
  classificationLabel: string
  severity: EventSeverityKind
  sector: EventSectorKind
  region: EventRegionKind
  country: string
  coordinates: EventCoordinates | null
  firstPublishedAt: string
  lastPublishedAt: string
  publishedAt?: string
  fetchedAt: string
  verified: boolean
  sources: EventSourceItem[]
  originalMethodology: string
}

export interface EventKpi {
  label: string
  value: string
  detail: string
  status: 'operational' | 'elevated' | 'critical' | 'unknown'
}

export interface EventSourceStatus {
  id: string
  label: string
  url: string
  docUrl: string
  status: 'ok' | 'stale' | 'warning' | 'error'
  message: string
  type: string
  classification: EventClassificationKind
  authRequired: boolean
  rateLimitInfo: string
  coverage: string
  lastFetched: string
  itemsCount: number
}

export interface EventsDashboardResponse {
  state: 'ok' | 'stale' | 'error'
  updatedAt: string
  totalRawItems: number
  deduplicatedCount: number
  displayedCount: number
  grouped: boolean
  kpis: EventKpi[]
  sources: EventSourceStatus[]
  items: EventClusterItem[]
}
