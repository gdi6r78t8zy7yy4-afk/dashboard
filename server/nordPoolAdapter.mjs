/**
 * Nord Pool Market Data Adapter for Energy Dashboard
 * 
 * This adapter fetches day-ahead prices from Nord Pool's Market Data API.
 * 
 * Documentation: https://developers.nordpoolgroup.com/reference/marketdata-introduction
 */

const NORDPOOL_API_BASE = 'https://api.nordpoolgroup.com';
const NORDPOOL_MARKET_DATA_PATH = '/api/MarketData';

// Cache for Nord Pool data to avoid excessive requests
const cache = new Map();
const cacheMs = 15 * 60 * 1000; // 15 minutes cache

// Nordic bidding areas for Sweden
const SWEDISH_AREAS = ['SE1', 'SE2', 'SE3', 'SE4'];

// Market data types that we want to fetch
const MARKET_DATA_TYPES = {
  DAY_AHEAD: 'DayAhead',
  INTRADAY: 'Intraday'
};

// Cache key generation
function generateCacheKey(area, period, dataType) {
  return `${area}-${period}-${dataType}`;
}

// Parse Nord Pool date format to JavaScript Date
function parseNordPoolDate(dateString) {
  if (!dateString) return null;
  // Nord Pool dates are in ISO format like "2026-10-12T00:00:00Z"
  return new Date(dateString);
}

// Parse Nord Pool price data
function parseNordPoolPrices(data) {
  if (!data || !Array.isArray(data)) return [];
  
  const prices = [];
  
  for (const item of data) {
    if (!item || !item.deliveryStart || !item.deliveryEnd || item.price === undefined) {
      continue;
    }
    
    const price = {
      timestamp: parseNordPoolDate(item.deliveryStart),
      endTime: parseNordPoolDate(item.deliveryEnd),
      value: item.price,
      currency: item.currency || 'EUR',
      unit: item.unit || 'MWh',
      area: item.area || null,
      period: item.period || null,
    };
    
    // Convert timestamp to ISO string for consistency
    if (price.timestamp) {
      price.timestamp = price.timestamp.toISOString();
    }
    
    if (price.endTime) {
      price.endTime = price.endTime.toISOString();
    }
    
    prices.push(price);
  }
  
  return prices;
}

/**
 * Fetches day-ahead prices for a specific area from Nord Pool API
 */
async function fetchDayAheadPrices({ area, period = '24h', fetchImpl = fetch, token }) {
  // Validate that area is supported
  if (!SWEDISH_AREAS.includes(area)) {
    throw new Error(`Unsupported area: ${area}. Only Swedish areas supported: ${SWEDISH_AREAS.join(', ')}`);
  }
  
  // Build the request URL
  const url = new URL(NORDPOOL_API_BASE + NORDPOOL_MARKET_DATA_PATH);
  url.searchParams.set('instrument', 'DayAhead');
  url.searchParams.set('area', area);
  url.searchParams.set('period', period);
  
  // Set headers for authentication
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Make the request
  const response = await fetchImpl(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10000) // 10 second timeout
  });
  
  if (!response.ok) {
    throw new Error(`Nord Pool API returned HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Parse the response
  const prices = parseNordPoolPrices(data?.data);
  
  return {
    state: 'ok',
    data: prices,
    retrievedAt: new Date().toISOString(),
    area,
    period,
    lastUpdated: prices.length > 0 ? prices[prices.length - 1].timestamp : new Date().toISOString(),
    note: `Nord Pool day-ahead prices for ${area} (${prices.length} data points)`
  };
}

/**
 * Gets cached Nord Pool data
 */
function getCachedData(area, period, dataType) {
  const key = generateCacheKey(area, period, dataType);
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < cacheMs) {
    return cached.data;
  }
  
  return null;
}

/**
 * Sets cached Nord Pool data
 */
function setCachedData(area, period, dataType, data) {
  const key = generateCacheKey(area, period, dataType);
  cache.set(key, {
    timestamp: Date.now(),
    data
  });
}

/**
 * Fetches day-ahead prices for Swedish areas from Nord Pool API
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.area - The Nordic bidding area (SE1, SE2, SE3, or SE4)
 * @param {string} options.period - Time period ('24h', '7d', etc.)  
 * @param {typeof fetch} options.fetchImpl - Fetch implementation
 * @param {string} options.token - Nord Pool API access token
 * @returns {Promise<Object>} Response object with status and data
 */
export async function getNordPoolDayAheadPrices({
  area = 'SE1',
  period = '24h',
  fetchImpl = fetch,
  token = process.env.NORDPOOL_API_TOKEN
} = {}) {
  // Check if we have a valid token
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return {
      state: 'not_configured',
      data: [],
      retrievedAt: new Date().toISOString(),
      area,
      period,
      lastError: 'Nord Pool API token not configured. Set NORDPOOL_API_TOKEN in environment variables.',
      note: 'Nord Pool API requires authentication. Please configure your API token.'
    };
  }
  
  // Try to get from cache first
  const cached = getCachedData(area, period, 'day-ahead');
  if (cached) {
    return {
      ...cached,
      cached: true
    };
  }
  
  try {
    const result = await fetchDayAheadPrices({ area, period, fetchImpl, token });
    
    // Cache the result
    setCachedData(area, period, 'day-ahead', result);
    
    return {
      ...result,
      cached: false
    };
  } catch (error) {
    // Return error state but provide fallback information
    return {
      state: 'error',
      data: [],
      retrievedAt: new Date().toISOString(),
      area,
      period,
      lastError: error.message,
      note: `Failed to fetch Nord Pool data: ${error.message}`
    };
  }
}

/**
 * Fetches day-ahead prices for all Swedish areas
 */
export async function getNordPoolDayAheadPricesForAllAreas({
  period = '24h',
  fetchImpl = fetch,
  token = process.env.NORDPOOL_API_TOKEN
} = {}) {
  const results = {};
  
  // Fetch data for each Swedish area
  const fetchPromises = SWEDISH_AREAS.map(area => 
    getNordPoolDayAheadPrices({ area, period, fetchImpl, token })
  );
  
  const responses = await Promise.allSettled(fetchPromises);
  
  // Collect results
  for (let i = 0; i < SWEDISH_AREAS.length; i++) {
    const area = SWEDISH_AREAS[i];
    const response = responses[i];
    
    if (response.status === 'fulfilled') {
      results[area] = response.value;
    } else {
      results[area] = {
        state: 'error',
        data: [],
        retrievedAt: new Date().toISOString(),
        area,
        period,
        lastError: response.reason?.message || 'Unknown error',
        note: `Failed to fetch Nord Pool data for ${area}: ${response.reason?.message || 'Unknown error'}`
      };
    }
  }
  
  return results;
}

/**
 * Clears the Nord Pool data cache
 */
export function clearNordPoolCache() {
  cache.clear();
}

// Export for testing purposes
export { 
  parseNordPoolPrices,
  fetchDayAheadPrices,
  generateCacheKey
};