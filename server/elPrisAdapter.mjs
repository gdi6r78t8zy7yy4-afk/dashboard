/**
 * Elpriset just nu.se price adapter for the Energy Dashboard
 *
 * Replaces the (token-gated) Nord Pool Market Data API as the source for
 * current Swedish spot/day-ahead electricity prices. The API is open and
 * free, no authentication required.
 *
 * Documentation: https://www.elprisetjustnu.se/elpris-api
 *
 * Endpoint: GET https://www.elprisetjustnu.se/api/v1/prices/YYYY/MM-DD_ZONE.json
 * Response: [ { SEK_per_kWh, EUR_per_kWh, EXR, time_start, time_end }, ... ]
 *
 * Notes:
 * - Covers the four Swedish bidding zones: SE1 (Luleå), SE2 (Sundsvall),
 *   SE3 (Stockholm), SE4 (Malmö).
 * - From 1 October 2025 Sweden uses quarter-hour prices (96/day);
 *   earlier dates contain hourly prices (24/day).
 * - Tomorrow's prices arrive at the earliest 13:00 the previous day,
 *   so a missing tomorrow file is expected in the first part of the day.
 * - Prices are ex-VAT. The underlying data comes from ENTSO-E in EUR with
 *   a daily EUR→SEK exchange rate (EXR).
 */

const ELPRIS_API_BASE = 'https://www.elprisetjustnu.se/api/v1/prices'

// Swedish bidding zones published by elprisetjustnu.se
const SWEDISH_ZONES = ['SE1', 'SE2', 'SE3', 'SE4']

const ELPRIS_ATTRIBUTION = 'Källa: Elpriset just nu.se (data ursprungligen från ENTSO-E, valutasats EUR→SEK).'

// Cache to avoid hammering the static JSON files
const cache = new Map()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export function clearElPrisCache() {
  cache.clear()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

/**
 * Calendar date parts in Swedish time (Europe/Stockholm).
 */
export function swedishDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => Number(parts.find((part) => part.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/**
 * Add days to a date-parts object (rolls over month/year boundaries).
 */
export function addSwedishDays(parts, days) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0))
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
}

/**
 * Build the URL for one zone-day of prices.
 * Example: https://www.elprisetjustnu.se/api/v1/prices/2026/10-13_SE3.json
 */
export function buildElPrisUrl(parts, zone) {
  return `${ELPRIS_API_BASE}/${parts.year}/${pad2(parts.month)}-${pad2(parts.day)}_${zone}.json`
}

/**
 * Normalize raw elprisetjustnu rows to point objects.
 *
 * `value` is converted to EUR/MWh to stay comparable with ENTSO-E
 * day-ahead prices; the SEK price is kept alongside for display.
 */
export function parseElPrisPrices(rows) {
  if (!Array.isArray(rows)) return []

  const points = []
  for (const row of rows) {
    const start = Date.parse(row?.time_start)
    const eurPerKWh = Number(row?.EUR_per_kWh)
    if (!Number.isFinite(start) || !Number.isFinite(eurPerKWh)) continue

    const sekPerKWh = Number(row?.SEK_per_kWh)
    const exr = Number(row?.EXR)
    points.push({
      timestamp: new Date(start).toISOString(),
      value: Math.round(eurPerKWh * 1000 * 1e6) / 1e6, // EUR/MWh
      sekPerKWh: Number.isFinite(sekPerKWh) ? sekPerKWh : null,
      eurPerKWh,
      exr: Number.isFinite(exr) ? exr : null,
    })
  }
  return points
}

async function fetchZoneDay({ parts, zone, fetchImpl }) {
  const url = buildElPrisUrl(parts, zone)
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  })

  if (response.status === 404) {
    // E.g. tomorrow's file has not been published yet (before ~13:00).
    return { state: 'missing', url, points: [] }
  }
  if (!response.ok) {
    throw new Error(`Elpriset just nu returned HTTP ${response.status} for ${url}`)
  }

  const rows = await response.json()
  const points = parseElPrisPrices(rows)
  return { state: points.length ? 'ok' : 'missing', url, points }
}

