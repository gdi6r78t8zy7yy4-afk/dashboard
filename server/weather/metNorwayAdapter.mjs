/**
 * MET Norway Weather Data Adapter
 * Documentation: https://api.met.no/
 */

import { createTtlCache } from '../cache.mjs'

// api.met.no asks clients to cache results; keep 10 minutes per coordinate.
const metNorwayCache = createTtlCache(10 * 60 * 1000, { maxEntries: 500 })

export async function fetchMetNorwayWeather(lat, lon, options = {}) {
  const cacheKey = `metnorway:${lat.toFixed(3)},${lon.toFixed(3)}`
  if (!options.forceRefresh) {
    const cached = metNorwayCache.get(cacheKey)
    if (cached) return { ...cached, cached: true }
  }

  try {
    // Build the MET Norway API URL
    const baseUrl = 'https://api.met.no/weatherapi/locationforecast/2.0/compact'
    
    // MET Norway requires specific coordinate format in query parameters
    const url = `${baseUrl}?lat=${lat}&lon=${lon}`
    
    // Make the request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Northwatch/1.0 (infrastructure-monitoring dashboard)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`MET Norway API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Parse and normalize the data
    const result = normalizeMetNorwayData(data, lat, lon)
    if (result.current?.status === 'ok' || result.current?.points.length > 0) {
      metNorwayCache.set(cacheKey, result)
    }
    return result
  } catch (error) {
    console.error('Error fetching MET Norway weather data:', error)
    // Return error status instead of throwing to allow fallback
    return {
      mode: 'live',
      location: {
        latitude: lat,
        longitude: lon
      },
      current: {
        status: 'error',
        dataType: 'current_weather',
        unit: 'Celsius',
        points: [],
        lastUpdated: null,
        note: `MET Norway error: ${error.message}`,
        source: 'MET Norway'
      },
      hourly: [],
      daily: [],
      alerts: [],
      retrievedAt: new Date().toISOString(),
      sources: {
        metNorway: {
          status: 'error',
          lastUpdated: new Date().toISOString()
        }
      }
    }
  }
}

function normalizeMetNorwayData(data, lat, lon) {
  const result = {
    mode: 'live',
    location: {
      latitude: lat,
      longitude: lon
    },
    current: {
      status: 'ok',
      dataType: 'current_weather',
      unit: 'Celsius',
      points: [],
      lastUpdated: null,
      note: null,
      source: 'MET Norway'
    },
    hourly: [],
    daily: [],
    alerts: [],
    retrievedAt: new Date().toISOString(),
    sources: {
      metNorway: {
        status: 'ok',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Parse current weather - MET Norway returns XML but we'll assume JSON for this implementation
  if (data && data.properties) {
    // In a real implementation, we would parse the actual properties structure
    // This is a simplified version for demonstration purposes
    
    const current = data.properties?.timeseries?.[0]?.data?.instant?.details || {}
    
    // Convert timestamp to ISO format if available
    const time = data.properties?.timeseries?.[0]?.time
    
    result.current.lastUpdated = time || null
    
    // Only add points if we have data
    if (current.air_temperature !== undefined) {
      result.current.points.push({
        timestamp: time,
        value: current.air_temperature,
        unit: '°C',
        source: 'MET Norway',
        quality: 'observed'
      })
    }
    
    if (current.wind_speed !== undefined) {
      result.current.points.push({
        timestamp: time,
        value: current.wind_speed * 3.6, // Convert m/s to km/h
        unit: 'km/h',
        source: 'MET Norway',
        quality: 'observed'
      })
    }
    
    if (current.relative_humidity !== undefined) {
      result.current.points.push({
        timestamp: time,
        value: current.relative_humidity,
        unit: '%',
        source: 'MET Norway',
        quality: 'observed'
      })
    }
  }

  return result
}