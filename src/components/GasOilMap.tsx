import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Define types for our gas/oil map data
interface GasOilMapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  value: number;
  unit: string;
  type: 'field' | 'terminal' | 'pipeline' | 'storage' | 'facility';
  commodity?: string;
  indicator?: string;
  country?: string;
}

interface GasOilMapLayer {
  id: string;
  name: string;
  visible: boolean;
  type: 'country' | 'point' | 'line';
  data?: GasOilMapPoint[];
  source?: string;
  description?: string;
}

interface GasOilMapFeature {
  id?: string;
  name?: string;
  type: 'country' | 'field' | 'terminal' | 'pipeline' | 'storage' | 'coordinates';
  commodity?: string;
  indicator?: string;
  value?: number;
  unit?: string;
  coordinates?: [number, number];
  /** Raw click coordinates (type 'coordinates'). */
  lat?: number;
  lng?: number;
  country?: string;
  source?: string;
  lastUpdated?: string;
  status?: 'ok' | 'stale' | 'error' | 'missing';
  note?: string;
}

// Mock country data for demonstration
interface MockCountryEntry {
  value: number
  unit: string
  source: string
}

const MOCK_COUNTRY_DATA: Record<string, Record<string, MockCountryEntry>> = {
  production: {
    'United States': { value: 12000, unit: 'barrels/day', source: 'EIA' },
    'Saudi Arabia': { value: 10000, unit: 'barrels/day', source: 'Saudi Aramco' },
    'Russia': { value: 9500, unit: 'barrels/day', source: 'Rosneft' },
    'China': { value: 8500, unit: 'barrels/day', source: 'CNPC' },
    'Canada': { value: 5500, unit: 'barrels/day', source: 'Suncor' },
    'Brazil': { value: 4200, unit: 'barrels/day', source: 'Petrobras' },
    'United Kingdom': { value: 2800, unit: 'barrels/day', source: 'BP' },
    'Norway': { value: 2500, unit: 'barrels/day', source: 'Equinor' },
    'Iraq': { value: 2300, unit: 'barrels/day', source: 'Iraq National Oil Company' },
    'Mexico': { value: 1800, unit: 'barrels/day', source: 'Pemex' },
  },
  storage: {
    'United States': { value: 120000, unit: 'barrels', source: 'EIA' },
    'Saudi Arabia': { value: 100000, unit: 'barrels', source: 'Saudi Aramco' },
    'Russia': { value: 95000, unit: 'barrels', source: 'Rosneft' },
    'China': { value: 85000, unit: 'barrels', source: 'CNPC' },
    'Canada': { value: 55000, unit: 'barrels', source: 'Suncor' },
  },
  imports: {
    'Germany': { value: 2500, unit: 'barrels/day', source: 'IEA' },
    'Japan': { value: 3200, unit: 'barrels/day', source: 'IEA' },
    'China': { value: 4500, unit: 'barrels/day', source: 'IEA' },
    'India': { value: 2100, unit: 'barrels/day', source: 'IEA' },
    'South Korea': { value: 1800, unit: 'barrels/day', source: 'IEA' },
  },
  exports: {
    'Saudi Arabia': { value: 9000, unit: 'barrels/day', source: 'Saudi Aramco' },
    'Russia': { value: 8500, unit: 'barrels/day', source: 'Rosneft' },
    'United States': { value: 7800, unit: 'barrels/day', source: 'EIA' },
    'Canada': { value: 5200, unit: 'barrels/day', source: 'Suncor' },
    'Norway': { value: 2300, unit: 'barrels/day', source: 'Equinor' },
  },
  prices: {
    'United States': { value: 75.20, unit: 'USD/barrel', source: 'EIA' },
    'Europe': { value: 82.40, unit: 'USD/barrel', source: 'IEA' },
    'Asia': { value: 78.90, unit: 'USD/barrel', source: 'IEA' },
  }
}

