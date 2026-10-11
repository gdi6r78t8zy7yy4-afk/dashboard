# Cyberhot & Sårbarhetsbevakning (Infrastructure Watch)

Dokumentation över datakällor, klassificeringsregler, integrationsarkitektur och testresultat för cyberhotdashboarden i Infrastructure Watch (Northwatch).

---

## 1. Datakällor & Integrationer

| Datakälla | Typ / Protokoll | Endpoint / URL | Autentisering | Aktualitet / Cache |
| :--- | :--- | :--- | :--- | :--- |
| **CERT-SE** | Atom / XML | `https://www.cert.se/feed/atom.xml` | Öppen (ingen nyckel) | 5 min in-memory cache |
| **CISA KEV** | Officiell JSON (maskinläsbar) | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` (fallback till GitHub mirror) | Öppen | 30 min in-memory cache |
| **NVD API 2.0** | REST JSON | `https://services.nvd.nist.gov/rest/json/cves/2.0` | Valfri `NVD_API_KEY` via miljövariabel | 15 min cache, rate-limit skydd |
| **MITRE ATT&CK** | Enterprise Matrix | Referenskatalog & STIX-mappning för sårbarhetsmönster | Öppen | Statisk / Versionshanterad |
| **MISP** | REST API (POST) | `${MISP_URL}/attributes/restSearch` | `Authorization: ${MISP_API_KEY}` (endast på server) | 10 min cache |

---

## 2. Strikt 5-Nivåers Klassificeringsmodell

För att förhindra falska antaganden och sammanblandning av hotindikatorer och verkliga angrepp tillämpas en strikt femdelad klassificering:

1. **1. Publicerad varning (`published_warning`):**
   - Officiellt meddelande, säkerhetsråd eller blixtvarning publicerad av nationell CSIRT (CERT-SE) eller behörig myndighet.
   - *Tolkning:* Manar organisationer till proaktiv granskning av egna system och tillämpning av tillgängliga patchar.

2. **2. Sårbarhet med känd exploatering (`exploited_vulnerability`):**
   - Post i CISA KEV (Known Exploited Vulnerabilities) eller teknisk CVE-post i NVD.
   - *Viktig avgränsning:* En post i CISA KEV visar att sårbarheten har utnyttjats i observerade attacker globalt. Det innebär **INTE** automatiskt att sårbarheten utnyttjas i Sverige eller mot svenska organisationer.
   - *Teknisk sårbarhet (NVD):* En CVE med hög CVSS-poäng (t.ex. 9.8) innebär teknisk allvarlighetsgrad om sårbarheten exponeras, inte att ett intrång ägt rum.

3. **3. Hotindikator observerad i ett flöde (`threat_indicator`):**
   - Teknisk artefakt (IP-adress, domännamn, filhash / IoC) som delats via en konfigurerad MISP-instans.
   - *Tolkning:* En observerad signal i ett flöde är inte ett bevis på intrång i den egna miljön.

4. **4. Bekräftad incident (`verified_incident`):**
   - Faktiskt verifierat dataintrång, pågående attack eller driftstörning som officiellt bekräftats av CSIRT eller drabbad organisation.

5. **5. Härledd riskbedömning (`derived_risk_assessment`):**
   - Syntetiserad analys av öppet tillgängliga hotflöden och exponeringsindikatorer.
   - *Tolkning:* En analytisk slutsats som aldrig får förväxlas med en observerad verklig attack.

---

## 3. Säkerhets- och Integrationsarkitektur

### MISP (Malware Information Sharing Platform)
- Konfigureras uteslutande på serversidan med `MISP_URL` och `MISP_API_KEY`.
- Om miljövariablerna saknas rapporterar systemet rent läget `not_configured` med pedagogisk installationsguide.
- **Inga hemligheter eller tokens läcker någonsin till frontend-klienten.**

### NVD API 2.0
- Stödjer tidsfönster (`lastModStartDate` / `lastModEndDate`), paginering (`startIndex`, `resultsPerPage`) och enskilda CVE-uppslagningar via `cveId`.
- Extraherar primära CVSS v3.1-mått (vektor, basscore, svårighetsgrad), berörda CPE-konfigurationer och CWE-svagheter.

### MITRE ATT&CK
- Karterar automatiskt CWE-koder och sårbarhetsbeskrivningar till Enterprise ATT&CK-tekniker:
  - `T1190`: Exploit Public-Facing Application (Initial Access)
  - `T1133`: External Remote Services (Initial Access)
  - `T1566`: Phishing (Initial Access)
  - `T1199`: Trusted Relationship / Supply Chain (Initial Access)
  - `T1059`: Command and Scripting Interpreter (Execution)
  - `T1203`: Exploitation for Client Execution (Execution)
  - `T1068`: Exploitation for Privilege Escalation (Privilege Escalation)
  - `T1078`: Valid Accounts (Defense Evasion / Initial Access)
  - `T1505`: Server Software Component / Web Shell (Persistence)
  - `T1562`: Impair Defenses (Defense Evasion)
  - `T1110`: Brute Force (Credential Access)
  - `T1557`: Adversary-in-the-Middle (Credential Access)
  - `T1486`: Data Encrypted for Impact / Ransomware (Impact)
  - `T1499`: Endpoint Denial of Service (Impact)
  - `T1498`: Network Denial of Service (Impact)
  - `T1071`: Application Layer Protocol (Command and Control)

---

## 4. Verifiering och Tester

- **CISA KEV:** Verifierad mot officiell CISA KEV JSON (1 739 sårbarheter inlästa, 361 med känd ransomware-koppling).
- **CERT-SE:** Verifierad mot live Atom-flöde från cert.se (20 aktuella nationella varningar).
- **NVD API 2.0:** Verifierad mot NIST REST API 2.0 med CVSS 3.1-analys.
- **Enhetstester:** 50 automatiserade tester passerar (`npm test`) i 15 testsviter.
- **Typkontroll och bygge:** TypeScript-kompilering och Vite produktionsbygge godkända utan fel.
