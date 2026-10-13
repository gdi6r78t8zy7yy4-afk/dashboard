/**
 * GDACS Weather Alerts Adapter
 * Website: https://www.gdacs.org/
 */

import { fetch } from 'undici'

export async function fetchGdacsAlerts(options = {}) {
  try {
    // Build the GDACS API URL
    const baseUrl = 'https://api.gdacs.org/api/Alerts'
    
    // Build query parameters (limit to recent alerts)
    const params = new URLSearchParams({
      eventtype: 'ALL',
      limit: options.limit || 50
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
      throw new Error(`GDACS API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Parse and normalize the data
    return normalizeGdacsData(data)
  } catch (error) {
    console.error('Error fetching GDACS alerts:', error)
    // Return empty alerts instead of throwing to allow fallback
    return {
      alerts: [],
      retrievedAt: new Date().toISOString()
    }
  }
}

function normalizeGdacsData(data) {
  const alerts = []
  
  // If data is an array, process each alert
  if (Array.isArray(data)) {
    for (const item of data) {
      // Extract relevant fields from GDACS alert structure
      if (item && item.eventName && item.eventType) {
        // Parse coordinates if available
        let latitude = null
        let longitude = null
        
        if (item.geometry && item.geometry.coordinates) {
          // GDACS uses GeoJSON format - extract coordinates
          const coords = item.geometry.coordinates
          if (Array.isArray(coords) && coords.length >= 2) {
            longitude = coords[0]
            latitude = coords[1]
          }
        }

        alerts.push({
          id: item.eventId || item.gdacsId || Math.random().toString(36).substr(2, 9),
          title: item.eventName,
          description: item.eventDescription || item.summary || '',
          severity: mapGdacsSeverity(item.severity) || 'medium',
          location: {
            latitude,
            longitude
          },
          startTime: item.date || null,
          endTime: item.endDate || null,
          source: 'GDACS',
          sourceUrl: item.url || null,
          category: mapGdacsCategory(item.eventType) || 'weather',
          status: item.status || 'active'
        })
      }
    }
  }
  
  // If data is a single alert object
  else if (data && data.eventName) {
    alerts.push({
      id: data.eventId || data.gdacsId || Math.random().toString(36).substr(2, 9),
      title: data.eventName,
      description: data.eventDescription || data.summary || '',
      severity: mapGdacsSeverity(data.severity) || 'medium',
      location: {
        latitude: data.geometry?.coordinates?.[1] || null,
        longitude: data.geometry?.coordinates?.[0] || null
      },
      startTime: data.date || null,
      endTime: data.endDate || null,
      source: 'GDACS',
      sourceUrl: data.url || null,
      category: mapGdacsCategory(data.eventType) || 'weather',
      status: data.status || 'active'
    })
  }

  return {
    alerts,
    retrievedAt: new Date().toISOString()
  }
}

function mapGdacsSeverity(severity) {
  if (!severity) return 'medium'
  
  const severityLower = severity.toLowerCase()
  if (severityLower.includes('low')) return 'low'
  if (severityLower.includes('medium') || severityLower.includes('moderate')) return 'medium'
  if (severityLower.includes('high') || severityLower.includes('severe')) return 'high'
  if (severityLower.includes('critical') || severityLower.includes('extreme')) return 'critical'
  return 'medium'
}

function mapGdacsCategory(eventType) {
  if (!eventType) return 'weather'
  
  const typeLower = eventType.toLowerCase()
  if (typeLower.includes('flood') || typeLower.includes('rain')) return 'weather'
  if (typeLower.includes('storm') || typeLower.includes('wind')) return 'weather'  
  if (typeLower.includes('earthquake')) return 'natural_disaster'
  if (typeLower.includes('fire') || typeLower.includes('wildfire')) return 'natural_disaster'
  if (typeLower.includes('health')) return 'health'
  return 'weather'
}