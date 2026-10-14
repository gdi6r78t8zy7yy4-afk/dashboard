/**
 * Gas and Oil Data Adapter for Northwatch Dashboard
 * 
 * This adapter handles fetching and processing gas and oil data from multiple sources.
 * It follows the same patterns as the energy data adapter but is specialized for
 * oil and gas commodities.
 */

// In-memory cache to prevent excessive requests to data sources
const cache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function clearGasOilCache() {
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
 * Gas and Oil data source configurations
 */
const gasOilSources = {
  // EIA (US Energy Information Administration)
  eia: {
    name: 'EIA',
    url: 'https://www.eia.gov/opendata/',
    description: 'US Energy Information Administration Open Data',
    requiresAuth: false,
    // TODO: Add actual EIA API endpoints
  },
  
  // Eurostat (European Statistical Office)
  eurostat: {
    name: 'Eurostat',
    url: 'https://ec.europa.eu/eurostat/web/energy/database',
    description: 'European Statistical Office energy database',
    requiresAuth: false,
    // TODO: Add actual Eurostat API endpoints
  },
  
  // ENTSOG (European Network of Transmission System Operators for Gas)
  entsog: {
    name: 'ENTSOG',
    url: 'https://transparency.entsog.eu/',
    description: 'European Network of Transmission System Operators for Gas',
    requiresAuth: false,
    // TODO: Add actual ENTSOG API endpoints
  },
  
  // GIE (Gas Interconnection Europe)
  gie: {
    name: 'GIE',
    url: 'https://www.gie.eu/',
    description: 'Gas Interconnection Europe',
    requiresAuth: false,
    // TODO: Add actual GIE API endpoints
  },
  
  // World Bank Commodity Markets
  worldBank: {
    name: 'World Bank',
    url: 'https://www.worldbank.org/en/research/commodity-markets',
    description: 'World Bank Commodity Markets data',
    requiresAuth: false,
    // TODO: Add actual World Bank API endpoints
  },
  
  // FRED (Federal Reserve Economic Data)
  fred: {
    name: 'FRED',
    url: 'https://fred.stlouisfed.org/',
    description: 'Federal Reserve Economic Data',
    requiresAuth: false,
    // TODO: Add actual FRED API endpoints
  },
  
  // OPEC publications
  opec: {
    name: 'OPEC',
    url: 'https://www.opec.org/',
    description: 'Organization of the Petroleum Exporting Countries',
    requiresAuth: false,
    // TODO: Add actual OPEC API endpoints
  },
}

/**
 * Generic function to fetch and parse JSON data with error handling
 */
async function fetchJsonData(url, options = {}, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json', ...options.headers },
      signal: AbortSignal.timeout(10000),
      ...options,
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    return { status: 'ok', data, retrievedAt: new Date().toISOString() }
  } catch (error) {
    return { 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error',
      retrievedAt: new Date().toISOString() 
    }
  }
}

/**
 * Generic function to fetch and parse XML data with error handling
 */
async function fetchXmlData(url, options = {}, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/xml', ...options.headers },
      signal: AbortSignal.timeout(10000),
      ...options,
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const xmlText = await response.text()
    return { status: 'ok', data: xmlText, retrievedAt: new Date().toISOString() }
  } catch (error) {
    return { 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error',
      retrievedAt: new Date().toISOString() 
    }
  }
}

/**
 * Helper function to validate and normalize timestamp
 */
function validateTimestamp(timestamp) {
  if (!timestamp) return null
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/**
 * Helper function to parse numeric values safely
 */
function parseNumericValue(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/**
 * Helper function to create a dataset with proper structure
 */
function createDataset(status, dataType, unit, points = [], note = null) {
  return {
    status,
    dataType,
    unit,
    points,
    lastUpdated: points.length ? 
      points.reduce((latest, point) => {
        return point.timestamp > latest ? point.timestamp : latest
      }, points[0]?.timestamp || null) : 
      null,
    note,
  }
}

/**
 * Placeholder function to get gas and oil data from sources
 * This will be expanded with actual implementations for each source
 */
export async function getGasOilData({ 
  commodity = 'crude_oil', 
  indicator = 'production',
  geography = { type: 'country', name: 'Sweden' },
  period = '24h',
  fetchImpl = fetch,
  token = process.env.GAS_OIL_API_TOKEN
} = {}) {
  // This is a placeholder implementation - will be expanded with real data sources
  
  // Check cache first
  const cacheKey = `${commodity}-${indicator}-${geography.type}-${geography.name}-${period}`
  const cached = getCached(cacheKey)
  if (cached) {
    return cached
  }
  
  // Initialize empty response structure
  const response = {
    mode: 'demo',
    commodity,
    indicator,
    geography,
    sources: Object.entries(gasOilSources).map(([id, source]) => ({
      id,
      name: source.name,
      url: source.url,
      status: 'not_configured',
      lastUpdated: null,
      note: `Source ${source.name} not yet implemented`,
      requiresAuth: source.requiresAuth,
      attribution: source.description
    })),
    datasets: {},
    retrievedAt: new Date().toISOString(),
  }
  
  // Set a demo mode response for now
  if (commodity === 'crude_oil' && indicator === 'production') {
    // Sample data for demonstration
    const samplePoints = []
    const now = new Date()
    
    // Generate 24 hours of sample data points
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
      samplePoints.push({
        timestamp: timestamp.toISOString(),
        value: 1000 + Math.floor(Math.random() * 200) - 100, // Random value around 1000
        category: 'production',
      })
    }
    
    response.datasets.production = createDataset(
      'ok', 
      'production', 
      'barrels/day', 
      samplePoints, 
      'Demo data for crude oil production'
    )
    
    // Update source statuses
    response.sources[0].status = 'ok' // EIA source
    response.sources[0].lastUpdated = new Date().toISOString()
  }
  
  // Cache the result
  setCached(cacheKey, response)
  
  return response
}

/**
 * Function to get metadata about available gas and oil data sources
 */
export function getGasOilSourceMetadata() {
  return Object.entries(gasOilSources).map(([id, source]) => ({
    id,
    name: source.name,
    url: source.url,
    description: source.description,
    requiresAuth: source.requiresAuth,
  }))
}

// Export for testing
export { 
  fetchJsonData, 
  fetchXmlData, 
  validateTimestamp,
  parseNumericValue,
  createDataset,
}