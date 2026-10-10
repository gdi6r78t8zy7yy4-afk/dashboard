import { XMLParser, XMLValidator } from 'fast-xml-parser'

const areas = {
  se: {
    label: 'Sweden',
    timezone: 'Europe/Stockholm',
    zones: {
      SE1: { eic: '10Y1001A1001A44P', coordinates: [22.15, 65.58], neighbors: ['NO4', 'FI', 'SE2'] },
      SE2: { eic: '10Y1001A1001A45N', coordinates: [17.31, 62.39], neighbors: ['NO3', 'SE1', 'SE3'] },
      SE3: { eic: '10Y1001A1001A46L', coordinates: [18.06, 59.33], neighbors: ['NO1', 'SE2', 'SE4', 'FI', 'DK1'] },
      SE4: { eic: '10Y1001A1001A47J', coordinates: [13.00, 55.60], neighbors: ['SE3', 'DK2', 'DE-LU', 'PL'] },
    },
  },
  no: {
    label: 'Norway',
    timezone: 'Europe/Oslo',
    zones: {
      NO1: { eic: '10YNO-1--------2', coordinates: [10.75, 59.91], neighbors: ['NO2', 'NO3', 'NO5', 'SE3'] },
      NO2: { eic: '10YNO-2--------T', coordinates: [5.32, 60.39], neighbors: ['NO1', 'NO5', 'DK1', 'NL', 'DE-LU', 'GB'] },
      NO3: { eic: '10YNO-3--------J', coordinates: [10.40, 63.43], neighbors: ['NO1', 'NO4', 'NO5', 'SE2'] },
      NO4: { eic: '10YNO-4--------9', coordinates: [18.96, 69.65], neighbors: ['NO3', 'SE1', 'FI'] },
      NO5: { eic: '10Y1001A1001A48H', coordinates: [5.32, 60.39], neighbors: ['NO1', 'NO2', 'NO3'] },
    },
  },
  dk: {
    label: 'Denmark',
    timezone: 'Europe/Copenhagen',
    zones: {
      DK1: { eic: '10YDK-1--------W', coordinates: [9.50, 56.15], neighbors: ['DK2', 'SE3', 'NO2', 'DE-LU'] },
      DK2: { eic: '10YDK-2--------M', coordinates: [11.90, 55.68], neighbors: ['DK1', 'SE4', 'DE-LU'] },
    },
  },
  fi: {
    label: 'Finland',
    timezone: 'Europe/Helsinki',
    zones: {
      FI: { eic: '10YFI-1--------U', coordinates: [24.94, 60.17], neighbors: ['SE1', 'SE3', 'EE'] },
    },
  },
}

const neighborEics = {
  SE1: areas.se.zones.SE1.eic,
  SE2: areas.se.zones.SE2.eic,
  SE3: areas.se.zones.SE3.eic,
  SE4: areas.se.zones.SE4.eic,
  NO1: areas.no.zones.NO1.eic,
  NO2: areas.no.zones.NO2.eic,
  NO3: areas.no.zones.NO3.eic,
  NO4: areas.no.zones.NO4.eic,
  NO5: areas.no.zones.NO5.eic,
  DK1: areas.dk.zones.DK1.eic,
  DK2: areas.dk.zones.DK2.eic,
  FI: areas.fi.zones.FI.eic,
  'DE-LU': '10Y1001A1001A82H',
  PL: '10YPL-AREA-----S',
  NL: '10YNL----------L',
  EE: '10Y1001A1001A39I',
  GB: '10YGB----------A',
}

const generationTypes = {
  B01: 'Biomass',
  B02: 'Lignite',
  B04: 'Gas',
  B05: 'Hard coal',
  B06: 'Oil',
  B09: 'Geothermal',
  B10: 'Pumped storage',
  B11: 'Run-of-river hydro',
  B12: 'Reservoir hydro',
  B14: 'Nuclear',
  B16: 'Solar',
  B17: 'Waste',
  B18: 'Offshore wind',
  B19: 'Onshore wind',
  B20: 'Other',
}

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true })
const smhiBase = 'https://opendata-download-metobs.smhi.se/api/version/1.0'
const forecastUnavailableNote = 'SMHI currently documents no general public point-forecast endpoint in its Open Data catalogue; no forecast is inferred.'
const noticesUnavailableNote = 'Svenska kraftnät publishes operational information as a web page, but no documented public machine-readable feed is configured.'

function asArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function findAll(value, key, matches = []) {
  if (!value || typeof value !== 'object') return matches
  for (const [childKey, childValue] of Object.entries(value)) {
    if (childKey === key) matches.push(...asArray(childValue))
    if (childValue && typeof childValue === 'object') findAll(childValue, key, matches)
  }
  return matches
}

function field(value, key) {
  const found = findAll(value, key, [])
  return found.length ? found[0] : undefined
}

function utcParameter(date) {
  return date.toISOString().replace(/[-:]/g, '').slice(0, 12)
}

function intervalFor(period, now) {
  const durations = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }
  const hours = durations[period]
  if (!hours) throw new Error('Unsupported energy period.')
  const end = new Date(now)
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000)
  return { start: utcParameter(start), end: utcParameter(end), startDate: start, endDate: end }
}

export function getEnergyArea(country = 'se', zone) {
  const market = areas[country]
  if (!market) throw new Error('Unsupported country. Choose Sweden, Norway, Denmark, or Finland.')
  const selectedZone = zone ?? Object.keys(market.zones)[0]
  const area = market.zones[selectedZone]
  if (!area) throw new Error(`Bidding zone ${selectedZone} does not belong to ${market.label}.`)
  return { country, countryLabel: market.label, timezone: market.timezone, zone: selectedZone, ...area }
}

export function buildEntsoeUrl({ documentType, processType, area, start, end, from, to, token }) {
  const url = new URL('https://web-api.tp.entsoe.eu/api')
  url.searchParams.set('securityToken', token)
  url.searchParams.set('documentType', documentType)
  if (processType) url.searchParams.set('processType', processType)
  if (area) url.searchParams.set(documentType === 'A65' ? 'outBiddingZone_Domain' : 'in_Domain', area)
  if (documentType === 'A44' && area) url.searchParams.set('out_Domain', area)
  if (from) url.searchParams.set('in_Domain', from)
  if (to) url.searchParams.set('out_Domain', to)
  url.searchParams.set('periodStart', start)
  url.searchParams.set('periodEnd', end)
  return url
}

function periodMilliseconds(resolution) {
  const match = /^PT(\d+)([HM])$/.exec(String(resolution ?? ''))
  if (!match) return 60 * 60 * 1000
  return Number(match[1]) * (match[2] === 'H' ? 60 : 1) * 60 * 1000
}

function readPointValue(point) {
  const keys = ['price.amount', 'quantity', 'out_Quantity.quantity', 'in_Quantity.quantity']
  for (const key of keys) {
    const raw = point?.[key] ?? field(point, key)
    const value = Number(raw)
    if (raw !== undefined && Number.isFinite(value)) return value
  }
  return null
}

export function parseEntsoeXml(xml, dataType) {
  const validation = XMLValidator.validate(xml)
  if (validation !== true) throw new Error('ENTSO-E returned invalid XML.')
  const document = parser.parse(xml).Publication_MarketDocument
  if (!document) throw new Error('ENTSO-E response did not contain a publication document.')
  const points = []

  for (const series of asArray(document.TimeSeries)) {
    for (const period of asArray(series.Period)) {
      const start = Date.parse(field(period.timeInterval, 'start'))
      const interval = periodMilliseconds(field(period, 'resolution'))
      for (const point of asArray(period.Point)) {
        const position = Number(field(point, 'position'))
        const value = readPointValue(point)
        if (!Number.isFinite(start) || !Number.isInteger(position) || value === null) continue
        const psrCode = field(series.MktPSRType, 'psrType')
        points.push({
          timestamp: new Date(start + (position - 1) * interval).toISOString(),
          value,
          category: generationTypes[psrCode] ?? psrCode ?? null,
          area: field(series.in_Domain, 'mRID') ?? field(series.out_Domain, 'mRID') ?? null,
        })
      }
    }
  }

  return {
    points,
    unit: field(document, 'price_Measure_Unit.name') ?? field(document, 'quantity_Measure_Unit.name') ?? null,
    currency: field(document, 'currency_Unit.name') ?? null,
  }
}

export function normalizeEntsoeUnit(parsed, dataType, fallback) {
  const units = { MAW: 'MW', MWH: 'MWh', KWH: 'kWh' }
  if (dataType === 'market_price') return `${parsed.currency ?? 'EUR'}/${units[parsed.unit] ?? parsed.unit ?? 'MWh'}`
  return units[parsed.unit] ?? parsed.unit ?? fallback
}

function dataset(status, dataType, unit, points = [], note = null) {
  return {
    status,
    dataType,
    unit,
    points,
    lastUpdated: points.length ? points.reduce((latest, point) => point.timestamp > latest ? point.timestamp : latest, points[0].timestamp) : null,
    note,
  }
}

