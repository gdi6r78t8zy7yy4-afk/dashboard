/**
 * NVD API 2.0 Adapter.
 * National Vulnerability Database (NIST) API 2.0 client.
 * Documentation: https://nvd.nist.gov/developers/vulnerabilities
 */

const NVD_API_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0'
const NVD_DOCS_URL = 'https://nvd.nist.gov/vuln'

const CACHE_MS = 15 * 60 * 1000 // 15 minutes
const TIMEOUT_MS = 12 * 1000 // 12 seconds

let memoryCache = new Map()

export function clearNvdCache() {
  memoryCache.clear()
}

/**
 * Extracts CVSS score, vector, and severity level from NVD metrics object.
 */
export function extractCvssMetrics(metrics) {
  if (!metrics) {
    return {
      version: null,
      baseScore: null,
      baseSeverity: 'UNKNOWN',
      vectorString: null,
      exploitabilityScore: null,
      impactScore: null,
    }
  }

  // Priority 1: CVSS v3.1 (Primary or Secondary)
  const v31List = metrics.cvssMetricV31 || []
  const primaryV31 = v31List.find((m) => m.type === 'Primary') || v31List[0]
  if (primaryV31?.cvssData) {
    return {
      version: '3.1',
      baseScore: primaryV31.cvssData.baseScore ?? null,
      baseSeverity: primaryV31.cvssData.baseSeverity || primaryV31.baseSeverity || 'UNKNOWN',
      vectorString: primaryV31.cvssData.vectorString ?? null,
      exploitabilityScore: primaryV31.exploitabilityScore ?? null,
      impactScore: primaryV31.impactScore ?? null,
    }
  }

  // Priority 2: CVSS v3.0
  const v30List = metrics.cvssMetricV30 || []
  const primaryV30 = v30List.find((m) => m.type === 'Primary') || v30List[0]
  if (primaryV30?.cvssData) {
    return {
      version: '3.0',
      baseScore: primaryV30.cvssData.baseScore ?? null,
      baseSeverity: primaryV30.cvssData.baseSeverity || primaryV30.baseSeverity || 'UNKNOWN',
      vectorString: primaryV30.cvssData.vectorString ?? null,
      exploitabilityScore: primaryV30.exploitabilityScore ?? null,
      impactScore: primaryV30.impactScore ?? null,
    }
  }

  // Priority 3: CVSS v2.0
  const v2List = metrics.cvssMetricV2 || []
  const primaryV2 = v2List.find((m) => m.type === 'Primary') || v2List[0]
  if (primaryV2?.cvssData) {
    return {
      version: '2.0',
      baseScore: primaryV2.cvssData.baseScore ?? null,
      baseSeverity: primaryV2.baseSeverity || (primaryV2.cvssData.baseScore >= 7.0 ? 'HIGH' : primaryV2.cvssData.baseScore >= 4.0 ? 'MEDIUM' : 'LOW'),
      vectorString: primaryV2.cvssData.vectorString ?? null,
      exploitabilityScore: primaryV2.exploitabilityScore ?? null,
      impactScore: primaryV2.impactScore ?? null,
    }
  }

  return {
    version: null,
    baseScore: null,
    baseSeverity: 'UNKNOWN',
    vectorString: null,
    exploitabilityScore: null,
    impactScore: null,
  }
}

/**
 * Extracts affected products/vendors from CPE criteria.
 */
export function extractAffectedProducts(configurations) {
  if (!Array.isArray(configurations)) return []
  const products = new Set()

  for (const config of configurations) {
    const nodes = config.nodes || []
    for (const node of nodes) {
      const cpeMatches = node.cpeMatch || []
      for (const match of cpeMatches) {
        if (match.criteria) {
          // Format: cpe:2.3:a:vendor:product:version:...
          const parts = match.criteria.split(':')
          if (parts.length >= 5) {
            const vendor = parts[3].replace(/\\/g, '').replace(/_/g, ' ')
            const product = parts[4].replace(/\\/g, '').replace(/_/g, ' ')
            if (vendor && product && vendor !== '*' && product !== '*') {
              products.add(`${vendor} - ${product}`)
            }
          }
        }
      }
    }
  }

  return [...products].slice(0, 8)
}

