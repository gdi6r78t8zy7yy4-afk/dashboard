import { getIodaOutages } from './telecomIoda.mjs'
import { getCloudflareOutages } from './telecomCloudflare.mjs'
import { getRipeRouting } from './telecomRipe.mjs'

const ripeBase = 'https://stat.ripe.net/data'
const ripeDocsUrl = 'https://stat.ripe.net/docs/data-api/ripestat-data-api'
const iodaBase = 'https://api.ioda.inetintel.cc.gatech.edu/v2'
const iodaDocsUrl = 'https://api.ioda.inetintel.cc.gatech.edu/v2/docs'

// Key European / Nordic Backbone Networks & Research ASNs
export const KEY_BACKBONES = [
  { asn: '1653', name: 'SUNET', operator: 'Vetenskapsrådet / SUNET', country: 'SE', category: 'National NREN / Backbone' },
  { asn: '3301', name: 'Telia Company', operator: 'Telia Company AB / Arelion', country: 'SE', category: 'Tier 1 / Transit' },
  { asn: '1257', name: 'Tele2 SWIPnet', operator: 'Tele2 Sverige AB', country: 'SE', category: 'Major ISP / Backbone' },
  { asn: '8473', name: 'Bahnhof', operator: 'Bahnhof AB', country: 'SE', category: 'Major ISP' },
  { asn: '2832', name: 'NORDUnet', operator: 'Nordic University Network', country: 'ND', category: 'Regional NREN Backbone' },
  { asn: '224', name: 'UNINETT / Sikt', operator: 'Kunnskapssektorens tjenesteleverandør', country: 'NO', category: 'National NREN' },
  { asn: '2119', name: 'Telenor Global', operator: 'Telenor Norge AS', country: 'NO', category: 'Tier 1 / Transit' },
  { asn: '1835', name: 'DeiC', operator: 'Danish e-Infrastructure Cooperation', country: 'DK', category: 'National NREN' },
  { asn: '3292', name: 'TDC Net', operator: 'TDC Holding A/S', country: 'DK', category: 'National Telecom / Transit' },
  { asn: '1741', name: 'Funet', operator: 'CSC - IT Center for Science', country: 'FI', category: 'National NREN' },
  { asn: '719', name: 'Elisa', operator: 'Elisa Oyj', country: 'FI', category: 'National Telecom' },
  { asn: '1299', name: 'Arelion', operator: 'Arelion Sweden AB (Global IP Transit)', country: 'EU', category: 'Global Tier 1 Backbone' },
  { asn: '20965', name: 'GÉANT', operator: 'GÉANT Association (Pan-European Backbone)', country: 'EU', category: 'Pan-European Academic Backbone' },
  { asn: '3356', name: 'Lumen (Level 3)', operator: 'Lumen Technologies', country: 'EU', category: 'Global Transit Tier 1' },
]

const cache = new Map()
const cacheMs = 60 * 1000

export const REGION_COUNTRIES = {
  se: ['SE'],
  no: ['NO'],
  dk: ['DK'],
  fi: ['FI'],
  is: ['IS'],
  nordics: ['DK', 'FI', 'IS', 'NO', 'SE'],
  europe: ['AL', 'AD', 'AT', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'TR', 'UA', 'GB'],
}

export const REGION_LABELS = {
  se: 'Sverige',
  no: 'Norge',
  dk: 'Danmark',
  fi: 'Finland',
  is: 'Island',
  nordics: 'Norden',
  europe: 'Europa',
}

function periodDays(period) {
  return { '24h': 1, '7d': 7, '30d': 30 }[period] ?? 7
}

function dateParameter(date) {
  return date.toISOString().slice(0, 19)
}

/**
 * Fetch looking glass and visibility for prominent ASNs
 */
