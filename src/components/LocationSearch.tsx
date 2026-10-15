import { useEffect, useState } from 'react'
import type { GeocodingResult } from '../types/weather'

interface LocationSearchProps {
  onLocationSelect?: (latitude: number, longitude: number, name?: string) => void
  className?: string
}

const LocationSearch = ({ onLocationSelect, className = '' }: LocationSearchProps) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    if (query.length >= 2) {
      setLoading(true)
      setError(null)

      timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(`/api/v1/weather/search?query=${encodeURIComponent(query)}`)
          const data = (await response.json()) as { locations?: GeocodingResult[] }

          if (data.locations) {
            setResults(data.locations)
          } else {
            setResults([])
            setError('Failed to search locations')
          }
        } catch (err) {
          setError('Search failed')
          setResults([])
        } finally {
          setLoading(false)
        }
      }, 300)
    } else {
      setResults([])
      setLoading(false)
    }

    return () => clearTimeout(timeoutId)
  }, [query])

  const handleSelect = (location: GeocodingResult) => {
    setQuery('')
    setResults([])
    if (onLocationSelect) {
      onLocationSelect(location.latitude, location.longitude, location.name)
    }
  }

  return (
    <div className={`location-search ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a location..."
        className="location-search-input"
      />

      {loading && <div className="search-loading">Searching...</div>}

      {error && <div className="search-error">{error}</div>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((result) => (
            <div
              key={result.id}
              className="search-result-item"
              onClick={() => handleSelect(result)}
            >
              <div className="result-name">{result.name}</div>
              <div className="result-details">
                {result.country}{result.admin1 ? `, ${result.admin1}` : ''}{result.admin2 ? `, ${result.admin2}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LocationSearch
