import { unzipSync, strFromU8 } from 'fflate'
import { XMLParser } from 'fast-xml-parser'

export const PTS_COVERAGE_URL = 'https://statistik.pts.se/files/mobiltacknings-och-bredbandskartlaggning/mtbbk_25-17220_tabellbilaga_mobilt%C3%A4ckning_v1.0.xlsx'
export const PTS_COVERAGE_PAGE = 'https://statistik.pts.se/mobiltacknings-och-bredbandskartlaggning'

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true })
const workbookCacheMs = 6 * 60 * 60 * 1000
let workbookCache = null

function asArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function parseXml(files, path) {
  const content = files[path]
  if (!content) throw new Error(`PTS workbook is missing ${path}.`)
  return parser.parse(strFromU8(content))
}

function cellText(cell, sharedStrings) {
  if (!cell) return null
  const value = cell.v ?? cell.is?.t
  if (cell['@_t'] === 's') return sharedStrings[Number(value)] ?? null
  if (value === undefined || value === null) return null
  return String(value).trim()
}

function coverageValue(raw) {
  if (raw === null || raw === undefined || raw === '') return { value: null, qualifier: 'missing' }
  const text = String(raw).trim()
  const threshold = /^>\s*([\d,.]+)\s*%$/.exec(text)
  if (threshold) return { value: Number(threshold[1].replace(',', '.')), qualifier: 'greater-than' }
  const value = Number(text.replace(',', '.'))
  if (!Number.isFinite(value)) return { value: null, qualifier: 'missing' }
  return { value: Math.min(value <= 1 ? value * 100 : value, 100), qualifier: 'exact' }
}

export function parsePtsCoverageWorkbook(buffer) {
  const files = unzipSync(new Uint8Array(buffer))
  const workbook = parseXml(files, 'xl/workbook.xml').workbook
  const relationships = asArray(parseXml(files, 'xl/_rels/workbook.xml.rels').Relationships.Relationship)
  const coverageSheet = asArray(workbook.sheets.sheet).find((sheet) => sheet['@_name'] === 'Yttäckning 2025')
  if (!coverageSheet) throw new Error('PTS workbook does not contain the Yttäckning 2025 sheet.')

  const relationship = relationships.find((item) => item['@_Id'] === coverageSheet['@_r:id'])
  if (!relationship) throw new Error('PTS workbook does not link the Yttäckning 2025 sheet.')
  const sheetPath = `xl/${relationship['@_Target']}`
  const sharedStringsDoc = files['xl/sharedStrings.xml'] ? parseXml(files, 'xl/sharedStrings.xml') : null
  const sharedStrings = asArray(sharedStringsDoc?.sst?.si).map((item) => {
    if (typeof item.t === 'string') return item.t
    return asArray(item.r).map((run) => run.t ?? '').join('')
  })
  const rows = asArray(parseXml(files, sheetPath).worksheet.sheetData.row)
  const rowCells = new Map(rows.map((row) => {
    const values = new Map(asArray(row.c).map((cell) => [cell['@_r'].replace(/\d+/g, ''), cellText(cell, sharedStrings)]))
    return [Number(row['@_r']), values]
  }))
  const headers = rowCells.get(2)
  if (!headers) throw new Error('PTS coverage sheet does not contain its documented column headers.')

  const columnByLabel = new Map([...headers].map(([column, label]) => [label, column]))
  const coverageColumns = {
    mobile10Mbps8Db: columnByLabel.get('Alla operatörer - minst 10 Mbit/s - 8 db'),
    mobile100Mbps8Db: columnByLabel.get('Alla operatörer - minst 100 Mbit/s - 8 db'),
    mobile5g8Db: columnByLabel.get('Alla operatörer - 5G - 8 db'),
  }
  if (Object.values(coverageColumns).some((column) => !column)) throw new Error('PTS workbook is missing a required 8 dB mobile coverage column.')

  return [...rowCells.entries()]
    .filter(([rowNumber, cells]) => rowNumber > 2 && String(cells.get('A') ?? '').endsWith(' län'))
    .map(([, cells]) => ({
      code: cells.get('B') ?? '',
      name: cells.get('A'),
      mobile10Mbps8Db: coverageValue(cells.get(coverageColumns.mobile10Mbps8Db)),
      mobile100Mbps8Db: coverageValue(cells.get(coverageColumns.mobile100Mbps8Db)),
      mobile5g8Db: coverageValue(cells.get(coverageColumns.mobile5g8Db)),
    }))
}

export async function getPtsCoverage({ fetchImpl = fetch, now = new Date() } = {}) {
  const requestedAt = new Date(now).toISOString()
  if (workbookCache && Date.parse(requestedAt) - Date.parse(workbookCache.retrievedAt) < workbookCacheMs) {
    return { ...workbookCache, requestedAt, cached: true }
  }

  try {
    const response = await fetchImpl(PTS_COVERAGE_URL, {
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'User-Agent': 'InfrastructureWatch/1.0' },
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error(`PTS returned HTTP ${response.status}.`)
    const counties = parsePtsCoverageWorkbook(await response.arrayBuffer())
    if (counties.length !== 21) throw new Error(`PTS returned ${counties.length} county rows; expected 21.`)
    workbookCache = { counties, retrievedAt: requestedAt, referencePeriod: '2025-11', cached: false }
    return { ...workbookCache, requestedAt, cached: false }
  } catch (error) {
    return {
      counties: [],
      retrievedAt: null,
      requestedAt,
      referencePeriod: '2025-11',
      cached: false,
      error: error instanceof Error ? error.message : 'PTS coverage data is unavailable.',
    }
  }
}