import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

// Create an OpenAI client configured for LM Studio
const openai = createOpenAI({
  baseURL: 'http://127.0.0.1:1234/v1',
  apiKey: 'lmstudio', // LM Studio doesn't require an API key, but we still need to set one
});

/**
 * Generate text using your local LLM
 * @param prompt The prompt to send to the model
 * @param model The model to use (defaults to qwen/qwen3-coder-30b)
 */
export async function generateTextWithLocalLLM(
  prompt: string,
  model: string = 'qwen/qwen3-coder-30b'
): Promise<string> {
  try {
    const result = await generateText({
      model: openai.model(model),
      prompt,
    });
    
    return result.text;
  } catch (error) {
    console.error('Error generating text with local LLM:', error);
    throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stream text generation from your local LLM
 * @param prompt The prompt to send to the model
 * @param model The model to use (defaults to qwen/qwen3-coder-30b)
 */
export async function* streamTextWithLocalLLM(
  prompt: string,
  model: string = 'qwen/qwen3-coder-30b'
) {
  try {
    const result = await streamText({
      model: openai.model(model),
      prompt,
    });
    
    yield* result.textStream;
  } catch (error) {
    console.error('Error streaming text with local LLM:', error);
    throw new Error(`Failed to stream text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Test connection to your local LM Studio instance
 */
export async function testLocalLLMConnection(): Promise<boolean> {
  try {
    // Try to get model information
    const models = await openai.models.list();
    console.log('Available models:', models.data);
    return true;
  } catch (error) {
    console.error('Failed to connect to LM Studio:', error);
    return false;
  }
}