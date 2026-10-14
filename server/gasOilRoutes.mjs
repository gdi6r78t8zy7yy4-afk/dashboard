/**
 * Gas and Oil API Routes
 *
 * Exports both:
 * - handleGasOilRequest(url, response): raw Node http dispatch used by
 *   server/index.mjs (the integrated dashboard API).
 * - registerGasOilRoutes(app): Express-style registration for standalone use
 *   and the scripts/test-gas-oil-api.mjs smoke test.
 */

import { getGasOilData, getGasOilSourceMetadata } from './gasOilData.mjs'
import { searchGasOil, getGasOilSearchCoverage } from './gasOilSearch.mjs'

async function sendJson(response, status, body) {
  response.writeHead(status)
  response.end(JSON.stringify(body))
}

export async function handleGasOilDataRequest(url, response) {
  try {
    const commodity = url.searchParams.get('commodity')
    const indicator = url.searchParams.get('indicator')
    const geographyParam = url.searchParams.get('geography')
    const period = url.searchParams.get('period')

    if (!commodity) {
      await sendJson(response, 400, {
        error: 'Missing required parameter',
        message: 'Commodity is required',
      })
      return
    }

    const gasOilData = await getGasOilData({
      commodity,
      indicator: indicator || 'production',
      geography: geographyParam ? JSON.parse(geographyParam) : { type: 'country', name: 'Sweden' },
      period: period || '24h',
    })

    await sendJson(response, 200, gasOilData)
  } catch (error) {
    console.error('Gas and Oil API error:', error)
    await sendJson(response, 500, {
      error: 'Internal server error',
      message: 'Failed to fetch gas and oil data',
    })
  }
}

export async function handleGasOilSourcesRequest(response) {
  try {
    const sources = getGasOilSourceMetadata()
    await sendJson(response, 200, {
      sources,
      retrievedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Gas and Oil sources API error:', error)
    await sendJson(response, 500, {
      error: 'Internal server error',
      message: 'Failed to fetch gas and oil sources metadata',
    })
  }
}

export async function handleGasOilAvailableRequest(response) {
  try {
    const coverage = getGasOilSearchCoverage()
    const available = {
      commodities: ['crude_oil', 'natural_gas', 'refined_products'],
      indicators: [
        'production',
        'consumption',
        'reserves',
        'imports',
        'exports',
        'storage',
        'capacity',
        'flows',
        'prices',
      ],
      indicatorDefinitions: coverage.indicators,
      geographies: [
        { type: 'country', name: 'Sweden' },
        { type: 'country', name: 'Norway' },
        { type: 'country', name: 'Denmark' },
        { type: 'country', name: 'Finland' },
        { type: 'country', name: 'United States' },
        { type: 'country', name: 'Russia' },
        { type: 'country', name: 'China' },
        { type: 'country', name: 'United Kingdom' },
      ],
      periods: ['24h', '7d', '30d', '90d'],
      retrievedAt: new Date().toISOString(),
    }

    await sendJson(response, 200, available)
  } catch (error) {
    console.error('Gas and Oil available data API error:', error)
    await sendJson(response, 500, {
      error: 'Internal server error',
      message: 'Failed to fetch available gas and oil data',
    })
  }
}

export async function handleGasOilSearchRequest(url, response) {
  const query = url.searchParams.get('q')
  if (!query || !query.trim()) {
    await sendJson(response, 200, {
      query: '',
      results: { geographies: [], indicators: [], benchmarks: [], assets: [], sources: [] },
      total: 0,
      byType: { geographies: 0, indicators: 0, benchmarks: 0, assets: 0, sources: 0 },
      ...getGasOilSearchCoverage(),
    })
    return
  }

  try {
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? Math.max(1, Math.min(20, Number(limitParam))) : undefined
    await sendJson(response, 200, searchGasOil(query, { limit }))
  } catch (error) {
    console.error('Gas and Oil search API error:', error)
    await sendJson(response, 500, {
      error: 'Internal server error',
      message: 'Failed to search gas and oil index',
    })
  }
}

/**
 * Dispatch a raw Node http request to the gas and oil handlers.
 * Returns true when the request was handled.
 */
export async function handleGasOilRequest(url, response) {
  if (url.pathname === '/api/v1/gas-oil/search') {
    await handleGasOilSearchRequest(url, response)
    return true
  }
  if (url.pathname === '/api/v1/gas-oil') {
    await handleGasOilDataRequest(url, response)
    return true
  }
  if (url.pathname === '/api/v1/gas-oil/sources') {
    await handleGasOilSourcesRequest(response)
    return true
  }
  if (url.pathname === '/api/v1/gas-oil/available') {
    await handleGasOilAvailableRequest(response)
    return true
  }
  return false
}

/**
 * Register gas and oil API routes on an Express-style app.
 * @param {Object} app - Application instance exposing get(path, handler).
 */
export function registerGasOilRoutes(app) {
  app.get('/api/v1/gas-oil/search', async (req, res) => {
    await handleGasOilSearchRequest(new URL(req.url ?? '/', 'http://localhost'), res)
  })

  app.get('/api/v1/gas-oil', async (req, res) => {
    await handleGasOilDataRequest(new URL(req.url ?? '/', 'http://localhost'), res)
  })

  app.get('/api/v1/gas-oil/sources', async (req, res) => {
    await handleGasOilSourcesRequest(res)
  })

  app.get('/api/v1/gas-oil/available', async (req, res) => {
    await handleGasOilAvailableRequest(res)
  })
}
