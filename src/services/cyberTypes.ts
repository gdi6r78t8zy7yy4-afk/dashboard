export type CyberClassificationKind =
  | 'published_warning'
  | 'exploited_vulnerability'
  | 'threat_indicator'
  | 'verified_incident'
  | 'derived_risk_assessment'
  | 'cve_record'

export type CyberClassificationTier = {
  tier: number
  id: CyberClassificationKind
  label: string
  shortLabel: string
  description: string
  rule: string
}

export type MitreTechnique = {
  id: string
  name: string
  tacticId: string
  tacticName: string
  description: string
  cwes: string[]
  mitigation: string
  url: string
  severity: 'critical' | 'elevated'
}

export type MitreTactic = {
  id: string
  name: string
  swedishName: string
  description: string
}

export type CertAdvisoryItem = {
  id: string
  title: string
  summary: string
  time: string
  source: string
  sourceUrl: string
  severity: 'critical' | 'elevated'
  kind: string
  cves: string[]
  mitreTechniques: MitreTechnique[]
  classificationTier: number
  classificationKind: CyberClassificationKind
  classificationLabel: string
  disambiguationNotice: string
}

export type CisaKevItem = {
  id: string
  cveID: string
  title: string
  vendor: string
  product: string
  summary: string
  dateAdded: string
  dueDate: string
  requiredAction: string
  knownRansomwareCampaignUse: string
  isRansomwareKnown: boolean
  cwes: string[]
  notes: string
  mitreTechniques: MitreTechnique[]
  hasCertSeAdvisory: boolean
  certSeMentionsCount: number
  severity: 'critical' | 'elevated'
  source: string
  sourceUrl: string
  nvdUrl: string
  retrievedAt: string
  classificationKind: CyberClassificationKind
  classificationLabel: string
  disambiguationNotice: string
}

export type NvdCveItem = {
  id: string
  cveId: string
  title: string
  description: string
  published: string | null
  lastModified: string | null
  vulnStatus: string
  cvssScore: number | null
  cvssSeverity: string
  cvssVersion: string | null
  cvssVector: string | null
  severity: 'critical' | 'elevated' | 'operational'
  affectedProducts: string[]
  cwes: string[]
  inCisaKev: boolean
  isRansomwareKnown: boolean
  mitreTechniques: MitreTechnique[]
  references: { url: string; source: string; tags: string[] }[]
  source: string
  sourceUrl: string
  retrievedAt: string
  classificationKind: CyberClassificationKind
  classificationLabel: string
  disambiguationNotice: string
}

export type MispIndicatorItem = {
  id: string
  eventId: string
  category: string
  type: string
  value: string
  timestamp: string
  comment: string
  toIds: boolean
  source: string
  severity: 'critical' | 'elevated' | 'operational'
  classificationKind: CyberClassificationKind
  classificationLabel: string
  disambiguationNotice: string
}

export type TimelineEvent = {
  id: string
  originalId: string
  type: 'cert_advisory' | 'cisa_kev' | 'nvd_cve' | 'misp_indicator'
  title: string
  summary: string
  time: string
  source: string
  sourceUrl: string
  severity: 'critical' | 'elevated' | 'operational'
  classificationTier: number
  classificationKind: CyberClassificationKind
  classificationLabel: string
  disambiguationNotice: string
  cves: string[]
  mitreTechniques: MitreTechnique[]
  badgeText: string
  cvssScore?: number | null
  requiredAction?: string
  dueDate?: string
}

export type CyberKpis = {
  certSeTotal: number
  certSeCritical: number
  cisaKevTotal: number
  cisaKevRansomware: number
  nvdRecentTotal: number
  nvdRecentCritical: number
  mitreTechniquesCount: number
  mispConfigured: boolean
  mispIndicatorsCount: number
}

export type DerivedRiskAssessment = {
  status: 'critical' | 'elevated' | 'operational'
  classificationKind: 'derived_risk_assessment'
  classificationLabel: string
  reason: string
  disambiguationNotice: string
}

export type CyberSourceProvenance = {
  id: string
  label: string
  state: 'ok' | 'stale' | 'error' | 'not_configured'
  sourceUrl?: string
  retrievedAt?: string
  observedAt?: string | null
  updateInterval?: string
  timeout?: string
  requiresAuth?: boolean
  verified?: boolean
  quality?: string
  lastError?: string | null
  cached?: boolean
}

export type CyberDashboardResponse = {
  state: 'ok' | 'stale' | 'error'
  retrievedAt: string
  kpis: CyberKpis
  classificationTiers: Record<string, CyberClassificationTier>
  derivedRiskAssessment: DerivedRiskAssessment
  timeline: TimelineEvent[]
  certAdvisories: CertAdvisoryItem[]
  cisaKev: {
    catalogVersion: string
    dateReleased: string
    count: number
    items: CisaKevItem[]
  }
  nvdCves: {
    totalResults: number
    items: NvdCveItem[]
  }
  mitreAttack: {
    matrix: string
    tactics: MitreTactic[]
    techniques: MitreTechnique[]
    totalTechniques: number
    totalTactics: number
    provenance: CyberSourceProvenance
  }
  misp: {
    state: string
    isConfigured: boolean
    message: string
    instanceHost: string | null
    indicators: MispIndicatorItem[]
    provenance: CyberSourceProvenance
  }
  sources: CyberSourceProvenance[]
}

export type CyberCveDetail = {
  cveId: string
  nvd: NvdCveItem | null
  cisaKev: CisaKevItem | null
  inCisaKev: boolean
  certSeAdvisories: CertAdvisoryItem[]
  mitreTechniques: MitreTechnique[]
  retrievedAt: string
  disambiguationNotice: string
}
