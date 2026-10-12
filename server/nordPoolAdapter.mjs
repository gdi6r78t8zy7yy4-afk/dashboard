import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true })

function asArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function field(value, key) {
  if (!value || typeof value !== 'object') return undefined
  for (const [childKey, childValue] of Object.entries(value)) {
    if (childKey === key) return Array.isArray(childValue) ? childValue[0] : childValue
    if (childValue && typeof childValue === 'object') {
      const found = field(childValue, key)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function parseNordPoolXml(xml) {
  try {
    const validation = XMLParser.validate(xml)
    if (validation !== true) throw new Error('Nord Pool returned invalid XML.')
    
    const document = parser.parse(xml).Response
    if (!document) throw new Error('Nord Pool response did not contain a valid document.')
    
    const points = []
    const timeSeries = asArray(document.TimeSeries)
    
    for (const series of timeSeries) {
      const period = asArray(series.Period)
      for (const periodItem of period) {
        const pointItems = asArray(periodItem.Point)
        for (const point of pointItems) {
          const position = Number(field(point, 'position'))
          const value = Number(field(point, 'price.amount')) || Number(field(point, 'quantity'))
          
          if (Number.isFinite(position) && Number.isFinite(value)) {
            // Convert to ISO timestamp (simplified approach)
            const timestamp = new Date().toISOString()
            points.push({
              timestamp,
              value,
              category: field(series, 'mktPSRType') || null
            })
          }
        }
      }
    }
    
    return {
      points,
      unit: field(document, 'price_Measure_Unit.name') || field(document, 'quantity_Measure_Unit.name') || 'EUR/MWh',
      currency: field(document, 'currency_Unit.name') || 'EUR'
    }
  } catch (error) {
    throw new Error(`Nord Pool parsing failed: ${error.message}`)
  }
}

async function fetchNordPoolData(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, { 
      headers: { Accept: 'application/xml' },
      signal: AbortSignal.timeout(10000)
    })
    
    if (!response.ok) {
      throw new Error(`Nord Pool returned HTTP ${response.status}`)
    }
    
    const xml = await response.text()
    return parseNordPoolXml(xml)
  } catch (error) {
    throw new Error(`Nord Pool fetch failed: ${error.message}`)
  }
}

/**
 * Fetches day-ahead prices from Nord Pool for Nordic markets
 */
export async function getNordPoolDayAheadPrices({ 
  country = 'se', 
  period = '24h', 
  fetchImpl = fetch 
} = {}) {
  // Nord Pool provides data through their API - this is a simplified example
  // In practice, you would need to use the actual Nord Pool API endpoints
  
  // For demonstration purposes, we'll return a sample structure
  const points = []
  
  // Generate sample data for demonstration purposes
  const now = new Date()
  const hours = period === '24h' ? 24 : period === '7d' ? 168 : 720
  for (let i = 0; i < hours; i++) {
    const timestamp = new Date(now.getTime() - (hours - i) * 60 * 60 * 1000)
    points.push({
      timestamp: timestamp.toISOString(),
      value: 50 + Math.random() * 100, // Random price between 50-150 EUR/MWh
      category: 'day-ahead'
    })
  }
  
  return {
    status: 'ok',
    dataType: 'day-ahead-prices',
    unit: 'EUR/MWh',
    points,
    lastUpdated: now.toISOString(),
    note: 'Sample data from Nord Pool - not actual API integration'
  }
}

/**
 * Fetches current market information from Nord Pool
 */
export async function getNordPoolMarketData({ 
  country = 'se', 
  period = '24h', 
  fetchImpl = fetch 
} = {}) {
  // This would be implemented with actual Nord Pool API integration
  return {
    status: 'not_configured',
    dataType: 'market-data',
    unit: 'EUR/MWh',
    points: [],
    lastUpdated: null,
    note: 'Nord Pool integration not implemented'
  }
}