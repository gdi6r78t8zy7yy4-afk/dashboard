#!/usr/bin/env node

/**
 * Script to test LM Studio connection
 */

import { checkLMStudioStatus, displayLMStudioConfig } from '../src/utils/llm-checker.js';

async function main() {
  console.log('🔍 Testing LM Studio Connection');
  console.log('=====================================\n');
  
  displayLMStudioConfig();
  console.log('');
  
  const isConnected = await checkLMStudioStatus();
  
  if (isConnected) {
    console.log('\n✅ LM Studio is properly configured and accessible!');
    console.log('You can now use local LLM features in this application.');
  } else {
    console.log('\n❌ LM Studio connection failed.');
    console.log('Please ensure:');
    console.log('1. LM Studio is running');
    console.log('2. Your model is loaded in LM Studio');
    console.log('3. The server is listening on http://127.0.0.1:1234/v1');
  }
}

main().catch(console.error);