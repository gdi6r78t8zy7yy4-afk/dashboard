import { createServer } from 'node:http'
import { getOverviewForRegion, getSectorForRegion } from './demoData.mjs'
import { getAggregatedOverview } from './overviewService.mjs'
import { getEnergyData } from './energyData.mjs'
import { getTelecomDashboard } from './telecomService.mjs'
import { getInternetDashboard } from './internetService.mjs'
import { getCyberDashboard, getCyberCveDetails } from './cyberService.mjs'
import { getEventsDashboard } from './eventsService.mjs'
import { getTransportDashboard } from './transportService.mjs'
// Import weather services
import { getWeatherData, getLocationInfo } from './weather/weatherService.mjs'
// Import gas and oil services
import { handleGasOilRequest } from './gasOilRoutes.mjs'

const port = Number(process.env.API_PORT ?? 3001)
const host = process.env.API_HOST ?? '127.0.0.1'

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')

  if (request.method !== 'GET') {
    response.writeHead(405, { Allow: 'GET' })
    response.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  if (url.pathname === '/api/v1/health') {
    response.writeHead(200)
    response.end(JSON.stringify({ status: 'ok', mode: 'demo' }))
    return
  }

  if (url.pathname === '/api/v1/overview') {
    response.writeHead(200)
    const region = url.searchParams.get('region') ?? 'se'
    try {
      const data = await getAggregatedOverview({ region })
      response.end(JSON.stringify(data))
    } catch {
      response.end(JSON.stringify(getOverviewForRegion(region)))
    }
    return
  }

  if (url.pathname === '/api/v1/sector') {
    response.writeHead(200)
    const region = url.searchParams.get('region') ?? 'se'
    const id = url.searchParams.get('id') ?? 'telecom'
    response.end(JSON.stringify(getSectorForRegion(region, id)))
    return
  }

  if (url.pathname === '/api/v1/energy') {
    try {
      const result = await getEnergyData({
        country: url.searchParams.get('country') ?? 'se',
        zone: url.searchParams.get('zone') ?? undefined,
        period: url.searchParams.get('period') ?? '24h',
      })
      response.writeHead(200)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(400)
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid energy query.' }))
    }
    return
  }

  if (url.pathname === '/api/v1/telecom') {
    try {
      const result = await getTelecomDashboard({
        region: url.searchParams.get('region') ?? 'se',
        period: url.searchParams.get('period') ?? '7d',
      })
      response.writeHead(200)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(400)
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid telecom query.' }))
    }
    return
  }

  if (url.pathname === '/api/v1/internet') {
    try {
      const result = await getInternetDashboard({
        region: url.searchParams.get('region') ?? 'se',
        period: url.searchParams.get('period') ?? '7d',
        asn: url.searchParams.get('asn') ?? '1653',
        indicator: url.searchParams.get('indicator') ?? 'all',
      })
      response.writeHead(200)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(400)
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid internet query.' }))
    }
    return
  }

  if (url.pathname === '/api/v1/cyber') {
    try {
      const result = await getCyberDashboard({
        search: url.searchParams.get('search') ?? '',
        classificationFilter: url.searchParams.get('classification') ?? 'all',
        severityFilter: url.searchParams.get('severity') ?? 'all',
      })
      response.writeHead(200)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(500)
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Kunde inte hämta cyberhotdata.' }))
    }
    return
  }

  if (url.pathname.startsWith('/api/v1/cyber/cve/')) {
    const cveId = decodeURIComponent(url.pathname.replace('/api/v1/cyber/cve/', ''))
    try {
      const result = await getCyberCveDetails(cveId)
      if (!result) {
        response.writeHead(404)
        response.end(JSON.stringify({ error: 'CVE hittades inte.' }))
        return
      }
      response.writeHead(200)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(500)
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Kunde inte slå upp CVE.' }))
    }
    return
  }

  if (url.pathname === '/api/v1/events') {
    try {
      const result = await getEventsDashboard({
        sector: url.searchParams.get('sector') ?? 'all',
        region: url.searchParams.get('region') ?? 'all',
        classification: url.searchParams.get('classification') ?? 'all',
        severity: url.searchParams.get('severity') ?? 'all',
        search: url.searchParams.get('search') ?? '',
        grouped: url.searchParams.get('grouped') !== 'false',
        forceRefresh: url.searchParams.get('refresh') === 'true',
      })
      response.writeHead(200)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(500)
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Kunde inte hämta omvärldshändelser.' }))
    }
    return
  }

  if (url.pathname === '/api/v1/transport') {
    try {
      const result = await getTransportDashboard({
        mode: url.searchParams.get('mode') ?? 'all',
        region: url.searchParams.get('region') ?? 'se',
        period: url.searchParams.get('period') ?? '24h',
      })
      response.writeHead(200)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(500)
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Kunde inte hämta transportdata.' }))
    }
    return
  }

  // Weather API routes
  if (url.pathname === '/api/v1/weather') {
    try {
      const lat = url.searchParams.get('lat')
      const lon = url.searchParams.get('lon')
      const timezone = url.searchParams.get('timezone')
      
      if (!lat || !lon) {
        response.writeHead(400)
        response.end(JSON.stringify({ 
          error: 'Missing required parameters',
          message: 'Latitude (lat) and longitude (lon) are required'
        }))
        return
      }
      
      const result = await getWeatherData(parseFloat(lat), parseFloat(lon), { timezone })
      response.writeHead(200)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(500)
      response.end(JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to fetch weather data'
      }))
    }
    return
  }

  if (url.pathname === '/api/v1/weather/search') {
    try {
      const query = url.searchParams.get('query')
      
      if (!query) {
        response.writeHead(400)
        response.end(JSON.stringify({ 
          error: 'Missing query parameter',
          message: 'Search query is required'
        }))
        return
      }
      
      const result = await getLocationInfo(query)
      response.writeHead(200)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(500)
      response.end(JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to search locations'
      }))
    }
    return
  }

  // Gas and oil API routes
  if (await handleGasOilRequest(url, response)) {
    return
  }

  response.writeHead(404)
  response.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(port, host, () => {
  console.log(`Northwatch API listening on http://${host}:${port}`)
})
