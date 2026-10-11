const TRAFIKVERKET_API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json'
const TRAFIKVERKET_PORTAL_URL = 'https://bransch.trafikverket.se/tjanster/data-kartor-och-geodatatjanster/'
const CACHE_MS = 5 * 60 * 1000 // 5 minutes
const TIMEOUT_MS = 12 * 1000 // 12 seconds

let memoryCache = null

export function buildTrafikverketQuery(apiKey, limit = 25) {
  return `<REQUEST>
  <LOGIN authenticationkey="${apiKey}" />
  <QUERY objecttype="Situation" schemaversion="1.5" limit="${limit}">
    <FILTER>
      <IN name="Deviation.SeverityCode" value="3,4,5" />
    </FILTER>
  </QUERY>
</REQUEST>`
}

export function parseTrafikverketSituations(jsonResponse, now = new Date()) {
  const result = jsonResponse?.RESPONSE?.RESULT?.[0]
  if (result?.ERROR) {
    throw new Error(`Trafikverket API error: ${result.ERROR.MESSAGE ?? 'Okänt fel'}`)
  }

  const situations = result?.Situation ?? []
  const retrievedAt = new Date(now).toISOString()

  const incidents = []

  for (const situation of situations) {
    const sitId = situation.Id ?? situation.CountryCode ?? 'trafik-sit'
    const deviations = Array.isArray(situation.Deviation)
      ? situation.Deviation
      : situation.Deviation
        ? [situation.Deviation]
        : []

    for (const dev of deviations) {
      const devId = dev.Id ?? `${sitId}-${incidents.length}`
      const severityCode = Number(dev.SeverityCode ?? dev.SeverityText ?? 3)
      const severity = severityCode >= 4 ? 'critical' : 'elevated'
      const kind = severityCode >= 5 ? 'verified_incident' : 'warning'
      const title = dev.Header ?? dev.MessageCode ?? 'Trafikhändelse'
      const message = dev.Message ?? dev.Description ?? 'Trafikstörning rapporterad av Trafikverket.'
      const location = dev.Geometry?.WKT ?? dev.LocationDescriptor ?? dev.RoadNumber ?? 'Sverige'
      const startTime = dev.StartTime ? new Date(dev.StartTime).toISOString() : retrievedAt

      incidents.push({
        id: `trafikverket-${devId}`,
        source: 'Trafikverket',
        sourceUrl: TRAFIKVERKET_PORTAL_URL,
        category: 'Transport',
        service: 'Vägtrafik',
        title,
        summary: message,
        location,
        time: startTime,
        retrievedAt,
        verified: true,
        kind,
        severity,
        note: `Officiell trafikstörning rapporterad via Trafikverkets API (kod ${severityCode}).`,
      })
    }
  }

  return {
    retrievedAt,
    incidents,
  }
}

/**
 * Fetches and normalizes Trafikverket situations with API key verification, caching, and error handling.
 */
export async function getTrafikverketSituations({
  apiKey = process.env.TRAFIKVERKET_API_KEY,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const currentTime = new Date(now).getTime()
  const retrievedAt = new Date(now).toISOString()

  // Requirement: If authentication is not configured, clearly mark as not_configured (do NOT emit fake values)
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return {
      state: 'not_configured',
      retrievedAt,
      observedAt: null,
      cached: false,
      incidents: [],
      lastError: 'API-nyckel ej konfigurerad. Sätt TRAFIKVERKET_API_KEY på servern för trafikdata i realtid.',
      provenance: {
        source: 'Trafikverket Öppna API',
        sourceUrl: TRAFIKVERKET_PORTAL_URL,
        retrievedAt,
        observedAt: null,
        updateInterval: '5 min',
        timeout: '12 s',
        requiresAuth: true,
        verified: false,
        quality: 'missing',
      },
      note: 'Trafikverket kräver en kostnadsfri personlig API-nyckel. Konfigurera TRAFIKVERKET_API_KEY i .env.',
    }
  }

  // Check fresh cache
  if (memoryCache && currentTime - memoryCache.cachedAt < CACHE_MS) {
    return {
      ...memoryCache.data,
      cached: true,
      state: 'ok',
    }
  }

  try {
    const xmlBody = buildTrafikverketQuery(apiKey)
    const response = await fetchImpl(TRAFIKVERKET_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        Accept: 'application/json',
      },
      body: xmlBody,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`Trafikverket svarade med HTTP ${response.status}`)
    }

    const json = await response.json()
    const parsed = parseTrafikverketSituations(json, now)

    const result = {
      state: 'ok',
      retrievedAt: parsed.retrievedAt,
      observedAt: parsed.incidents[0]?.time ?? parsed.retrievedAt,
      cached: false,
      incidents: parsed.incidents,
      lastError: null,
      provenance: {
        source: 'Trafikverket Öppna API',
        sourceUrl: TRAFIKVERKET_PORTAL_URL,
        retrievedAt: parsed.retrievedAt,
        observedAt: parsed.incidents[0]?.time ?? parsed.retrievedAt,
        updateInterval: '5 min',
        timeout: '12 s',
        requiresAuth: true,
        verified: true,
        quality: 'official-statistic',
      },
      note: `Aktiva trafikhändelser (${parsed.incidents.length} st) hämtade från Trafikverket.`,
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
        lastError: error instanceof Error ? error.message : 'Kunde inte förnya data från Trafikverket.',
      }
    }

    return {
      state: 'error',
      retrievedAt,
      observedAt: null,
      cached: false,
      incidents: [],
      lastError: error instanceof Error ? error.message : 'Trafikverket API-anrop misslyckades.',
      provenance: {
        source: 'Trafikverket Öppna API',
        sourceUrl: TRAFIKVERKET_PORTAL_URL,
        retrievedAt,
        observedAt: null,
        updateInterval: '5 min',
        timeout: '12 s',
        requiresAuth: true,
        verified: false,
        quality: 'missing',
      },
      note: 'Fel vid kontakt med Trafikverkets tjänst.',
    }
  }
}

export function clearTrafikverketCache() {
  memoryCache = null
}
