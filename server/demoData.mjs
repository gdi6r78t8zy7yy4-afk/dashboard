export const demoOverview = {
  mode: 'demo',
  services: [
    { id: 'weather', label: 'Weather', description: 'Warnings and forecast', status: 'operational', severity: 0, weight: 1, metric: '2 active', metricLabel: 'weather warnings', updated: '4 min ago', category: 'Civil infrastructure' },
    { id: 'finance', label: 'Financial markets', description: 'Market and payment signals', status: 'operational', severity: 0, weight: 1, metric: 'Markets open', metricLabel: 'market status', updated: '1 min ago', category: 'Civil infrastructure' },
    { id: 'roads', label: 'Road traffic', description: 'National roads and incidents', status: 'elevated', severity: 1, weight: 1.2, metric: '14 incidents', metricLabel: 'reported incidents', updated: 'Demo snapshot', category: 'Transport' },
    { id: 'rail', label: 'Train traffic', description: 'Passenger and freight rail', status: 'operational', severity: 0, weight: 1.2, metric: '98.7%', metricLabel: 'on-time services', updated: '6 min ago', category: 'Transport' },
    { id: 'aviation', label: 'Air traffic', description: 'Airports and flight operations', status: 'operational', severity: 0, weight: 1, metric: 'Normal', metricLabel: 'airspace status', updated: '3 min ago', category: 'Transport' },
    { id: 'maritime', label: 'Boat traffic', description: 'Ports, shipping and fairways', status: 'elevated', severity: 1, weight: 1, metric: '2 advisories', metricLabel: 'navigation advisories', updated: '18 min ago', category: 'Transport' },
    { id: 'power', label: 'Electricity grid', description: 'Generation and transmission', status: 'operational', severity: 0, weight: 1.5, metric: 'Stable', metricLabel: 'grid operating data', updated: 'Live', category: 'Energy' },
    { id: 'energy', label: 'Oil & gas reserves', description: 'Storage and supply outlook', status: 'operational', severity: 0, weight: 1, metric: 'Normal', metricLabel: 'storage levels', updated: 'Live', category: 'Energy' },
    { id: 'datacenters', label: 'Datacenters', description: 'Facility capacity and service health', status: 'operational', severity: 0, weight: 1.3, metric: '99.98%', metricLabel: 'service availability', updated: '5 min ago', category: 'Digital infrastructure' },
    { id: 'telecom', label: 'Telecom operators', description: 'Coverage and public internet indicators', status: 'operational', severity: 0, weight: 1.5, metric: 'Coverage OK', metricLabel: 'network status', updated: 'Live', category: 'Digital infrastructure' },
    { id: 'networks', label: 'Data networks', description: 'Backbone capacity and incidents', status: 'operational', severity: 0, weight: 1.5, metric: 'Stable', metricLabel: 'network status', updated: 'Demo snapshot', category: 'Digital infrastructure' },
  ],
  incidents: [
    { severity: 'critical', service: 'CERT-SE', title: 'Confirmed cyber advisory', location: 'Sweden', time: '2026-10-10T17:52:00Z', note: 'Verified incident · CERT-SE reflected active exploit telemetry for critical endpoints.' },
    { severity: 'elevated', service: 'Road traffic', title: 'Reduced capacity on E4', location: 'Uppsala County', time: '2026-10-10T18:35:00Z', note: 'Warning signal · traffic feed not connected' },
  ],
  sectors: [
    { id: 'energy', label: 'Energy', status: 'operational', summary: 'Grid is within expected tolerances.', value: 'Stable', region: 'SE' },
    { id: 'telecom', label: 'Telecom', status: 'operational', summary: 'Network is functioning normally.', value: 'Coverage OK', region: 'SE' },
    { id: 'internet', label: 'Internet', status: 'operational', summary: 'Network is stable with no reported issues.', value: 'Stable', region: 'SE' },
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
    { id: 'timeline-3', title: 'Road capacity warning', time: '18:35', source: 'Trafikverket', severity: 'elevated', category: 'Transport' },
    { id: 'timeline-4', title: 'Navigation advisory issued', time: '18:12', source: 'Sjöfartsverket', severity: 'elevated', category: 'Transport' },
  ],
  sources: [
    { id: 'cert-se', label: 'CERT-SE', category: 'Cyber', status: 'ok', lastSuccessfulUpdate: '2026-10-10T17:52:00Z', updateInterval: '5 min', timeout: '8 s', lastError: null, requiresAuth: false, verified: true },
    { id: 'trafikverket', label: 'Trafikverket', category: 'Transport', status: 'not_configured', lastSuccessfulUpdate: '2026-10-10T15:11:00Z', updateInterval: '10 min', timeout: '12 s', lastError: 'API key missing', requiresAuth: true, verified: false },
    { id: 'ripe-stat', label: 'RIPEstat', category: 'Internet', status: 'ok', lastSuccessfulUpdate: '2026-10-10T17:45:00Z', updateInterval: '15 min', timeout: '10 s', lastError: null, requiresAuth: false, verified: true },
    { id: 'ioda', label: 'IODA', category: 'Internet', status: 'stale', lastSuccessfulUpdate: '2026-10-10T16:04:00Z', updateInterval: '30 min', timeout: '15 s', lastError: 'Feed delayed beyond SLA', requiresAuth: false, verified: true },
    { id: 'entsoe', label: 'ENTSO-E', category: 'Energy', status: 'not_configured', lastSuccessfulUpdate: '2026-10-10T15:42:00Z', updateInterval: '15 min', timeout: '12 s', lastError: 'Token not configured', requiresAuth: true, verified: false },
    { id: 'nordpool', label: 'Nord Pool Market Data API', category: 'Energy', status: 'not_configured', lastSuccessfulUpdate: null, updateInterval: '15 min', timeout: '10 s', lastError: 'API token not configured', requiresAuth: true, verified: false },
  ],
}

