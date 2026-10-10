import express, { type Request, type Response } from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getOverviewForRegion, getSectorForRegion } from './server/demoData.mjs'
import { getEnergyData } from './server/energyData.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startServer() {
  const app = express()
  const port = Number(process.env.PORT || 3000)
  const isProduction = process.env.NODE_ENV === 'production'

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', mode: 'demo' })
  })

  app.get('/api/v1/overview', (req: Request, res: Response) => {
    const region = typeof req.query.region === 'string' ? req.query.region : 'se'
    res.json(getOverviewForRegion(region))
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

  if (!isProduction) {
    const { createServer } = await import('vite')
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')))
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'))
    })
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Northwatch listening on http://0.0.0.0:${port}`)
  })
}

startServer()
