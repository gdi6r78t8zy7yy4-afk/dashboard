export type StatusLevel = 'operational' | 'elevated' | 'critical' | 'unknown'

export type ServiceStatus = {
  status: StatusLevel
  severity: number
  weight: number
}

export type StatusSummaryConfig = {
  method: string
  elevatedThreshold: number
  criticalThreshold: number
  unknownSeverity: number
  levels: Record<StatusLevel, number>
  descriptions: Record<StatusLevel, string>
}

export type StatusSummary = {
  level: StatusLevel
  label: string
  description: string
  score: number | null
}

const labels: Record<StatusLevel, string> = {
  operational: 'All systems operational',
  elevated: 'Elevated service conditions',
  critical: 'Critical service disruption',
  unknown: 'Situation unknown',
}

export function summarizeStatuses(
  services: ServiceStatus[],
  config: StatusSummaryConfig,
): StatusSummary {
  if (services.length === 0 || services.every((service) => service.status === 'unknown')) {
    return {
      level: 'unknown',
      label: labels.unknown,
      description: config.descriptions.unknown,
      score: null,
    }
  }

  const totalWeight = services.reduce((total, service) => total + service.weight, 0)
  if (totalWeight <= 0) {
    return {
      level: 'unknown',
      label: labels.unknown,
      description: config.descriptions.unknown,
      score: null,
    }
  }

  const weightedSeverity = services.reduce((total, service) => {
    const severity = service.status === 'unknown'
      ? config.unknownSeverity
      : config.levels[service.status]
    return total + severity * service.weight
  }, 0)
  const score = weightedSeverity / (totalWeight * Math.max(...Object.values(config.levels), 1))
  const level: StatusLevel = score >= config.criticalThreshold
    ? 'critical'
    : score >= config.elevatedThreshold
      ? 'elevated'
      : 'operational'

  return {
    level,
    label: labels[level],
    description: config.descriptions[level],
    score,
  }
}
