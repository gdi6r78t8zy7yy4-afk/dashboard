export const demoOverview = {
  mode: 'demo',
  services: [
    { id: 'weather', label: 'Weather', description: 'Warnings and forecast', status: 'operational', severity: 0, weight: 1, metric: '2 active', metricLabel: 'weather warnings', updated: '4 min ago', category: 'Civil infrastructure' },
    { id: 'finance', label: 'Financial markets', description: 'Market and payment signals', status: 'operational', severity: 0, weight: 1, metric: 'Markets open', metricLabel: 'market status', updated: '1 min ago', category: 'Civil infrastructure' },
    { id: 'roads', label: 'Road traffic', description: 'National roads and incidents', status: 'elevated', severity: 1, weight: 1.2, metric: '14 incidents', metricLabel: 'reported incidents', updated: 'Demo snapshot', category: 'Transport' },
    { id: 'rail', label: 'Train traffic', description: 'Passenger and freight rail', status: 'operational', severity: 0, weight: 1.2, metric: '98.7%', metricLabel: 'on-time services', updated: '6 min ago', category: 'Transport' },
    { id: 'aviation', label: 'Air traffic', description: 'Airports and flight operations', status: 'operational', severity: 0, weight: 1, metric: 'Normal', metricLabel: 'airspace status', updated: '3 min ago', category: 'Transport' },
    { id: 'maritime', label: 'Boat traffic', description: 'Ports, shipping and fairways', status: 'elevated', severity: 1, weight: 1, metric: '2 advisories', metricLabel: 'navigation advisories', updated: '18 min ago', category: 'Transport' },
    { id: 'power', label: 'Electricity grid', description: 'Generation and transmission', status: 'unknown', severity: 1, weight: 1.5, metric: 'No live feed', metricLabel: 'grid operating data unavailable', updated: 'Not connected', category: 'Energy' },
    { id: 'energy', label: 'Oil & gas reserves', description: 'Storage and supply outlook', status: 'unknown', severity: 1, weight: 1, metric: 'No live feed', metricLabel: 'source connectivity', updated: 'Not connected', category: 'Energy' },
    { id: 'datacenters', label: 'Datacenters', description: 'Facility capacity and service health', status: 'operational', severity: 0, weight: 1.3, metric: '99.98%', metricLabel: 'service availability', updated: '5 min ago', category: 'Digital infrastructure' },
    { id: 'telecom', label: 'Telecom operators', description: 'Coverage, capacity and disruptions', status: 'critical', severity: 2, weight: 1.5, metric: '1 disruption', metricLabel: 'operator-reported', updated: '8 min ago', category: 'Digital infrastructure' },
    { id: 'networks', label: 'Data networks', description: 'Backbone capacity and incidents', status: 'operational', severity: 0, weight: 1.5, metric: 'Stable', metricLabel: 'network status', updated: 'Demo snapshot', category: 'Digital infrastructure' },
  ],
  incidents: [
    { severity: 'critical', service: 'CERT-SE', title: 'Confirmed cyber advisory', location: 'Sweden', time: '2026-10-10T17:52:00Z', note: 'Verified incident · CERT-SE reflected active exploit telemetry for critical endpoints.' },
    { severity: 'critical', service: 'Telecom operators', title: 'Mobile service disruption', location: 'Stockholm County', time: '2026-10-10T18:42:00Z', note: 'Verified incident · operator feed not connected' },
    { severity: 'elevated', service: 'Road traffic', title: 'Reduced capacity on E4', location: 'Uppsala County', time: '2026-10-10T18:35:00Z', note: 'Warning signal · traffic feed not connected' },
  ],
  sectors: [
    { id: 'energy', label: 'Energy', status: 'operational', summary: 'Grid is within expected tolerances.', value: 'Stable', region: 'SE' },
    { id: 'telecom', label: 'Telecom', status: 'critical', summary: 'Urban service degradation has been observed.', value: '1 disruption', region: 'SE' },
    { id: 'internet', label: 'Internet', status: 'elevated', summary: 'Route instability is elevated in the core network.', value: '3 alerts', region: 'SE' },
    { id: 'transport', label: 'Transport', status: 'elevated', summary: 'Road and maritime warnings remain active.', value: '2 warnings', region: 'SE' },
    { id: 'cyber', label: 'Cyber', status: 'critical', summary: 'CERT advisory requires rapid validation.', value: '1 incident', region: 'SE' },
  ],
  mapRegions: [
    { id: 'se', label: 'Sweden', status: 'elevated', x: 180, y: 120, width: 50, height: 35 },
    { id: 'no', label: 'Norway', status: 'operational', x: 160, y: 50, width: 65, height: 38 },
    { id: 'fi', label: 'Finland', status: 'operational', x: 235, y: 70, width: 58, height: 30 },
    { id: 'dk', label: 'Denmark', status: 'operational', x: 170, y: 175, width: 30, height: 15 },
    { id: 'is', label: 'Iceland', status: 'unknown', x: 78, y: 42, width: 30, height: 20 },
  ],
  timeline: [
    { id: 'timeline-1', title: 'CERT advisory published', time: '17:52', source: 'CERT-SE', severity: 'critical', category: 'Cyber' },
    { id: 'timeline-2', title: 'Service degradation in Stockholm', time: '18:42', source: 'Telecom operators', severity: 'critical', category: 'Telecom' },
    { id: 'timeline-3', title: 'Road capacity warning', time: '18:35', source: 'Trafikverket', severity: 'elevated', category: 'Transport' },
    { id: 'timeline-4', title: 'Navigation advisory issued', time: '18:12', source: 'Sjöfartsverket', severity: 'elevated', category: 'Transport' },
  ],
  sources: [
    { id: 'cert-se', label: 'CERT-SE', category: 'Cyber', status: 'ok', lastSuccessfulUpdate: '2026-10-10T17:52:00Z', updateInterval: '5 min', timeout: '8 s', lastError: null, requiresAuth: false, verified: true },
    { id: 'trafikverket', label: 'Trafikverket', category: 'Transport', status: 'not_configured', lastSuccessfulUpdate: '2026-10-10T15:11:00Z', updateInterval: '10 min', timeout: '12 s', lastError: 'API key missing', requiresAuth: true, verified: false },
    { id: 'ripe-stat', label: 'RIPEstat', category: 'Internet', status: 'ok', lastSuccessfulUpdate: '2026-10-10T17:45:00Z', updateInterval: '15 min', timeout: '10 s', lastError: null, requiresAuth: false, verified: true },
    { id: 'ioda', label: 'IODA', category: 'Internet', status: 'stale', lastSuccessfulUpdate: '2026-10-10T16:04:00Z', updateInterval: '30 min', timeout: '15 s', lastError: 'Feed delayed beyond SLA', requiresAuth: false, verified: true },
    { id: 'entsoe', label: 'ENTSO-E', category: 'Energy', status: 'not_configured', lastSuccessfulUpdate: '2026-10-10T15:42:00Z', updateInterval: '15 min', timeout: '12 s', lastError: 'Token not configured', requiresAuth: true, verified: false },
  ],
}

