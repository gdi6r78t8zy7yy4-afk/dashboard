import express, { type Request, type Response } from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getOverviewForRegion, getSectorForRegion } from './server/demoData.mjs'
import { getAggregatedOverview } from './server/overviewService.mjs'
import { getEnergyData } from './server/energyData.mjs'
import { getTelecomDashboard } from './server/telecomService.mjs'
import { getInternetDashboard } from './server/internetService.mjs'
import { getCyberDashboard, getCyberCveDetails } from './server/cyberService.mjs'
import { getEventsDashboard } from './server/eventsService.mjs'
import { getTransportDashboard } from './server/transportService.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startServer() {
  const app = express()
  const port = Number(process.env.PORT || 3000)
  const isProduction = process.env.NODE_ENV === 'production'

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', mode: 'demo' })
  })

  app.get('/api/v1/overview', async (req: Request, res: Response) => {
    const region = typeof req.query.region === 'string' ? req.query.region : 'se'
    try {
      const data = await getAggregatedOverview({ region })
      res.json(data)
    } catch {
      res.json(getOverviewForRegion(region))
    }
  })

  app.get('/api/v1/sector', (req: Request, res: Response) => {
    const region = typeof req.query.region === 'string' ? req.query.region : 'se'
    const id = typeof req.query.id === 'string' ? req.query.id : 'telecom'
    res.json(getSectorForRegion(region, id))
  })

  app.get('/api/v1/energy', async (req: Request, res: Response) => {
    const country = typeof req.query.country === 'string' ? req.query.country : 'se'
    const zone = typeof req.query.zone === 'string' ? req.query.zone : undefined
    const period = typeof req.query.period === 'string' ? req.query.period : '24h'
    try {
      res.json(await getEnergyData({ country, zone, period }))
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid energy query.' })
    }
  })

  app.get('/api/v1/telecom', async (req: Request, res: Response) => {
    const region = typeof req.query.region === 'string' ? req.query.region : 'se'
    const period = typeof req.query.period === 'string' ? req.query.period : '7d'
    try {
      res.json(await getTelecomDashboard({ region, period }))
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid telecom query.' })
    }
  })

  app.get('/api/v1/internet', async (req: Request, res: Response) => {
    const region = typeof req.query.region === 'string' ? req.query.region : 'se'
    const period = typeof req.query.period === 'string' ? req.query.period : '7d'
    const asn = typeof req.query.asn === 'string' ? req.query.asn : '1653'
    const indicator = typeof req.query.indicator === 'string' ? req.query.indicator : 'all'
    try {
      res.json(await getInternetDashboard({ region, period, asn, indicator }))
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid internet query.' })
    }
  })

  app.get('/api/v1/cyber', async (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search : ''
    const classificationFilter = typeof req.query.classification === 'string' ? req.query.classification : 'all'
    const severityFilter = typeof req.query.severity === 'string' ? req.query.severity : 'all'
    try {
      res.json(await getCyberDashboard({ search, classificationFilter, severityFilter }))
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Kunde inte hämta cyberhotdata.' })
    }
  })

  app.get('/api/v1/cyber/cve/:cveId', async (req: Request, res: Response) => {
    const { cveId } = req.params
    try {
      const result = await getCyberCveDetails(cveId)
      if (!result) {
        res.status(404).json({ error: 'CVE hittades inte.' })
        return
      }
      res.json(result)
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Kunde inte slå upp CVE.' })
    }
  })

  app.get('/api/v1/events', async (req: Request, res: Response) => {
    const sector = typeof req.query.sector === 'string' ? req.query.sector : 'all'
    const region = typeof req.query.region === 'string' ? req.query.region : 'all'
    const classification = typeof req.query.classification === 'string' ? req.query.classification : 'all'
    const severity = typeof req.query.severity === 'string' ? req.query.severity : 'all'
    const search = typeof req.query.search === 'string' ? req.query.search : ''
    const grouped = req.query.grouped !== 'false'
    const forceRefresh = req.query.refresh === 'true'
    try {
      res.json(await getEventsDashboard({ sector, region, classification, severity, search, grouped, forceRefresh }))
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Kunde inte hämta omvärldshändelser.' })
    }
  })

  app.get('/api/v1/transport', async (req: Request, res: Response) => {
    const mode = typeof req.query.mode === 'string' ? req.query.mode : 'all'
    const region = typeof req.query.region === 'string' ? req.query.region : 'se'
    const period = typeof req.query.period === 'string' ? req.query.period : '24h'
    try {
      res.json(await getTransportDashboard({ mode, region, period }))
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Kunde inte hämta transportdata.' })
    }
  })

  if (!isProduction) {
    const { createServer } = await import('vite')
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')))
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'))
    })
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Northwatch listening on http://0.0.0.0:${port}`)
  })
}

startServer()
