# Northwatch

A modular situational-awareness dashboard framework for critical infrastructure in Sweden, the Nordic countries, and Europe. Most infrastructure areas still use clearly labelled demonstration data. The Electricity grid dashboard reads public SMHI weather observations and can query ENTSO-E market/system data when a valid server-side token is configured.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- LM Studio (for local LLM functionality)

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run dev` starts both the frontend and backend API and loads `.env` if present. The overview and other sector dashboards use clearly marked demo data. The Electricity grid dashboard has its own country, bidding-zone, and period controls. 

Copy `.env.example` to `.env` and configure your API keys for real data:
```bash
cp .env.example .env
```

The following API keys are already configured in your `.env` file:


The tokens are never exposed to the browser. Without a token, ENTSO-E values stay explicitly unconfigured.

## Local LLM Setup

This project is configured to work with a local LLM running in LM Studio. To use this functionality:

1. Ensure LM Studio is installed and running
2. Make sure your model is available at the default URL: `http://127.0.0.1:1234/v1`
3. Your configured model should be named `qwen/qwen3-coder-30b`

The application uses the `@ai-sdk/openai-compatible` package to interface with your local LLM. The configuration is already set up in `opencode.json`.

To test if your LM Studio connection works:
```bash
npm run dev
# Then in another terminal:
node -e "import('./src/utils/llm-checker.js').then(m => m.checkLMStudioStatus())"
```

## Scripts

- `npm run dev` starts the Vite frontend and Node.js API server.
- `npm run dev:web` starts only the frontend.
- `npm run dev:api` starts only the backend API server.
- `npm run typecheck` checks the TypeScript project references.
- `npm run build` type-checks and creates a production build in `dist/`.
- `npm run preview` serves the production build locally.
- `npm test` runs unit tests for situation summaries, demo data, and energy data normalization.

## Application architecture

- **Frontend:** React and TypeScript own navigation, visualization, accessible status indicators, and dashboard composition.
- **Backend:** `server/index.mjs` exposes a small versioned API, and the Vite dev server proxies `/api` to it. The server owns demo responses now; the browser consumes them through the same API boundary intended for provider data.
- **Backend integration:** `server/energyData.mjs` implements server-side ENTSO-E requests and SMHI observations. `.env.example` lists server-only credential names; copy it to `.env` for local secrets. Never use `VITE_` for provider credentials or return secrets to the browser.
- **Provider adapters:** implement one adapter per source in the backend, normalize responses into a shared service/observation contract, and expose versioned read-only endpoints to the frontend. Keep provider-specific failures and stale data visible instead of presenting them as healthy.
- **Sector dashboard:** the Telecom operators dashboard uses the same app shell and region filtering as the overview, but adds a dedicated sector view with KPI cards, source-quality metadata, observation filtering, stale-data checks, and clickable event details. Demo mode remains explicitly labelled and should never be mistaken for operational status.
- **Energy dashboard:** the Electricity grid view supports Sweden (SE1-SE4), Norway (NO1-NO5), Denmark (DK1-DK2), and Finland (FI). It queries ENTSO-E day-ahead prices (A44/A01), actual and forecast generation (A75/A16 and A71/A01), actual and forecast load (A65/A16 and A65/A01), and cross-border energy (A11/A16). Data is normalized from XML on the server. ENTSO-E requests remain unavailable until an authorized `ENTSOE_API_TOKEN` is configured. SMHI hourly temperature, wind, and precipitation observations are fetched from active nearby stations for Swedish zones. See [docs/ENERGY-DATA.md](./docs/ENERGY-DATA.md) for tested coverage and limitations.
- **Telecom dashboard:** the Telecom operators view combines the official PTS 2025 county coverage workbook with live country-level RIPEstat/RIPE RIS routing observations and IODA internet outage indicators. All sources retain different reference times and geographic precision. No operator-specific, cell-site, or mobile outage state is inferred. See [docs/TELECOM-DATA.md](./docs/TELECOM-DATA.md) for source regions, intervals, and live verification.
- **Configuration:** site summary thresholds, status weights, and display descriptions are centralized in `src/config/siteConfig.ts`. Change this policy through reviewed deployment configuration rather than hard-coding provider rules into dashboard components.
- **Live-data boundary:** the overview and non-energy dashboards remain illustrative sample data. ENTSO-E data types have adapter support but have not been verified against a real authenticated response in this environment. Public SMHI observation responses were verified live. Electricity prices are market data, not evidence of grid stability; weather is contextual only. Missing outage messages and grid-disturbance feeds are shown as unavailable, not healthy.

## API discovery

See [docs/API-SOURCES.md](./docs/API-SOURCES.md) for a domain-by-domain source shortlist, access limitations, and recommended first integrations. Public endpoints and terms can change; verify the provider's current license, attribution, quotas, and service-level commitments before production use.

## Continuous integration

GitHub Actions runs type checks, unit tests, and a production build on pushes and pull requests to `main`. Configure GitHub branch protection to require the workflow before merging.