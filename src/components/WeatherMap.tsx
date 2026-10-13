import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const WeatherMap = ({ 
  center = [57.7, 12.0], 
  zoom = 4,
  onLocationSelect,
  selectedLocation,
  weatherData
}) => {
  const mapRef = useRef(null)
  const [mapInstance, setMapInstance] = useState(null)
  const markerRef = useRef(null)

  useEffect(() => {
    // Initialize map if not already initialized
    if (!mapInstance && mapRef.current) {
      const map = L.map(mapRef.current).setView(center, zoom)
      
      // Add base tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map)
      
      setMapInstance(map)
      
      // Add click event listener
      map.on('click', (e) => {
        if (onLocationSelect) {
          onLocationSelect(e.latlng.lat, e.latlng.lng)
        }
      })
    }

    return () => {
      if (mapInstance) {
        mapInstance.remove()
      }
    }
  }, [center, zoom, mapInstance, onLocationSelect])

  // Update marker when selected location changes
  useEffect(() => {
    if (mapInstance && selectedLocation) {
      // Remove previous marker if exists
      if (markerRef.current) {
        mapInstance.removeLayer(markerRef.current)
      }
      
      // Add new marker
      const marker = L.marker([selectedLocation.lat, selectedLocation.lon]).addTo(mapInstance)
      markerRef.current = marker
      
      // Center map on marker
      mapInstance.setView([selectedLocation.lat, selectedLocation.lon], 8)
    }
  }, [mapInstance, selectedLocation])

  return (
    <div 
      ref={mapRef} 
      className="weather-map-container"
      style={{ height: '100%', width: '100%' }}
    />
  )
}

export default WeatherMap