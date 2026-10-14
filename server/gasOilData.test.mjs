import { describe, expect, it, vi } from 'vitest'
import { 
  getGasOilData, 
  getGasOilSourceMetadata,
  fetchJsonData,
  fetchXmlData,
  validateTimestamp,
  parseNumericValue,
  createDataset
} from './gasOilData.mjs'

describe('gas oil data adapter', () => {
  it('provides metadata about available sources', () => {
    const metadata = getGasOilSourceMetadata()
    expect(metadata).toHaveLength(7)
    expect(metadata[0]).toHaveProperty('id')
    expect(metadata[0]).toHaveProperty('name')
    expect(metadata[0]).toHaveProperty('url')
  })

  it('creates datasets with proper structure', () => {
    const points = [
      { timestamp: '2026-10-10T00:00:00Z', value: 1000, category: 'production' },
      { timestamp: '2026-10-10T01:00:00Z', value: 1050, category: 'production' }
    ]
    
    const dataset = createDataset('ok', 'production', 'barrels/day', points, 'Test data')
    
    expect(dataset.status).toBe('ok')
    expect(dataset.dataType).toBe('production')
    expect(dataset.unit).toBe('barrels/day')
    expect(dataset.points).toHaveLength(2)
    expect(dataset.lastUpdated).toBe('2026-10-10T01:00:00Z')
    expect(dataset.note).toBe('Test data')
  })

  it('parses timestamps correctly', () => {
    expect(validateTimestamp('2026-10-10T00:00:00Z')).toBe('2026-10-10T00:00:00.000Z')
    expect(validateTimestamp('invalid-date')).toBeNull()
    expect(validateTimestamp(null)).toBeNull()
  })

  it('parses numeric values safely', () => {
    expect(parseNumericValue('123.45')).toBe(123.45)
    expect(parseNumericValue('not-a-number')).toBeNull()
    expect(parseNumericValue(null)).toBeNull()
    expect(parseNumericValue(undefined)).toBeNull()
    expect(parseNumericValue('')).toBeNull()
  })

  it('handles JSON data fetching with success', async () => {
    const mockResponse = new Response(JSON.stringify({ test: 'data' }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
    const fetchImpl = vi.fn(async () => mockResponse)
    const result = await fetchJsonData('https://example.com/api', { method: 'GET' }, fetchImpl)
    
    expect(result.status).toBe('ok')
    expect(result.data).toEqual({ test: 'data' })
    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/api', {
      headers: { Accept: 'application/json' },
      signal: expect.any(AbortSignal),
      method: 'GET'
    })
  })

  it('handles JSON data fetching with error', async () => {
    const mockResponse = new Response('Error message', { status: 500 })
    
    const fetchImpl = vi.fn(async () => mockResponse)
    const result = await fetchJsonData('https://example.com/api', { method: 'GET' }, fetchImpl)
    
    expect(result.status).toBe('error')
    expect(result.error).toContain('500')
  })

  it('handles XML data fetching with success', async () => {
    const mockResponse = new Response('<root><test>data</test></root>', { 
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    })
    
    const fetchImpl = vi.fn(async () => mockResponse)
    const result = await fetchXmlData('https://example.com/api', { method: 'GET' }, fetchImpl)
    
    expect(result.status).toBe('ok')
    expect(result.data).toContain('<root>')
    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/api', {
      headers: { Accept: 'application/xml' },
      signal: expect.any(AbortSignal),
      method: 'GET'
    })
  })

  it('handles XML data fetching with error', async () => {
    const mockResponse = new Response('Error message', { status: 500 })
    
    const fetchImpl = vi.fn(async () => mockResponse)
    const result = await fetchXmlData('https://example.com/api', { method: 'GET' }, fetchImpl)
    
    expect(result.status).toBe('error')
    expect(result.error).toContain('500')
  })

  it('returns demo data when no specific implementation exists', async () => {
    const result = await getGasOilData({
      commodity: 'crude_oil',
      indicator: 'production',
      geography: { type: 'country', name: 'Sweden' },
      period: '24h'
    })
    
    expect(result.mode).toBe('demo')
    expect(result.commodity).toBe('crude_oil')
    expect(result.indicator).toBe('production')
    expect(result.geography.name).toBe('Sweden')
    expect(result.datasets.production).toBeDefined()
    expect(result.datasets.production.status).toBe('ok')
  })
})