const GasOilMap = ({ 
  onFeatureSelect,
  commodity = 'crude_oil',
  indicator = 'production',
  focus
}: {
  onFeatureSelect?: (feature: GasOilMapFeature) => void
  commodity?: string
  indicator?: string
  /** When set (and the token changes), the map flies to this location. */
  focus?: { coordinates: [number, number]; zoom: number; token: number } | null
}) => {
  const mapRef = useRef(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [layers, setLayers] = useState<GasOilMapLayer[]>([
    { id: 'production', name: 'Production', visible: true, type: 'country', source: 'EIA', description: 'Oil production by country' },
    { id: 'storage', name: 'Storage', visible: false, type: 'point', source: 'EIA', description: 'Strategic storage facilities' },
    { id: 'imports', name: 'Imports', visible: false, type: 'country', source: 'IEA', description: 'Oil imports by country' },
    { id: 'exports', name: 'Exports', visible: false, type: 'country', source: 'IEA', description: 'Oil exports by country' },
    { id: 'pipelines', name: 'Pipelines', visible: false, type: 'line', source: 'ENTSOG', description: 'Oil pipeline infrastructure' },
    { id: 'prices', name: 'Market Prices', visible: false, type: 'country', source: 'EIA', description: 'Regional market prices' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState('24h')
  const [legend, setLegend] = useState<{label: string; color: string}[]>([])
  const [countryData, setCountryData] = useState<Record<string, any>>({})
  const [markers, setMarkers] = useState<L.Marker[]>([])
  const [lines, setLines] = useState<L.Polyline[]>([])
  const [selectedMarker, setSelectedMarker] = useState<L.Marker | null>(null)

  // Keep the latest callback in a ref so the map is created exactly once
  // (the parent passes a fresh handler on every render).
  const onFeatureSelectRef = useRef(onFeatureSelect)
  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect
  }, [onFeatureSelect])

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return

    const map = L.map(mapRef.current, {
      center: [30, 15], // Center on Africa/Europe
      zoom: 2,
      zoomControl: true,
      attributionControl: true,
    })

    // Add base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map)

    setMapInstance(map)

    // Add click event listener for feature selection
    map.on('click', (e) => {
      const handler = onFeatureSelectRef.current
      if (handler) {
        // For coordinate clicks, show nearby country data
        handler({
          type: 'coordinates',
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        })
      }
    })

    // Cleanup on unmount
    return () => {
      map.remove()
    }
  }, [])
  
  // Load map data when layer changes or component mounts
  useEffect(() => {
    if (!mapInstance) return
    
    setLoading(true)
    setError(null)
    
    // Simulate loading data from API
    const loadData = async () => {
      try {
        // In a real implementation, we would fetch from:
        // `/api/v1/gas-oil?commodity=${commodity}&indicator=${indicator}&geography=global`
        
        // For demo purposes, let's use mock data
        const data = MOCK_COUNTRY_DATA[indicator] || {}
        setCountryData(data)
        
        // Update legend based on data
        const values = Object.values(data).map((d) => d.value)
        if (values.length > 0) {
          // Create a color scale based on value range
          const colors = [
            { label: 'Low', color: '#f0f8ff' },
            { label: 'Medium', color: '#87ceeb' },
            { label: 'High', color: '#4169e1' },
          ]
          
          setLegend(colors)
        }
        
        setLoading(false)
      } catch (err) {
        setError('Failed to load map data')
        setLoading(false)
      }
    }
    
    loadData()
  }, [indicator, commodity, mapInstance])
  
  // Fly to a focused location (e.g. when a search result is selected).
  useEffect(() => {
    if (!mapInstance || !focus) return
    const [lat, lng] = focus.coordinates
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    mapInstance.flyTo([lat, lng], focus.zoom ?? 5, { duration: 0.8 })
  }, [focus, mapInstance])
  
  // Toggle layer visibility
  const toggleLayer = (layerId: string) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    ))
  }
  
  // Reset map view
  const resetMapView = () => {
    if (mapInstance) {
      mapInstance.setView([30, 15], 2)
      // Remove selection highlighting
      if (selectedMarker) {
        selectedMarker.getElement()?.classList.remove('selected-marker')
        setSelectedMarker(null)
      }
    }
  }
  
  // Handle feature selection
  const handleSelectFeature = (feature: GasOilMapFeature) => {
    onFeatureSelectRef.current?.(feature)
  }
  
  // Render map based on selected layer
  useEffect(() => {
    if (!mapInstance) return
    
    // Clear existing layers
    markers.forEach(marker => mapInstance.removeLayer(marker))
    lines.forEach(line => mapInstance.removeLayer(line))
    setMarkers([])
    setLines([])
    
    // Add new layers based on visibility
    layers.forEach(layer => {
      if (!layer.visible) return
      
      // Handle country-level data (shaded regions)
      if (layer.type === 'country' && layer.id !== 'prices') {
        // This would be replaced with actual country polygon rendering
        // For now, we'll just log that this layer is handled
      }
      
      // Handle point data (facilities, terminals)
      if (layer.type === 'point' && layer.id === 'storage') {
        // Add storage facility markers
        Object.entries(countryData).forEach(([country, data]) => {
          // In a real implementation, we'd have actual coordinates
          // For demo purposes, let's place them roughly in their region
          let lat = 30 + Math.random() * 20 - 10 // Random around center
          let lng = 15 + Math.random() * 30 - 15 // Random around center
          
          // Better positioning for some countries
          if (country === 'United States') {
            lat = 39.8283; lng = -98.5795;
          } else if (country === 'Saudi Arabia') {
            lat = 24.7136; lng = 46.6753;
          } else if (country === 'Russia') {
            lat = 61.5240; lng = 105.3188;
          } else if (country === 'China') {
            lat = 35.8617; lng = 104.1954;
          } else if (country === 'Canada') {
            lat = 56.1304; lng = -106.3468;
          }
          
          const marker = L.marker([lat, lng]).addTo(mapInstance)
          
          // Add popup with data
          marker.bindPopup(`<b>${country}</b><br>Storage: ${data.value} ${data.unit}<br>Source: ${data.source}`)
          
          // Add click handler
          marker.on('click', () => {
            // Clear previous selection
            if (selectedMarker) {
              selectedMarker.getElement()?.classList.remove('selected-marker')
            }
            
            // Highlight new selection
            marker.getElement()?.classList.add('selected-marker')
            setSelectedMarker(marker)
            
            handleSelectFeature({
              id: country,
              name: country,
              type: 'storage',
              commodity,
              indicator,
              value: data.value,
              unit: data.unit,
              coordinates: [lat, lng],
              country,
              source: data.source,
              status: 'ok',
              lastUpdated: new Date().toISOString(),
            })
          })
          
          // Store reference for cleanup
          setMarkers(prev => [...prev, marker])
        })
      }
      
      // Handle line data (pipelines)
      if (layer.type === 'line' && layer.id === 'pipelines') {
        // For demo, create a simple pipeline line between two points
        const pipelineCoords = [
          [30, 15], // Start point (Middle East)
          [40, 20], // Middle point
          [50, 10], // End point (Europe)
        ]
        
        const line = L.polyline(pipelineCoords as [number, number][], {
          color: '#387c65',
          weight: 4,
        }).addTo(mapInstance)
        
        // Add popup to line
        const midpoint = [
          (pipelineCoords[0][0] + pipelineCoords[1][0] + pipelineCoords[2][0]) / 3,
          (pipelineCoords[0][1] + pipelineCoords[1][1] + pipelineCoords[2][1]) / 3
        ]
        
        line.bindPopup('Oil Pipeline<br>Trans-Eurasia Pipeline')
        
        // Add click handler
        line.on('click', () => {
          handleSelectFeature({
            id: 'pipeline-1',
            name: 'Trans-Eurasia Pipeline',
            type: 'pipeline',
            commodity,
            indicator: 'pipelines',
            value: 50000, // Example flow rate
            unit: 'barrels/day',
            coordinates: midpoint as [number, number],
            source: layer.source,
            status: 'ok',
            lastUpdated: new Date().toISOString(),
          })
        })
        
        setLines(prev => [...prev, line])
      }
    })
  }, [layers, mapInstance, countryData, commodity, indicator, selectedMarker])
  
  // Render loading state
  if (loading) {
    return (
      <div className="gas-oil-map-container">
        <div className="map-loading">Loading map data...</div>
      </div>
    )
  }
  
  // Render error state
  if (error) {
    return (
      <div className="gas-oil-map-container">
        <div className="map-error">{error}</div>
      </div>
    )
  }
  
  return (
    <div className="gas-oil-map-container">
      <div 
        ref={mapRef} 
        className="gas-oil-map"
        style={{ height: '100%', width: '100%' }}
      />
      
      {/* Map Controls */}
      <div className="map-controls">
        <button 
          className="map-control-button"
          onClick={resetMapView}
          title="Reset map view"
        >
          Reset View
        </button>
        
        <div className="map-layer-controls">
          {layers.map(layer => (
            <button
              key={layer.id}
              className={`map-layer-button ${layer.visible ? 'active' : ''}`}
              onClick={() => toggleLayer(layer.id)}
              title={layer.description}
            >
              {layer.name}
            </button>
          ))}
        </div>
        
        <div className="map-time-controls">
          <label htmlFor="time-period">Time Period:</label>
          <select 
            id="time-period"
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
      </div>
      
      {/* Legend */}
      <div className="map-legend">
        <h4>Legend</h4>
        {legend.map((item, index) => (
          <div key={index} className="legend-item">
            <span 
              className="legend-color" 
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </div>
        ))}
        <div className="legend-source">
          <small>Data source: {layers.find(l => l.visible)?.source || 'EIA'}</small>
        </div>
      </div>
      
      {/* Map Info */}
      <div className="map-info">
        <div className="map-info-header">
          <h3>Gas & Oil Dashboard</h3>
          <span className="map-info-subheader">
            {commodity} - {indicator}
          </span>
        </div>
        <p>Click on features to view details. Use layer controls to show different data types.</p>
      </div>
      
      {/* Source Attribution */}
      <div className="map-attribution">
        <small>Data sources: EIA, IEA, ENTSOG, Rosneft, BP, etc.</small>
      </div>
    </div>
  )
}

export default GasOilMap