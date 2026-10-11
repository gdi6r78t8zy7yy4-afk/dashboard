/**
 * MITRE ATT&CK Adapter.
 * Enterprise matrix tactics and techniques relevant to critical infrastructure,
 * network perimeters, vulnerabilities, and incident response.
 * Official website: https://attack.mitre.org/
 */

export const MITRE_TACTICS = [
  { id: 'TA0001', name: 'Initial Access', swedishName: 'Initial åtkomst', description: 'Metoder som hotaktörer använder för att ta sig in i nätverket.' },
  { id: 'TA0002', name: 'Execution', swedishName: 'Exekvering', description: 'Körning av skadlig kod på ett lokalt eller fjärrstyrt system.' },
  { id: 'TA0003', name: 'Persistence', swedishName: 'Persistens', description: 'Metoder för att behålla åtkomst även efter omstart eller lösenordsbyte.' },
  { id: 'TA0004', name: 'Privilege Escalation', swedishName: 'Behörighetseskalering', description: 'Att höja behörigheter till administratörs- eller root-nivå.' },
  { id: 'TA0005', name: 'Defense Evasion', swedishName: 'Försvarsundvikande', description: 'Tekniker för att undvika detektering från säkerhetsverktyg och EDR.' },
  { id: 'TA0006', name: 'Credential Access', swedishName: 'Åtkomst till inloggningsuppgifter', description: 'Stöld eller forcering av lösenord, tokens och certifikat.' },
  { id: 'TA0007', name: 'Discovery', swedishName: 'System- och nätverksinventering', description: 'Hotaktören kartlägger systemmiljön och interna resurser.' },
  { id: 'TA0008', name: 'Lateral Movement', swedishName: 'Lateral förflyttning', description: 'Spridning från det initialt komprometterade systemet till andra servrar.' },
  { id: 'TA0009', name: 'Collection', swedishName: 'Datainsamling', description: 'Insamling av känslig data, filer och konfigurationer.' },
  { id: 'TA0011', name: 'Command and Control', swedishName: 'C2 / Styrning och kontroll', description: 'Kommunikation med servrar utanför nätverket för instruktioner.' },
  { id: 'TA0010', name: 'Exfiltration', swedishName: 'Dataexfiltrering', description: 'Överföring av stulen information ut ur organisationen.' },
  { id: 'TA0040', name: 'Impact', swedishName: 'Påverkan och sabotage', description: 'Störning av tillgänglighet, integritet eller utpressning (t.ex. ransomware).' },
]

