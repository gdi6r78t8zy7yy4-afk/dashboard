import type { StatusSummaryConfig } from '../services/statusSummary'

export const siteConfig = {
  statusSummary: {
    method: 'Weighted risk',
    elevatedThreshold: 0.12,
    criticalThreshold: 0.4,
    unknownSeverity: 0.5,
    levels: {
      operational: 0,
      elevated: 1,
      critical: 2,
      unknown: 0,
    },
    descriptions: {
      operational: 'No material disruption reported across monitored services.',
      elevated: 'One or more services report degraded conditions or disruption.',
      critical: 'The configured risk threshold for priority response has been reached.',
      unknown: 'There is not enough connected source data to assess this area.',
    },
  } satisfies StatusSummaryConfig,
}
