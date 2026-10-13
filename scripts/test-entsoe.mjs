import { buildEntsoeUrl, intervalFor, getEnergyArea, parseEntsoeXml } from '../server/energyData.mjs'

const token = process.env.ENTSOE_API_TOKEN
const now = new Date()

async function testUrl(description, params) {
  const url = buildEntsoeUrl({ ...params, token })
  try {
    const res = await fetch(url, { headers: { Accept: 'application/xml' } })
    const text = await res.text()
    if (!res.ok) {
      console.log(`[HTTP ${res.status}] ${description}`)
      console.log('   URL:', url.search.replace(token, 'TOKEN'))
      const match = text.match(/<text>([\s\S]*?)<\/text>/) || text.match(/<Reason>([\s\S]*?)<\/Reason>/)
      console.log('   Reason:', match ? match[1].trim() : text.slice(0, 150))
    } else {
      console.log(`[HTTP 200 OK] ${description}`)
    }
  } catch (err) {
    console.log(`[ERROR] ${description}:`, err.message)
  }
}

async function run() {
  console.log('=== Checking 24h, 7d, 30d periods ===')
  for (const period of ['24h', '7d', '30d']) {
    const interval = intervalFor(period, now)
    const area = getEnergyArea('se', 'SE3')
    await testUrl(`A75 (actualGeneration) SE3 ${period}`, {
      documentType: 'A75',
      processType: 'A16',
      area: area.eic,
      start: interval.start,
      end: interval.end,
    })
    await testUrl(`A11 (flow SE3 -> NO1) ${period}`, {
      documentType: 'A11',
      processType: 'A16',
      from: area.eic,
      to: '10YNO-1--------2',
      start: interval.start,
      end: interval.end,
    })
  }

  console.log('\n=== Checking all cross-border flows for SE3 (24h) ===')
  const area = getEnergyArea('se', 'SE3')
  const interval24 = intervalFor('24h', now)
  const neighborEics = {
    NO1: '10YNO-1--------2',
    SE2: '10Y1001A1001A45N',
    SE4: '10Y1001A1001A47J',
    FI: '10YFI-1--------U',
    DK1: '10YDK-1--------W',
  }
  for (const [neighbor, nEic] of Object.entries(neighborEics)) {
    await testUrl(`Flow from SE3 to ${neighbor}`, {
      documentType: 'A11',
      processType: 'A16',
      from: area.eic,
      to: nEic,
      start: interval24.start,
      end: interval24.end,
    })
    await testUrl(`Flow from ${neighbor} to SE3`, {
      documentType: 'A11',
      processType: 'A16',
      from: nEic,
      to: area.eic,
      start: interval24.start,
      end: interval24.end,
    })
  }

  console.log('\n=== Checking other countries and zones (24h) ===')
  for (const [c, z] of [['se', 'SE1'], ['no', 'NO1'], ['dk', 'DK1'], ['fi', 'FI']]) {
    const a = getEnergyArea(c, z)
    await testUrl(`A75 (actualGeneration) ${c.toUpperCase()} ${z}`, {
      documentType: 'A75',
      processType: 'A16',
      area: a.eic,
      start: interval24.start,
      end: interval24.end,
    })
  }
}

run().catch(console.error)
