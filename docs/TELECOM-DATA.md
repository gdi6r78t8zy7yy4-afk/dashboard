# Telekom & Digital Infrastruktur – Datatäckning och integrationer

Dokumentation över anslutna datakällor, geografisk precision, tidsintervall, verifieringsresultat och gränssnittets metodologiska avgränsningar för Infrastructure Watch.

---

## 1. API-gränssnitt

Endpunkten exponeras på:
`GET /api/v1/telecom?region={region}&period={period}`

### Parametrar
- `region`: `se` (Sverige), `no` (Norge), `dk` (Danmark), `fi` (Finland), `is` (Island), `nordics` (Norden), `europe` (Europa). Standardvärde: `se`.
- `period`: `24h` (24 timmar), `7d` (7 dagar), `30d` (30 dagar). Standardvärde: `7d`.

### Responsmönster och gemensam modell
Svaret följer typmodellen `TelecomDashboardResponse` i `src/services/telecomTypes.ts`. Varje källkomponent kapslas i `TelecomSource<T>` och innehåller:
- `state`: `'ok'` | `'partial'` | `'stale'` | `'unavailable'` | `'error'` | `'not_applicable'`.
- `provenance`:
  - `source`: Namn på leverantör/institution.
  - `sourceUrl`: URL till officiell dokumentation eller datakälla.
  - `retrievedAt`: Tidpunkt då backend hämtade datat (ISO-8601).
  - `observedAt`: Ursprunglig observationstidpunkt eller snapshot-datum.
  - `referencePeriod`: Den period eller tidsram observationen avser.
  - `geographicPrecision`: `'country'` | `'county'` | `'network-observation'` | `'multi-country'` | `'none'`.
  - `resolution`: Samplingsfrekvens eller aggregeringsnivå.
  - `quality`: `'official-statistic'` | `'routing-observation'` | `'internet-outage-indicator'` | `'missing'`.
- `data`: Det typade nyttolastobjektet.
- `note`: Metodologisk anmärkning eller orsak till eventuell begränsning.

---

## 2. Källdetaljer och integrationer

