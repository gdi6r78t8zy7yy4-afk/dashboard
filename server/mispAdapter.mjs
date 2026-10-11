/**
 * MISP (Malware Information Sharing Platform) Adapter.
 * Integrates threat sharing IoCs strictly when configured via environment variables.
 * Never leaks secrets or API credentials to frontend or client responses.
 * Official docs: https://www.misp-project.org/
 */

const CACHE_MS = 10 * 60 * 1000 // 10 minutes
const TIMEOUT_MS = 10 * 1000 // 10 seconds

let memoryCache = null

export function clearMispCache() {
  memoryCache = null
}

export function isMispConfigured() {
  const url = process.env.MISP_URL
  const key = process.env.MISP_API_KEY
  return Boolean(url && url.trim().length > 0 && key && key.trim().length > 0)
}

export function normalizeMispAttribute(raw, retrievedAt) {
  const id = raw.id || `misp-${Math.random().toString(36).substring(2, 9)}`
  const eventId = raw.event_id || raw.Event?.id || 'Unknown'
  const category = raw.category || 'Network activity'
  const type = raw.type || 'ip-dst'
  const value = raw.value || ''
  const timestamp = raw.timestamp
    ? new Date(Number(raw.timestamp) * 1000).toISOString()
    : retrievedAt
  const comment = raw.comment || 'Hotindikator delad via MISP-gemenskapen.'
  const toIds = Boolean(raw.to_ids)

  return {
    id: String(id),
    eventId: String(eventId),
    category,
    type,
    value,
    timestamp,
    comment,
    toIds,
    source: 'MISP Threat Sharing',
    retrievedAt,
    // Classification according to prompt rules:
    // 3. Hotindikator observerad i ett flöde (Threat indicator / IoC)
    classificationKind: 'threat_indicator',
    classificationLabel: 'Hotindikator observerad i ett flöde',
    severity: toIds ? 'elevated' : 'operational',
    disambiguationNotice: 'En hotindikator (IoC) är en observerad teknisk artefakt (IP-adress, domän eller filhash) i ett hotdelningsflöde. Det innebär INTE att ditt nätverk har komprometterats.',
  }
}

export async function getMispThreatData({ fetchImpl = fetch, now = new Date(), forceRefresh = false } = {}) {
  const currentTime = new Date(now).getTime()
  const retrievedAt = new Date(now).toISOString()

  const configured = isMispConfigured()
  if (!configured) {
    return {
      state: 'not_configured',
      isConfigured: false,
      message: 'Ingen MISP-instans är konfigurerad. Ange miljövariablerna MISP_URL och MISP_API_KEY på servern för att aktivera hotdelning via MISP.',
      instanceHost: null,
      totalIndicators: 0,
      indicators: [],
      retrievedAt,
      cached: false,
      provenance: {
        source: 'MISP Threat Sharing',
        sourceUrl: 'https://www.misp-project.org/',
        retrievedAt,
        observedAt: null,
        updateInterval: 'Vid konfiguration',
        timeout: '10 s',
        requiresAuth: true,
        isConfigured: false,
        verified: false,
        quality: 'unconfigured-flow',
      },
    }
  }

  const mispUrl = (process.env.MISP_URL || '').replace(/\/+$/, '')
  const mispKey = process.env.MISP_API_KEY

  if (!forceRefresh && memoryCache && currentTime - memoryCache.cachedAt < CACHE_MS) {
    return {
      ...memoryCache.data,
      cached: true,
      state: 'ok',
    }
  }

  try {
    const searchUrl = `${mispUrl}/attributes/restSearch`
    const body = {
      returnFormat: 'json',
      limit: 50,
      to_ids: 1,
    }

    const response = await fetchImpl(searchUrl, {
      method: 'POST',
      headers: {
        Authorization: mispKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'InfrastructureWatch/1.0 (MISP Client)',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`MISP-instansen svarade med HTTP ${response.status}`)
    }

    const data = await response.json()
    const rawAttrs = Array.isArray(data.response?.Attribute)
      ? data.response.Attribute
      : Array.isArray(data)
        ? data
        : []

    const indicators = rawAttrs.map((attr) => normalizeMispAttribute(attr, retrievedAt))

    // Host mask to ensure no internal URL structure or tokens leak
    let instanceHost = 'Konfigurerad MISP'
    try {
      const u = new URL(mispUrl)
      instanceHost = u.hostname
    } catch {
      // keep fallback
    }

    const result = {
      state: 'ok',
      isConfigured: true,
      instanceHost,
      message: `Ansluten till ${instanceHost}. ${indicators.length} färska hotindikatorer inlästa.`,
      totalIndicators: indicators.length,
      indicators,
      retrievedAt,
      cached: false,
      provenance: {
        source: `MISP (${instanceHost})`,
        sourceUrl: 'https://www.misp-project.org/',
        retrievedAt,
        observedAt: indicators[0]?.timestamp || retrievedAt,
        updateInterval: '10 min',
        timeout: '10 s',
        requiresAuth: true,
        isConfigured: true,
        verified: true,
        quality: 'configured-threat-feed',
      },
    }

    memoryCache = {
      cachedAt: currentTime,
      data: result,
    }

    return result
  } catch (error) {
    if (memoryCache) {
      return {
        ...memoryCache.data,
        state: 'stale',
        cached: true,
        lastError: error instanceof Error ? error.message : 'Kunde inte kontakta MISP.',
      }
    }

    let instanceHost = 'MISP'
    try {
      const u = new URL(mispUrl)
      instanceHost = u.hostname
    } catch {
      // ignore
    }

    return {
      state: 'error',
      isConfigured: true,
      instanceHost,
      message: `Fel vid anslutning till MISP: ${error instanceof Error ? error.message : 'Timeout'}`,
      totalIndicators: 0,
      indicators: [],
      retrievedAt,
      cached: false,
      lastError: error instanceof Error ? error.message : 'Nätverksfel mot MISP.',
      provenance: {
        source: `MISP (${instanceHost})`,
        sourceUrl: 'https://www.misp-project.org/',
        retrievedAt,
        observedAt: null,
        updateInterval: '10 min',
        timeout: '10 s',
        requiresAuth: true,
        isConfigured: true,
        verified: false,
        quality: 'missing',
      },
    }
  }
}
