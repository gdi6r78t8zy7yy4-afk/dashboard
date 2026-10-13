import { useState, useEffect } from 'react'
import WeatherMap from './components/WeatherMap'
import LocationSearch from './components/LocationSearch'
import WeatherDetailPanel from './components/WeatherDetailPanel'
import WeatherAlertDetail from './components/WeatherAlertDetail'

const WeatherDashboard = () => {
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [weatherData, setWeatherData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [showAlertDetail, setShowAlertDetail] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState(null)

  // Fetch weather data when location changes
  useEffect(() => {
    const fetchWeatherData = async () => {
      if (!selectedLocation) return
      
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/v1/weather?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}`)
        const data = await response.json()
        
        setWeatherData(data)
        setShowDetailPanel(true)
      } catch (err) {
        setError('Failed to fetch weather data')
        console.error('Weather fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchWeatherData()
  }, [selectedLocation])

  const handleLocationSelect = async (lat, lon, name) => {
    setSelectedLocation({ lat, lon, name })
  }

  const handleAlertSelect = (alert) => {
    setSelectedAlert(alert)
    setShowAlertDetail(true)
  }

  const handleCloseDetail = () => {
    setShowDetailPanel(false)
  }

  const handleCloseAlertDetail = () => {
    setShowAlertDetail(false)
    setSelectedAlert(null)
  }

  return (
    <div className="weather-dashboard">
      <div className="dashboard-header">
        <h1>Global Weather Dashboard</h1>
        <LocationSearch onLocationSelect={handleLocationSelect} className="weather-location-search" />
      </div>

      <div className="dashboard-content">
        <div className="map-container">
          <WeatherMap 
            center={[57.7, 12.0]} 
            zoom={4}
            onLocationSelect={handleLocationSelect}
            selectedLocation={selectedLocation}
            weatherData={weatherData}
          />
        </div>

        <div className="sidebar">
          {showDetailPanel && selectedLocation && (
            <WeatherDetailPanel 
              location={selectedLocation}
              weatherData={weatherData}
              onClose={handleCloseDetail}
            />
          )}
          
          {showAlertDetail && selectedAlert && (
            <WeatherAlertDetail 
              alert={selectedAlert}
              onClose={handleCloseAlertDetail}
            />
          )}
        </div>
      </div>

      {loading && <div className="loading">Loading weather data...</div>}
      {error && <div className="error">{error}</div>}
    </div>
  )
}

export default WeatherDashboard