export const MITRE_TECHNIQUES = [
  {
    id: 'T1190',
    name: 'Exploit Public-Facing Application',
    tacticId: 'TA0001',
    tacticName: 'Initial Access',
    description: 'Hotaktörer utnyttjar sårbarheter i internetanslutna tjänster som webbservrar, VPN-gateways, brandväggar eller databaser för att få initial fotfäste.',
    cwes: ['CWE-78', 'CWE-79', 'CWE-89', 'CWE-94', 'CWE-119', 'CWE-502', 'CWE-787', 'CWE-22', 'CWE-20'],
    mitigation: 'Regelbunden sårbarhetsskanning, nätverkssegmentering, snabb applicering av säkerhetsuppdateringar och Web Application Firewall (WAF).',
    url: 'https://attack.mitre.org/techniques/T1190/',
    severity: 'critical',
  },
  {
    id: 'T1133',
    name: 'External Remote Services',
    tacticId: 'TA0001',
    tacticName: 'Initial Access',
    description: 'Åtkomst via externa fjärrtjänster såsom VPN, Citrix eller RDP utan att behöva placera skadlig kod initialt.',
    cwes: ['CWE-287', 'CWE-306', 'CWE-521'],
    mitigation: 'Kräv nätverks-MFA (flerfaktorautentisering), begränsa tillgång via IP-tillåtelselistor och övervaka inloggningsanomalier.',
    url: 'https://attack.mitre.org/techniques/T1133/',
    severity: 'elevated',
  },
  {
    id: 'T1566',
    name: 'Phishing',
    tacticId: 'TA0001',
    tacticName: 'Initial Access',
    description: 'Hotaktörer skickar nätfiskemeddelanden för att få användare att klicka på skadliga länkar, öppna bilagor eller uppge inloggningsuppgifter.',
    cwes: ['CWE-200', 'CWE-284'],
    mitigation: 'E-postfiltrering (SPF, DKIM, DMARC), phishing-utbildning och stark MFA (FIDO2/WebAuthn).',
    url: 'https://attack.mitre.org/techniques/T1566/',
    severity: 'elevated',
  },
  {
    id: 'T1199',
    name: 'Trusted Relationship / Supply Chain',
    tacticId: 'TA0001',
    tacticName: 'Initial Access',
    description: 'Intrång genom kompromettering av tredje part, leverantörer eller mjukvaruberoenden (leverantörskedjeattack).',
    cwes: ['CWE-829', 'CWE-494'],
    mitigation: 'Leverantörsgranskning, minst privilegierad åtkomst för externa konsulter och mjukvaruverifikation (SBOM).',
    url: 'https://attack.mitre.org/techniques/T1199/',
    severity: 'critical',
  },
  {
    id: 'T1059',
    name: 'Command and Scripting Interpreter',
    tacticId: 'TA0002',
    tacticName: 'Execution',
    description: 'Körning av kommandon genom inbyggda tolkar som PowerShell, bash, cmd.exe, Python eller VBScript.',
    cwes: ['CWE-77', 'CWE-78', 'CWE-88'],
    mitigation: 'Script Block Logging, PowerShell Constrained Language Mode och applikationsvitlistning (AppLocker/WDAC).',
    url: 'https://attack.mitre.org/techniques/T1059/',
    severity: 'elevated',
  },
  {
    id: 'T1203',
    name: 'Exploitation for Client Execution',
    tacticId: 'TA0002',
    tacticName: 'Execution',
    description: 'Utnyttjande av sårbarheter i lokala klientapplikationer (webbläsare, PDF-läsare, Office-paket) vid öppning av preparerat innehåll.',
    cwes: ['CWE-119', 'CWE-120', 'CWE-416', 'CWE-787'],
    mitigation: 'Härdning av webbläsare, sandlådeläge och central patchhantering av klientmjukvara.',
    url: 'https://attack.mitre.org/techniques/T1203/',
    severity: 'elevated',
  },
  {
    id: 'T1068',
    name: 'Exploitation for Privilege Escalation',
    tacticId: 'TA0004',
    tacticName: 'Privilege Escalation',
    description: 'Utnyttjande av sårbarheter i operativsystemets kärna eller priviligerade tjänster för att erhålla SYSTEM/root-rättigheter.',
    cwes: ['CWE-250', 'CWE-269', 'CWE-276'],
    mitigation: 'Principen om minsta behörighet, aktivera minnesskydd (DEP, ASLR) och snabb kärnuppdatering.',
    url: 'https://attack.mitre.org/techniques/T1068/',
    severity: 'critical',
  },
  {
    id: 'T1078',
    name: 'Valid Accounts',
    tacticId: 'TA0005',
    tacticName: 'Defense Evasion',
    description: 'Hotaktörer använder legitima användarkonton för att smälta in i normal nätverkstrafik och kringgå åtkomstkontroller.',
    cwes: ['CWE-287', 'CWE-521'],
    mitigation: 'Privileged Access Management (PAM), rotationsrutiner för lösenord och kontinuerlig granskning av inaktiva konton.',
    url: 'https://attack.mitre.org/techniques/T1078/',
    severity: 'elevated',
  },
  {
    id: 'T1505',
    name: 'Server Software Component / Web Shell',
    tacticId: 'TA0003',
    tacticName: 'Persistence',
    description: 'Installation av web shells eller skadliga moduler i webbservrar för att säkerställa långsiktig bakdörrsåtkomst.',
    cwes: ['CWE-434', 'CWE-94'],
    mitigation: 'Filintegritetsövervakning (FIM), skrivskydd av webbkataloger och logganalys av onormala HTTP POST-anrop.',
    url: 'https://attack.mitre.org/techniques/T1505/',
    severity: 'critical',
  },
  {
    id: 'T1562',
    name: 'Impair Defenses',
    tacticId: 'TA0005',
    tacticName: 'Defense Evasion',
    description: 'Avaktivering eller manipulation av säkerhetsverktyg, antivirustjänster, Windows Event Logs eller brandväggsregler.',
    cwes: ['CWE-284', 'CWE-732'],
    mitigation: ' manipulationsskydd (Tamper Protection) för EDR och centraliserad loggning med immutabel lagring (SIEM).',
    url: 'https://attack.mitre.org/techniques/T1562/',
    severity: 'critical',
  },
  {
    id: 'T1110',
    name: 'Brute Force',
    tacticId: 'TA0006',
    tacticName: 'Credential Access',
    description: 'Systematiska försök att gissa lösenord via lösenordssprejning, ordlistor eller råstyrkeangrepp mot inloggningsportaler.',
    cwes: ['CWE-307', 'CWE-521'],
    mitigation: 'Kontoutlåsning, hastighetsbegränsning (rate limiting) och blockering av kända angrepps-IP.',
    url: 'https://attack.mitre.org/techniques/T1110/',
    severity: 'elevated',
  },
  {
    id: 'T1557',
    name: 'Adversary-in-the-Middle (AiTM)',
    tacticId: 'TA0006',
    tacticName: 'Credential Access',
    description: 'Mellanhandskapning av sessionstokens eller krypterad trafik mellan användare och legitim autentiseringstjänst.',
    cwes: ['CWE-287', 'CWE-295'],
    mitigation: 'Phishing-resistenta MFA-metoder (FIDO2) och strikt TLS-certifikatsvalidering.',
    url: 'https://attack.mitre.org/techniques/T1557/',
    severity: 'critical',
  },
  {
    id: 'T1486',
    name: 'Data Encrypted for Impact (Ransomware)',
    tacticId: 'TA0040',
    tacticName: 'Impact',
    description: 'Kryptering av organisationens filer, virtuella maskiner och säkerhetskopior i syfte att utpressa offret på lösensumma.',
    cwes: ['CWE-284', 'CWE-311'],
    mitigation: 'Isolerade offline-backuper (3-2-1-principen), segmenterade nätverk och övervakning av onormal masskrypteringsaktivitet.',
    url: 'https://attack.mitre.org/techniques/T1486/',
    severity: 'critical',
  },
  {
    id: 'T1499',
    name: 'Endpoint Denial of Service',
    tacticId: 'TA0040',
    tacticName: 'Impact',
    description: 'Överbelastning av servrar eller enskilda tjänster genom resursutmattning (CPU, minne, sockets) eller kraschframkallande fel.',
    cwes: ['CWE-400', 'CWE-770', 'CWE-19'],
    mitigation: 'Resurskvoter, DDoS-skydd och automatisk omstart av havererade systemprocesser.',
    url: 'https://attack.mitre.org/techniques/T1499/',
    severity: 'elevated',
  },
  {
    id: 'T1498',
    name: 'Network Denial of Service',
    tacticId: 'TA0040',
    tacticName: 'Impact',
    description: 'Volymetriska nätverksangrepp som mättar bandbredd och nätverkskapacitet (SYN flood, UDP amplification).',
    cwes: ['CWE-400'],
    mitigation: 'BGP Anycast, uppströms DDoS-mitigering och trafikanalys.',
    url: 'https://attack.mitre.org/techniques/T1498/',
    severity: 'elevated',
  },
  {
    id: 'T1071',
    name: 'Application Layer Protocol',
    tacticId: 'TA0011',
    tacticName: 'Command and Control',
    description: 'Hotaktörer kapslar in C2-kommunikation i legitima protokoll såsom HTTPS, DNS eller WebSocket för att undvika inspektion.',
    cwes: ['CWE-200'],
    mitigation: 'SSL/TLS-dekryptering och djupgående paketinspektion i brandväggar, DNS-filtrering.',
    url: 'https://attack.mitre.org/techniques/T1071/',
    severity: 'elevated',
  },
]

