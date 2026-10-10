# Energy Data Coverage

## Configuration

Copy `.env.example` to `.env` and set `ENTSOE_API_TOKEN`. The token is read by the Node.js server only. ENTSO-E requires an account authorized for REST API access and a security token. `npm run dev` and `npm start` load `.env`; never prefix this secret with `VITE_`.

The energy API is `GET /api/v1/energy?country=se&zone=SE3&period=24h`. Supported periods are `24h`, `7d`, and `30d`. Supported areas are Sweden `SE1`-`SE4`, Norway `NO1`-`NO5`, Denmark `DK1`-`DK2`, and Finland `FI`. The server validates that each bidding zone belongs to the selected country.

## ENTSO-E

The adapter uses the production endpoint `https://web-api.tp.entsoe.eu/api`, the documented query-string security token, bounded `periodStart`/`periodEnd` UTC intervals, and XML responses parsed with `fast-xml-parser`. Swedish bidding-zone EICs were checked against ENTSO-E's published EIC area list:

| Zone | EIC |
| --- | --- |
| SE1 | `10Y1001A1001A44P` |
| SE2 | `10Y1001A1001A45N` |
| SE3 | `10Y1001A1001A46L` |
| SE4 | `10Y1001A1001A47J` |

Implemented document/process pairs:

| Data class | Document/process | Meaning in this dashboard | Live response verified here |
| --- | --- | --- | --- |
| Day-ahead price | A44 / A01 | Market price, currency per MWh | No; no ENTSO-E token was configured |
| Actual generation by type | A75 / A16 | Published actual production series | No; no ENTSO-E token was configured |
| Generation forecast | A71 / A01 | Published generation forecast | No; no ENTSO-E token was configured |
| Actual load | A65 / A16 | Published system-total-load series | No; no ENTSO-E token was configured |
| Load forecast | A65 / A01 | Published load forecast | No; no ENTSO-E token was configured |
| Cross-border energy | A11 / A16 | Directional series requested for each adjacent area | No; no ENTSO-E token was configured |

The XML parser, EIC validation, request parameters, and no-token behavior are covered by unit tests. ENTSO-E answers in UTC; the UI renders timestamps in the selected country's IANA timezone. Values and units are taken from the publication when supplied, with `MW`, `MWh`, and currency/MWh normalization.

## SMHI

Live requests to SMHI's public observation catalog and latest-hour endpoints returned HTTP 200 during verification on 2026-10-10. The adapter selects active nearby stations and requests parameter 1 (air temperature), 4 (mean wind speed), and 7 (hourly precipitation). Stockholm observations were verified using active station IDs 98230 and 97200. Values retain station, quality, timestamp, and parameter unit; observations older than three hours are marked stale.

General point forecasts are not connected. The previous `pmp3g` forecast path tested here returned 404, and no current general forecast feed was located in SMHI's Open Data documentation. Forecast data is therefore presented as unavailable; it is not inferred from observations.

## Operational Notices And Grid Events

Svenska kraftnät's [Information från driften](https://www.svk.se/om-kraftsystemet/kraftsystemdata/information-fran-driften/) page is linked as the official notice source. It is a published web page, not a documented public machine-readable API, so notices are not scraped or represented as a live feed.

No verified public grid-disturbance feed is connected. ENTSO-E market prices, load, production, flows, and SMHI weather are not evidence that a Swedish grid fault has occurred. The dashboard explicitly reports this data gap.

## Verification Limits

`npm test` uses representative XML/JSON fixtures for adapter behavior. Live verification covered the SMHI station catalogs and observation endpoints only. A successful authenticated ENTSO-E response, production-type coverage, flow direction semantics, and provider-specific limits remain to be confirmed with an authorized token and representative production queries.