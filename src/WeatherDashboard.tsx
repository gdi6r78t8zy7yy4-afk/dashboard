import { useEffect, useState } from 'react'
import WeatherMap from './components/WeatherMap'
import LocationSearch from './components/LocationSearch'
import WeatherDetailPanel from './components/WeatherDetailPanel'
import WeatherAlertDetail from './components/WeatherAlertDetail'
import type { SelectedLocation, WeatherAlert, WeatherData } from './types/weather'

const WeatherDashboard = () => {
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [showAlertDetail, setShowAlertDetail] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<WeatherAlert | null>(null)

  // Fetch weather data when location changes
  useEffect(() => {
    let cancelled = false

    const fetchWeatherData = async () => {
      if (!selectedLocation) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/v1/weather?lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}`
        )
        const data = (await response.json()) as WeatherData

        if (!cancelled) {
          setWeatherData(data)
          setShowDetailPanel(true)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to fetch weather data')
          console.error('Weather fetch error:', err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchWeatherData()

    return () => {
      cancelled = true
    }
  }, [selectedLocation])

  const handleLocationSelect = (latitude: number, longitude: number, name?: string) => {
    setSelectedLocation({ latitude, longitude, name })
  }

  const handleAlertSelect = (alert: WeatherAlert) => {
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
          />
        </div>

        <div className="sidebar">
          {showDetailPanel && selectedLocation && (
            <WeatherDetailPanel
              location={selectedLocation}
              weatherData={weatherData}
              onClose={handleCloseDetail}
              onAlertSelect={handleAlertSelect}
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
