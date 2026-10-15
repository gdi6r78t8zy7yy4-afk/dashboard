/**
 * Pure helpers for the shared gas/oil detail popup.
 *
 * Every builder only copies fields that are actually known about the record;
 * unknown fields stay null/undefined so the UI never presents unsupported
 * fields as if they were real observations.
 */

import type { GasOilDetailRecord, GasOilPoint, GasOilSource } from '../types/gas-oil'

const COMMODITY_LABELS: Record<string, string> = {
  crude_oil: 'Crude Oil',
  natural_gas: 'Natural Gas',
  refined_products: 'Refined Products',
  lng: 'LNG',
}

const INDICATOR_LABELS: Record<string, string> = {
  production: 'Production',
  consumption: 'Consumption',
  reserves: 'Reserves',
  imports: 'Imports',
  exports: 'Exports',
  storage: 'Storage',
  capacity: 'Capacity',
  flows: 'Flows',
  prices: 'Market Prices',
}

export function formatCommodity(id: string | null | undefined): string | null {
  if (!id) return null
  return COMMODITY_LABELS[id] ?? id
}

export function formatIndicator(id: string | null | undefined): string | null {
  if (!id) return null
  return INDICATOR_LABELS[id] ?? id
}

/**
 * Human-readable age label for a published/observed timestamp.
 * Returns null when no valid timestamp is available.
 */
