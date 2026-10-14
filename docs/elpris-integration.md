# Elpriset just nu.se Integration

The energy dashboard uses the open, free [Elpriset just nu.se](https://www.elprisetjustnu.se) API as the source for current Swedish spot electricity prices. This **replaces** the token-gated Nord Pool Market Data API for that purpose (see [nordpool-integration.md](./nordpool-integration.md), kept for history).

## API

- **Docs:** https://www.elprisetjustnu.se/elpris-api
- **Endpoint:** `GET https://www.elprisetjustnu.se/api/v1/prices/[YEAR]/[MM-DD]_[ZONE].json`
- **Authentication:** none (open static JSON files)
- **Zones:** `SE1` (Luleå), `SE2` (Sundsvall), `SE3` (Stockholm), `SE4` (Malmö)
- **Resolution:** quarter-hour prices from 1 October 2025 (96/day); hourly (24/day) for earlier dates
- **Currency:** prices are ex-VAT; the file contains `SEK_per_kWh`, `EUR_per_kWh` and the daily `EXR` (EUR→SEK rate). Underlying data comes from ENTSO-E.
- **Timeliness:** tomorrow's file arrives at the earliest 13:00 the previous day, so a missing tomorrow file is expected in the first part of the day.

## Adapter

- **Location:** `server/elPrisAdapter.mjs`
- **Tests:** `server/elPrisAdapter.test.mjs`
- **Main function:** `getElPrisPricesForAllAreas({ fetchImpl, now })` — fetches today + tomorrow for all four Swedish zones and returns a per-zone entry:

```js
{
  state: 'ok' | 'partial' | 'missing' | 'error',
  zone: 'SE3',
  unit: 'EUR/MWh',          // `value` is normalized to EUR/MWh to match ENTSO-E day-ahead
  data: [ { timestamp, value, sekPerKWh, eurPerKWh, exr } ],  // today + tomorrow, chronological
  today: { date, state, points },
  tomorrow: { date, state, points },
  current: { timestamp, value, sekPerKWh } | null,  // latest published point ≤ now
  lastUpdated, retrievedAt, note
}
```

- Results are cached in memory for 15 minutes (`clearElPrisCache()` to reset).
- Per-zone errors are isolated: one failing zone degrades to `error`/`missing` for that zone only.

## API response

`GET /api/v1/energy?country=se&zone=SE3&period=24h` now returns:

- `elpris` — the per-zone price map above (replaces the former `nordpool` field)
- `sources.elpris` — status/label/endpoint/lastUpdated for source-health display

The dashboard shows:

- a **Current spot price** metric card (SEK/kWh + EUR/MWh) for the selected zone,
- the "Elpriset just nu – spotpris" chart with today + tomorrow quarter-hour prices,
- per-zone price comparison using elpris data (falling back to ENTSO-E day-ahead),
- source-health rows for Elpriset just nu.se.

## Configuration

None required — the API is open. No environment variables.