async function requestEntsoe({ token, documentType, processType, area, from, to, interval, dataType, unit, fetchImpl }) {
  const url = buildEntsoeUrl({ documentType, processType, area, start: interval.start, end: interval.end, from, to, token })
  const response = await fetchImpl(url, { headers: { Accept: 'application/xml' }, signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(`ENTSO-E returned HTTP ${response.status}.`)
  const parsed = parseEntsoeXml(await response.text(), dataType)
  const normalizedUnit = normalizeEntsoeUnit(parsed, dataType, unit)
  return parsed.points.length
    ? dataset('ok', dataType, normalizedUnit, parsed.points)
    : dataset('missing', dataType, normalizedUnit, [], 'The source returned no points for this period.')
}

async function safeEntsoeRequest(options) {
  if (!options.token) return dataset('not_configured', options.dataType, options.unit, [], 'Set ENTSOE_API_TOKEN on the server to enable ENTSO-E data.')
  try {
    return await requestEntsoe(options)
  } catch (error) {
    return dataset('error', options.dataType, options.unit, [], error instanceof Error ? error.message : 'ENTSO-E request failed.')
  }
}

function closestStation(stations, longitude, latitude) {
  const candidates = asArray(stations).filter((station) => station.active === true && Number.isFinite(Number(station.latitude)) && Number.isFinite(Number(station.longitude)))
  candidates.sort((left, right) => {
    const distance = (station) => (Number(station.latitude) - latitude) ** 2 + (Number(station.longitude) - longitude) ** 2
    return distance(left) - distance(right)
  })
  return candidates[0] ?? null
}

async function fetchWeatherObservation(parameter, label, unit, coordinates, fetchImpl, now) {
  try {
    const stationUrl = `${smhiBase}/parameter/${parameter}/station.json`
    const stationResponse = await fetchImpl(stationUrl, { signal: AbortSignal.timeout(10000) })
    if (!stationResponse.ok) throw new Error(`SMHI station catalog returned HTTP ${stationResponse.status}.`)
    const catalog = await stationResponse.json()
    const station = closestStation(catalog.station, coordinates[0], coordinates[1])
    if (!station || Math.abs(Number(station.latitude) - coordinates[1]) > 2.5 || Math.abs(Number(station.longitude) - coordinates[0]) > 2.5) {
      return { parameter, label, status: 'missing', unit, station: null, points: [], lastUpdated: null, note: 'No nearby reporting station was found.' }
    }

    const dataUrl = `${smhiBase}/parameter/${parameter}/station/${station.key}/period/latest-hour/data.json`
    const dataResponse = await fetchImpl(dataUrl, { signal: AbortSignal.timeout(10000) })
    if (!dataResponse.ok) throw new Error(`SMHI observation returned HTTP ${dataResponse.status}.`)
    const observation = await dataResponse.json()
    const points = asArray(observation.value).flatMap((item) => {
      const value = Number(item.value)
      const timestamp = new Date(Number(item.date)).toISOString()
      return Number.isFinite(value) ? [{ timestamp, value, quality: item.quality ?? null }] : []
    })
    const lastUpdated = points.length ? points[points.length - 1].timestamp : null
    const isStale = lastUpdated ? now.getTime() - Date.parse(lastUpdated) > 3 * 60 * 60 * 1000 : false
    return {
      parameter,
      label,
      status: points.length ? isStale ? 'stale' : 'ok' : 'missing',
      unit,
      station: station.name ?? station.title ?? String(station.key),
      points,
      lastUpdated,
      note: points.length ? null : 'SMHI returned no values for the latest-hour period.',
    }
  } catch (error) {
    return { parameter, label, status: 'error', unit, station: null, points: [], lastUpdated: null, note: error instanceof Error ? error.message : 'SMHI request failed.' }
  }
}

/** @param {{ country?: string, zone?: string, period?: string, fetchImpl?: typeof fetch, token?: string, now?: Date }} options */
export async function getEnergyData({ country = 'se', zone, period = '24h', fetchImpl = fetch, token = process.env.ENTSOE_API_TOKEN, now = new Date() } = {}) {
  const area = getEnergyArea(country, zone)
  const interval = intervalFor(period, now)
  const zoneEic = area.eic
  const shared = { token, interval, fetchImpl }
  const queries = {
    dayAheadPrices: safeEntsoeRequest({ ...shared, area: zoneEic, documentType: 'A44', processType: 'A01', dataType: 'market_price', unit: 'EUR/MWh' }),
    actualGeneration: safeEntsoeRequest({ ...shared, area: zoneEic, documentType: 'A75', processType: 'A16', dataType: 'measured_generation', unit: 'MW' }),
    generationForecast: safeEntsoeRequest({ ...shared, area: zoneEic, documentType: 'A71', processType: 'A01', dataType: 'forecast_generation', unit: 'MW' }),
    actualLoad: safeEntsoeRequest({ ...shared, area: zoneEic, documentType: 'A65', processType: 'A16', dataType: 'measured_load', unit: 'MW' }),
    loadForecast: safeEntsoeRequest({ ...shared, area: zoneEic, documentType: 'A65', processType: 'A01', dataType: 'forecast_load', unit: 'MW' }),
  }

  const flows = area.neighbors.map(async (neighbor) => {
    const neighborEic = neighborEics[neighbor]
    const [exportFlow, importFlow] = await Promise.all([
      safeEntsoeRequest({ ...shared, from: zoneEic, to: neighborEic, documentType: 'A11', processType: 'A16', dataType: 'measured_flow', unit: 'MWh' }),
      safeEntsoeRequest({ ...shared, from: neighborEic, to: zoneEic, documentType: 'A11', processType: 'A16', dataType: 'measured_flow', unit: 'MWh' }),
    ])
    return { neighbor, export: exportFlow, import: importFlow }
  })

  const [dayAheadPrices, actualGeneration, generationForecast, actualLoad, loadForecast, crossBorderFlows] = await Promise.all([
    queries.dayAheadPrices,
    queries.actualGeneration,
    queries.generationForecast,
    queries.actualLoad,
    queries.loadForecast,
    Promise.all(flows),
  ])

  const weather = country === 'se'
    ? await Promise.all([
      fetchWeatherObservation(1, 'Air temperature', '°C', area.coordinates, fetchImpl, new Date(now)),
      fetchWeatherObservation(4, 'Mean wind speed', 'm/s', area.coordinates, fetchImpl, new Date(now)),
      fetchWeatherObservation(7, 'Hourly precipitation', 'mm', area.coordinates, fetchImpl, new Date(now)),
    ])
    : []

  const entsoeDatasets = [dayAheadPrices, actualGeneration, generationForecast, actualLoad, loadForecast, ...crossBorderFlows.flatMap((flow) => [flow.import, flow.export])]
  const hasEntsoeValues = entsoeDatasets.some((item) => item.status === 'ok')
  const hasEntsoeErrors = entsoeDatasets.some((item) => item.status === 'error')
  const entsoeStatus = !token ? 'not_configured' : hasEntsoeValues && hasEntsoeErrors ? 'partial' : hasEntsoeValues ? 'ok' : hasEntsoeErrors ? 'error' : 'missing'
  const smhiStatus = country !== 'se' ? 'not_applicable' : weather.some((item) => item.status === 'ok') ? 'ok' : weather.some((item) => item.status === 'stale') ? 'stale' : weather.some((item) => item.status === 'error') ? 'error' : 'unavailable'

  return {
    mode: hasEntsoeValues ? 'live' : 'partial',
    market: { country, countryLabel: area.countryLabel, zone: area.zone, eic: area.eic, period, timezone: area.timezone, start: interval.startDate.toISOString(), end: interval.endDate.toISOString() },
    sources: {
      entsoe: { status: entsoeStatus, label: 'ENTSO-E Transparency Platform', endpoint: 'https://web-api.tp.entsoe.eu/api', lastUpdated: [dayAheadPrices, actualGeneration, actualLoad].flatMap((item) => item.points).reduce((latest, point) => !latest || point.timestamp > latest ? point.timestamp : latest, null) },
      smhi: { status: smhiStatus, label: 'SMHI Open Data' },
      svkNotices: { status: 'not_configured', label: 'Svenska kraftnät – Information från driften', url: 'https://www.svk.se/om-kraftsystemet/kraftsystemdata/information-fran-driften/', note: noticesUnavailableNote },
      smhiForecast: { status: 'not_configured', label: 'SMHI forecasts', note: forecastUnavailableNote },
    },
    datasets: { dayAheadPrices, actualGeneration, generationForecast, actualLoad, loadForecast, crossBorderFlows },
    weather,
    gridDisturbances: { status: 'not_configured', value: null, note: 'Market prices and weather observations are not evidence of a grid disturbance. No verified public disturbance feed is connected.' },
    retrievedAt: new Date(now).toISOString(),
  }
}