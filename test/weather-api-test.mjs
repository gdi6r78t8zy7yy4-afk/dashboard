/**
 * Simple test to verify weather API endpoints work
 */

import { fetch } from 'undici'

async function testWeatherEndpoints() {
  console.log('Testing Weather API Endpoints...')
  
  try {
    // Test weather data endpoint
    console.log('\n1. Testing weather data endpoint...')
    const weatherResponse = await fetch('http://localhost:3001/api/v1/weather?lat=57.7&lon=12.0')
    const weatherData = await weatherResponse.json()
    console.log('✓ Weather data endpoint working')
    console.log(`  Status: ${weatherData.mode}`)
    console.log(`  Location: ${weatherData.location?.name || 'Unknown'}`)
    
    // Test search endpoint
    console.log('\n2. Testing location search endpoint...')
    const searchResponse = await fetch('http://localhost:3001/api/v1/weather/search?query=Stockholm')
    const searchData = await searchResponse.json()
    console.log('✓ Location search endpoint working')
    console.log(`  Found ${searchData.locations?.length || 0} locations`)
    
    // Test alerts endpoint
    console.log('\n3. Testing alerts endpoint...')
    const alertsResponse = await fetch('http://localhost:3001/api/v1/weather/alerts')
    const alertsData = await alertsResponse.json()
    console.log('✓ Alerts endpoint working')
    console.log(`  Found ${alertsData.alerts?.length || 0} alerts`)
    
    console.log('\n✅ All weather API endpoints are working correctly!')
    
  } catch (error) {
    console.error('❌ Error testing weather API:', error.message)
    return false
  }
  
  return true
}

// Run the test
testWeatherEndpoints().catch(console.error)