/**
 * Normalizes an NVD CVE object into unified schema.
 */
export function normalizeNvdCve(rawCve, retrievedAt) {
  const cve = rawCve.cve || rawCve
  const cveId = (cve.id || '').trim().toUpperCase()
  const published = cve.published || null
  const lastModified = cve.lastModified || null
  const vulnStatus = cve.vulnStatus || 'Analyzed'

  // English description
  const descObj = (cve.descriptions || []).find((d) => d.lang === 'en') || cve.descriptions?.[0]
  const description = (descObj?.value || 'Ingen beskrivning tillgänglig i NVD.').trim()

  const cvss = extractCvssMetrics(cve.metrics)
  const affectedProducts = extractAffectedProducts(cve.configurations)

  // Extract CWEs
  const cwes = []
  if (Array.isArray(cve.weaknesses)) {
    for (const w of cve.weaknesses) {
      for (const d of w.description || []) {
        if (d.value && d.value !== 'NVD-CWE-noinfo' && d.value !== 'NVD-CWE-Other') {
          cwes.push(d.value)
        }
      }
    }
  }

  // Extract references
  const references = (cve.references || []).map((ref) => ({
    url: ref.url,
    source: ref.source || 'NVD',
    tags: ref.tags || [],
  })).slice(0, 5)

  // Map severity string to our StatusLevel
  const normalizedSeverity =
    cvss.baseScore !== null
      ? cvss.baseScore >= 9.0
        ? 'critical'
        : cvss.baseScore >= 7.0
          ? 'elevated'
          : 'operational'
      : 'operational'

  return {
    id: cveId,
    cveId,
    title: `${cveId}: ${description.slice(0, 110)}${description.length > 110 ? '…' : ''}`,
    description,
    published,
    lastModified,
    vulnStatus,
    cvssScore: cvss.baseScore,
    cvssSeverity: cvss.baseSeverity,
    cvssVersion: cvss.version,
    cvssVector: cvss.vectorString,
    severity: normalizedSeverity,
    affectedProducts,
    cwes,
    references,
    source: 'NVD (NIST)',
    sourceUrl: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`,
    retrievedAt,
    // Classification according to prompt rules:
    // 2. Sårbarhet (eller teknisk CVE-post)
    classificationKind: 'cve_record',
    classificationLabel: 'CVE-sårbarhetsregistrering (NVD)',
    disambiguationNotice: 'En CVE med hög CVSS-poäng innebär att sårbarheten har allvarliga tekniska konsekvenser om den utnyttjas. Det innebär INTE att en svensk organisation eller infrastruktur har angripits.',
  }
}

/**
 * Fetches recent CVEs from NVD API 2.0 with rate-limit and error handling.
 */
export async function getNvdRecentCves({
  days = 14,
  resultsPerPage = 20,
  startIndex = 0,
  fetchImpl = fetch,
  now = new Date(),
  forceRefresh = false,
} = {}) {
  const cacheKey = `recent_${days}_${resultsPerPage}_${startIndex}`
  const currentTime = new Date(now).getTime()

  if (!forceRefresh) {
    const cached = memoryCache.get(cacheKey)
    if (cached && currentTime - cached.cachedAt < CACHE_MS) {
      return {
        ...cached.data,
        cached: true,
        state: 'ok',
      }
    }
  }

  const retrievedAt = new Date(now).toISOString()
  const pastDate = new Date(currentTime - days * 86400 * 1000)
  const lastModStartDate = pastDate.toISOString()
  const lastModEndDate = new Date(now).toISOString()

  const params = new URLSearchParams({
    lastModStartDate,
    lastModEndDate,
    resultsPerPage: String(resultsPerPage),
    startIndex: String(startIndex),
  })

  const url = `${NVD_API_BASE}?${params.toString()}`
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'InfrastructureWatch/1.0 (NVD Client)',
  }

  const apiKey = process.env.NVD_API_KEY
  if (apiKey) {
    headers.apiKey = apiKey
  }

  try {
    const response = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`NVD API svarade med HTTP ${response.status}`)
    }

    const data = await response.json()
    const rawList = Array.isArray(data.vulnerabilities) ? data.vulnerabilities : []
    const items = rawList.map((item) => normalizeNvdCve(item, retrievedAt))

    // Sort by lastModified / published descending
    items.sort((a, b) => {
      const timeA = new Date(a.lastModified || a.published || 0).getTime()
      const timeB = new Date(b.lastModified || b.published || 0).getTime()
      return timeB - timeA
    })

    const result = {
      state: 'ok',
      totalResults: data.totalResults || items.length,
      resultsPerPage: data.resultsPerPage || resultsPerPage,
      startIndex: data.startIndex || startIndex,
      items,
      retrievedAt,
      cached: false,
      provenance: {
        source: 'NVD API 2.0',
        sourceUrl: url,
        portalUrl: NVD_DOCS_URL,
        retrievedAt,
        observedAt: items[0]?.lastModified || retrievedAt,
        totalResults: data.totalResults || items.length,
        updateInterval: '15 min',
        timeout: '12 s',
        requiresAuth: Boolean(apiKey),
        hasApiKey: Boolean(apiKey),
        verified: true,
        quality: 'official-nvd-feed',
      },
    }

    memoryCache.set(cacheKey, {
      cachedAt: currentTime,
      data: result,
    })

    return result
  } catch (err) {
    const cached = memoryCache.get(cacheKey)
    if (cached) {
      return {
        ...cached.data,
        state: 'stale',
        cached: true,
        lastError: err instanceof Error ? err.message : String(err),
      }
    }

    return {
      state: 'error',
      totalResults: 0,
      resultsPerPage,
      startIndex,
      items: [],
      retrievedAt,
      cached: false,
      lastError: err instanceof Error ? err.message : String(err),
      provenance: {
        source: 'NVD API 2.0',
        sourceUrl: url,
        portalUrl: NVD_DOCS_URL,
        retrievedAt,
        observedAt: null,
        totalResults: 0,
        updateInterval: '15 min',
        timeout: '12 s',
        requiresAuth: Boolean(apiKey),
        hasApiKey: Boolean(apiKey),
        verified: false,
        quality: 'missing',
      },
    }
  }
}

/**
 * Fetches a single CVE by ID from NVD API 2.0.
 */
export async function getNvdCveById(cveId, { fetchImpl = fetch, now = new Date() } = {}) {
  const cleanId = (cveId || '').trim().toUpperCase()
  if (!cleanId) return null

  const cacheKey = `cve_${cleanId}`
  const currentTime = new Date(now).getTime()
  const cached = memoryCache.get(cacheKey)
  if (cached && currentTime - cached.cachedAt < CACHE_MS) {
    return cached.data
  }

  const url = `${NVD_API_BASE}?cveId=${encodeURIComponent(cleanId)}`
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'InfrastructureWatch/1.0 (NVD Single Lookup)',
  }
  const apiKey = process.env.NVD_API_KEY
  if (apiKey) headers.apiKey = apiKey

  try {
    const res = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) return null
    const json = await res.json()
    const item = json.vulnerabilities?.[0]
    if (!item) return null

    const normalized = normalizeNvdCve(item, new Date(now).toISOString())
    memoryCache.set(cacheKey, {
      cachedAt: currentTime,
      data: normalized,
    })
    return normalized
  } catch {
    return null
  }
}
