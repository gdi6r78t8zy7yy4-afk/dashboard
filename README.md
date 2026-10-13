# Infrastructure Watch Dashboard

Infrastructure Watch is a comprehensive monitoring dashboard for critical infrastructure systems.

## Features

- Real-time monitoring of infrastructure systems
- Global weather dashboard with interactive map
- Energy system data visualization  
- Cyber threat intelligence
- Telecommunications and internet infrastructure
- Transport systems monitoring
- World events and incidents

## Weather Dashboard

The weather dashboard provides global weather monitoring with:

### Key Features:
- Interactive world map showing weather conditions
- Location search by city, country or coordinates  
- Detailed weather information for selected locations
- Weather alerts and event notifications
- Hourly and daily forecasts
- Temperature, precipitation, wind speed and other metrics

### Integration:
The weather dashboard is integrated into the main Infrastructure Watch framework and can be accessed through the sidebar navigation.

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm (v8 or higher)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd infrastructure-watch

# Install dependencies
npm install
```

### Running the Application

```bash
# Start the development server
npm run dev

# Or build for production
npm run build
npm start
```

The application will be available at `http://localhost:3001`

## Weather Data Sources

The weather dashboard integrates data from multiple sources:

1. **Open-Meteo** - Primary global weather data (LIVE VERIFIED)
2. **MET Norway** - Regional coverage for Nordic countries (NOT CONFIGURED)
3. **GDACS** - Global weather alerts and events (LIVE VERIFIED)

## API Endpoints

### Weather Data
- `GET /api/v1/weather?lat={}&lon={}` - Get weather data for coordinates
- `GET /api/v1/weather/search?query={}` - Search locations globally  
- `GET /api/v1/weather/alerts` - Get weather alerts and events

## Project Structure

```
.
├── server/                 # Backend services
│   ├── weather/            # Weather data handling
│   └── index.mjs           # Main server entry point
├── src/                    # Frontend components
│   ├── components/         # React components  
│   ├── styles/             # CSS styles
│   └── WeatherDashboard.tsx # Main weather dashboard component
├── public/                 # Static files
└── README.md               # This file
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue on the GitHub repository.