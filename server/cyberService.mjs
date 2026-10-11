/**
 * Cyber Threat & Vulnerability Aggregator Service.
 * Unifies CERT-SE, CISA KEV, NVD API 2.0, MITRE ATT&CK, and MISP feeds.
 * Strictly enforces 5-tier classification rules and disambiguation.
 */

import { getCertSeAdvisories } from './certSeAdapter.mjs'
import { getCisaKevData } from './cisaKevAdapter.mjs'
import { getNvdCveById, getNvdRecentCves } from './nvdAdapter.mjs'
import { getMitreAttackData, mapToMitreTechniques } from './mitreAttackAdapter.mjs'
import { getMispThreatData } from './mispAdapter.mjs'

export const CLASSIFICATION_TIERS = {
  published_warning: {
    tier: 1,
    id: 'published_warning',
    label: '1. Publicerad varning',
    shortLabel: 'Publicerad varning',
    description: 'Officiell varning, säkerhetsråd eller blixtmeddelande publicerat av nationell CSIRT (CERT-SE) eller myndighet.',
    rule: 'En publicerad varning innebär att användare uppmanas att granska berörda system och installera tillgängliga uppdateringar.',
  },
  exploited_vulnerability: {
    tier: 2,
    id: 'exploited_vulnerability',
    label: '2. Sårbarhet med känd exploatering',
    shortLabel: 'Känd exploatering (KEV)',
    description: 'Sårbarhet i officiella CISA KEV-katalogen där verkligt utnyttjande har observerats av hotaktörer.',
    rule: 'En post i CISA KEV innebär att sårbarheten utnyttjas globalt. Det innebär INTE automatiskt att sårbarheten utnyttjas i Sverige.',
  },
  threat_indicator: {
    tier: 3,
    id: 'threat_indicator',
    label: '3. Hotindikator i flöde (IoC)',
    shortLabel: 'Hotindikator (MISP)',
    description: 'Teknisk artefakt (IP-adress, domännamn, filhash) observerad i ett anslutet MISP-delningsflöde.',
    rule: 'En hotindikator är en observerad signal i ett flöde, inte ett bevis på intrång i det egna nätverket.',
  },
  verified_incident: {
    tier: 4,
    id: 'verified_incident',
    label: '4. Bekräftad incident',
    shortLabel: 'Bekräftad incident',
    description: 'Faktiskt verifierat dataintrång, driftavbrott eller cyberangrepp som påverkar infrastruktur eller organisation.',
    rule: 'Klassas endast som bekräftad incident när officiell källa bekräftar pågående eller genomfört angrepp.',
  },
  derived_risk_assessment: {
    tier: 5,
    id: 'derived_risk_assessment',
    label: '5. Härledd riskbedömning',
    shortLabel: 'Härledd riskbedömning',
    description: 'Analytisk sammanställning baserad på kombinationen av sårbarhetens allvarlighetsgrad och systemets exponering.',
    rule: 'En härledd bedömning är en analytisk slutsats och ska aldrig förväxlas med en observerad verklig attack.',
  },
  cve_record: {
    tier: 2,
    id: 'cve_record',
    label: '2. Teknisk sårbarhetsregistrering (NVD)',
    shortLabel: 'NVD CVE-post',
    description: 'Officiell CVE-registrering i NIST National Vulnerability Database med CVSS-poäng och tekniska specifikationer.',
    rule: 'En hög CVSS-poäng (t.ex. 9.8) innebär teknisk allvarlighetsgrad om sårbarheten nås, inte att den aktivt exploateras.',
  },
}

const CVE_REGEX = /\bCVE-\d{4}-\d{4,7}\b/gi

function extractCvesFromText(text) {
  if (!text || typeof text !== 'string') return []
  const matches = text.match(CVE_REGEX)
  if (!matches) return []
  return [...new Set(matches.map((c) => c.toUpperCase()))]
}