export async function getBackboneRoutingStatus({ asns = KEY_BACKBONES, fetchImpl = fetch } = {}) {
  const results = await Promise.all(
    asns.map(async (item) => {
      try {
        const [visRes, asRes] = await Promise.all([
          fetchImpl(`${ripeBase}/routing-status/data.json?resource=AS${item.asn}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
          }).then((r) => r.ok ? r.json() : null),
          fetchImpl(`${ripeBase}/as-overview/data.json?resource=AS${item.asn}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
          }).then((r) => r.ok ? r.json() : null),
        ])

        const visibility = visRes?.data?.visibility
        const v4Peers = visibility?.v4?.ris_peers_seeing ?? null
        const v4Total = visibility?.v4?.total_ris_peers ?? null
        const v6Peers = visibility?.v6?.ris_peers_seeing ?? null
        const v6Total = visibility?.v6?.total_ris_peers ?? null
        const holder = asRes?.data?.holder ?? item.operator
        const announced = asRes?.data?.announced ?? (v4Peers !== null && v4Peers > 0)

        return {
          asn: item.asn,
          name: item.name,
          operator: holder,
          country: item.country,
          category: item.category,
          announced,
          v4VisibilityPct: v4Total ? Number(((v4Peers / v4Total) * 100).toFixed(1)) : null,
          v6VisibilityPct: v6Total ? Number(((v6Peers / v6Total) * 100).toFixed(1)) : null,
          v4Peers,
          v4Total,
          v6Peers,
          v6Total,
          queryTime: visRes?.data?.query_time ?? new Date().toISOString(),
        }
      } catch {
        return {
          asn: item.asn,
          name: item.name,
          operator: item.operator,
          country: item.country,
          category: item.category,
          announced: true,
          v4VisibilityPct: null,
          v6VisibilityPct: null,
          v4Peers: null,
          v4Total: null,
          v6Peers: null,
          v6Total: null,
          queryTime: new Date().toISOString(),
        }
      }
    }),
  )
  return results
}

/**
 * Fetch BGP update activity (announcements & withdrawals) for a specific ASN
 */
export async function getAsnBgpActivity({ asn = '1653', period = '24h', fetchImpl = fetch, now = new Date() } = {}) {
  const end = new Date(now)
  const start = new Date(end.getTime() - periodDays(period) * 24 * 60 * 60 * 1000)
  const url = `${ripeBase}/bgp-update-activity/data.json?resource=AS${asn}&starttime=${dateParameter(start)}&endtime=${dateParameter(end)}`

  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const updates = (json.data?.updates ?? []).map((u) => ({
      starttime: u.starttime,
      announcements: u.announcements ?? 0,
      withdrawals: u.withdrawals ?? 0,
    }))
    return {
      state: 'ok',
      asn,
      updates,
      samplingResolution: json.data?.sampling_resolution ?? '1h',
    }
  } catch (err) {
    return {
      state: 'error',
      asn,
      updates: [],
      error: err instanceof Error ? err.message : 'Kunde inte hämta BGP-uppdateringar',
    }
  }
}

/**
 * Fetch verified outage and anomaly events from IODA
 */