function zoneDayCacheKey(parts, zone) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}_${zone}`
}

function getCachedZoneDay(parts, zone) {
  const item = cache.get(zoneDayCacheKey(parts, zone))
  if (!item) return null
  if (Date.now() > item.expiresAt) {
    cache.delete(zoneDayCacheKey(parts, zone))
    return null
  }
  return item.data
}

function setCachedZoneDay(parts, zone, data) {
  cache.set(zoneDayCacheKey(parts, zone), { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

/**
 * Fetch prices for all Swedish zones for today and tomorrow.
 *
 * @param {Object} options
 * @param {typeof fetch} options.fetchImpl - Fetch implementation (injectable for tests).
 * @param {Date} options.now - Reference date (defaults to now).
 * @returns {Promise<Record<string, Object>>} Map of zone → price entry:
 *   {
 *     state: 'ok' | 'partial' | 'missing' | 'error',
 *     zone, currency, unit,
 *     data: Point[],            // today + tomorrow in chronological order
 *     today: { date, state, points },
 *     tomorrow: { date, state, points },
 *     current: { timestamp, value, sekPerKWh } | null,  // latest published point ≤ now
 *     lastUpdated, retrievedAt, note
 *   }
 */
export async function getElPrisPricesForAllAreas({ fetchImpl = fetch, now = new Date() } = {}) {
  const results = {}

  const fetchZone = async (zone) => {
    const todayParts = swedishDateParts(now)
    const tomorrowParts = addSwedishDays(todayParts, 1)

    const dayJob = async (parts, label) => {
      const cached = getCachedZoneDay(parts, zone)
      if (cached) return cached
      let day
      try {
        day = await fetchZoneDay({ parts, zone, fetchImpl })
      } catch (error) {
        day = {
          state: 'error',
          url: buildElPrisUrl(parts, zone),
          points: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
      setCachedZoneDay(parts, zone, day)
      return {
        date: `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`,
        label,
        ...day,
      }
    }

    const [today, tomorrow] = await Promise.all([
      dayJob(todayParts, 'today'),
      dayJob(tomorrowParts, 'tomorrow'),
    ])

    const data = [...today.points, ...tomorrow.points].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const currentCandidate = [...data].reverse().find((point) => point.timestamp <= now.toISOString()) ?? null
    let state
    if (today.state === 'ok') {
      // Tomorrow's file is expected to be missing until ~13:00 the previous day.
      state = tomorrow.state === 'error' ? 'partial' : 'ok'
    } else if (tomorrow.state === 'ok') {
      state = 'partial'
    } else {
      state = today.state === 'error' || tomorrow.state === 'error' ? 'error' : 'missing'
    }

    const note =
      state === 'error'
        ? `${today.error ?? tomorrow.error ?? 'Elpriset just nu.se request failed. '} ${ELPRIS_ATTRIBUTION}`
        : state === 'ok' && tomorrow.state !== 'ok'
          ? `Morgondagens priser ej publicerade ännu (anländer tidigast kl 13 dagen innan). ${ELPRIS_ATTRIBUTION}`
          : ELPRIS_ATTRIBUTION

    return {
      state,
      zone,
      currency: 'EUR',
      unit: 'EUR/MWh',
      data,
      today,
      tomorrow,
      current: currentCandidate
        ? { timestamp: currentCandidate.timestamp, value: currentCandidate.value, sekPerKWh: currentCandidate.sekPerKWh }
        : null,
      lastUpdated: currentCandidate ? currentCandidate.timestamp : null,
      retrievedAt: new Date(now).toISOString(),
      note,
    }
  }

  const settled = await Promise.allSettled(SWEDISH_ZONES.map(fetchZone))
  for (let i = 0; i < SWEDISH_ZONES.length; i++) {
    const zone = SWEDISH_ZONES[i]
    const result = settled[i]
    if (result.status === 'fulfilled') {
      results[zone] = result.value
    } else {
      results[zone] = {
        state: 'error',
        zone,
        currency: 'EUR',
        unit: 'EUR/MWh',
        data: [],
        today: { state: 'error', points: [] },
        tomorrow: { state: 'error', points: [] },
        current: null,
        lastUpdated: null,
        retrievedAt: new Date(now).toISOString(),
        note: `Failed to fetch prices for ${zone}: ${result.reason?.message ?? 'Unknown error'}`,
      }
    }
  }

  return results
}