/**
 * Maps a list of CWEs and text descriptions to relevant MITRE ATT&CK techniques.
 */
export function mapToMitreTechniques({ cwes = [], text = '', isRansomware = false } = {}) {
  const matched = new Map()

  // Explicit ransomware mapping
  if (isRansomware || /ransomware|utpressnings|krypterat|krypteringsskadlig/i.test(text)) {
    const t = MITRE_TECHNIQUES.find((x) => x.id === 'T1486')
    if (t) matched.set(t.id, t)
  }

  // CWE mappings
  const cweSet = new Set((cwes || []).map((c) => String(c).toUpperCase().trim()))
  for (const tech of MITRE_TECHNIQUES) {
    for (const cwe of tech.cwes || []) {
      if (cweSet.has(cwe)) {
        matched.set(tech.id, tech)
      }
    }
  }

  // Keyword mappings in title/description
  const lower = (text || '').toLowerCase()
  if (/web|http|rce|remote code execution|sql injection|ssrf|command injection|public-facing/i.test(lower)) {
    const t = MITRE_TECHNIQUES.find((x) => x.id === 'T1190')
    if (t) matched.set(t.id, t)
  }
  if (/vpn|remote desktop|rdp|citrix|remote access/i.test(lower)) {
    const t = MITRE_TECHNIQUES.find((x) => x.id === 'T1133')
    if (t) matched.set(t.id, t)
  }
  if (/privilege escalation|privilegieeskalering|root|system behörighet/i.test(lower)) {
    const t = MITRE_TECHNIQUES.find((x) => x.id === 'T1068')
    if (t) matched.set(t.id, t)
  }
  if (/denial of service|dos|överbelastning|crash|resource exhaustion/i.test(lower)) {
    const t = MITRE_TECHNIQUES.find((x) => x.id === 'T1499')
    if (t) matched.set(t.id, t)
  }
  if (/phishing|nätfiske|credential harvesting/i.test(lower)) {
    const t = MITRE_TECHNIQUES.find((x) => x.id === 'T1566')
    if (t) matched.set(t.id, t)
  }
  if (/powershell|bash|script execution|command execution/i.test(lower)) {
    const t = MITRE_TECHNIQUES.find((x) => x.id === 'T1059')
    if (t) matched.set(t.id, t)
  }

  return [...matched.values()]
}

export function getMitreAttackData() {
  return {
    state: 'ok',
    matrix: 'Enterprise ATT&CK',
    tactics: MITRE_TACTICS,
    techniques: MITRE_TECHNIQUES,
    totalTechniques: MITRE_TECHNIQUES.length,
    totalTactics: MITRE_TACTICS.length,
    provenance: {
      source: 'MITRE ATT&CK',
      sourceUrl: 'https://attack.mitre.org/',
      license: 'MITRE ATT&CK Terms of Use',
      verified: true,
      quality: 'industry-framework',
    },
  }
}
