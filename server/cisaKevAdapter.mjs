/**
 * CISA Known Exploited Vulnerabilities (KEV) Adapter.
 * Reads the authoritative machine-readable catalog from CISA.
 * Official URL: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
 * GitHub Mirror: https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json
 */

const CISA_KEV_PRIMARY_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
const CISA_KEV_FALLBACK_URL = 'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json'
const CISA_DOCS_URL = 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'

const CACHE_MS = 30 * 60 * 1000 // 30 minutes
const TIMEOUT_MS = 10 * 1000 // 10 seconds

let memoryCache = null

export function clearCisaKevCache() {
  memoryCache = null
}

export function normalizeCisaKevItem(raw, retrievedAt) {
  const cveID = (raw.cveID || '').trim().toUpperCase()
  const vendor = (raw.vendorProject || '').trim()
  const product = (raw.product || '').trim()
  const vulnName = (raw.vulnerabilityName || '').trim()
  const dateAdded = raw.dateAdded || ''
  const dueDate = raw.dueDate || ''
  const requiredAction = (raw.requiredAction || '').trim()
  const ransomware = raw.knownRansomwareCampaignUse || 'Unknown'
  const isRansomwareKnown = String(ransomware).toLowerCase() === 'known'
  const cwes = Array.isArray(raw.cwes) ? raw.cwes : []
  const notes = (raw.notes || '').trim()
  const shortDescription = (raw.shortDescription || '').trim()

  return {
    id: cveID,
    cveID,
    title: vulnName || `${vendor} ${product} Sårbarhet (${cveID})`,
    vendor,
    product,
    summary: shortDescription,
    dateAdded,
    dueDate,
    requiredAction,
    knownRansomwareCampaignUse: ransomware,
    isRansomwareKnown,
    cwes,
    notes,
    source: 'CISA KEV',
    sourceUrl: CISA_DOCS_URL,
    nvdUrl: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveID)}`,
    retrievedAt,
    // Classification according to prompt rules:
    // 2. Sårbarhet med känd exploatering (Exploited vulnerability)
    classificationKind: 'exploited_vulnerability',
    classificationLabel: 'Sårbarhet med känd exploatering',
    severity: isRansomwareKnown ? 'critical' : 'elevated',
    disambiguationNotice: 'En post i CISA KEV innebär att sårbarheten har utnyttjats i observerade attacker globalt. Det innebär inte automatiskt att sårbarheten utnyttjas i Sverige eller mot svenska organisationer.',
  }
}

export async function getCisaKevData({ fetchImpl = fetch, now = new Date(), forceRefresh = false } = {}) {
  const currentTime = new Date(now).getTime()

  if (!forceRefresh && memoryCache && currentTime - memoryCache.cachedAt < CACHE_MS) {
    return {
      ...memoryCache.data,
      cached: true,
      state: 'ok',
    }
  }

  const retrievedAt = new Date(now).toISOString()

  // Try primary CISA URL, then fallback
  const urls = [CISA_KEV_PRIMARY_URL, CISA_KEV_FALLBACK_URL]
  let lastError = null

  for (const url of urls) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'InfrastructureWatch/1.0 (CISA KEV Client)',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!response.ok) {
        throw new Error(`CISA svarade med HTTP ${response.status} på ${url}`)
      }

      const json = await response.json()
      const rawList = Array.isArray(json.vulnerabilities) ? json.vulnerabilities : []

      const items = rawList.map((item) => normalizeCisaKevItem(item, retrievedAt))

      // Sort newest dateAdded first
      items.sort((a, b) => {
        if (!a.dateAdded) return 1
        if (!b.dateAdded) return -1
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
      })

      const catalogVersion = json.catalogVersion || 'Unknown'
      const dateReleased = json.dateReleased || retrievedAt
      const count = json.count || items.length

      const result = {
        state: 'ok',
        catalogVersion,
        dateReleased,
        count,
        items,
        retrievedAt,
        cached: false,
        provenance: {
          source: 'CISA KEV',
          sourceUrl: url,
          catalogUrl: CISA_DOCS_URL,
          retrievedAt,
          observedAt: dateReleased,
          catalogVersion,
          totalCount: count,
          updateInterval: '30 min',
          timeout: '10 s',
          requiresAuth: false,
          verified: true,
          quality: 'official-exploited-catalog',
        },
      }

      memoryCache = {
        cachedAt: currentTime,
        data: result,
      }

      return result
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  // Return stale cache if available
  if (memoryCache) {
    return {
      ...memoryCache.data,
      state: 'stale',
      cached: true,
      lastError: lastError || 'Kunde inte uppdatera CISA KEV.',
    }
  }

  return {
    state: 'error',
    catalogVersion: null,
    dateReleased: null,
    count: 0,
    items: [],
    retrievedAt,
    cached: false,
    lastError: lastError || 'Kunde inte hämta CISA KEV-katalogen.',
    provenance: {
      source: 'CISA KEV',
      sourceUrl: CISA_KEV_PRIMARY_URL,
      catalogUrl: CISA_DOCS_URL,
      retrievedAt,
      observedAt: null,
      catalogVersion: null,
      totalCount: 0,
      updateInterval: '30 min',
      timeout: '10 s',
      requiresAuth: false,
      verified: false,
      quality: 'missing',
    },
  }
}
