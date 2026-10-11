const cloudflareBase = 'https://api.cloudflare.com/client/v4/radar'
const cloudflareDocsUrl = 'https://developers.cloudflare.com/api/resources/radar/subresources/annotations/subresources/outages/methods/get/'
const cloudflareStartUrl = 'https://developers.cloudflare.com/radar/get-started/first-request/'

function periodDays(period) {
  return { '24h': 1, '7d': 7, '30d': 30 }[period] ?? 7
}

function normalizeAnnotation(annotation) {
  return {
    id: String(annotation.id ?? ''),
    description: annotation.description ?? 'Cloudflare Radar outage or anomaly annotation.',
    eventType: annotation.eventType ?? 'UNKNOWN',
    startDate: annotation.startDate ?? null,
    endDate: annotation.endDate ?? null,
    locations: annotation.locations ?? [],
    asns: annotation.asns ?? [],
    outage: annotation.outage ?? null,
    linkedUrl: annotation.linkedUrl ?? null,
  }
}

function makeSource({ state, retrievedAt, region, data, note, observedAt = null, quality = 'missing' }) {
  return {
    state,
    provenance: {
      source: 'Cloudflare Radar outage annotations',
      sourceUrl: cloudflareDocsUrl,
      retrievedAt,
      observedAt,
      referencePeriod: `${periodDays(region.period)} day(s) requested`,
      geographicPrecision: region.countries.length === 1 ? 'country' : 'multi-country',
      resolution: 'Provider incident/anomaly annotations; geography is reported at the scope present in each annotation, not a point location',
      quality,
    },
    data,
    note,
  }
}

/** @param {{ region: { id: string, period: string, countries: string[] }, token?: string, fetchImpl?: typeof fetch, now?: Date }} options */
export async function getCloudflareOutages({ region, token = process.env.CLOUDFLARE_API_TOKEN, fetchImpl = fetch, now = new Date() }) {
  const retrievedAt = new Date(now).toISOString()
  if (!token) {
    return makeSource({
      state: 'unavailable',
      retrievedAt,
      region,
      data: [],
      note: `Not connected: set CLOUDFLARE_API_TOKEN to a server-side token with Account > Radar > Read. Radar data is available under CC BY-NC 4.0. See ${cloudflareStartUrl}`,
    })
  }

  const url = new URL(`${cloudflareBase}/annotations/outages`)
  url.searchParams.set('dateRange', `${periodDays(region.period)}d`)
  url.searchParams.set('limit', '100')
  url.searchParams.set('format', 'JSON')
  if (region.countries.length === 1) url.searchParams.set('location', region.countries[0])

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    })
    const payload = await response.json()
    if (!response.ok || payload.success !== true) {
      const message = payload.errors?.map((item) => item.message).filter(Boolean).join('; ')
      throw new Error(message || `Cloudflare Radar returned HTTP ${response.status}.`)
    }

    const countries = new Set(region.countries)
    const annotations = (payload.result?.annotations ?? [])
      .map(normalizeAnnotation)
      .filter((annotation) => !annotation.locations.length || annotation.locations.some((country) => countries.has(country)))
    const observedAt = annotations.reduce((latest, annotation) => {
      const candidate = annotation.endDate ?? annotation.startDate
      return candidate && (!latest || candidate > latest) ? candidate : latest
    }, null)

    return makeSource({
      state: 'ok',
      retrievedAt,
      observedAt,
      region,
      quality: 'cloudflare-annotation',
      data: annotations,
      note: annotations.length
        ? 'Cloudflare Radar annotations are provider observations and may describe outages or anomalies. They do not establish cause, cyberattack, or local service impact without independent confirmation.'
        : 'No Cloudflare Radar outage annotations matched this area and period. This is not confirmation that every network service was available.',
    })
  } catch (error) {
    return makeSource({
      state: 'error',
      retrievedAt,
      region,
      data: [],
      note: error instanceof Error ? error.message : 'Cloudflare Radar data is unavailable.',
    })
  }
}