import { createServer } from 'node:http'
import { getOverviewForRegion, getSectorForRegion } from './demoData.mjs'

const port = Number(process.env.API_PORT ?? 3001)
const host = process.env.API_HOST ?? '127.0.0.1'

const server = createServer((request, response) => {
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
    response.end(JSON.stringify(getOverviewForRegion(region)))
    return
  }

  if (url.pathname === '/api/v1/sector') {
    response.writeHead(200)
    const region = url.searchParams.get('region') ?? 'se'
    const id = url.searchParams.get('id') ?? 'telecom'
    response.end(JSON.stringify(getSectorForRegion(region, id)))
    return
  }

  response.writeHead(404)
  response.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(port, host, () => {
  console.log(`Northwatch API listening on http://${host}:${port}`)
})
