export const demoOverview = {
  mode: 'demo',
  services: [
    { id: 'weather', label: 'Weather', description: 'Warnings and forecast', status: 'operational', severity: 0, weight: 1, metric: '2 active', metricLabel: 'weather warnings', updated: '4 min ago', category: 'Civil infrastructure' },
    { id: 'finance', label: 'Financial markets', description: 'Market and payment signals', status: 'operational', severity: 0, weight: 1, metric: 'Markets open', metricLabel: 'market status', updated: '1 min ago', category: 'Civil infrastructure' },
    { id: 'roads', label: 'Road traffic', description: 'National roads and incidents', status: 'elevated', severity: 1, weight: 1.2, metric: '14 incidents', metricLabel: 'reported incidents', updated: 'Demo snapshot', category: 'Transport' },
    { id: 'rail', label: 'Train traffic', description: 'Passenger and freight rail', status: 'operational', severity: 0, weight: 1.2, metric: '98.7%', metricLabel: 'on-time services', updated: '6 min ago', category: 'Transport' },
    { id: 'aviation', label: 'Air traffic', description: 'Airports and flight operations', status: 'operational', severity: 0, weight: 1, metric: 'Normal', metricLabel: 'airspace status', updated: '3 min ago', category: 'Transport' },
    { id: 'maritime', label: 'Boat traffic', description: 'Ports, shipping and fairways', status: 'elevated', severity: 1, weight: 1, metric: '2 advisories', metricLabel: 'navigation advisories', updated: '18 min ago', category: 'Transport' },
    { id: 'power', label: 'Electricity grid', description: 'Generation and transmission', status: 'operational', severity: 0, weight: 1.5, metric: '50.1 Hz', metricLabel: 'grid frequency', updated: '2 min ago', category: 'Energy' },
    { id: 'energy', label: 'Oil & gas reserves', description: 'Storage and supply outlook', status: 'unknown', severity: 1, weight: 1, metric: 'No live feed', metricLabel: 'source connectivity', updated: 'Not connected', category: 'Energy' },
    { id: 'datacenters', label: 'Datacenters', description: 'Facility capacity and service health', status: 'operational', severity: 0, weight: 1.3, metric: '99.98%', metricLabel: 'service availability', updated: '5 min ago', category: 'Digital infrastructure' },
    { id: 'telecom', label: 'Telecom operators', description: 'Coverage, capacity and disruptions', status: 'critical', severity: 2, weight: 1.5, metric: '1 disruption', metricLabel: 'operator-reported', updated: '8 min ago', category: 'Digital infrastructure' },
    { id: 'networks', label: 'Data networks', description: 'Backbone capacity and incidents', status: 'operational', severity: 0, weight: 1.5, metric: 'Stable', metricLabel: 'network status', updated: 'Demo snapshot', category: 'Digital infrastructure' },
  ],
  incidents: [
    { severity: 'critical', service: 'Telecom operators', title: 'Mobile service disruption', location: 'Stockholm County', time: '18:42', note: 'Demo incident · operator feed not connected' },
    { severity: 'elevated', service: 'Road traffic', title: 'Reduced capacity on E4', location: 'Uppsala County', time: '18:35', note: 'Demo incident · traffic feed not connected' },
    { severity: 'elevated', service: 'Boat traffic', title: 'Navigation advisory', location: 'Gulf of Bothnia', time: '18:12', note: 'Demo incident · maritime feed not connected' },
  ],
}

export function getOverviewForRegion(region) {
  if (region === 'se') return demoOverview

  return {
    ...demoOverview,
    services: demoOverview.services.map((service) => ({
      ...service,
      status: 'unknown',
      metric: 'No live feed',
      metricLabel: 'source connectivity',
      updated: 'Not connected',
    })),
    incidents: [],
  }
}
