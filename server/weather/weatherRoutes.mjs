/**
 * Weather API Routes
 */

import { getWeatherData, getLocationInfo } from './weatherService.mjs'

/**
 * Register weather API routes
 * @param {Object} app - Express application instance
 */
export function registerWeatherRoutes(app) {
  // Get weather data for a location
  app.get('/api/v1/weather', async (req, res) => {
    try {
      const { lat, lon, timezone } = req.query
      
      // Validate required parameters
      if (!lat || !lon) {
        return res.status(400).json({
          error: 'Missing required parameters',
          message: 'Latitude (lat) and longitude (lon) are required'
        })
      }
      
      // Validate coordinates
      const latitude = parseFloat(lat)
      const longitude = parseFloat(lon)
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          error: 'Invalid coordinates',
          message: 'Latitude and longitude must be valid numbers'
        })
      }
      
      // Validate coordinate ranges
      if (latitude < -90 || latitude > 90) {
        return res.status(400).json({
          error: 'Invalid latitude',
          message: 'Latitude must be between -90 and 90'
        })
      }
      
      if (longitude < -180 || longitude > 180) {
        return res.status(400).json({
          error: 'Invalid longitude',
          message: 'Longitude must be between -180 and 180'
        })
      }
      
      // Fetch weather data
      const weatherData = await getWeatherData(latitude, longitude, { timezone })
      
      res.json(weatherData)
    } catch (error) {
      console.error('Weather API error:', error)
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch weather data'
      })
    }
  })

  // Search for locations
  app.get('/api/v1/weather/search', async (req, res) => {
    try {
      const { query } = req.query
      
      if (!query) {
        return res.status(400).json({
          error: 'Missing query parameter',
          message: 'Search query is required'
        })
      }
      
      const locationData = await getLocationInfo(query)
      
      res.json(locationData)
    } catch (error) {
      console.error('Location search error:', error)
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to search locations'
      })
    }
  })

  // Get weather alerts
  app.get('/api/v1/weather/alerts', async (req, res) => {
    try {
      // This endpoint could be extended to provide alerts by location or time period
      const alertsData = await getWeatherData(0, 0) // Dummy call to get alerts
      res.json({
        alerts: alertsData.alerts,
        retrievedAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Alerts API error:', error)
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch alerts'
      })
    }
  })
}