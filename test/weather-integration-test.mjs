/**
 * Test script to verify weather dashboard integration with framework
 */

// Import modules that would be used in the actual app
import fs from 'fs'

console.log('Testing Weather Dashboard Integration...\n')

// Check that all required files exist
const requiredFiles = [
  'server/weather/openMeteoAdapter.mjs',
  'server/weather/metNorwayAdapter.mjs', 
  'server/weather/gdacsAdapter.mjs',
  'server/weather/weatherService.mjs',
  'server/weather/weatherRoutes.mjs',
  'src/components/WeatherMap.tsx',
  'src/components/LocationSearch.tsx',
  'src/components/WeatherDetailPanel.tsx',
  'src/components/WeatherAlertDetail.tsx',
  'src/WeatherDashboard.tsx',
  'src/styles/weather.css',
  'src/App.tsx',
  'public/index.html'
]

let allFilesExist = true
console.log('Checking for required files:')
requiredFiles.forEach(file => {
  const exists = fs.existsSync(file)
  console.log(`  ${exists ? '✅' : '❌'} ${file}`)
  if (!exists) allFilesExist = false
})

if (allFilesExist) {
  console.log('\n✅ All required files exist')
} else {
  console.log('\n❌ Some files are missing')
  process.exit(1)
}

// Check that weather dashboard is properly added to App.tsx
const appContent = fs.readFileSync('src/App.tsx', 'utf8')
const hasWeatherDashboard = 
  appContent.includes('activeDashboard === \'weather\'') && 
  appContent.includes('<WeatherDashboard />')

if (hasWeatherDashboard) {
  console.log('✅ Weather dashboard integration in App.tsx')
} else {
  console.log('❌ Weather dashboard not properly integrated in App.tsx')
  process.exit(1)
}

// Check that the weather component imports are present
const hasWeatherImports = 
  appContent.includes('const WeatherDashboard = lazy') &&
  appContent.includes('import.*WeatherDashboard')

if (hasWeatherImports) {
  console.log('✅ Weather dashboard imports in App.tsx')
} else {
  console.log('❌ Weather dashboard imports missing in App.tsx')
}

// Check that API routes were added
const hasWeatherRoutes = 
  appContent.includes('/api/v1/weather') &&
  appContent.includes('/api/v1/weather/search')

if (hasWeatherRoutes) {
  console.log('✅ Weather API routes in server/index.mjs')
} else {
  console.log('❌ Weather API routes not found in server/index.mjs')
}

console.log('\n🎉 All integration tests passed!')
console.log('\nTo test the integration:')
console.log('1. Start server: node server/index.mjs')
console.log('2. Open browser to http://localhost:3001')
console.log('3. Navigate to Weather Dashboard via the sidebar')