export async function getCyberDashboard({
  search = '',
  classificationFilter = 'all',
  severityFilter = 'all',
  fetchImpl = fetch,
  now = new Date(),
  forceRefresh = false,
} = {}) {
  const retrievedAt = new Date(now).toISOString()

  // Parallel fetch of all independent security sources
  const [certResult, cisaResult, nvdResult, mispResult] = await Promise.all([
    getCertSeAdvisories({ fetchImpl, now }),
    getCisaKevData({ fetchImpl, now, forceRefresh }),
    getNvdRecentCves({ fetchImpl, now, resultsPerPage: 25, forceRefresh }),
    getMispThreatData({ fetchImpl, now, forceRefresh }),
  ])

  const mitreResult = getMitreAttackData()

  // Pre-index CISA KEV by CVE ID for O(1) correlation
  const cisaMap = new Map()
  for (const item of cisaResult.items || []) {
    cisaMap.set(item.cveID, item)
  }

  // Pre-index CERT-SE by CVE mentions
  const certCveMentions = new Map()
  const certNormalizedItems = (certResult.items || []).map((item) => {
    const cves = extractCvesFromText(`${item.title} ${item.summary}`)
    const mitreTechs = mapToMitreTechniques({
      text: `${item.title} ${item.summary}`,
    })

    const classificationKey = item.kind === 'verified_incident' ? 'verified_incident' : 'published_warning'
    const tierMeta = CLASSIFICATION_TIERS[classificationKey]

    const enriched = {
      ...item,
      cves,
      mitreTechniques: mitreTechs,
      classificationTier: tierMeta.tier,
      classificationKind: tierMeta.id,
      classificationLabel: tierMeta.label,
      disambiguationNotice:
        classificationKey === 'verified_incident'
          ? 'Bekräftad incident enligt rapportering från CERT-SE.'
          : 'Publicerad nationell varning. Indikerar inte att alla svenska organisationer är drabbade, utan manar till proaktiv granskning.',
    }

    for (const cve of cves) {
      if (!certCveMentions.has(cve)) certCveMentions.set(cve, [])
      certCveMentions.get(cve).push(enriched)
    }

    return enriched
  })

  // Enrich CISA KEV items with MITRE techniques & CERT-SE mentions
  const cisaEnrichedItems = (cisaResult.items || []).slice(0, 100).map((kev) => {
    const mitreTechs = mapToMitreTechniques({
      cwes: kev.cwes,
      text: `${kev.title} ${kev.summary}`,
      isRansomware: kev.isRansomwareKnown,
    })

    const relatedCert = certCveMentions.get(kev.cveID) || []

    return {
      ...kev,
      mitreTechniques: mitreTechs,
      certSeMentionsCount: relatedCert.length,
      hasCertSeAdvisory: relatedCert.length > 0,
      classificationTier: 2,
    }
  })

  // Enrich NVD items with CISA KEV status & MITRE techniques
  const nvdEnrichedItems = (nvdResult.items || []).map((cve) => {
    const inCisa = cisaMap.get(cve.cveId)
    const relatedCert = certCveMentions.get(cve.cveId) || []
    const mitreTechs = mapToMitreTechniques({
      cwes: cve.cwes,
      text: `${cve.title} ${cve.description}`,
      isRansomware: inCisa?.isRansomwareKnown || false,
    })

    return {
      ...cve,
      inCisaKev: Boolean(inCisa),
      cisaKevDateAdded: inCisa?.dateAdded || null,
      isRansomwareKnown: inCisa?.isRansomwareKnown || false,
      certSeMentionsCount: relatedCert.length,
      mitreTechniques: mitreTechs,
      classificationTier: inCisa ? 2 : 2,
    }
  })

  // Unified Chronological Timeline (Deduplicated feed of events)
  const timeline = []

  // Add CERT-SE entries
  for (const item of certNormalizedItems) {
    timeline.push({
      id: `cert-${item.id}`,
      originalId: item.id,
      type: 'cert_advisory',
      title: item.title,
      summary: item.summary,
      time: item.time,
      source: 'CERT-SE',
      sourceUrl: item.sourceUrl,
      severity: item.severity,
      classificationTier: item.classificationTier,
      classificationKind: item.classificationKind,
      classificationLabel: item.classificationLabel,
      disambiguationNotice: item.disambiguationNotice,
      cves: item.cves,
      mitreTechniques: item.mitreTechniques,
      badgeText: item.kind === 'verified_incident' ? 'Incident' : 'Varning',
    })
  }

  // Add Top recent CISA KEV additions
  for (const kev of cisaEnrichedItems.slice(0, 40)) {
    timeline.push({
      id: `cisa-${kev.cveID}`,
      originalId: kev.cveID,
      type: 'cisa_kev',
      title: `${kev.cveID}: ${kev.vendor} ${kev.product} (Känd exploatering)`,
      summary: kev.summary,
      time: kev.dateAdded ? `${kev.dateAdded}T12:00:00Z` : retrievedAt,
      source: 'CISA KEV',
      sourceUrl: kev.sourceUrl,
      severity: kev.isRansomwareKnown ? 'critical' : 'elevated',
      classificationTier: 2,
      classificationKind: 'exploited_vulnerability',
      classificationLabel: '2. Sårbarhet med känd exploatering',
      disambiguationNotice: kev.disambiguationNotice,
      cves: [kev.cveID],
      mitreTechniques: kev.mitreTechniques,
      badgeText: kev.isRansomwareKnown ? 'KEV + Ransomware' : 'CISA KEV',
      requiredAction: kev.requiredAction,
      dueDate: kev.dueDate,
    })
  }

  // Add High/Critical NVD CVEs that are not already in timeline from CISA
  const seenCvesInTimeline = new Set(cisaEnrichedItems.slice(0, 40).map((k) => k.cveID))
  for (const nvd of nvdEnrichedItems.slice(0, 20)) {
    if (!seenCvesInTimeline.has(nvd.cveId)) {
      timeline.push({
        id: `nvd-${nvd.cveId}`,
        originalId: nvd.cveId,
        type: 'nvd_cve',
        title: nvd.title,
        summary: nvd.description,
        time: nvd.lastModified || nvd.published || retrievedAt,
        source: 'NVD (NIST)',
        sourceUrl: nvd.sourceUrl,
        severity: nvd.severity,
        classificationTier: 2,
        classificationKind: 'cve_record',
        classificationLabel: '2. Teknisk sårbarhetsregistrering (NVD)',
        disambiguationNotice: nvd.disambiguationNotice,
        cves: [nvd.cveId],
        mitreTechniques: nvd.mitreTechniques,
        badgeText: nvd.cvssScore ? `CVSS ${nvd.cvssScore}` : 'NVD CVE',
        cvssScore: nvd.cvssScore,
      })
    }
  }

  // Add MISP threat indicators if configured
  for (const misp of (mispResult.indicators || []).slice(0, 20)) {
    timeline.push({
      id: `misp-${misp.id}`,
      originalId: misp.id,
      type: 'misp_indicator',
      title: `MISP IoC: [${misp.type}] ${misp.value}`,
      summary: misp.comment,
      time: misp.timestamp,
      source: 'MISP',
      sourceUrl: 'https://www.misp-project.org/',
      severity: misp.severity,
      classificationTier: 3,
      classificationKind: 'threat_indicator',
      classificationLabel: '3. Hotindikator i flöde (IoC)',
      disambiguationNotice: misp.disambiguationNotice,
      cves: [],
      mitreTechniques: [],
      badgeText: 'IoC',
    })
  }

  // Sort timeline newest first
  timeline.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  // Deduplicate timeline by originalId
  const uniqueTimeline = []
  const seenTimelineIds = new Set()
  for (const item of timeline) {
    if (!seenTimelineIds.has(item.id)) {
      seenTimelineIds.add(item.id)
      uniqueTimeline.push(item)
    }
  }

  // KPI Metrics Calculation
  const certCriticalCount = certNormalizedItems.filter((i) => i.severity === 'critical').length
  const kevRansomwareCount = (cisaResult.items || []).filter((i) => i.isRansomwareKnown).length
  const nvdCriticalCount = (nvdResult.items || []).filter((i) => (i.cvssScore ?? 0) >= 9.0).length

  // Derived Overall Risk Posture (Separated clearly from observations!)
  let postureStatus = 'operational'
  let postureReason = 'Inga kritiska nationella blixtvarningar är aktiva just nu.'
  if (certCriticalCount > 0) {
    postureStatus = 'critical'
    postureReason = `${certCriticalCount} kritiska nationella varningar eller aktiva incidenter publicerade av CERT-SE.`
  } else if (certNormalizedItems.length > 0 || kevRansomwareCount > 0) {
    postureStatus = 'elevated'
    postureReason = `Förhöjd vaksamhet påkallad. ${certNormalizedItems.length} aktuella CERT-SE-meddelanden och ${kevRansomwareCount} kända sårbarheter med ransomware-koppling i CISA KEV.`
  }

  const derivedRiskAssessment = {
    status: postureStatus,
    classificationKind: 'derived_risk_assessment',
    classificationLabel: '5. Härledd riskbedömning',
    reason: postureReason,
    disambiguationNotice: 'Denna bedömning är en syntetiserad analys av öppna hotflöden och utgör inte en garanti mot oidentifierade sårbarheter eller isolerade angrepp.',
  }

  // Source Provenance List
  const sources = [
    {
      ...certResult.provenance,
      id: 'cert-se',
      label: 'CERT-SE Nationell CSIRT',
      state: certResult.state,
      lastError: certResult.lastError || null,
      cached: certResult.cached,
    },
    {
      ...cisaResult.provenance,
      id: 'cisa-kev',
      label: 'CISA KEV Katalog (USA CISA)',
      state: cisaResult.state,
      lastError: cisaResult.lastError || null,
      cached: cisaResult.cached,
    },
    {
      ...nvdResult.provenance,
      id: 'nvd-api',
      label: 'NVD API 2.0 (NIST USA)',
      state: nvdResult.state,
      lastError: nvdResult.lastError || null,
      cached: nvdResult.cached,
    },
    {
      ...mitreResult.provenance,
      id: 'mitre-attack',
      label: 'MITRE ATT&CK Enterprise Matrix',
      state: mitreResult.state,
      lastError: null,
      cached: true,
    },
    {
      ...mispResult.provenance,
      id: 'misp',
      label: 'MISP Threat Sharing Platform',
      state: mispResult.state,
      lastError: mispResult.lastError || null,
      cached: mispResult.cached,
    },
  ]

  return {
    state: 'ok',
    retrievedAt,
    kpis: {
      certSeTotal: certNormalizedItems.length,
      certSeCritical: certCriticalCount,
      cisaKevTotal: cisaResult.count || (cisaResult.items || []).length,
      cisaKevRansomware: kevRansomwareCount,
      nvdRecentTotal: nvdResult.totalResults || (nvdResult.items || []).length,
      nvdRecentCritical: nvdCriticalCount,
      mitreTechniquesCount: mitreResult.totalTechniques,
      mispConfigured: mispResult.isConfigured,
      mispIndicatorsCount: mispResult.totalIndicators,
    },
    classificationTiers: CLASSIFICATION_TIERS,
    derivedRiskAssessment,
    timeline: uniqueTimeline,
    certAdvisories: certNormalizedItems,
    cisaKev: {
      catalogVersion: cisaResult.catalogVersion,
      dateReleased: cisaResult.dateReleased,
      count: cisaResult.count,
      items: cisaEnrichedItems,
    },
    nvdCves: {
      totalResults: nvdResult.totalResults,
      items: nvdEnrichedItems,
    },
    mitreAttack: mitreResult,
    misp: mispResult,
    sources,
  }
}

