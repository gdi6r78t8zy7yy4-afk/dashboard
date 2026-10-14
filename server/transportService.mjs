/**
 * Transport Service for Infrastructure Watch
 * Provides unified data adapters for Road (Väg), Rail (Järnväg), and Aviation (Flyg)
 * Data Sources:
 * - Trafikverket Öppna API (RoadCondition, TrainAnnouncement)
 * - OpenSky Network API (ADS-B live aircraft observations)
 */

const TRAFIKVERKET_API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json'
const TRAFIKVERKET_PORTAL_URL = 'https://bransch.trafikverket.se/tjanster/data-kartor-och-geodatatjanster/'
const OPENSKY_API_URL = 'https://opensky-network.org/api/states/all'
const OPENSKY_PORTAL_URL = 'https://opensky-network.org/data/api'

const CACHE_TTL_MS = 60 * 1000 // 60 seconds

const memoryCache = new Map()

export function clearTransportCache() {
  memoryCache.clear()
}

function getCache(key) {
  const item = memoryCache.get(key)
  if (!item) return null
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key)
    return null
  }
  return item.data
}

function setCache(key, data, ttlMs = CACHE_TTL_MS) {
  memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

/**
 * Parses coordinates from WGS84 LineString or Point
 * e.g. "LINESTRING (20.96 64.75, 20.97 64.75)" or "POINT (18.06 59.33)"
 */
export function parseWgs84Geometry(wgs84Str) {
  if (!wgs84Str || typeof wgs84Str !== 'string') return null
  try {
    const pointMatch = wgs84Str.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i)
    if (pointMatch) {
      return {
        longitude: parseFloat(pointMatch[1]),
        latitude: parseFloat(pointMatch[2]),
      }
    }
    const lineMatch = wgs84Str.match(/LINESTRING\s*\(\s*([-\d.]+)\s+([-\d.]+)/i)
    if (lineMatch) {
      return {
        longitude: parseFloat(lineMatch[1]),
        latitude: parseFloat(lineMatch[2]),
      }
    }
  } catch {
    // fallback
  }
  return null
}

/**
 * Road adapter: Fetches Swedish road conditions and disruptions from Trafikverket
 */
export async function getTransportRoadData({
  apiKey = process.env.TRAFIKVERKET_API_KEY,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const cached = getCache('road_data')
  if (cached) return cached

  const retrievedAt = new Date(now).toISOString()

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    const result = {
      mode: 'road',
      status: 'not_configured',
      retrievedAt,
      lastChecked: retrievedAt,
      items: [],
      error: 'Trafikverket API-nyckel saknas. Sätt TRAFIKVERKET_API_KEY i miljövariabler.',
      provenance: {
        source: 'Trafikverket Öppna API (Vägtrafik)',
        url: TRAFIKVERKET_PORTAL_URL,
        requiresAuth: true,
        updateInterval: '5 min',
        licensing: 'Trafikverkets öppna data-licens (kräver registrering)',
      },
    }
    return result
  }

  try {
    const xmlQuery = `<REQUEST>
      <LOGIN authenticationkey="${apiKey}" />
      <QUERY objecttype="RoadCondition" schemaversion="1.2" limit="30">
        <FILTER>
          <NE name="ConditionCode" value="1" />
        </FILTER>
      </QUERY>
    </REQUEST>`

    const response = await fetchImpl(TRAFIKVERKET_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml', Accept: 'application/json' },
      body: xmlQuery,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`Trafikverket RoadCondition svarade med HTTP ${response.status}`)
    }

    const json = await response.json()
    const errorMsg = json?.RESPONSE?.RESULT?.[0]?.ERROR?.MESSAGE
    if (errorMsg) {
      throw new Error(`Trafikverket API fel: ${errorMsg}`)
    }

    const rawConditions = json?.RESPONSE?.RESULT?.[0]?.RoadCondition || []
    const items = rawConditions.map((rc, idx) => {
      const coords = parseWgs84Geometry(rc.Geometry?.WGS84)
      const warningText = Array.isArray(rc.Warning) ? rc.Warning.join(', ') : rc.Warning || rc.ConditionText || 'Besvärligt väglag'
      const conditionInfo = Array.isArray(rc.ConditionInfo) ? rc.ConditionInfo.join(', ') : rc.ConditionInfo || ''

      return {
        id: `road-${rc.Id || idx}`,
        mode: 'road',
        transportType: 'Vägtrafik',
        title: `${rc.RoadNumber || 'Väg'}: ${warningText}`,
        summary: `Väglag: ${rc.ConditionText || 'Observerat'}. ${conditionInfo ? `Tillstånd: ${conditionInfo}.` : ''} ${rc.LocationText || ''}`.trim(),
        location: rc.LocationText || rc.RoadNumber || 'Sverige',
        roadNumber: rc.RoadNumber || null,
        conditionCode: rc.ConditionCode,
        conditionText: rc.ConditionText,
        coordinates: coords,
        severity: rc.ConditionCode >= 3 ? 'critical' : 'elevated',
        kind: rc.ConditionCode >= 3 ? 'verified_incident' : 'warning',
        time: rc.StartTime ? new Date(rc.StartTime).toISOString() : (rc.ModifiedTime ? new Date(rc.ModifiedTime).toISOString() : retrievedAt),
        retrievedAt,
        source: 'Trafikverket',
        sourceUrl: TRAFIKVERKET_PORTAL_URL,
        verified: true,
      }
    })

    const result = {
      mode: 'road',
      status: 'ok',
      retrievedAt,
      lastChecked: retrievedAt,
      count: items.length,
      items,
      error: null,
      provenance: {
        source: 'Trafikverket Öppna API (RoadCondition v1.2)',
        url: TRAFIKVERKET_PORTAL_URL,
        requiresAuth: true,
        updateInterval: '5 min',
        licensing: 'Trafikverkets öppna data-licens',
      },
    }

    setCache('road_data', result)
    return result
  } catch (error) {
    const result = {
      mode: 'road',
      status: 'error',
      retrievedAt,
      lastChecked: retrievedAt,
      items: [],
      error: error instanceof Error ? error.message : 'Kunde inte hämta väglag från Trafikverket',
      provenance: {
        source: 'Trafikverket Öppna API',
        url: TRAFIKVERKET_PORTAL_URL,
        requiresAuth: true,
        updateInterval: '5 min',
      },
    }
    return result
  }
}

