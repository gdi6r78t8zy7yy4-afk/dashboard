#!/usr/bin/env node

/**
 * Script to test Nord Pool adapter functionality
 */

import { getNordPoolDayAheadPricesForAllAreas } from '../server/nordpoolAdapter.mjs';

async function main() {
  console.log('🔍 Testing Nord Pool Adapter');
  console.log('==========================\n');

  try {
    // Test with a dummy token to see the structure
    console.log('1. Testing Nord Pool data fetching...');
    
    const results = await getNordPoolDayAheadPricesForAllAreas({
      period: '24h',
      token: process.env.NORDPOOL_API_TOKEN || 'dummy-token'
    });
    
    Object.entries(results).forEach(([area, data]) => {
      console.log(`   ${area}:`);
      console.log(`     Status: ${data.state}`);
      if (data.state === 'ok') {
        console.log(`     Data points: ${data.data.length}`);
        if (data.data.length > 0) {
          console.log(`     Sample price: ${data.data[0].value} ${data.data[0].currency}/${data.data[0].unit}`);
        }
      } else if (data.state === 'not_configured') {
        console.log(`     Note: ${data.note}`);
      } else if (data.state === 'error') {
        console.log(`     Error: ${data.lastError}`);
      }
      console.log('');
    });
    
    console.log('✅ Nord Pool adapter test completed!');
    
  } catch (error) {
    console.error('❌ Error testing Nord Pool adapter:', error);
    process.exit(1);
  }
}

main().catch(console.error);