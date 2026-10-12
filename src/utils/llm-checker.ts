/**
 * Utility to check if LM Studio is properly configured and running
 */

import { testLocalLLMConnection } from '../services/aiService';

/**
 * Check if LM Studio is accessible
 * @returns Promise that resolves to true if LM Studio is running, false otherwise
 */
export async function checkLMStudioStatus(): Promise<boolean> {
  console.log('Checking LM Studio connection...');
  
  try {
    const isConnected = await testLocalLLMConnection();
    
    if (isConnected) {
      console.log('✅ LM Studio is accessible and configured correctly');
      return true;
    } else {
      console.log('❌ LM Studio is not accessible. Please ensure it is running.');
      return false;
    }
  } catch (error) {
    console.error('Error checking LM Studio status:', error);
    console.log('❌ Failed to check LM Studio connection. Please ensure it is running.');
    return false;
  }
}

/**
 * Display configuration information
 */
export function displayLMStudioConfig() {
  console.log('LM Studio Configuration:');
  console.log('- Base URL: http://127.0.0.1:1234/v1');
  console.log('- Model: qwen/qwen3-coder-30b');
  console.log('- Provider: LM Studio (local)');
}

// Example usage:
// checkLMStudioStatus().then(isConnected => {
//   if (isConnected) {
//     console.log('LM Studio is ready to use!');
//   } else {
//     console.log('Please start LM Studio before using this application.');
//   }
// });