/**
 * Rail adapter: Fetches Swedish railway disruptions, cancellations and delays from Trafikverket
 */
export async function getTransportRailData({
  apiKey = process.env.TRAFIKVERKET_API_KEY,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const cached = getCache('rail_data')
  if (cached) return cached

  const retrievedAt = new Date(now).toISOString()

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    const result = {
      mode: 'rail',
      status: 'not_configured',
      retrievedAt,
      lastChecked: retrievedAt,
      items: [],
      error: 'Trafikverket API-nyckel saknas. Sätt TRAFIKVERKET_API_KEY på servern för tågtrafikdata.',
      provenance: {
        source: 'Trafikverket Öppna API (Järnväg)',
        url: TRAFIKVERKET_PORTAL_URL,
        requiresAuth: true,
        updateInterval: '2 min',
        licensing: 'Trafikverkets öppna data-licens',
      },
    }
    return result
  }

  try {
    const xmlQuery = `<REQUEST>
      <LOGIN authenticationkey="${apiKey}" />
      <QUERY objecttype="TrainAnnouncement" schemaversion="1.9" limit="30">
        <FILTER>
          <OR>
            <EQ name="Canceled" value="true" />
            <EXISTS name="Deviation" value="true" />
          </OR>
        </FILTER>
      </QUERY>
    </REQUEST>`

    const response = await fetchImpl(TRAFIKVERKET_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml', Accept: 'application/json' },
      body: xmlQuery,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`Trafikverket TrainAnnouncement svarade med HTTP ${response.status}`)
    }

    const json = await response.json()
    const errorMsg = json?.RESPONSE?.RESULT?.[0]?.ERROR?.MESSAGE
    if (errorMsg) {
      throw new Error(`Trafikverket API fel: ${errorMsg}`)
    }

    const announcements = json?.RESPONSE?.RESULT?.[0]?.TrainAnnouncement || []
    const items = announcements.map((ta, idx) => {
      const isCanceled = ta.Canceled === true
      const deviations = Array.isArray(ta.Deviation)
        ? ta.Deviation.map((d) => d.Description).filter(Boolean)
        : ta.Deviation?.Description
          ? [ta.Deviation.Description]
          : []
      const otherInfo = Array.isArray(ta.OtherInformation)
        ? ta.OtherInformation.map((o) => o.Description).filter(Boolean)
        : ta.OtherInformation?.Description
          ? [ta.OtherInformation.Description]
          : []

      const devText = [...deviations, ...otherInfo].join('. ') || (isCanceled ? 'Inställd avgång' : 'Avvikelse i tidtabell')
      const trainIdent = ta.AdvertisedTrainIdent || ta.OperationalTrainNumber || 'Tåg'
      const operator = ta.InformationOwner || ta.Operator || 'Järnvägsoperatör'
      const fromLoc = ta.FromLocation?.[0]?.LocationName || ''
      const toLoc = ta.ToLocation?.[0]?.LocationName || ''
      const routeText = fromLoc && toLoc ? `${fromLoc} → ${toLoc}` : ''

      return {
        id: `rail-${ta.ActivityId || idx}`,
        mode: 'rail',
        transportType: 'Järnvägstrafik',
        title: isCanceled ? `Tåg ${trainIdent} inställt (${operator})` : `Tåg ${trainIdent}: ${deviations[0] || 'Trafikstörning'}`,
        summary: `${routeText ? `Sträcka: ${routeText}. ` : ''}${devText}. Station/signatur: ${ta.LocationSignature || 'Sverige'}.`.trim(),
        location: ta.LocationSignature ? `Station ${ta.LocationSignature}` : 'Svenska järnvägsnätet',
        trainIdent,
        operator,
        isCanceled,
        deviations,
        severity: isCanceled ? 'critical' : 'elevated',
        kind: isCanceled ? 'verified_incident' : 'warning',
        time: ta.AdvertisedTimeAtLocation ? new Date(ta.AdvertisedTimeAtLocation).toISOString() : retrievedAt,
        retrievedAt,
        source: 'Trafikverket',
        sourceUrl: ta.WebLink || TRAFIKVERKET_PORTAL_URL,
        verified: true,
      }
    })

    const result = {
      mode: 'rail',
      status: 'ok',
      retrievedAt,
      lastChecked: retrievedAt,
      count: items.length,
      items,
      error: null,
      provenance: {
        source: 'Trafikverket Öppna API (TrainAnnouncement v1.9)',
        url: TRAFIKVERKET_PORTAL_URL,
        requiresAuth: true,
        updateInterval: '2 min',
        licensing: 'Trafikverkets öppna data-licens',
      },
    }

    setCache('rail_data', result)
    return result
  } catch (error) {
    const result = {
      mode: 'rail',
      status: 'error',
      retrievedAt,
      lastChecked: retrievedAt,
      items: [],
      error: error instanceof Error ? error.message : 'Kunde inte hämta järnvägsdata från Trafikverket',
      provenance: {
        source: 'Trafikverket Öppna API (Järnväg)',
        url: TRAFIKVERKET_PORTAL_URL,
        requiresAuth: true,
        updateInterval: '2 min',
      },
    }
    return result
  }
}

