const ripeBase = 'https://stat.ripe.net/data'
const ripeDocsUrl = 'https://stat.ripe.net/docs/data-api/ripestat-data-api'

function numeric(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}

function periodDays(period) {
  return { '24h': 1, '7d': 7, '30d': 30 }[period] ?? 7
}

function dateParameter(date) {
  return date.toISOString().slice(0, 19)
}

export function parseCountryRoutingStats(payload) {
  const rows = Array.isArray(payload?.data?.stats) ? payload.data.stats : []
  return rows.flatMap((row) => {
    if (!row.stats_date) return []
    return [{
      date: row.stats_date,
      ipv4Prefixes: numeric(row.v4_prefixes_ris),
      ipv6Prefixes: numeric(row.v6_prefixes_ris),
      routedAsns: numeric(row.asns_ris),
    }]
  })
}

async function requestJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`RIPEstat returned HTTP ${response.status}.`)
  const payload = await response.json()
  if (payload.status !== 'ok') throw new Error(payload.messages?.[0]?.[1] ?? 'RIPEstat query failed.')
  return payload
}

export async function getRipeRouting({ country = 'SE', period = '7d', fetchImpl = fetch, now = new Date() } = {}) {
  const requestedAt = new Date(now).toISOString()
  const end = new Date(now)
  const start = new Date(end.getTime() - periodDays(period) * 24 * 60 * 60 * 1000)
  const routingUrl = new URL(`${ripeBase}/country-routing-stats/data.json`)
  routingUrl.searchParams.set('resource', country)
  routingUrl.searchParams.set('starttime', dateParameter(start))
  routingUrl.searchParams.set('endtime', dateParameter(end))
  const asnsUrl = new URL(`${ripeBase}/country-asns/data.json`)
  asnsUrl.searchParams.set('resource', country)

  try {
    const [routingResult, asnsResult] = await Promise.all([
      requestJson(routingUrl, fetchImpl),
      requestJson(asnsUrl, fetchImpl),
    ])
    const history = parseCountryRoutingStats(routingResult)
    const latest = history.at(-1) ?? null
    const asnCountry = asnsResult.data?.countries?.find((item) => item.resource === country) ?? asnsResult.data?.countries?.[0]
    const observedAt = latest?.date ?? asnsResult.data?.query_time ?? null
    const stale = observedAt ? Date.parse(requestedAt) - Date.parse(observedAt) > 8 * 24 * 60 * 60 * 1000 : true

    return {
      state: stale ? 'stale' : 'ok',
      provenance: {
        source: 'RIPEstat Data API / RIPE RIS',
        sourceUrl: ripeDocsUrl,
        retrievedAt: requestedAt,
        observedAt,
        referencePeriod: `${dateParameter(start)}Z – ${dateParameter(end)}Z`,
        geographicPrecision: 'country',
        resolution: routingResult.data?.resolution ?? 'provider daily aggregates; RIS snapshots are periodic',
        quality: 'routing-observation',
      },
      data: { history, latest, registeredAsns: numeric(asnCountry?.stats?.registered), routedAsns: numeric(asnCountry?.stats?.routed) },
      note: 'RIPE RIS observes BGP announcements and routing visibility. These values do not measure mobile network availability or user reachability.',
    }
  } catch (error) {
    return {
      state: 'error',
      provenance: {
        source: 'RIPEstat Data API / RIPE RIS',
        sourceUrl: ripeDocsUrl,
        retrievedAt: requestedAt,
        observedAt: null,
        referencePeriod: `${dateParameter(start)}Z – ${dateParameter(end)}Z`,
        geographicPrecision: 'country',
        resolution: 'Provider daily aggregates; RIS snapshots are periodic',
        quality: 'missing',
      },
      data: { history: [], latest: null, registeredAsns: null, routedAsns: null },
      note: error instanceof Error ? error.message : 'RIPEstat data is unavailable.',
    }
  }
}