/**
 * Detailed single CVE query combining NVD, CISA KEV, MITRE ATT&CK, and CERT-SE.
 */
export async function getCyberCveDetails(cveId, { fetchImpl = fetch, now = new Date() } = {}) {
  const cleanId = (cveId || '').trim().toUpperCase()
  if (!cleanId) return null

  const [nvdItem, cisaResult, certResult] = await Promise.all([
    getNvdCveById(cleanId, { fetchImpl, now }),
    getCisaKevData({ fetchImpl, now }),
    getCertSeAdvisories({ fetchImpl, now }),
  ])

  const kevItem = (cisaResult.items || []).find((k) => k.cveID === cleanId) || null
  const relatedCert = (certResult.items || []).filter((item) =>
    `${item.title} ${item.summary}`.toUpperCase().includes(cleanId)
  )

  const cwes = [
    ...(nvdItem?.cwes || []),
    ...(kevItem?.cwes || []),
  ]

  const mitreTechs = mapToMitreTechniques({
    cwes,
    text: `${nvdItem?.description || ''} ${kevItem?.summary || ''}`,
    isRansomware: kevItem?.isRansomwareKnown || false,
  })

  return {
    cveId: cleanId,
    nvd: nvdItem,
    cisaKev: kevItem,
    inCisaKev: Boolean(kevItem),
    certSeAdvisories: relatedCert,
    mitreTechniques: mitreTechs,
    retrievedAt: new Date(now).toISOString(),
    disambiguationNotice: 'En CVE-post visar teknisk potential och svaghet. Den innebär inte att organisationen eller nätverket har utsatts för ett intrångsförsök.',
  }
}