const demoSectorViews = {
  telecom: {
    id: 'telecom',
    label: 'Telecom operators',
    headline: 'Operator-specific real-time availability is not connected. Public routing and annual coverage data are available in the telecom dashboard.',
    status: 'operational',
    qualityNote: 'No operator-specific source is connected. Routing observations do not establish mobile operator or tower availability.',
    kpis: [
      { label: 'Operator feeds', value: '0', trend: 'configured', status: 'unknown' },
      { label: 'Mobile outages', value: 'No data', trend: 'operator-specific', status: 'unknown' },
      { label: 'Public routing sources', value: '2', trend: 'RIPE RIS, IODA', status: 'operational' },
      { label: 'Coverage statistics', value: 'Annual', trend: 'PTS 2025', status: 'unknown' },
    ],
    observations: [],
  },
  internet: {
    id: 'internet',
    label: 'Internet infrastructure',
    headline: 'BGP routing and internet outage detection data from public sources.',
    status: 'operational',
    qualityNote: 'Public internet monitoring data is available from RIPEstat and IODA.',
    kpis: [
      { label: 'Active prefixes', value: '150,000+', trend: 'stable', status: 'operational' },
      { label: 'Routing stability', value: 'High', trend: 'stable', status: 'operational' },
      { label: 'Outage detections', value: '2 alerts', trend: 'recent', status: 'elevated' },
      { label: 'Network coverage', value: 'Global', trend: 'full', status: 'operational' },
    ],
    observations: [],
  },
  cyber: {
    id: 'cyber',
    label: 'Cyber threats and vulnerabilities',
    headline: 'Active cyber incidents, security advisories, and vulnerability assessments.',
    status: 'critical',
    qualityNote: 'Security alerts from CERT-SE and other sources.',
    kpis: [
      { label: 'Active advisories', value: '1', trend: 'new', status: 'critical' },
      { label: 'Vulnerabilities', value: '12 active', trend: 'stable', status: 'elevated' },
      { label: 'Threat indicators', value: '36', trend: 'stable', status: 'operational' },
      { label: 'Security events', value: '8', trend: 'recent', status: 'elevated' },
    ],
    observations: [],
  },
  energy: {
    id: 'energy',
    label: 'Energy grid status',
    headline: 'Electricity generation, load, and transmission data from ENTSO-E and SMHI.',
    status: 'operational',
    qualityNote: 'Data from ENTSO-E and SMHI weather observations.',
    kpis: [
      { label: 'Grid stability', value: 'Stable', trend: 'stable', status: 'operational' },
      { label: 'Generation capacity', value: '98%', trend: 'stable', status: 'operational' },
      { label: 'Load forecast', value: 'Normal', trend: 'stable', status: 'operational' },
      { label: 'Weather impact', value: 'Minimal', trend: 'stable', status: 'operational' },
    ],
    observations: [],
  },
  transport: {
    id: 'transport',
    label: 'Transport infrastructure',
    headline: 'Road, rail, and maritime traffic conditions and incidents.',
    status: 'elevated',
    qualityNote: 'Data from Trafikverket and other transport authorities.',
    kpis: [
      { label: 'Road incidents', value: '14', trend: 'increasing', status: 'elevated' },
      { label: 'Rail capacity', value: '98.7%', trend: 'stable', status: 'operational' },
      { label: 'Air traffic', value: 'Normal', trend: 'stable', status: 'operational' },
      { label: 'Maritime alerts', value: '2', trend: 'increasing', status: 'elevated' },
    ],
    observations: [],
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
  const sector = demoSectorViews[sectorId]

  if (!sector) {
    return {
      mode: 'demo',
      id: sectorId,
      label: 'Data unavailable',
      headline: 'No sector-specific data source is configured for this dashboard.',
      status: 'unknown',
      qualityNote: 'Missing sector data is shown as unknown and is not inferred from another sector.',
      kpis: [],
      observations: [],
    }
  }

  // For telecom sector, we should return unknown status for all regions when not properly connected
  if (sectorId === 'telecom') {
    const telecomSector = {
      mode: 'demo',
      ...sector,
      status: 'unknown',
      qualityNote: 'No operator-specific source is connected. Routing observations do not establish mobile operator or tower availability.',
      kpis: [
        { label: 'Operator feeds', value: '0', trend: 'configured', status: 'unknown' },
        { label: 'Mobile outages', value: 'No data', trend: 'operator-specific', status: 'unknown' },
        { label: 'Public routing sources', value: '2', trend: 'RIPE RIS, IODA', status: 'operational' },
        { label: 'Coverage statistics', value: 'Annual', trend: 'PTS 2025', status: 'unknown' },
      ],
      observations: [],
    }
    
    return telecomSector;
  }

  if (safeRegion !== 'se') {
    // For non-Sweden regions, return a more realistic demo data
    const updatedSector = {
      mode: 'demo',
      ...sector,
      status: 'unknown', // Keep it as unknown for non-Sweden regions
      qualityNote: 'The selected region does not currently have a trusted live feed. The sector view is intentionally marked demo-only.',
      kpis: sector.kpis.map(kpi => ({
        ...kpi,
        status: 'unknown', // Ensure all KPIs show as unknown for demo
      })),
      observations: [],
    }
    
    // For transport sector, add some sample data
    if (sectorId === 'transport') {
      updatedSector.kpis = [
        { label: 'Road incidents', value: '12', trend: 'increasing', status: 'elevated' },
        { label: 'Rail capacity', value: '98.2%', trend: 'stable', status: 'operational' },
        { label: 'Air traffic', value: 'Normal', trend: 'stable', status: 'operational' },
        { label: 'Maritime alerts', value: '1', trend: 'increasing', status: 'elevated' },
      ]
    }
    
    return updatedSector
  }

  return {
    mode: 'demo',
    ...sector,
    observations: sector.observations.filter((observation) => observation.quality !== 'stale'),
  }
}
