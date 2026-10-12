# Northwatch Dashboard Setup Instructions

This document explains how to configure your Northwatch dashboard for full functionality with real data sources.

## Getting Started

1. **Install dependencies**:
```bash
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
```

Then edit `.env` to add your API tokens if you want to enable real data sources.

## Provided API Keys

We've already configured the following API keys in your `.env` file:



## Required Data Sources

### Energy Data (ENTSO-E)
To get real energy data, you need an ENTSO-E API token:
1. Go to https://transparency.entsoe.eu/
2. Register for an account
3. Get your API token
4. Add it to your `.env` file:
```
ENTSOE_API_TOKEN=your_token_here
```

### Transport Data (Trafikverket)
To get real transport data, you need a Trafikverket API token:
1. Go to https://api.trafikverket.se/
2. Register for an account
3. Get your API token
4. Add it to your `.env` file:
```
TRAFIKVERKET_API_TOKEN=your_token_here
```

## Testing Your Setup

Run the following to verify your data sources:
```bash
npm run verify-data
```

This will show you whether each data source is returning live or demo data.

## Dashboard Widgets

All dashboard widgets should now show data:
- **Energi**: Shows grid status, generation, load data
- **Telekom**: Shows network coverage and routing data  
- **Internet**: Shows BGP prefix data and outage detections
- **Transport**: Shows road, rail, air, and maritime incidents
- **Cyber**: Shows security advisories and vulnerabilities

If a widget shows "Ej konfigurerad" or similar, it means the corresponding data source is not enabled in your environment (which is normal for demo purposes).