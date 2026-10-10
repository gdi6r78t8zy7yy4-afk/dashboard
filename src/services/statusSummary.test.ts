import { describe, expect, it } from 'vitest'
import { siteConfig } from '../config/siteConfig'
import { buildSectorObservations } from './sectorView'
import { summarizeStatuses } from './statusSummary'

describe('buildSectorObservations', () => {
  it('keeps verified and warning data while filtering stale or missing observations', () => {
    const view = buildSectorObservations(
      'telecom',
      [
        { status: 'critical', severity: 2, weight: 1.5, id: 'telecom', label: 'Telecom operators', description: 'Capacity signal', metric: '1 disruption', metricLabel: 'operator-reported', updated: '8 min ago', category: 'Digital infrastructure' },
      ],
      [
        { severity: 'critical', service: 'Telecom operators', title: 'Mobile service disruption', location: 'Stockholm County', time: '18:42', note: 'Verified incident' },
        { severity: 'elevated', service: 'Telecom operators', title: 'Backhaul saturation', location: 'Gothenburg', time: '19:05', note: 'Warning signal' },
        { severity: 'elevated', service: 'Telecom operators', title: 'Device telemetry delayed', location: 'Malmö', time: '08:00', note: 'Stale feed' },
      ],
      'se',
    )

    expect(view.kpis.some((kpi) => kpi.label === 'Verified incidents')).toBe(true)
    expect(view.observations).toHaveLength(2)
    expect(view.observations[0].quality).toBe('verified')
    expect(view.observations.some((obs) => obs.title === 'Device telemetry delayed')).toBe(false)
  })
})

describe('summarizeStatuses', () => {
  it('returns operational when all monitored services are healthy', () => {
    const summary = summarizeStatuses([
      { status: 'operational', severity: 0, weight: 1 },
      { status: 'operational', severity: 0, weight: 2 },
    ], siteConfig.statusSummary)

    expect(summary.level).toBe('operational')
    expect(summary.score).toBe(0)
  })

  it('weights risk by service importance and configured severity', () => {
    const summary = summarizeStatuses([
      { status: 'critical', severity: 2, weight: 3 },
      { status: 'operational', severity: 0, weight: 1 },
    ], siteConfig.statusSummary)

    expect(summary.level).toBe('critical')
    expect(summary.score).toBe(0.75)
  })

  it('applies site-configured thresholds to the weighted score', () => {
    const summary = summarizeStatuses([
      { status: 'elevated', severity: 1, weight: 1 },
    ], { ...siteConfig.statusSummary, criticalThreshold: 0.45, elevatedThreshold: 0.2 })

    expect(summary.level).toBe('critical')
  })

  it('returns unknown when there are no assessable services', () => {
    expect(summarizeStatuses([], siteConfig.statusSummary).level).toBe('unknown')
    expect(summarizeStatuses([
      { status: 'unknown', severity: 1, weight: 1 },
    ], siteConfig.statusSummary).level).toBe('unknown')
  })
})
