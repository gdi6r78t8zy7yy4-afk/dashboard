import { describe, expect, it } from 'vitest'
import { siteConfig } from '../config/siteConfig'
import { summarizeStatuses } from './statusSummary'

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
