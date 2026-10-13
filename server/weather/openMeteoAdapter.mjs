/**
 * Open-Meteo Weather Data Adapter
 * Documentation: https://open-meteo.com/
 */

import { fetch } from 'undici'

export async function fetchOpenMeteoWeather(lat, lon, options = {}) {
  try {
    // Build the Open-Meteo API URL
    const baseUrl = 'https://api.open-meteo.com/v1/forecast'
    
    // Build query parameters
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current_weather: 'true',
      hourly: ['temperature_2m', 'precipitation', 'wind_speed_10m', 'wind_direction_10m', 'cloud_cover'].join(','),
      daily: ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'wind_speed_10m_max'].join(','),
      timezone: options.timezone || 'auto'
    })

    const url = `${baseUrl}?${params.toString()}`
    
    // Make the request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Infrastructure-Watch/1.0'
      },
      timeout: 10000 // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Parse and normalize the data
    return normalizeOpenMeteoData(data, lat, lon)
  } catch (error) {
    console.error('Error fetching Open-Meteo weather data:', error)
    throw new Error(`Failed to fetch Open-Meteo weather data: ${error.message}`)
  }
}

function normalizeOpenMeteoData(data, lat, lon) {
  const result = {
    mode: 'live',
    location: {
      latitude: lat,
      longitude: lon,
      name: data.location?.name || null,
      country: data.location?.country || null
    },
    current: {
      status: 'ok',
      dataType: 'current_weather',
      unit: 'Celsius',
      points: [],
      lastUpdated: data.current_weather?.time || null,
      note: null,
      source: 'Open-Meteo'
    },
    hourly: [],
    daily: [],
    alerts: [],
    retrievedAt: new Date().toISOString(),
    sources: {
      openMeteo: {
        status: 'ok',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // Parse current weather
  if (data.current_weather) {
    const current = data.current_weather
    
    result.current.points = [
      { timestamp: current.time, value: current.temperature, unit: '°C', source: 'Open-Meteo', quality: 'observed' },
      { timestamp: current.time, value: current.windspeed, unit: 'km/h', source: 'Open-Meteo', quality: 'observed' },
      { timestamp: current.time, value: current.winddirection, unit: '°', source: 'Open-Meteo', quality: 'observed' },
      { timestamp: current.time, value: current.precipitation, unit: 'mm', source: 'Open-Meteo', quality: 'observed' },
      { timestamp: current.time, value: current.cloudcover, unit: '%', source: 'Open-Meteo', quality: 'observed' }
    ]
  }

  // Parse hourly forecast
  if (data.hourly) {
    const hours = data.hourly.time || []
    const temps = data.hourly.temperature_2m || []
    const precip = data.hourly.precipitation || []
    const windSpeeds = data.hourly.wind_speed_10m || []
    const windDirs = data.hourly.wind_direction_10m || []
    const cloudCover = data.hourly.cloud_cover || []

    const hourlyData = []
    for (let i = 0; i < hours.length; i++) {
      if (hours[i]) {
        hourlyData.push({
          timestamp: hours[i],
          value: temps[i] || null,
          unit: '°C',
          source: 'Open-Meteo',
          quality: 'forecast'
        })
      }
    }

    result.hourly = [{
      status: 'ok',
      dataType: 'temperature_2m',
      unit: '°C',
      points: hourlyData,
      lastUpdated: data.hourly.time?.[0] || null,
      note: 'Hourly temperature forecast',
      source: 'Open-Meteo'
    }]
  }

  // Parse daily forecast
  if (data.daily) {
    const days = data.daily.time || []
    const tempsMax = data.daily.temperature_2m_max || []
    const tempsMin = data.daily.temperature_2m_min || []
    const precipSum = data.daily.precipitation_sum || []
    const windMax = data.daily.wind_speed_10m_max || []

    const dailyData = []
    for (let i = 0; i < days.length; i++) {
      if (days[i]) {
        dailyData.push({
          timestamp: days[i],
          value: tempsMax[i] || null,
          unit: '°C',
          source: 'Open-Meteo',
          quality: 'forecast'
        })
      }
    }

    result.daily = [{
      status: 'ok',
      dataType: 'temperature_2m_max',
      unit: '°C',
      points: dailyData,
      lastUpdated: data.daily.time?.[0] || null,
      note: 'Daily maximum temperature forecast',
      source: 'Open-Meteo'
    }]
  }

  return result
}