### A. Post- och telestyrelsen (PTS) – Officiell täckningskartläggning
- **Källa**: PTS Mobiltäcknings- och bredbandskartläggning.
- **Officiell länk**: [statistik.pts.se/mobiltacknings-och-bredbandskartlaggning](https://statistik.pts.se/mobiltacknings-och-bredbandskartlaggning)
- **Datafil**: [Officiell tabellbilaga MTBBK 2025 v1.0 (XLSX)](https://statistik.pts.se/files/mobiltacknings-och-bredbandskartlaggning/mtbbk_25-17220_tabellbilaga_mobilt%C3%A4ckning_v1.0.xlsx).
- **Mätperiod & referens**: Årlig nationell modellberäkning med referenstidpunkt **november 2025**.
- **Geografisk omfattning**: Samtliga Sveriges 21 län. (För andra regioner returneras `state: 'not_applicable'` med information om att PTS enbart kartlägger Sverige).
- **Mätetal vid 8 dB dämpning**:
  - `Alla operatörer - 5G - 8 db` (5G-yttäckning)
  - `Alla operatörer - minst 100 Mbit/s - 8 db` (Snabb mobil bredbandstäckning)
  - `Alla operatörer - minst 10 Mbit/s - 8 db` (Grundläggande mobil bredbandstäckning)
- **Dämpningsstandard**: 8 dB motsvarar PTS standardberäkning för tillförlitlig handhållen mobil mottagning.
- **Cache**: Arbetsboken cachas i internminnet i 6 timmar.

### B. RIPEstat & RIPE RIS – Global BGP-routing och prefix
- **Källa**: RIPE Network Coordination Centre (RIPE NCC) & Routing Information Service (RIS).
- **Officiell länk**: [stat.ripe.net/docs/data-api/ripestat-data-api](https://stat.ripe.net/docs/data-api/ripestat-data-api) / [ris.ripe.net](https://ris.ripe.net/)
- **Anropade endpunkter**:
  - `/data/country-routing-stats/data.json?resource={country}&starttime={start}&endtime={end}`: Dagliga observationer av IPv4- och IPv6-prefix synliga i RIS.
  - `/data/country-asns/data.json?resource={country}`: Antal registrerade och faktiskt annonserade/routade autonoma system (ASN).
- **Geografisk omfattning**: Landskod (ISO-3166-1 alpha-2) eller flerlandsklustring (Norden, Europa).
- **Upplösning**: Daglig historik över 24 timmar, 7 dagar eller 30 dagar.
- **Mätmetod**: Observationer från distribuerade BGP route collectors (RIS).

### C. IODA – Internet Outage Detection and Analysis
- **Källa**: Georgia Tech InetIntel / IODA v2 API.
- **Officiell länk**: [api.ioda.inetintel.cc.gatech.edu/v2/docs](https://api.ioda.inetintel.cc.gatech.edu/v2/docs)
- **Anropade endpunkter**:
  - `/outages/summary`: Sammanfattning av avbrott för landet/regionen.
  - `/outages/events`: Verifierade avbrottshändelser.
  - `/outages/alerts`: Automatiska avbrottslarm.
  - `/signals/events/country/{country}`: Sammansatt tidsserieindikator.
- **Tidsintervall**: Dynamiskt beräknat utifrån vald period (`24h`, `7d`, `30d`) med Unix epoch-sekunder.
- **Upplösning**: 30-minuters samplingssteg.
- **Mätmetod**: Makroindikator sammanställd från active probing (ping/traceroute), BGP-routingförändringar och network telescope (darknet-trafik).

---

## 3. Viktiga avgränsningar och integritetsregler

1. **PTS är inte realtidsdata**:
   - PTS kartläggning bygger på teleoperatörernas årliga teoretiska beräkningar och fältvalideringar för november månad. Det är ett statistiskt planeringsunderlag och kan aldrig användas för att avgöra om en basstation fungerar just nu.
2. **RIPE RIS mäter routing, inte mobiltäckning**:
   - RIPE RIS registrerar globalt propagerade BGP-rutter. Att rutter finns indikerar att autonoma system annonserar IP-adresser till omvärlden, men garanterar inte att en slutanvändares mobiluppkoppling fungerar.
3. **IODA visar makrostörningar**:
   - IODA detekterar större regionala och nationella avvikelser. Att IODA inte visar några larm innebär inte att inga lokala driftstörningar förekommer.
4. **Ingen basstation eller område markeras som ur funktion**:
   - Varken PTS, RIPEstat eller IODA innehåller data på basstationsnivå. Gränssnittet markerar uttryckligen aldrig en mobilmast eller ett län som trasigt baserat på dessa källor.
5. **Operatörsspecifik realtidsstatus**:
   - De svenska mobiloperatörerna (Telia, Telenor, Tele2, Tre) tillhandahåller inte öppna maskinläsbara realtids-API:er för sina driftstörningar. Gränssnittet visar därför transparent att operatörsspecifik realtidsdrift för närvarande är ej tillgänglig (`unavailable`).

---

## 4. Liveverifiering mot riktiga API-svar

Följande tester har genomförts mot produktionsservrarna den 10–11 oktober 2026:

| Leverantör | Status | Svarstid | Faktisk data | Anmärkning |
| :--- | :--- | :--- | :--- | :--- |
| **PTS** | HTTP 200 OK | ~1,2 s | 21 län extraherade ur `Yttäckning 2025` | Rikssnitt: 5G ~92,1 %, 100 Mbit/s ~41,8 %, 10 Mbit/s ~97,4 %. |
| **RIPEstat** | HTTP 200 OK | ~380 ms | 60–1128 tidsseriepunkter | IPv4-prefix: ~5 725 st, IPv6-prefix: ~936 st, Routade AS: ~639 st. |
| **IODA** | HTTP 200 OK | ~450 ms | 338 datapunkter (30-min upplösning) | Signalnivå ~1,0. Inga publicerade avbrottshändelser i testfönstret. |

---

## 5. Automatiserade enhetstester

- `server/telecomPts.test.mjs`: Validerar uppackning av XLSX-arkiv, XML-tolkning, länsextraktion och procentnormalisering inklusive trösklar (`>99,99%`).
- `server/telecomProviders.test.mjs`: Validerar normalisering av RIPEstat-ruttningsstatistik, IODA-tidsintervall, dedup av larm och hantering av tomma perioder.
- `server/telecomService.test.mjs`: Testar sammanslagning av källor, skydd mot felaktig märkning av icke-svenska områden, tidsintervallvalidering samt internminnescaching.
- `src/services/statusSummary.test.ts`: Testar statusnivåberäkning och aggregation.