export function freshnessLabel(publishedAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!publishedAt) return null
  const time = Date.parse(publishedAt)
  if (Number.isNaN(time)) return null
  const diffMs = now.getTime() - time
  if (diffMs < 0) return 'Not yet effective'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} d ago`
}

/**
 * Locale-formatted date/time for display, or null when no valid date.
 */
export function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function safeIso(value: string | null | undefined): string | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

function safeValue(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export interface ObservationContext {
  title: string
  scope?: string | null
  commodity?: string | null
  indicator?: string | null
  unit?: string | null
  source?: string | null
  recordRef?: string | null
  sourceUrl?: string | null
  status?: GasOilDetailRecord['status']
  period?: string | null
  note?: string | null
  definition?: string | null
  history?: GasOilPoint[] | null
  publishedAt?: string | null
}

/**
 * Build a detail record for a single chart observation (time + value).
 */
export function buildObservationRecord(point: GasOilPoint, context: ObservationContext): GasOilDetailRecord {
  return {
    id: `observation-${context.title.replace(/\s+/g, '-').toLowerCase()}-${point.timestamp ?? 'unknown'}`,
    kind: 'observation',
    title: context.title,
    typeLabel: 'Observation',
    scope: context.scope ?? null,
    commodity: context.commodity ?? null,
    indicator: context.indicator ?? null,
    value: safeValue(point.value),
    unit: context.unit ?? null,
    observedAt: safeIso(point.timestamp),
    publishedAt: safeIso(context.publishedAt),
    period: context.period ?? null,
    source: context.source ?? null,
    recordRef: context.recordRef ?? null,
    sourceUrl: context.sourceUrl ?? null,
    status: context.status ?? 'ok',
    note: context.note ?? null,
    definition: context.definition ?? null,
    methodology: null,
    history: context.history ?? null,
    coordinates: null,
    related: [],
  }
}

/**
 * Shape of map features selected by GasOilMap.
 */
export interface GasOilFeatureLike {
  id?: string
  name: string
  type: 'country' | 'field' | 'terminal' | 'pipeline' | 'storage' | 'coordinates'
  commodity?: string | null
  indicator?: string | null
  value?: number | null
  unit?: string | null
  coordinates?: [number, number] | null
  country?: string | null
  source?: string | null
  lastUpdated?: string | null
  status?: GasOilDetailRecord['status']
  note?: string | null
}

const FEATURE_KIND: Record<GasOilFeatureLike['type'], GasOilDetailRecord['kind']> = {
  country: 'geography',
  field: 'asset',
  terminal: 'asset',
  pipeline: 'asset',
  storage: 'asset',
  coordinates: 'observation',
}

const FEATURE_TYPE_LABEL: Record<GasOilFeatureLike['type'], string> = {
  country: 'Country',
  field: 'Oil/Gas Field',
  terminal: 'Terminal',
  pipeline: 'Pipeline',
  storage: 'Storage facility',
  coordinates: 'Map location',
}

/**
 * Build a detail record for a clicked map feature. Extra context (dataset
 * source/lastUpdated/note) is merged in by the dashboard when available.
 */
export function buildFeatureRecord(feature: GasOilFeatureLike, extra?: Partial<ObservationContext>): GasOilDetailRecord {
  const hasCoordinates = Array.isArray(feature.coordinates)
  return {
    id: `feature-${feature.id ?? feature.name.replace(/\s+/g, '-').toLowerCase()}`,
    kind: FEATURE_KIND[feature.type] ?? 'asset',
    title: feature.name,
    typeLabel: FEATURE_TYPE_LABEL[feature.type] ?? 'Feature',
    scope: feature.country ? `Country · ${feature.country}` : null,
    commodity: feature.commodity ?? null,
    indicator: feature.indicator ?? null,
    value: safeValue(feature.value),
    unit: feature.unit ?? null,
    observedAt: safeIso(feature.lastUpdated),
    publishedAt: safeIso(extra?.publishedAt ?? feature.lastUpdated),
    period: extra?.period ?? null,
    source: extra?.source ?? feature.source ?? null,
    recordRef: feature.id ?? null,
    sourceUrl: extra?.sourceUrl ?? null,
    status: feature.status ?? extra?.status ?? 'ok',
    note: extra?.note ?? feature.note ?? null,
    definition: extra?.definition ?? null,
    methodology: null,
    history: extra?.history ?? null,
    coordinates: hasCoordinates ? (feature.coordinates as [number, number]) : null,
    zoom: hasCoordinates ? 5 : undefined,
    related: hasCoordinates ? [{ label: 'Center map', action: 'map' }] : [],
  }
}

export interface KpiContext {
  id: string
  label: string
  definition: string
  latest: { value: number | null; unit: string | null; timestamp: string | null } | null
  source?: string | null
  sourceUrl?: string | null
  status?: GasOilDetailRecord['status']
  scope?: string | null
  period?: string | null
  note?: string | null
  methodology?: string | null
  history?: GasOilPoint[] | null
}

/**
 * Build a detail record for a KPI/summary card: metric definition, latest
 * observation, source and available history.
 */
export function buildKpiRecord(kpi: KpiContext): GasOilDetailRecord {
  return {
    id: `metric-${kpi.id}`,
    kind: 'metric',
    title: kpi.label,
    typeLabel: 'Metric',
    scope: kpi.scope ?? null,
    value: safeValue(kpi.latest?.value ?? null),
    unit: kpi.latest?.unit ?? null,
    observedAt: safeIso(kpi.latest?.timestamp ?? null),
    publishedAt: safeIso(kpi.latest?.timestamp ?? null),
    period: kpi.period ?? null,
    source: kpi.source ?? null,
    recordRef: kpi.id,
    sourceUrl: kpi.sourceUrl ?? null,
    status: kpi.status ?? (kpi.latest ? 'ok' : 'missing'),
    note: kpi.note ?? null,
    definition: kpi.definition,
    methodology: kpi.methodology ?? null,
    history: kpi.history ?? null,
    coordinates: null,
    related: [],
  }
}

/**
 * Source label for records derived from a dataset response. Prefers the
 * first source with status ok; never invents a source name.
 */
export function datasetSourceLabel(sources: { name: string; status: string }[] | null | undefined): string | null {
  if (!sources?.length) return null
  const ok = sources.find((s) => s.status === 'ok')
  return (ok ?? sources[0])?.name ?? null
}

/**
 * Build a detail record for a data source row (from the /sources metadata).
 */
export function buildSourceRecord(source: GasOilSource): GasOilDetailRecord {
  return {
    id: `source-${source.id}`,
    kind: 'source',
    title: source.name,
    typeLabel: 'Data source',
    scope: 'Data provider',
    commodity: null,
    indicator: null,
    value: null,
    unit: null,
    observedAt: source.lastUpdated,
    publishedAt: source.lastUpdated,
    period: null,
    source: source.name,
    recordRef: source.id,
    sourceUrl: source.url || null,
    status: source.status,
    note: source.note ?? null,
    definition: 'Upstream data provider for the gas and oil dashboard.',
    methodology: source.requiresAuth
      ? 'Requires an API key or token to be configured on the server.'
      : 'Open data; no authentication required.',
    history: null,
    coordinates: null,
    related: source.url ? [{ label: 'Open source site', action: 'source-url' }] : [],
  }
}
