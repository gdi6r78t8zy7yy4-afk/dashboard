#!/usr/bin/env node

/**
 * Script to test that all configured API keys work correctly
 */

import { getTrafikverketSituations } from '../server/trafikverketAdapter.mjs';
import { getAggregatedOverview } from '../server/overviewService.mjs';

async function main() {
  console.log('🔍 Testing API Keys and Data Sources');
  console.log('=====================================\n');

  try {
    // Test Trafikverket API (if key is configured)
    console.log('1. Testing Trafikverket API...');
    const trafikverketResult = await getTrafikverketSituations({ 
      apiKey: process.env.TRAFIKVERKET_API_TOKEN,
      now: new Date() 
    });
    
    if (trafikverketResult.state === 'ok') {
      console.log(`   ✅ Trafikverket API working - ${trafikverketResult.incidents.length} incidents found`);
    } else if (trafikverketResult.state === 'not_configured') {
      console.log('   ⚠️  Trafikverket API not configured');
    } else {
      console.log(`   ❌ Trafikverket API error: ${trafikverketResult.lastError}`);
    }

    // Test overview data to see if it's using real data now
    console.log('\n2. Testing aggregated overview...');
    const overview = await getAggregatedOverview({ region: 'se', now: new Date() });
    
    console.log(`   Mode: ${overview.mode}`);
    console.log(`   Region: ${overview.region}`);
    console.log(`   Services: ${overview.services.length}`);
    console.log(`   Incidents: ${overview.incidents.length}`);
    
    // Check that sectors have actual values (not demo values)
    overview.sectors.forEach(sector => {
      console.log(`   - ${sector.label}: ${sector.value} (${sector.status})`);
    });
    
    console.log('\n✅ API configuration test completed!');
    console.log('\n💡 Note: If you see "Ej konfigurerad" for some sectors, it means the specific API key is not available.');
    console.log('   If you see real data values instead of "Ej konfigurerad", the keys are working correctly.');
    
  } catch (error) {
    console.error('❌ Error testing API keys:', error);
    process.exit(1);
  }
}

main().catch(console.error);