/**
 * Weather Service - Main service for handling weather data requests
 */

import { fetchOpenMeteoWeather } from './openMeteoAdapter.mjs'
import { fetchMetNorwayWeather } from './metNorwayAdapter.mjs'
import { fetchGdacsAlerts } from './gdacsAdapter.mjs'
import { createTtlCache } from '../cache.mjs'

// Geocoding results rarely change; cache 24 hours per query.
const geocodingCache = createTtlCache(24 * 60 * 60 * 1000, { maxEntries: 500 })

/**
 * Get weather data for a specific location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude  
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Normalized weather data
 */
export async function getWeatherData(lat, lon, options = {}) {
  try {
    // Fetch data from multiple sources
    const [openMeteoData, metNorwayData, gdacsData] = await Promise.allSettled([
      fetchOpenMeteoWeather(lat, lon, options),
      fetchMetNorwayWeather(lat, lon, options),
      fetchGdacsAlerts({ limit: 20 })
    ])

    // Process Open-Meteo data (primary source)
    let primaryData = null
    if (openMeteoData.status === 'fulfilled') {
      primaryData = openMeteoData.value
    } else {
      console.error('Open-Meteo fetch failed:', openMeteoData.reason)
    }

    // Process MET Norway data (secondary source for Nordic region)
    let metData = null
    if (metNorwayData.status === 'fulfilled') {
      metData = metNorwayData.value
    } else {
      console.error('MET Norway fetch failed:', metNorwayData.reason)
    }

    // Process GDACS alerts
    let alerts = []
    if (gdacsData.status === 'fulfilled') {
      alerts = gdacsData.value.alerts || []
    } else {
      console.error('GDACS fetch failed:', gdacsData.reason)
    }

    // Merge data from different sources
    const result = {
      mode: 'live',
      location: primaryData?.location || { latitude: lat, longitude: lon },
      current: {
        status: 'ok',
        dataType: 'current_weather',
        unit: 'Celsius',
        points: [],
        lastUpdated: null,
        note: null,
        source: 'Open-Meteo'
      },
      hourly: [],
      daily: [],
      alerts: alerts,
      retrievedAt: new Date().toISOString(),
      sources: {
        openMeteo: primaryData?.sources?.openMeteo || { status: 'error', lastUpdated: null },
        metNorway: metNorwayData.status === 'fulfilled' ? metNorwayData.value.sources?.metNorway : { status: 'error', lastUpdated: null },
        gdacs: {
          status: gdacsData.status === 'fulfilled' ? 'ok' : 'error',
          lastUpdated: new Date().toISOString()
        }
      }
    }

    // Merge current weather data from primary source
    if (primaryData?.current) {
      result.current = primaryData.current
      // Update last updated timestamp to the latest available
      if (primaryData.current.lastUpdated) {
        result.current.lastUpdated = primaryData.current.lastUpdated
      }
    }

    // Merge hourly forecasts
    if (primaryData?.hourly) {
      result.hourly = primaryData.hourly
    }

    // Merge daily forecasts  
    if (primaryData?.daily) {
      result.daily = primaryData.daily
    }

    // Merge MET Norway data if available and in Nordic region
    if (metData && metData.current) {
      // Merge MET Norway data with Open-Meteo data if available
      if (result.current.points.length === 0) {
        result.current = metData.current
      } else {
        // Combine data points if both sources provide data
        result.current.points = [...result.current.points, ...metData.current.points]
      }
    }

    return result
  } catch (error) {
    console.error('Error in weather service:', error)
    throw new Error(`Weather service error: ${error.message}`)
  }
}

/**
 * Get location information using geocoding
 * @param {string} query - Location search query
 * @returns {Promise<Object>} Location information
 */
export async function getLocationInfo(query) {
  const cacheKey = `geocode:${query.trim().toLowerCase()}`
  if (query && geocodingCache.get(cacheKey)) {
    return geocodingCache.get(cacheKey)
  }

  try {
    // For this implementation, we'll use Open-Meteo's geocoding API
    const baseUrl = 'https://geocoding-api.open-meteo.com/v1/search'
    const params = new URLSearchParams({
      name: query,
      count: 20
    })
    
    const url = `${baseUrl}?${params.toString()}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Northwatch/1.0 (infrastructure-monitoring dashboard)'
      },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Normalize geocoding results
    const locations = []
    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results) {
        locations.push({
          id: result.id,
          name: result.name,
          latitude: result.latitude,
          longitude: result.longitude,
          country: result.country,
          admin1: result.admin1,
          admin2: result.admin2,
          population: result.population
        })
      }
    }
    
    const result = {
      locations,
      retrievedAt: new Date().toISOString()
    }
    if (locations.length > 0 && query) {
      geocodingCache.set(cacheKey, result)
    }
    return result
  } catch (error) {
    console.error('Error in location service:', error)
    return {
      locations: [],
      retrievedAt: new Date().toISOString(),
      error: error.message
    }
  }
}