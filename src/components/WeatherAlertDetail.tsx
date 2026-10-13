const WeatherAlertDetail = ({ alert, onClose }) => {
  if (!alert) {
    return (
      <div className="weather-alert-detail">
        <div className="detail-header">
          <h2>Alert Details</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        <p>No alert selected</p>
      </div>
    )
  }

  return (
    <div className="weather-alert-detail">
      <div className="detail-header">
        <h2>{alert.title}</h2>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      <div className="detail-content">
        <div className="alert-info">
          <div className="alert-meta">
            <span className={`severity ${alert.severity}`}>{alert.severity}</span>
            <span>{alert.category}</span>
          </div>
          
          <p className="alert-description">{alert.description}</p>
          
          {alert.sourceUrl && (
            <div className="alert-source">
              <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer">
                View Original Source
              </a>
            </div>
          )}
          
          <div className="alert-timestamps">
            <div>
              <strong>Start Time:</strong> {new Date(alert.startTime).toLocaleString()}
            </div>
            {alert.endTime && (
              <div>
                <strong>End Time:</strong> {new Date(alert.endTime).toLocaleString()}
              </div>
            )}
            <div>
              <strong>Source:</strong> {alert.source}
            </div>
          </div>
          
          {alert.location.latitude && alert.location.longitude && (
            <div className="alert-location">
              <strong>Location:</strong> 
              Lat: {alert.location.latitude.toFixed(4)}, Lon: {alert.location.longitude.toFixed(4)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WeatherAlertDetail