export async function getIodaOutageEvents({ region = 'se', period = '7d', fetchImpl = fetch, now = new Date() } = {}) {
  const until = Math.floor(new Date(now).getTime() / 1000)
  const from = until - periodDays(period) * 86400
  const url = `${iodaBase}/outages/events?from=${from}&until=${until}&limit=50`

  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const rawEvents = json.data ?? []

    const countries = new Set(REGION_COUNTRIES[region] ?? ['SE'])
    const isEuropeOrNordics = region === 'europe' || region === 'nordics'

    const mapped = rawEvents.map((e) => {
      // Determine affected country / asn
      const locationCode = String(e.location ?? '')
      const parts = locationCode.split('/')
      const locType = parts[0] ?? ''
      const locTarget = parts[1] ?? ''

      let countryCode = null
      let asn = null

      if (locType === 'asn') {
        asn = locTarget
      } else if (locType === 'geoasn') {
        const subParts = locTarget.split('-')
        asn = subParts[0]
        countryCode = subParts[1]
      } else if (locType === 'country') {
        countryCode = locTarget
      }

      return {
        id: String(e.location ?? `${e.location_name}-${e.start}`),
        locationName: e.location_name ?? 'Okänd entitet',
        locationCode,
        locType,
        countryCode,
        asn,
        datasource: e.datasource ?? 'bgp',
        start: new Date(Number(e.start) * 1000).toISOString(),
        durationSeconds: e.duration ?? null,
        score: e.score !== null && e.score !== undefined ? Math.round(Number(e.score)) : null,
        method: e.method ?? 'median',
        interpretation: e.datasource === 'bgp'
          ? 'BGP-routingförändring detekterad av IODA. Observationen innebär en förändring i ruttannonsering, inte nödvändigtvis ett avbrott hos slutanvändare eller cyberangrepp.'
          : e.datasource === 'ping-slash24' || e.datasource === 'active'
            ? 'Aktiv mätavvikelse (prober/ping). Indikerar svarsbortfall från testade prefix.'
            : 'Darknet / telescope-anomali. Indikerar förändrat bakgrundsbrus från opartitionerat nät.',
      }
    })

    // Filter to region if specific country, or return European/Nordic related events
    const filtered = mapped.filter((e) => {
      if (isEuropeOrNordics) {
        if (!e.countryCode) return true // Include ASNs that operate internationally
        return countries.has(e.countryCode)
      }
      if (e.countryCode) return e.countryCode === region.toUpperCase()
      return false
    })

    return {
      state: 'ok',
      events: filtered.length ? filtered : mapped.slice(0, 10), // If no direct country hit, provide European/macro context
      totalFound: rawEvents.length,
      filteredCount: filtered.length,
    }
  } catch (err) {
    return {
      state: 'unavailable',
      events: [],
      totalFound: 0,
      filteredCount: 0,
      note: err instanceof Error ? err.message : 'IODA API ej nåbart',
    }
  }
}

/**
 * Main aggregator for Internet & Network Infrastructure Dashboard
 */
