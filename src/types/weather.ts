/**
 * Shared types for the weather dashboard and the `/api/v1/weather*` endpoints.
 */

/** A single observation or forecast value from a weather source. */
export interface WeatherPoint {
  timestamp: string | null
  value: number | null
  unit: string
  source?: string
  quality?: string
}

/** A series of points (current conditions, hourly or daily forecast). */
export interface WeatherSeries {
  status: string
  dataType: string
  unit: string
  points: WeatherPoint[]
  lastUpdated: string | null
  note: string | null
  source?: string
}

/** A weather alert (GDACS or similar). */
export interface WeatherAlert {
  id: string
  title: string
  description: string
  severity: string
  category?: string
  location: {
    latitude: number | null
    longitude: number | null
  }
  startTime: string | null
  endTime?: string | null
  source?: string
  sourceUrl?: string | null
  status?: string
}

/** The resolved location inside a weather response. */
export interface WeatherLocationInfo {
  latitude: number
  longitude: number
  name?: string | null
  country?: string | null
}

/** Health of an individual weather source. */
export interface WeatherSourceStatus {
  status: string
  lastUpdated: string | null
}

/** Normalized weather response from `GET /api/v1/weather`. */
export interface WeatherData {
  mode: string
  location: WeatherLocationInfo
  current: WeatherSeries
  hourly: WeatherSeries[]
  daily: WeatherSeries[]
  alerts: WeatherAlert[]
  retrievedAt: string
  sources: Record<string, WeatherSourceStatus>
}

/** A location picked by the user (map click or geocoding search). */
export interface SelectedLocation {
  latitude: number
  longitude: number
  name?: string
}

/** A geocoding row from `GET /api/v1/weather/search`. */
export interface GeocodingResult {
  id: number | string
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
  admin2?: string
  population?: number
}
