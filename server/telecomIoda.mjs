const iodaBase = 'https://api.ioda.inetintel.cc.gatech.edu/v2'
const iodaDocsUrl = 'https://api.ioda.inetintel.cc.gatech.edu/v2/docs'

function periodSeconds(period) {
  return { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }[period] * 60 * 60
}

function records(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.events)) return value.events
  if (Array.isArray(value?.alerts)) return value.alerts
  if (Array.isArray(value?.items)) return value.items
  return []
}

function mapEvent(event, index) {
  const startedAt = event.startTime ?? event.startedAt ?? event.start ?? event.firstSeen ?? null
  const endedAt = event.endTime ?? event.endedAt ?? event.end ?? event.lastSeen ?? null
  const entityName = event.entityName ?? event.entity?.name ?? event.entityCode ?? 'Sweden'
  return {
    id: String(event.id ?? event.eventId ?? event.alertId ?? `${entityName}-${startedAt ?? index}`),
    entityName,
    datasource: event.datasource ?? event.source ?? null,
    startedAt: startedAt ? normalizeTimestamp(startedAt) : null,
    endedAt: endedAt ? normalizeTimestamp(endedAt) : null,
    severity: event.severity ?? event.level ?? event.alertLevel ?? null,
    summary: event.description ?? event.summary ?? event.title ?? 'IODA country-level internet outage indicator.',
  }
}

function normalizeTimestamp(value) {
  const raw = Number(value)
  const date = Number.isFinite(raw) && raw > 1000000000 ? new Date(raw < 100000000000 ? raw * 1000 : raw) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function requestJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`IODA returned HTTP ${response.status}.`)
  const payload = await response.json()
  if (payload.error) throw new Error(String(payload.error))
  return payload
}

export function parseIodaEvents(payloads) {
  const unique = new Map()
  for (const payload of payloads) {
    for (const event of records(payload?.data)) {
      const item = mapEvent(event, unique.size)
      unique.set(item.id, item)
    }
  }
  return [...unique.values()].sort((left, right) => (right.startedAt ?? '').localeCompare(left.startedAt ?? ''))
}

export function parseIodaSignal(payload) {
  const series = records(payload?.data).find((item) => item.entityType === 'country' && item.entityCode === 'SE')
  if (!series || !Array.isArray(series.values) || !Number.isFinite(Number(series.from)) || !Number.isFinite(Number(series.step))) return []
  return series.values.flatMap((raw, index) => {
    const value = Number(raw)
    return Number.isFinite(value) ? [{ timestamp: new Date((Number(series.from) + index * Number(series.step)) * 1000).toISOString(), value }] : []
  })
}

/** @param {{ country?: string, period?: string, fetchImpl?: typeof fetch, now?: Date }} options */
export async function getIodaOutages({ country = 'SE', period = '7d', fetchImpl = fetch, now = new Date() } = {}) {
  const requestedAt = new Date(now).toISOString()
  const until = Math.floor(new Date(now).getTime() / 1000)
  const from = until - periodSeconds(period)
  const query = new URLSearchParams({ entityType: 'country', entityCode: country, from: String(from), until: String(until) })
  const eventsQuery = new URLSearchParams({ from: String(from), until: String(until) })
  const urls = [
    `${iodaBase}/outages/summary?${query}`,
    `${iodaBase}/outages/events?${query}`,
    `${iodaBase}/outages/alerts?${query}`,
    `${iodaBase}/signals/events/country/${encodeURIComponent(country)}?${eventsQuery}`,
  ]
  const results = await Promise.allSettled(urls.map((url) => requestJson(url, fetchImpl)))
  const successful = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
  const failures = results.filter((result) => result.status === 'rejected')
  const events = parseIodaEvents(successful.slice(0, 3))
  const signal = parseIodaSignal(successful[3])
  const observedAt = signal.at(-1)?.timestamp ?? null
  const state = successful.length === 0 ? 'error' : failures.length ? 'partial' : observedAt ? 'ok' : 'unavailable'

  return {
    state,
    provenance: {
      source: 'IODA Internet Outage Detection and Analysis',
      sourceUrl: iodaDocsUrl,
      retrievedAt: requestedAt,
      observedAt,
      referencePeriod: `${new Date(from * 1000).toISOString()} – ${new Date(until * 1000).toISOString()}`,
      geographicPrecision: 'country',
      resolution: 'Country-level 30-minute internet outage indicator; outage event products are queried for the same period',
      quality: 'internet-outage-indicator',
    },
    data: { events, signal, period, country },
    note: failures.length
      ? `Some IODA endpoints were unavailable (${failures.length} of ${urls.length}).`
      : events.length
        ? 'IODA detects internet outage signals; it does not provide complete operator status or identify failed mobile towers.'
        : 'No IODA outage events or alerts were published for Sweden in this time window. This is not confirmation that all services were available.',
  }
}