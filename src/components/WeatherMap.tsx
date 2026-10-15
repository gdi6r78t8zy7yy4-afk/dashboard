import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { SelectedLocation } from '../types/weather'

interface WeatherMapProps {
  center?: [number, number]
  zoom?: number
  onLocationSelect?: (lat: number, lon: number, name?: string) => void
  selectedLocation?: SelectedLocation | null
}

const WeatherMap = ({ center = [57.7, 12.0], zoom = 4, onLocationSelect, selectedLocation }: WeatherMapProps) => {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  // Keep the latest callback in a ref so the map is created exactly once.
  const onLocationSelectRef = useRef(onLocationSelect)
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect
  }, [onLocationSelect])

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView(center, zoom)

      // Add base tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map)

      mapInstanceRef.current = map

      // Add click event listener
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (onLocationSelectRef.current) {
          onLocationSelectRef.current(e.latlng.lat, e.latlng.lng)
        }
      })
    }

    return () => {
      const map = mapInstanceRef.current
      if (map) {
        map.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [center, zoom])

  // Update marker when selected location changes
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !selectedLocation) return

    // Remove previous marker if exists
    if (markerRef.current) {
      map.removeLayer(markerRef.current)
      markerRef.current = null
    }

    // Add new marker
    const marker = L.marker([selectedLocation.latitude, selectedLocation.longitude]).addTo(map)
    markerRef.current = marker

    // Center map on marker
    map.setView([selectedLocation.latitude, selectedLocation.longitude], 8)
  }, [selectedLocation])

  return (
    <div
      ref={mapRef}
      className="weather-map-container"
      style={{ height: '100%', width: '100%' }}
    />
  )
}

export default WeatherMap
