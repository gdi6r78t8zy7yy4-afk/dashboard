export type TelecomSourceState = 'ok' | 'partial' | 'stale' | 'unavailable' | 'error' | 'not_applicable'

export type TelecomProvenance = {
  source: string
  sourceUrl: string
  retrievedAt: string | null
  observedAt: string | null
  referencePeriod: string | null
  geographicPrecision: 'country' | 'county' | 'network-observation' | 'multi-country' | 'none'
  resolution: string
  quality: 'official-statistic' | 'routing-observation' | 'internet-outage-indicator' | 'missing'
}

export type PtsCoverageValue = {
  value: number | null
  qualifier: 'exact' | 'greater-than' | 'missing'
}

export type PtsCountyCoverage = {
  code: string
  name: string
  mobile10Mbps8Db: PtsCoverageValue
  mobile100Mbps8Db: PtsCoverageValue
  mobile5g8Db: PtsCoverageValue
}

export type TelecomSource<T> = {
  state: TelecomSourceState
  provenance: TelecomProvenance
  data: T
  note: string | null
}

export type RipeRoutingPoint = {
  date: string
  ipv4Prefixes: number | null
  ipv6Prefixes: number | null
  routedAsns: number | null
  countriesRepresented?: number
}

export type IodaEvent = {
  id: string
  entityName: string
  datasource: string | null
  startedAt: string | null
  endedAt: string | null
  severity: string | null
  summary: string
}

export type TelecomDashboardResponse = {
  country: string
  region: string
  regionLabel?: string
  countries?: string[]
  period: '24h' | '7d' | '30d'
  retrievedAt: string
  cached?: boolean
  mode?: string
  coverage: TelecomSource<PtsCountyCoverage[]>
  routing: TelecomSource<{ history: RipeRoutingPoint[]; latest: RipeRoutingPoint | null; registeredAsns: number | null; routedAsns: number | null }>
  internetIncidents: TelecomSource<{ events: IodaEvent[]; signal: { timestamp: string; value: number }[]; period: string; country: string }>
  operatorStatus: TelecomSource<unknown>
  notices: TelecomSource<unknown>
  cloudflare?: { state: string; data?: { outages?: unknown[] } }
}