/**
 * Aviation adapter: Queries OpenSky Network API for live ADS-B flight observations in Nordic airspace
 */
export async function getTransportAviationData({
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const cached = getCache('aviation_data')
  if (cached) return cached

  const retrievedAt = new Date(now).toISOString()

  // Bounding box for Sweden / Southern Scandinavia: lat 55 to 69, lon 11 to 24
  const url = `${OPENSKY_API_URL}?lamin=55.0&lomin=11.0&lamax=69.0&lomax=24.0`

  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'InfrastructureWatch/1.0 (Traffic Awareness)',
      },
      signal: AbortSignal.timeout(5000), // Short timeout to avoid blocking if OpenSky rate limits
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('OpenSky Network hastighetsbegränsning uppnådd (HTTP 429). Anonyma förfrågningar är begränsade till 10 s intervall.')
      }
      throw new Error(`OpenSky Network svarade med HTTP ${response.status}`)
    }

    const data = await response.json()
    const rawStates = data.states || []

    const items = rawStates.slice(0, 40).map((state, idx) => {
      const icao24 = state[0]
      const callsign = (state[1] || '').trim() || icao24
      const originCountry = state[2]
      const timePosition = state[3]
      const longitude = state[5]
      const latitude = state[6]
      const baroAltitude = state[7] // meters
      const velocity = state[9] // m/s
      const trueTrack = state[10]

      return {
        id: `flight-${icao24 || idx}`,
        mode: 'aviation',
        transportType: 'Luftfart',
        title: `Flygning ${callsign} (${originCountry || 'ADS-B observation'})`,
        summary: `Höjd: ${baroAltitude ? `${Math.round(baroAltitude)} m` : 'Okänd'}. Hastighet: ${velocity ? `${Math.round(velocity * 3.6)} km/h` : 'Okänd'}. Kurs: ${trueTrack ? `${Math.round(trueTrack)}°` : 'N/A'}. Transponder: ${icao24}.`,
        location: latitude && longitude ? `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E` : 'Nordiskt luftrum',
        callsign,
        icao24,
        originCountry,
        altitudeMeters: baroAltitude,
        velocityKmh: velocity ? Math.round(velocity * 3.6) : null,
        coordinates: latitude && longitude ? { latitude, longitude } : null,
        severity: 'operational',
        kind: 'technical_observation',
        time: timePosition ? new Date(timePosition * 1000).toISOString() : retrievedAt,
        retrievedAt,
        source: 'OpenSky Network',
        sourceUrl: OPENSKY_PORTAL_URL,
        verified: true,
      }
    })

    const result = {
      mode: 'aviation',
      status: 'ok',
      retrievedAt,
      lastChecked: retrievedAt,
      count: items.length,
      items,
      error: null,
      provenance: {
        source: 'OpenSky Network REST API (ADS-B Live States)',
        url: OPENSKY_PORTAL_URL,
        requiresAuth: false,
        updateInterval: '10 s',
        licensing: 'OpenSky Network användarvillkor (öppna ADS-B observationer)',
        caveat: 'ADS-B observationer av flygplan i luften, inte ett fullständigt flygplatstidtabells- eller försening-API.',
      },
    }

    setCache('aviation_data', result, 30 * 1000) // 30 sec cache
    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Kunde inte ansluta till OpenSky Network'
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('hastighetsbegränsning')
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('aborted')

    const result = {
      mode: 'aviation',
      status: isRateLimit ? 'rate_limited' : isTimeout ? 'timeout' : 'error',
      retrievedAt,
      lastChecked: retrievedAt,
      count: 0,
      items: [],
      error: isTimeout
        ? 'OpenSky Network svarade inte inom tidsgränsen. Öppna API:et har strikta anonyma begränsningar.'
        : errorMsg,
      provenance: {
        source: 'OpenSky Network REST API',
        url: OPENSKY_PORTAL_URL,
        requiresAuth: false,
        updateInterval: '10 s',
        licensing: 'OpenSky Network användarvillkor',
        caveat: 'OpenSky tillhandahåller transpondertelemetri. Vid hastighetsbegränsning visas senast kända status.',
      },
      note: 'Kontrollen genomfördes och loggades; frånvaro av data tolkas inte som normal flygtrafik.',
    }

    // Cache the error response for 20s to prevent spamming
    setCache('aviation_data', result, 20 * 1000)
    return result
  }
}

