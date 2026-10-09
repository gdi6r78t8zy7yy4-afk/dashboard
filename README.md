# Northwatch

A modular situational-awareness dashboard framework for critical infrastructure in Sweden, the Nordic countries, and Europe. The current application is an interactive UI prototype with clearly labelled demonstration data; it does not connect to live operational feeds yet.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run dev` starts both the frontend and backend API. The left navigation selects an area of interest and an infrastructure dashboard. The overview brings together service health and active advisories; status aggregation is configured in `src/config/siteConfig.ts`. Only Sweden has sample values; other areas correctly report missing feeds until country-specific connectors are implemented.

## Scripts

- `npm run dev` starts the Vite frontend and Node.js API server.
- `npm run dev:web` starts only the frontend.
- `npm run dev:api` starts only the backend API server.
- `npm run typecheck` checks the TypeScript project references.
- `npm run build` type-checks and creates a production build in `dist/`.
- `npm run preview` serves the production build locally.
- `npm test` runs unit tests for configurable situation summaries.

## Application architecture

- **Frontend:** React and TypeScript own navigation, visualization, accessible status indicators, and dashboard composition.
- **Backend:** `server/index.mjs` exposes a small versioned API, and the Vite dev server proxies `/api` to it. The server owns demo responses now; the browser consumes them through the same API boundary intended for provider data.
- **Backend integration milestone:** add provider adapters, scheduled polling, normalization, freshness/provenance, and alerting to the API service. `.env.example` lists server-only credential names; copy it to `.env` for local secrets. Never use `VITE_` for provider credentials or return secrets to the browser.
- **Provider adapters:** implement one adapter per source in the backend, normalize responses into a shared service/observation contract, and expose versioned read-only endpoints to the frontend. Keep provider-specific failures and stale data visible instead of presenting them as healthy.
- **Configuration:** site summary thresholds, status weights, and display descriptions are centralized in `src/config/siteConfig.ts`. Change this policy through reviewed deployment configuration rather than hard-coding provider rules into dashboard components.
- **Live-data boundary:** current service cards and incidents are illustrative sample data served by the backend. No provider connectors are active. Connectors must not be considered operational until their access, update cadence, licensing, and outage behavior have been validated.

## API discovery

See [docs/API-SOURCES.md](./docs/API-SOURCES.md) for a domain-by-domain source shortlist, access limitations, and recommended first integrations. Public endpoints and terms can change; verify the provider's current license, attribution, quotas, and service-level commitments before production use.

## Continuous integration

GitHub Actions runs type checks, unit tests, and a production build on pushes and pull requests to `main`. Configure GitHub branch protection to require the workflow before merging.