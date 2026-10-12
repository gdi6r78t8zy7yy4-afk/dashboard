/**
 * Example usage of the local LM Studio LLM integration
 * 
 * This file demonstrates how to use your configured local LLM in the application.
 */

import { generateTextWithLocalLLM, streamTextWithLocalLLM } from '../services/aiService';

/**
 * Example 1: Simple text generation
 */
async function exampleSimpleGeneration() {
  try {
    const prompt = "Explain in simple terms what a dashboard is for a non-technical user.";
    const result = await generateTextWithLocalLLM(prompt);
    console.log('Generated text:', result);
  } catch (error) {
    console.error('Failed to generate text:', error);
  }
}

/**
 * Example 2: Streaming text generation (useful for real-time responses)
 */
async function exampleStreamingGeneration() {
  try {
    const prompt = "List 5 benefits of using a local LLM instead of cloud-based models.";
    
    console.log('Streaming response:');
    for await (const text of streamTextWithLocalLLM(prompt)) {
      process.stdout.write(text);
    }
    console.log('\n'); // Add newline after streaming
  } catch (error) {
    console.error('Failed to stream text:', error);
  }
}

/**
 * Example 3: Using with specific model configuration
 */
async function exampleWithSpecificModel() {
  try {
    const prompt = "What is the difference between a dashboard and a report?";
    const result = await generateTextWithLocalLLM(prompt, 'qwen/qwen3-coder-30b');
    console.log('Specific model response:', result);
  } catch (error) {
    console.error('Failed with specific model:', error);
  }
}

// Run examples (uncomment to test)
// exampleSimpleGeneration();
// exampleStreamingGeneration();
// exampleWithSpecificModel();

export { 
  exampleSimpleGeneration, 
  exampleStreamingGeneration, 
  exampleWithSpecificModel 
};