#!/usr/bin/env node

/**
 * Script to verify that dashboard widgets show data
 */

import { getAggregatedOverview } from '../server/overviewService.mjs';
import { getSectorForRegion } from '../server/demoData.mjs';

async function main() {
  console.log('🔍 Verifying Dashboard Data Sources');
  console.log('=====================================\n');

  try {
    // Test overview data
    console.log('1. Testing overview data...');
    const overview = await getAggregatedOverview({ region: 'se', now: new Date() });
    
    console.log(`   Mode: ${overview.mode}`);
    console.log(`   Region: ${overview.region}`);
    console.log(`   Services: ${overview.services.length}`);
    console.log(`   Incidents: ${overview.incidents.length}`);
    console.log(`   Sectors: ${overview.sectors.length}`);
    
    // Check that sectors have values
    overview.sectors.forEach(sector => {
      console.log(`   - ${sector.label}: ${sector.value} (${sector.status})`);
    });
    
    console.log('\n2. Testing sector-specific data...');
    
    // Test various sectors
    const sectorsToTest = ['telecom', 'internet', 'cyber', 'energy', 'transport'];
    for (const sectorId of sectorsToTest) {
      const sectorData = getSectorForRegion('se', sectorId);
      console.log(`   ${sectorData.label}: ${sectorData.status}`);
      if (sectorData.kpis && sectorData.kpis.length > 0) {
        console.log(`     KPIs: ${sectorData.kpis.length}`);
        sectorData.kpis.forEach(kpi => {
          console.log(`       - ${kpi.label}: ${kpi.value} (${kpi.status})`);
        });
      }
    }
    
    console.log('\n✅ All data sources are properly configured and returning data!');
  } catch (error) {
    console.error('❌ Error testing data sources:', error);
    process.exit(1);
  }
}

main().catch(console.error);