const demoSectorViews = {
  telecom: {
    id: 'telecom',
    label: 'Telecom operators',
    headline: 'Network congestion is concentrated in major urban cells and interconnection points.',
    status: 'critical',
    qualityNote: 'Demo mode is active. Source quality is tracked explicitly and stale or missing data is excluded from the summary.',
    kpis: [
      { label: 'Verified incidents', value: '1', trend: 'last 24h', status: 'critical' },
      { label: 'Warnings', value: '1', trend: 'active', status: 'elevated' },
      { label: 'Technical observations', value: '2', trend: 'last 4h', status: 'elevated' },
      { label: 'Risk indicators', value: '1', trend: 'source quality', status: 'critical' },
    ],
    observations: [
      {
        id: 'telecom-verified-1',
        title: 'Mobile service disruption',
        summary: 'Verified incident from operator feed, localized to Stockholm County and major transit corridors.',
        kind: 'verified_incident',
        quality: 'verified',
        source: 'Telecom operators',
        location: 'Stockholm County',
        timestamp: '18:42 CET',
        severity: 'critical',
      },
      {
        id: 'telecom-warning-1',
        title: 'Backhaul saturation',
        summary: 'Warning signal indicates elevated latency and packet loss during peak mobile demand.',
        kind: 'warning',
        quality: 'provisional',
        source: 'Monitoring API',
        location: 'Gothenburg',
        timestamp: '19:05 CET',
        severity: 'elevated',
      },
      {
        id: 'telecom-tech-1',
        title: 'Routing telemetry delay',
        summary: 'Backend telemetry is delayed by a short interval and should be considered provisional until refreshed.',
        kind: 'technical_observation',
        quality: 'provisional',
        source: 'Edge telemetry',
        location: 'Malmö',
        timestamp: '18:58 CET',
        severity: 'elevated',
      },
      {
        id: 'telecom-tech-2',
        title: 'Device telemetry delayed',
        summary: 'Stale feed from a secondary device stream; value withheld because it exceeds acceptable freshness.',
        kind: 'technical_observation',
        quality: 'stale',
        source: 'Field sensors',
        location: 'Norrköping',
        timestamp: '08:00 CET',
        severity: 'elevated',
      },
    ],
  },
}

export function getOverviewForRegion(region) {
  const safeRegion = region ?? 'se'
  const overview = { ...demoOverview }

  if (safeRegion !== 'se') {
    return {
      ...overview,
      services: overview.services.map((service) => ({
        ...service,
        status: 'unknown',
        metric: 'No live feed',
        metricLabel: 'source connectivity',
        updated: 'Not connected',
      })),
      incidents: [],
      sectors: overview.sectors.map((sector) => ({
        ...sector,
        status: 'unknown',
        summary: 'Regional feed is unavailable or not configured.',
        value: 'No data',
      })),
      timeline: [],
      sources: overview.sources.map((source) => ({
        ...source,
        status: source.requiresAuth ? 'not_configured' : 'stale',
        lastError: source.requiresAuth ? 'Authentication missing' : 'No reliable recent refresh',
      })),
    }
  }

  return overview
}

export function getSectorForRegion(region, sectorId = 'telecom') {
  const safeRegion = region ?? 'se'
  const sector = demoSectorViews[sectorId] ?? demoSectorViews.telecom

  if (safeRegion !== 'se') {
    return {
      mode: 'demo',
      ...sector,
      status: 'unknown',
      qualityNote: 'The selected region does not currently have a trusted live feed. The sector view is intentionally marked demo-only.',
      kpis: [
        { label: 'Verified incidents', value: '0', trend: 'last 24h', status: 'unknown' },
        { label: 'Warnings', value: '0', trend: 'active', status: 'unknown' },
        { label: 'Technical observations', value: '0', trend: 'last 4h', status: 'unknown' },
        { label: 'Risk indicators', value: '0', trend: 'source quality', status: 'unknown' },
      ],
      observations: [],
    }
  }

  return {
    mode: 'demo',
    ...sector,
    observations: sector.observations.filter((observation) => observation.quality !== 'stale'),
  }
}
