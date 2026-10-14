/**
 * Gas and Oil data types for Northwatch dashboard
 */

export interface GasOilPoint {
  timestamp: string;
  value: number;
  category?: string | null;
  quality?: string | null;
}

export interface GasOilDataset {
  status: 'ok' | 'not_configured' | 'error' | 'missing' | 'stale';
  dataType: string;
  unit: string;
  points: GasOilPoint[];
  lastUpdated: string | null;
  note: string | null;
}

export interface GasOilSource {
  id: string;
  name: string;
  url: string;
  status: 'ok' | 'not_configured' | 'error' | 'missing' | 'stale';
  lastUpdated: string | null;
  note: string | null;
  requiresAuth?: boolean;
  attribution?: string;
}

export interface GasOilResponse {
  mode: 'live' | 'partial' | 'demo';
  commodity: string;
  indicator: string;
  geography: {
    type: 'country' | 'region' | 'market_area' | 'coordinates';
    name: string;
    id?: string;
    coordinates?: [number, number];
  };
  sources: GasOilSource[];
  datasets: {
    production?: GasOilDataset;
    consumption?: GasOilDataset;
    reserves?: GasOilDataset;
    imports?: GasOilDataset;
    exports?: GasOilDataset;
    storage?: GasOilDataset;
    capacity?: GasOilDataset;
    flows?: GasOilDataset;
    prices?: GasOilDataset;
  };
  retrievedAt: string;
}

/**
 * Kinds of records the shared detail popup can display. Only fields that are
 * actually known for the selected record are rendered.
 */
export type GasOilDetailKind =
  | 'geography'
  | 'indicator'
  | 'benchmark'
  | 'asset'
  | 'source'
  | 'observation'
  | 'metric';

export interface GasOilDetailRecord {
  id: string;
  kind: GasOilDetailKind;
  title: string;
  typeLabel: string;
  /** Geographic scope, e.g. "Country · Europe" or "Global market". */
  scope?: string | null;
  commodity?: string | null;
  indicator?: string | null;
  value?: number | null;
  unit?: string | null;
  /** Start of the observation period / timestamp of the observation. */
  observedAt?: string | null;
  /** When the source published the value. */
  publishedAt?: string | null;
  /** Human-readable observation period, e.g. "Last 24 hours". */
  period?: string | null;
  source?: string | null;
  /** Original record reference (facility id, FRED series id, ...). */
  recordRef?: string | null;
  sourceUrl?: string | null;
  status?: 'ok' | 'stale' | 'error' | 'missing' | 'not_configured' | null;
  note?: string | null;
  definition?: string | null;
  methodology?: string | null;
  /** Related historical points when available. */
  history?: GasOilPoint[] | null;
  /** [lat, lng] when the record has a geographic location. */
  coordinates?: [number, number] | null;
  zoom?: number;
  related?: { label: string; action: string }[];
}

export interface GasOilSearchItem {
  id: string;
  name: string;
  type: GasOilDetailKind;
  typeLabel: string;
  scope: string | null;
  aliases: string[] | null;
  rank: number;
  detail: GasOilDetailRecord;
}

export interface GasOilSearchResponse {
  query: string;
  results: {
    geographies: GasOilSearchItem[];
    indicators: GasOilSearchItem[];
    benchmarks: GasOilSearchItem[];
    assets: GasOilSearchItem[];
    sources: GasOilSearchItem[];
  };
  total: number;
  byType: Record<string, number>;
  coverage: {
    geographies: number;
    indicators: number;
    benchmarks: number;
    assets: number;
    sources: number;
    note: string;
  };
  limitations: string[];
}