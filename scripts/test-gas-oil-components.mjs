#!/usr/bin/env node

/**
 * Simple script to test Gas & Oil components
 */

// Test that our files exist and can be imported
try {
  // Test component imports
  const GasOilMap = await import('../src/components/GasOilMap.tsx')
  const GasOilDetailPanel = await import('../src/components/GasOilDetailPanel.tsx')
  const GasOilDashboard = await import('../src/GasOilDashboard.tsx')
  
  console.log('✅ All Gas & Oil components imported successfully!')
  
  // Test that our dashboard is correctly registered in the app
  const fs = await import('fs')
  const appContent = fs.readFileSync('./src/App.tsx', 'utf8')
  
  if (appContent.includes('GasOilDashboard')) {
    console.log('✅ GasOilDashboard correctly registered in App.tsx')
  } else {
    console.error('❌ GasOilDashboard not found in App.tsx')
    process.exit(1)
  }
  
  if (appContent.includes('gas-oil')) {
    console.log('✅ GasOil dashboard correctly added to navigation')
  } else {
    console.error('❌ GasOil dashboard not found in navigation')
    process.exit(1)
  }
  
  console.log('✅ All Gas & Oil component tests passed!')
  
} catch (error) {
  console.error('❌ Error in Gas & Oil component tests:', error.message)
  process.exit(1)
}