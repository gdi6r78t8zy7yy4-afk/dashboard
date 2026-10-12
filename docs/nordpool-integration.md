# Nord Pool Market Data Integration

This document describes the integration of Nord Pool market data into the Northwatch dashboard energy section.

## Integration Overview

The Nord Pool Market Data API has been integrated to provide day-ahead electricity prices for Swedish bidding areas (SE1, SE2, SE3, SE4) in addition to existing data sources.

## API Integration Details

### API Endpoint
- **Base URL**: `https://api.nordpoolgroup.com`
- **Market Data API**: `/api/MarketData`
- **Instrument Type**: `DayAhead`

### Supported Areas
- SE1 (Stockholm)
- SE2 (Uppsala)
- SE3 (Södermanland)
- SE4 (Skåne)

### Authentication
- Uses OAuth 2.0 Bearer Token authentication
- Requires valid API credentials from Nord Pool
- Token stored in environment variable `NORDPOOL_API_TOKEN`

### Data Format
- Returns JSON responses with price data points
- Each price point includes:
  - `deliveryStart`: Start time of delivery period
  - `deliveryEnd`: End time of delivery period  
  - `price`: Market price value
  - `currency`: Currency code (typically EUR)
  - `unit`: Unit of measure (typically MWh)

## Implementation Details

### Adapter File
- **Location**: `server/nordpoolAdapter.mjs`
- **Functionality**: 
  - Fetches day-ahead prices for Swedish bidding areas
  - Implements caching to reduce API calls
  - Handles authentication and error states
  - Follows existing code patterns in the project

### Data Integration
- Integrated with existing energy data pipeline in `server/energyData.mjs`
- Added to the sources listing in the energy dashboard
- Provides status information (ok, error, not_configured)

### Configuration
The Nord Pool API requires authentication. To enable this data source:

1. Obtain an API token from Nord Pool's Developer Portal
2. Add the token to your `.env` file:
```
NORDPOOL_API_TOKEN=your-nordpool-api-token-here
```

## Dashboard Integration

### Energy Dashboard Section
The Nord Pool data is now available in the energy dashboard and will appear as:
- Additional market price data points
- Status indicator showing whether data is available
- Integration with existing energy data visualization

### Source Status Reporting
The dashboard now shows the following sources for energy data:
- ENTSO-E Transparency Platform (existing)
- Svenska kraftnät Öppna Data (existing)  
- SMHI Open Data (existing)
- Nord Pool Market Data API (new)

## Error Handling

The integration handles the following scenarios gracefully:
- Missing API token: Shows "not_configured" status
- Network errors: Returns error state with details
- Authentication failures: Shows appropriate error message
- Cache management: Uses 15-minute cache to reduce API calls

## Testing

To verify the integration:
```bash
npm run test-nordpool
```

This will show the status of Nord Pool data fetching for all Swedish areas.

## Limitations

- Only day-ahead prices are currently supported
- Requires Nord Pool API credentials for real data
- Data is cached for 15 minutes to reduce load on Nord Pool servers
- Only Swedish bidding areas are supported in this implementation