export async function getInternetDashboard({
  region = 'se',
  period = '7d',
  asn = '1653',
  indicator = 'all',
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const selectedRegion = region.toLowerCase()
  if (!REGION_COUNTRIES[selectedRegion]) {
    throw new Error('Ogiltigt geografiskt område. Välj se, no, dk, fi, is, nordics eller europe.')
  }
  const key = `${selectedRegion}:${period}:${asn}:${indicator}`
  const cached = cache.get(key)
  if (cached && new Date(now).getTime() - Date.parse(cached.retrievedAt) < cacheMs) {
    return { ...cached, retrievedAt: new Date(now).toISOString(), cached: true }
  }

  const countries = REGION_COUNTRIES[selectedRegion]
  const isCountry = countries.length === 1
  const countryCode = isCountry ? countries[0] : 'SE'

  // Concurrent fetches with resilience
  const [routingResult, iodaResult, cloudflareResult, backbones, asnActivity, iodaEvents] = await Promise.all([
    // RIPEstat Country Routing Stats
    getRipeRouting({ country: countryCode, period, fetchImpl, now }),
    // IODA country signal
    getIodaOutages({ country: countryCode, period, fetchImpl, now }),
    // Cloudflare Radar
    getCloudflareOutages({
      region: { id: selectedRegion, period, countries },
      fetchImpl,
      now,
    }),
    // Key Nordic / European backbones routing status
    getBackboneRoutingStatus({
      asns: selectedRegion === 'se'
        ? KEY_BACKBONES.filter((b) => b.country === 'SE' || b.country === 'ND' || b.country === 'EU')
        : selectedRegion === 'nordics'
          ? KEY_BACKBONES.filter((b) => b.country !== 'EU')
          : KEY_BACKBONES,
      fetchImpl,
    }),
    // Specific ASN BGP activity
    getAsnBgpActivity({ asn, period, fetchImpl, now }),
    // IODA Outages events
    getIodaOutageEvents({ region: selectedRegion, period, fetchImpl, now }),
  ])

  // Aggregate regional routing summary if multi-country
  let multiCountryRouting = []
  if (!isCountry) {
    const topNordicCountries = selectedRegion === 'nordics' ? ['SE', 'NO', 'DK', 'FI', 'IS'] : ['SE', 'NO', 'DK', 'FI', 'DE', 'GB', 'FR', 'NL']
    const batch = await Promise.all(
      topNordicCountries.map(async (c) => ({
        country: c,
        res: await getRipeRouting({ country: c, period, fetchImpl, now }),
      })),
    )
    multiCountryRouting = batch.map((item) => ({
      country: item.country,
      ipv4: item.res.data?.latest?.ipv4Prefixes ?? null,
      ipv6: item.res.data?.latest?.ipv6Prefixes ?? null,
      asns: item.res.data?.routedAsns ?? null,
    }))
  }

  const result = {
    region: selectedRegion,
    regionLabel: REGION_LABELS[selectedRegion],
    countries,
    period,
    selectedAsn: asn,
    indicator,
    retrievedAt: new Date(now).toISOString(),
    cached: false,
    sources: [
      {
        id: 'ripestat',
        name: 'RIPEstat Data API',
        url: ripeDocsUrl,
        state: routingResult.state,
        observedAt: routingResult.provenance?.observedAt,
        retrievedAt: routingResult.provenance?.retrievedAt,
        geographicPrecision: 'country',
        quality: 'routing-observation',
        methodology: 'BGP Routing Information Service (RIS) snapshots och dagliga sammandrag från globala route collectors.',
        disclaimer: 'Routade prefix och BGP-annonsering mäter global internetuppkoppling och routing-synlighet, inte slutanvändarprestanda eller lokala accessfel.',
      },
      {
        id: 'ripe-ris',
        name: 'RIPE RIS (Routing Information Service)',
        url: 'https://ris.ripe.net/',
        state: routingResult.state,
        observedAt: routingResult.provenance?.observedAt,
        retrievedAt: routingResult.provenance?.retrievedAt,
        geographicPrecision: 'network-observation',
        quality: 'routing-observation',
        methodology: 'Distribuerade BGP looking glasses (RRC00–RRC26) mäter peerings och annonserade prefix i realtid.',
        disclaimer: 'En ruttändring eller BGP update (withdrawal/announcement) är en normal del av internetroutning och betyder inte automatiskt ett nätavbrott.',
      },
      {
        id: 'ioda',
        name: 'IODA (Georgia Tech InetIntel)',
        url: iodaDocsUrl,
        state: iodaResult.state,
        observedAt: iodaResult.provenance?.observedAt,
        retrievedAt: iodaResult.provenance?.retrievedAt,
        geographicPrecision: 'country',
        quality: 'internet-outage-indicator',
        methodology: 'Kombinerar tre oberoende dataströmmar: BGP-routing, aktiva prober (ping/traceroute) och teleskop/darknet.',
        disclaimer: 'En avvikande signal i IODA indikerar en makrostörning men är inte ett bevis för en cyberattack eller sabotage utan extern forensisk analys.',
      },
      {
        id: 'cloudflare-radar',
        name: 'Cloudflare Radar API',
        url: 'https://radar.cloudflare.com/',
        state: cloudflareResult.state,
        observedAt: cloudflareResult.provenance?.observedAt,
        retrievedAt: cloudflareResult.provenance?.retrievedAt,
        geographicPrecision: 'country',
        quality: cloudflareResult.provenance?.quality,
        methodology: 'Makroindikatorer för trafiktrender, routing-anomalier och publicerade driftnoteringar.',
        disclaimer: cloudflareResult.note,
      },
    ],
    routing: routingResult,
    multiCountryRouting,
    ioda: iodaResult,
    iodaEvents,
    backbones,
    asnActivity,
    cloudflare: cloudflareResult,
  }

  cache.set(key, result)
  return result
}

export function clearInternetCache() {
  cache.clear()
}
