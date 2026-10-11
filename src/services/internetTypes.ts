export type GeographicPrecision =
  | 'country'
  | 'county'
  | 'network-observation'
  | 'multi-country'
  | 'none'

export type DataQuality =
  | 'official-statistic'
  | 'routing-observation'
  | 'internet-outage-indicator'
  | 'cloudflare-annotation'
  | 'missing'

export type InternetSourceMeta = {
  id: string
  name: string
  url: string
  state: 'ok' | 'partial' | 'stale' | 'unavailable' | 'error' | 'not_applicable'
  observedAt: string | null
  retrievedAt: string | null
  geographicPrecision: GeographicPrecision
  quality: DataQuality
  methodology: string
  disclaimer: string
}

export type BackboneAsnStatus = {
  asn: string
  name: string
  operator: string
  country: string
  category: string
  announced: boolean
  v4VisibilityPct: number | null
  v6VisibilityPct: number | null
  v4Peers: number | null
  v4Total: number | null
  v6Peers: number | null
  v6Total: number | null
  queryTime: string
}

export type BgpUpdatePoint = {
  starttime: string
  announcements: number
  withdrawals: number
}

export type AsnBgpActivity = {
  state: string
  asn: string
  updates: BgpUpdatePoint[]
  samplingResolution?: string
  error?: string
}

export type IodaOutageEvent = {
  id: string
  locationName: string
  locationCode: string
  locType: string
  countryCode: string | null
  asn: string | null
  datasource: string
  start: string
  durationSeconds: number | null
  score: number | null
  method: string
  interpretation: string
}

export type MultiCountryRouteItem = {
  country: string
  ipv4: number | null
  ipv6: number | null
  asns: number | null
}

export type RouteHistoryPoint = {
  date: string
  ipv4Prefixes: number | null
  ipv6Prefixes: number | null
  routedAsns: number | null
}

export type InternetDashboardResponse = {
  region: string
  regionLabel: string
  countries: string[]
  period: '24h' | '7d' | '30d'
  selectedAsn: string
  indicator: string
  retrievedAt: string
  cached: boolean
  sources: InternetSourceMeta[]
  routing: {
    state: string
    provenance: {
      source: string
      sourceUrl: string
      retrievedAt: string
      observedAt: string | null
      referencePeriod: string
      geographicPrecision: GeographicPrecision
      resolution: string
      quality: DataQuality
    }
    data: {
      history: RouteHistoryPoint[]
      latest: RouteHistoryPoint | null
      registeredAsns: number | null
      routedAsns: number | null
    }
    note: string | null
  }
  multiCountryRouting: MultiCountryRouteItem[]
  ioda: {
    state: string
    provenance: {
      source: string
      sourceUrl: string
      retrievedAt: string
      observedAt: string | null
      referencePeriod: string
      geographicPrecision: GeographicPrecision
      resolution: string
      quality: DataQuality
    }
    data: {
      events: unknown[]
      signal: { timestamp: string; value: number }[]
      period: string
      country: string
    }
    note: string | null
  }
  iodaEvents: {
    state: string
    events: IodaOutageEvent[]
    totalFound: number
    filteredCount: number
    note?: string
  }
  backbones: BackboneAsnStatus[]
  asnActivity: AsnBgpActivity
  cloudflare: {
    state: string
    provenance: {
      source: string
      sourceUrl: string
      retrievedAt: string
      observedAt: string | null
      referencePeriod: string
      geographicPrecision: GeographicPrecision
      resolution: string
      quality: DataQuality
    }
    data: unknown[]
    note: string
  }
}