/**
 * Aggregates all transport modes (road, rail, aviation) into a single dashboard model
 */
export async function getTransportDashboard({
  mode = 'all',
  region = 'se',
  period = '24h',
  apiKey = process.env.TRAFIKVERKET_API_KEY,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const [roadData, railData, aviationData] = await Promise.all([
    getTransportRoadData({ apiKey, fetchImpl, now }),
    getTransportRailData({ apiKey, fetchImpl, now }),
    getTransportAviationData({ fetchImpl, now }),
  ])

  let items = []
  if (mode === 'all') {
    items = [...roadData.items, ...railData.items, ...aviationData.items]
  } else if (mode === 'road') {
    items = roadData.items
  } else if (mode === 'rail') {
    items = railData.items
  } else if (mode === 'aviation') {
    items = aviationData.items
  }

  // Sort items: critical severity first, then newest timestamp first
  items.sort((a, b) => {
    const rankA = a.severity === 'critical' ? 2 : a.severity === 'elevated' ? 1 : 0
    const rankB = b.severity === 'critical' ? 2 : b.severity === 'elevated' ? 1 : 0
    if (rankB !== rankA) return rankB - rankA
    return new Date(b.time).getTime() - new Date(a.time).getTime()
  })

  return {
    mode,
    region,
    period,
    retrievedAt: new Date(now).toISOString(),
    sources: {
      trafikverketRoad: {
        status: roadData.status,
        label: 'Trafikverket Väglag & Trafik',
        count: roadData.items.length,
        lastChecked: roadData.lastChecked,
        error: roadData.error,
        url: TRAFIKVERKET_PORTAL_URL,
      },
      trafikverketRail: {
        status: railData.status,
        label: 'Trafikverket Järnvägsmeddelanden & Förseningar',
        count: railData.items.length,
        lastChecked: railData.lastChecked,
        error: railData.error,
        url: TRAFIKVERKET_PORTAL_URL,
      },
      openSky: {
        status: aviationData.status,
        label: 'OpenSky Network (ADS-B Luftfart)',
        count: aviationData.count,
        lastChecked: aviationData.lastChecked,
        error: aviationData.error,
        url: OPENSKY_PORTAL_URL,
        note: aviationData.note || null,
      },
    },
    metrics: {
      roadIncidents: roadData.items.length,
      railDisruptions: railData.items.length,
      railCanceledCount: railData.items.filter((i) => i.isCanceled).length,
      observedAircraft: aviationData.count,
    },
    items,
  }
}
