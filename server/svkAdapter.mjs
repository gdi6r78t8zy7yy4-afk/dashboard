/**
 * Adapter for Svenska kraftnät Öppna Data (CKAN Action API 3)
 * Endpoint: https://data.svk.se/sv/api/3/action/
 *
 * Provides real-time physical power flows (net cross-border & inter-zone transfers)
 * and balancing capacity market reserves (mFRR & aFRR) across Swedish bidding zones.
 */

export const SVK_API_BASE = 'https://data.svk.se/sv/api/3/action'

export const SVK_RESOURCES = {
  flows: '4aa94b88-9f42-4f0a-a6a8-8e47aadc782a', // net_cross_border_physical_flows
  mfrr: '0c56e30d-8fce-4c27-afc8-621c230ae34d',  // mfrr_capacity_market
  afrr: '6351d2cc-1657-43eb-b112-b8408c700529',  // afrr_capacity_market
  dayAhead: 'cf392ef3-7345-4e98-970e-83088c185570', // market_data_day_ahead_area_prices
}

// In-memory cache to prevent excessive requests to data.svk.se
const cache = new Map()
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

export function clearSvkCache() {
  cache.clear()
}

function getCached(key) {
  const item = cache.get(key)
  if (!item) return null
  if (Date.now() > item.expiresAt) {
    cache.delete(key)
    return null
  }
  return item.data
}

function setCached(key, data, ttlMs = CACHE_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

/**
 * Check connectivity and metadata of Svenska kraftnät CKAN API
 */
export async function getSvkPortalStatus({ fetchImpl = fetch } = {}) {
  const cached = getCached('portal_status')
  if (cached) return cached

  try {
    const url = `${SVK_API_BASE}/status_show`
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      throw new Error(`SVK status_show returned HTTP ${response.status}`)
    }

    const json = await response.json()
    if (!json.success) {
      throw new Error('SVK CKAN response marked success: false')
    }

    const result = {
      status: 'ok',
      endpoint: SVK_API_BASE,
      siteTitle: json.result?.site_title ?? 'Svenska Kraftnät Data Service',
      siteUrl: json.result?.site_url ?? 'https://data.svk.se',
      ckanVersion: json.result?.ckan_version ?? '2.11.6',
      retrievedAt: new Date().toISOString(),
    }

    setCached('portal_status', result, 5 * 60 * 1000) // 5 min TTL
    return result
  } catch (error) {
    return {
      status: 'error',
      endpoint: SVK_API_BASE,
      siteTitle: 'Svenska Kraftnät Öppna Data',
      siteUrl: 'https://data.svk.se',
      ckanVersion: null,
      error: error instanceof Error ? error.message : 'Kunde inte ansluta till data.svk.se',
      retrievedAt: new Date().toISOString(),
    }
  }
}

/**
 * Fetch physical power flows from Svenska kraftnät datastore
 * Dataset: net_cross_border_physical_flows
 */
