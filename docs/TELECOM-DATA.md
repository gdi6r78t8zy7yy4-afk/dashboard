# Telecom Data Coverage

## API

The telecom view requests `GET /api/v1/telecom?region=se&period=7d`. Supported routing/outage periods are `24h`, `7d`, and `30d`. PTS coverage is an annual snapshot and is unchanged by that period selector. The current integration is Sweden-only; other selected regions return `not_applicable` rather than reusing Swedish observations.

Backend response types are shared with the frontend in `src/services/telecomTypes.ts`. Each provider result includes its source, source URL, retrieval time, observation/reference period, geographic precision, sampling resolution, and quality class.

## PTS Coverage

The adapter downloads the official [PTS 2025 mobile coverage workbook](https://statistik.pts.se/files/mobiltacknings-och-bredbandskartlaggning/mtbbk_25-17220_tabellbilaga_mobilt%C3%A4ckning_v1.0.xlsx) and parses the `Yttäckning 2025` sheet. It selects the PTS columns for all operators at 8 dB attenuation: at least 10 Mbit/s, at least 100 Mbit/s, and 5G. It returns the 21 county aggregate rows; the workbook also contains municipality rows, but this view does not claim finer-than-county visual precision. Percentages and threshold values such as `>99,99%` retain their qualifiers.

The workbook states that this coverage represents November 2025 and excludes water surfaces for Vänern, Vättern, Mälaren, and the Baltic Sea. PTS coverage is an annual network-availability estimate, not a real-time service test. Its geographic values must not be treated as live outage or cell-site status.

The workbook was downloaded and parsed from PTS during live verification on 2026-10-10 (HTTP 200, 348 kB, 21 county rows). The adapter caches the workbook for six hours. PTS's coverage portal also publishes broader regional and municipality data; the dashboard displays county totals only.

## RIPEstat And RIPE RIS

The adapter calls the public RIPEstat `country-routing-stats` endpoint with ISO country `SE` and explicit `starttime`/`endtime` values, plus `country-asns` for registered/routed ASN counts. The current view requests 24-hour, 7-day, or 30-day intervals. RIPEstat chooses the available sample resolution and exposes the actual query bounds; RIS snapshots are periodic, not continuous user-level probes.

Live verification on 2026-10-10 returned HTTP 200 for Sweden. The bounded seven-day query returned 60 routing observations with latest data dated 2026-10-10. The dashboard displays prefix and ASN counts as country-level routing observations only. They do not establish mobile availability, operator service, or end-user reachability.

## IODA

The adapter uses IODA v2 country-scope endpoints for outage summaries, events, alerts, and `signals/events/country/SE`, with `from` and `until` expressed as Unix epoch seconds. Its signal series is sampled at 30-minute steps in the tested response. The displayed period selector bounds this data.

Live verification on 2026-10-10 returned HTTP 200 for Sweden with 338 half-hour signal samples in a seven-day interval and no outage events/alerts in that period. An empty event result is phrased as “no IODA events published in this time window”; it does not assert that every operator/service was available. IODA identifies internet-outage indicators and is not a complete provider status feed.

## Missing Data And Incidents

No operator-specific real-time status or verified public operator notice feed is connected. The UI says so directly. RIPE RIS, RIPEstat, and IODA observations do not indicate that a particular mobile tower or geographic area is out of service. No fault state is inferred from those signals.

## Tests

`server/telecomPts.test.mjs` validates workbook XML, county extraction, percentage normalization, and threshold qualifiers using a generated XLSX fixture. `server/telecomProviders.test.mjs` tests RIPEstat response normalization, IODA signal timing, event de-duplication, and empty-feed semantics. `server/telecomService.test.mjs` verifies source aggregation, geography, unavailable operator status, period validation, and caching. Live checks were separately performed against all three public provider integrations as documented above.