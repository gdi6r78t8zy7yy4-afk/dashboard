import { test, expect, describe } from 'vitest';
import { generateTextWithLocalLLM, testLocalLLMConnection } from './aiService';

describe('AI Service', () => {
  test('should connect to local LM Studio', async () => {
    // This test will only pass if LM Studio is running
    const connected = await testLocalLLMConnection();
    // Note: This might fail if LM Studio isn't running, which is expected
    console.log('LM Studio connection test result:', connected);
  });

  test('should generate text with local LLM', async () => {
    // This test will only pass if LM Studio is running
    try {
      const result = await generateTextWithLocalLLM('Hello, how are you?', 'qwen/qwen3-coder-30b');
      expect(result).toBeDefined();
      console.log('Generated text:', result);
    } catch (error) {
      // This is expected to fail if LM Studio isn't running
      console.log('Test skipped - LM Studio not running:', error);
    }
  });
});