export async function getSvkPhysicalFlows({ zone = 'SE3', limit = 200, fetchImpl = fetch } = {}) {
  const cacheKey = `flows_${zone}_${limit}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const url = `${SVK_API_BASE}/datastore_search?resource_id=${SVK_RESOURCES.flows}&limit=${limit}&sort=start_time_utc desc`
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`SVK physical flows datastore returned HTTP ${response.status}`)
    }

    const json = await response.json()
    if (!json.success || !json.result?.records) {
      throw new Error('SVK flows datastore response missing records')
    }

    const records = json.result.records
    const cleanZone = zone.toUpperCase()

    // Filter flows relevant to the requested bidding zone
    // e.g. for SE3: flows where from_bidding_zone is SE3 (export) or to_bidding_zone is SE3 (import)
    const relevantRecords = records.filter(
      (r) => r.from_bidding_zone === cleanZone || r.to_bidding_zone === cleanZone
    )

    // Group flows by neighbor bidding zone
    // Standard neighbors for Swedish zones:
    // SE1: SE2, NO4, FI
    // SE2: SE1, SE3, NO3, NO4
    // SE3: SE2, SE4, NO1, DK1, FI
    // SE4: SE3, DK2, DELU/DE-LU, PL, LT
    const neighborFlows = new Map()

    for (const r of relevantRecords) {
      const isExport = r.from_bidding_zone === cleanZone
      const neighbor = isExport ? r.to_bidding_zone : r.from_bidding_zone
      const normalizedNeighbor = neighbor === 'DELU' ? 'DE-LU' : neighbor

      if (!neighborFlows.has(normalizedNeighbor)) {
        neighborFlows.set(normalizedNeighbor, {
          neighbor: normalizedNeighbor,
          exports: [],
          imports: [],
          latestExport: null,
          latestImport: null,
        })
      }

      const flowGroup = neighborFlows.get(normalizedNeighbor)
      const timestamp = r.start_time_utc ? new Date(r.start_time_utc + 'Z').toISOString() : new Date().toISOString()
      const point = {
        timestamp,
        timeSweden: r.start_time_sweden,
        value: Number(r.power),
        unit: r.power_unit || 'MW',
        from: r.from_bidding_zone,
        to: r.to_bidding_zone,
      }

      if (isExport) {
        flowGroup.exports.push(point)
        if (!flowGroup.latestExport || timestamp > flowGroup.latestExport.timestamp) {
          flowGroup.latestExport = point
        }
      } else {
        flowGroup.imports.push(point)
        if (!flowGroup.latestImport || timestamp > flowGroup.latestImport.timestamp) {
          flowGroup.latestImport = point
        }
      }
    }

    const result = {
      status: 'ok',
      resourceId: SVK_RESOURCES.flows,
      zone: cleanZone,
      totalRecordsQueried: records.length,
      relevantRecordsCount: relevantRecords.length,
      lastUpdated: relevantRecords[0]?.start_time_utc
        ? new Date(relevantRecords[0].start_time_utc + 'Z').toISOString()
        : null,
      neighbors: Array.from(neighborFlows.values()),
      recentRawRecords: relevantRecords.slice(0, 15),
    }

    setCached(cacheKey, result, 45 * 1000) // 45 sec cache
    return result
  } catch (error) {
    return {
      status: 'error',
      resourceId: SVK_RESOURCES.flows,
      zone,
      error: error instanceof Error ? error.message : 'Kunde inte hämta flöden från Svenska kraftnät',
      neighbors: [],
      recentRawRecords: [],
      lastUpdated: null,
    }
  }
}

/**
 * Fetch balancing capacity market reserves (mFRR & aFRR) from Svenska kraftnät datastore
 */
export async function getSvkBalancingReserves({ zone = 'SE3', limit = 30, fetchImpl = fetch } = {}) {
  const cacheKey = `reserves_${zone}_${limit}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const cleanZone = zone.toUpperCase()

  const [mfrrResult, afrrResult] = await Promise.allSettled([
    // mFRR capacity market
    (async () => {
      const url = `${SVK_API_BASE}/datastore_search?resource_id=${SVK_RESOURCES.mfrr}&limit=${limit}&sort=start_time_utc desc&filters=${encodeURIComponent(JSON.stringify({ bidding_zone: cleanZone }))}`
      const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`mFRR datastore returned HTTP ${res.status}`)
      const json = await res.json()
      return json.result?.records || []
    })(),
    // aFRR capacity market
    (async () => {
      const url = `${SVK_API_BASE}/datastore_search?resource_id=${SVK_RESOURCES.afrr}&limit=${limit}&sort=start_time_utc desc&filters=${encodeURIComponent(JSON.stringify({ bidding_zone: cleanZone }))}`
      const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`aFRR datastore returned HTTP ${res.status}`)
      const json = await res.json()
      return json.result?.records || []
    })(),
  ])

  const mfrrRecords = mfrrResult.status === 'fulfilled' ? mfrrResult.value : []
  const afrrRecords = afrrResult.status === 'fulfilled' ? afrrResult.value : []

  // Extract latest up and down reserves
  const extractLatest = (records) => {
    let latestUp = null
    let latestDown = null
    for (const r of records) {
      const dir = (r.reserve_direction || '').toLowerCase()
      if (dir === 'up' && !latestUp) {
        latestUp = {
          direction: 'up',
          volume: Number(r.volume),
          volumeUnit: r.volume_unit || 'MW',
          price: Number(r.price),
          priceUnit: r.price_unit || 'EUR-MW',
          timeSweden: r.start_time_sweden,
          timestamp: r.start_time_utc ? new Date(r.start_time_utc + 'Z').toISOString() : null,
        }
      } else if (dir === 'down' && !latestDown) {
        latestDown = {
          direction: 'down',
          volume: Number(r.volume),
          volumeUnit: r.volume_unit || 'MW',
          price: Number(r.price),
          priceUnit: r.price_unit || 'EUR-MW',
          timeSweden: r.start_time_sweden,
          timestamp: r.start_time_utc ? new Date(r.start_time_utc + 'Z').toISOString() : null,
        }
      }
      if (latestUp && latestDown) break
    }
    return { latestUp, latestDown }
  }

  const mfrrLatest = extractLatest(mfrrRecords)
  const afrrLatest = extractLatest(afrrRecords)

  const latestTimestamp = [
    mfrrRecords[0]?.start_time_utc,
    afrrRecords[0]?.start_time_utc,
  ].filter(Boolean).sort().reverse()[0]

  const result = {
    status: (mfrrRecords.length > 0 || afrrRecords.length > 0) ? 'ok' : 'missing',
    zone: cleanZone,
    lastUpdated: latestTimestamp ? new Date(latestTimestamp + 'Z').toISOString() : null,
    mfrr: {
      status: mfrrResult.status === 'fulfilled' ? 'ok' : 'error',
      productName: 'mFRR Kapacitetsmarknad (Manuell frekvensåterställningsreserv)',
      recordsCount: mfrrRecords.length,
      latest: mfrrLatest,
      records: mfrrRecords.slice(0, 10).map((r) => ({
        timeSweden: r.start_time_sweden,
        timestamp: r.start_time_utc ? new Date(r.start_time_utc + 'Z').toISOString() : null,
        direction: r.reserve_direction,
        volume: Number(r.volume),
        volumeUnit: r.volume_unit,
        price: Number(r.price),
        priceUnit: r.price_unit,
      })),
      error: mfrrResult.status === 'rejected' ? mfrrResult.reason?.message : null,
    },
    afrr: {
      status: afrrResult.status === 'fulfilled' ? 'ok' : 'error',
      productName: 'aFRR Kapacitetsmarknad (Automatisk frekvensåterställningsreserv)',
      recordsCount: afrrRecords.length,
      latest: afrrLatest,
      records: afrrRecords.slice(0, 10).map((r) => ({
        timeSweden: r.start_time_sweden,
        timestamp: r.start_time_utc ? new Date(r.start_time_utc + 'Z').toISOString() : null,
        direction: r.reserve_direction,
        volume: Number(r.volume),
        volumeUnit: r.volume_unit,
        price: Number(r.price),
        priceUnit: r.price_unit,
      })),
      error: afrrResult.status === 'rejected' ? afrrResult.reason?.message : null,
    },
  }

  setCached(cacheKey, result, 60 * 1000)
  return result
}

/**
 * Complete Svenska kraftnät data bundle for the energy dashboard
 */
export async function getSvkEnergyData({ zone = 'SE3', fetchImpl = fetch } = {}) {
  const [portal, flows, reserves] = await Promise.all([
    getSvkPortalStatus({ fetchImpl }),
    getSvkPhysicalFlows({ zone, fetchImpl }),
    getSvkBalancingReserves({ zone, fetchImpl }),
  ])

  const isOk = flows.status === 'ok' || reserves.status === 'ok' || portal.status === 'ok'

  return {
    status: isOk ? 'ok' : 'error',
    endpoint: SVK_API_BASE,
    label: 'Svenska kraftnät Öppna Data',
    url: 'https://data.svk.se',
    portal,
    flows,
    reserves,
    lastUpdated: flows.lastUpdated || reserves.lastUpdated || portal.retrievedAt,
  }
}
