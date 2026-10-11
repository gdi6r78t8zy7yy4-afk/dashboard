# Internet & Nätverksinfrastruktur – Datatäckning och integrationer

Dokumentation över anslutna API:er, metodologi, observation vs tolkning, autentiseringskrav och testresultat för internetdashboarden i Infrastructure Watch.

---

## 1. API-gränssnitt

Endpunkten exponeras på:
`GET /api/v1/internet?region={region}&period={period}&asn={asn}&indicator={indicator}`

### Parametrar
- `region`: `se` (Sverige), `no` (Norge), `dk` (Danmark), `fi` (Finland), `is` (Island), `nordics` (Norden), `europe` (Europa). Standard: `se`.
- `period`: `24h` (24 timmar), `7d` (7 dagar), `30d` (30 dagar). Standard: `7d`.
- `asn`: Autonomt systemnummer att analysera för BGP-uppdateringar och synlighet (t.ex. `1653` för SUNET, `3301` för Telia Company, `1257` för Tele2/SWIPnet, `2832` för NORDUnet, `1299` för Arelion). Standard: `1653`.
- `indicator`: `all` (alla indikatorer), `routing` (BGP-routing och prefix), `outages` (IODA makrostörningar), `backbones` (ryggradsnät och transit-AS). Standard: `all`.

---

## 2. Källdetaljer och integrationer

### A. RIPEstat Data API (RIPE NCC)
- **Dokumentation**: [stat.ripe.net/docs/data-api/ripestat-data-api](https://stat.ripe.net/docs/data-api/ripestat-data-api)
- **Autentisering**: Öppet API (ingen API-nyckel krävs).
- **Anropade endpunkter**:
  - `/data/country-routing-stats/data.json`: Antal unika IPv4- och IPv6-prefix synliga i RIPE RIS per dygn samt antal routade ASN.
  - `/data/country-asns/data.json`: Antal registrerade och faktiskt annonserade autonoma system i landet.
  - `/data/as-overview/data.json`: Operatörsnamn, AS-block och om AS:et annonseras globalt.
  - `/data/bgp-update-activity/data.json`: Tidsserie över ruttannonseringar (announcements) och tillbakadraganden (withdrawals) per timme för valt ASN.
- **Geografisk precision**: Landskod (`country`) och nätverksobservation (`network-observation`).

### B. RIPE RIS (Routing Information Service)
- **Dokumentation**: [ris.ripe.net](https://ris.ripe.net/)
- **Autentisering**: Öppet tillgängligt via RIPEstat API.
- **Anropade endpunkter**:
  - `/data/routing-status/data.json?resource=AS{asn}`: Synlighet via RIPE NCC:s globala RIS Route Collectors (RRC00–RRC26), antal RIS-peers som ser AS:et och totalt antal aktiva peers.
- **Geografisk precision**: Nätverksobservation (`network-observation`).

### C. IODA (Georgia Tech InetIntel)
- **Dokumentation**: [api.ioda.inetintel.cc.gatech.edu/v2/docs](https://api.ioda.inetintel.cc.gatech.edu/v2/docs)
- **Autentisering**: Öppet API (v2 REST).
- **Anropade endpunkter**:
  - `/signals/events/country/{country}`: Sammansatt makrosignal baserad på aktiva mätningar (ping-prober), BGP-flöden och telescope (mörknet).
  - `/outages/events`: Detekterade och poängsatta makroavbrott och anomalier med starttid, varaktighet, poäng och datakälla (`bgp`, `ping-slash24`, `telescope`).
- **Geografisk precision**: Makronivå / land (`country`) eller internationella AS-enheter (`asn`/`geoasn`).

### D. Cloudflare Radar
- **Dokumentation**: [radar.cloudflare.com](https://radar.cloudflare.com/) / [Cloudflare Radar API Docs](https://developers.cloudflare.com/api/resources/radar/subresources/annotations/subresources/outages/methods/get/)
- **Autentiseringskrav**: Kräver autentisering med HTTP Bearer-token via miljövariabeln `CLOUDFLARE_API_TOKEN` med behörighet *Account > Radar > Read*.
- **Hantering vid saknad token**: När token saknas markeras Cloudflare Radar transparent i gränssnittet som `Ej tillgänglig` (`unavailable`) med instruktion om hur token konfigureras. Systemet genererar inga falska livevärden.
- **Licensvillkor**: Data distribueras under CC BY-NC 4.0.

---

## 3. Metodologiska avgränsningar: Observation vs. Tolkning

Gränssnittet upprätthåller en strikt skillnad mellan objektiv observation och tolkning:

1. **Routingförändring är inte automatiskt ett avbrott**:
   - En BGP-uppdatering, ruttannonsering eller förändrat antal synliga prefix är en naturlig del av internets dynamiska routing (underhåll, peering-ändringar, trafikbalansering, prefixaggregering). Det innebär inte automatiskt att användare förlorat uppkoppling.
2. **Avvikande signal är inte automatiskt ett cyberangrepp**:
   - En signalanomali i IODA indikerar en mätavvikelse i routing, ping-svar eller darknet-brus. Den kan orsakas av strömavbrott, fiberbrott, felkonfiguration eller nätverksomläggning. Den klassas aldrig som en cyberattack utan extern forensisk analys och bekräftelse från officiella myndigheter (såsom CERT-SE).
3. **Ingen felaktig kartplacering**:
   - Källor som BGP-prefix eller landssignaler saknar punktkoordinater och placeras därför inte på kartan som exakta geografiska positioner.

---

## 4. Verifiering mot riktiga API-svar (11 oktober 2026)

| Datakälla | HTTP-status | Faktiskt svar | Anmärkning |
| :--- | :--- | :--- | :--- |
| **RIPEstat country routing** | 200 OK | Sverige: ~5 725 IPv4, ~936 IPv6, ~639 AS | Daglig upplösning, verifierad för SE, NO, DK, FI, IS. |
| **RIPE RIS looking glass** | 200 OK | SUNET (AS1653): 326/327 RIS-peers (99,7 %) | Telia (AS3301): 327/327 (100 %), Tele2 (AS1257): 327/327 (100 %). |
| **RIPE BGP updates** | 200 OK | 24–30 tidsseriepunkter per vald period | Visar volym av announcements och withdrawals. |
| **IODA signals** | 200 OK | Normaliserad tidsserie med 30-min intervall | Kontinuerlig makroindikator. |
| **IODA outage events** | 200 OK | Returnerar detekterade händelser och poäng | BGP- och ping-anomalier tolkas transparent. |
| **Cloudflare Radar** | 400 Bad Request (utan token) | Transparent markerad som `unavailable` | Verifierat att token krävs via `CLOUDFLARE_API_TOKEN`. |
