import { useState, useEffect } from 'react'

const WeatherDetailPanel = ({ location, weatherData, onClose }) => {
  const [currentWeather, setCurrentWeather] = useState(null)
  const [hourlyForecast, setHourlyForecast] = useState([])
  const [dailyForecast, setDailyForecast] = useState([])
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    if (weatherData) {
      // Set current weather data
      if (weatherData.current && weatherData.current.points) {
        setCurrentWeather(weatherData.current.points)
      }
      
      // Set forecast data
      if (weatherData.hourly) {
        setHourlyForecast(weatherData.hourly)
      }
      
      if (weatherData.daily) {
        setDailyForecast(weatherData.daily)
      }
      
      // Set alerts
      if (weatherData.alerts) {
        setAlerts(weatherData.alerts)
      }
    }
  }, [weatherData])

  if (!location) {
    return (
      <div className="weather-detail-panel">
        <div className="detail-header">
          <h2>Select a Location</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        <p>Please select a location on the map to view weather details.</p>
      </div>
    )
  }

  // Check if we have data to display
  const hasData = currentWeather || hourlyForecast.length > 0 || dailyForecast.length > 0 || alerts.length > 0

  return (
    <div className="weather-detail-panel">
      <div className="detail-header">
        <h2>{location.name || 'Weather Details'}</h2>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      <div className="detail-content">
        {!hasData ? (
          <div className="data-empty">
            <p>No weather data available for this location.</p>
          </div>
        ) : (
          <>
            {/* Location Info */}
            <div className="location-info">
              <h3>Location</h3>
              <p>{location.name}</p>
              <p>Lat: {location.latitude.toFixed(4)}, Lon: {location.longitude.toFixed(4)}</p>
            </div>

            {/* Current Weather */}
            {currentWeather && (
              <div className="current-weather">
                <h3>Current Weather</h3>
                <div className="weather-grid">
                  {currentWeather.map((point, index) => (
                    <div key={index} className="weather-item">
                      <span className="weather-label">{point.source}</span>
                      <span className="weather-value">{point.value} {point.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hourly Forecast */}
            {hourlyForecast.length > 0 && (
              <div className="hourly-forecast">
                <h3>Hourly Forecast</h3>
                <div className="forecast-grid">
                  {hourlyForecast.slice(0, 12).map((forecast, index) => (
                    <div key={index} className="forecast-item">
                      <span>{forecast.dataType}</span>
                      <span>{forecast.points[0]?.value} {forecast.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Forecast */}
            {dailyForecast.length > 0 && (
              <div className="daily-forecast">
                <h3>Daily Forecast</h3>
                <div className="forecast-grid">
                  {dailyForecast.slice(0, 7).map((forecast, index) => (
                    <div key={index} className="forecast-item">
                      <span>{forecast.dataType}</span>
                      <span>{forecast.points[0]?.value} {forecast.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="weather-alerts">
                <h3>Weather Alerts</h3>
                <div className="alerts-list">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="alert-item">
                      <h4>{alert.title}</h4>
                      <p>{alert.description}</p>
                      <div className="alert-meta">
                        <span className={`severity ${alert.severity}`}>{alert.severity}</span>
                        <span>{new Date(alert.startTime).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default WeatherDetailPanel