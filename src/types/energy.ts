/**
 * Energy data types for Northwatch dashboard
 */

export interface EnergyPoint {
  timestamp: string;
  value: number;
  category?: string | null;
  quality?: string | null;
}

export interface EnergyDataset {
  status: 'ok' | 'not_configured' | 'error' | 'missing' | 'stale';
  dataType: string;
  unit: string;
  points: EnergyPoint[];
  lastUpdated: string | null;
  note: string | null;
}

export interface WeatherObservation {
  parameter: number;
  label: string;
  status: 'ok' | 'not_configured' | 'error' | 'missing' | 'stale';
  unit: string;
  station: string | null;
  points: EnergyPoint[];
  lastUpdated: string | null;
  note: string | null;
}

export interface EnergyResponse {
  mode: 'live' | 'partial' | 'demo';
  market: {
    country: string;
    countryLabel: string;
    zone: string;
    eic: string;
    period: string;
    timezone: string;
    start: string;
    end: string;
  };
  sources: {
    entsoe: { status: string; label: string; endpoint: string; lastUpdated: string | null };
    smhi: { status: string; label: string };
    svkNotices: { status: string; label: string; url: string; note: string };
    elpris?: { status: string; label: string; endpoint: string; url?: string; lastUpdated: string | null; note?: string };
  };
  datasets: {
    dayAheadPrices: EnergyDataset;
    actualGeneration: EnergyDataset;
    generationForecast: EnergyDataset;
    actualLoad: EnergyDataset;
    loadForecast: EnergyDataset;
    crossBorderFlows: { neighbor: string; export: EnergyDataset; import: EnergyDataset }[];
    svkEvents?: EnergyDataset;
  };
  weather: WeatherObservation[];
  gridDisturbances: { status: string; value: null; note: string };
  retrievedAt: string;
  elpris?: Record<string, any> | null;
}