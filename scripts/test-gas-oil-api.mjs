#!/usr/bin/env node

/**
 * Simple script to test the Gas & Oil API endpoints
 */

import { createServer } from 'node:http'
import { getGasOilData, getGasOilSourceMetadata } from '../server/gasOilData.mjs'
import { registerGasOilRoutes } from '../server/gasOilRoutes.mjs'

// Test the basic functionality
async function testGasOilData() {
  console.log('Testing Gas & Oil data API...')
  
  try {
    // Test metadata
    const sources = getGasOilSourceMetadata()
    console.log('Available sources:', sources.length)
    sources.forEach(source => {
      console.log(`- ${source.name}: ${source.url}`)
    })
    
    // Test data fetching
    const testData = await getGasOilData({
      commodity: 'crude_oil',
      indicator: 'production',
      geography: { type: 'country', name: 'Sweden' },
      period: '24h'
    })
    
    console.log('\nTest data response:')
    console.log('Commodity:', testData.commodity)
    console.log('Indicator:', testData.indicator)
    console.log('Mode:', testData.mode)
    console.log('Sources count:', testData.sources.length)
    console.log('Has production data:', !!testData.datasets.production)
    
    if (testData.datasets.production) {
      console.log('Production points:', testData.datasets.production.points.length)
      console.log('First point:', testData.datasets.production.points[0])
    }
    
    console.log('\n✅ Gas & Oil API tests completed successfully!')
  } catch (error) {
    console.error('❌ Error in Gas & Oil API test:', error.message)
    process.exit(1)
  }
}

// Test the routes directly
async function testRoutes() {
  console.log('\nTesting API routes...')
  
  // Create a mock server instance to test routes
  const mockServer = {
    get: (path, handler) => {
      console.log(`Route registered: GET ${path}`)
    }
  }
  
  try {
    registerGasOilRoutes(mockServer)
    console.log('✅ Routes registered successfully!')
  } catch (error) {
    console.error('❌ Error registering routes:', error.message)
    process.exit(1)
  }
}

// Run tests
testGasOilData().then(() => testRoutes()).catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})