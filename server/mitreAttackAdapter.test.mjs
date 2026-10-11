import { describe, expect, it } from 'vitest'
import {
  getMitreAttackData,
  mapToMitreTechniques,
  MITRE_TACTICS,
  MITRE_TECHNIQUES,
} from './mitreAttackAdapter.mjs'

describe('mitreAttackAdapter', () => {
  it('provides tactics and techniques in Enterprise ATT&CK matrix', () => {
    const data = getMitreAttackData()
    expect(data.state).toBe('ok')
    expect(data.tactics.length).toBeGreaterThan(10)
    expect(data.techniques.length).toBeGreaterThan(15)
    expect(data.provenance.source).toBe('MITRE ATT&CK')
  })

  it('maps CWEs and ransomware keywords to relevant techniques', () => {
    // Ransomware mapping
    const ransomwareMatches = mapToMitreTechniques({
      isRansomware: true,
      text: 'Encrypted files demanding payment',
    })
    expect(ransomwareMatches.some((t) => t.id === 'T1486')).toBe(true)

    // Public-facing application exploit (CWE-89 SQLi, CWE-78 command injection)
    const webMatches = mapToMitreTechniques({
      cwes: ['CWE-89'],
      text: 'SQL injection in web portal',
    })
    expect(webMatches.some((t) => t.id === 'T1190')).toBe(true)

    // Remote access / VPN mapping
    const vpnMatches = mapToMitreTechniques({
      text: 'Flaw in SSL VPN gateway allowing bypass',
    })
    expect(vpnMatches.some((t) => t.id === 'T1133')).toBe(true)
  })
})
