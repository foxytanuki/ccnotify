import { describe, it, expect } from 'vitest';
import {
  validateDiscordWebhookUrl,
  validateNtfyTopicName,
  sanitizeInput,
  validateAndSanitizeDiscordUrl,
  validateAndSanitizeNtfyTopic,
} from '../../../src/services/validation.js';
import { CCNotifyError, ErrorType } from '../../../src/types/index.js';

describe('Discord Webhook URL Validation', () => {
  it('should accept valid Discord webhook URLs', () => {
    const validUrls = [
      'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz123456789012345678901234567890',
      'https://discordapp.com/api/webhooks/987654321098765432/ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789012345678901234567890',
      'https://discord.com/api/webhooks/111111111111111111/test-webhook-token_123',
    ];

    for (const url of validUrls) {
      expect(() => validateDiscordWebhookUrl(url)).not.toThrow();
    }
  });

  it('should reject invalid Discord webhook URLs', () => {
    const invalidUrls = [
      'https://example.com/webhook',
      'https://discord.com/api/webhooks/invalid',
      'https://discord.com/api/webhooks/123/token/extra',
      'http://discord.com/api/webhooks/123/token', // http instead of https
      'discord.com/api/webhooks/123/token', // missing protocol
      'https://discord.com/webhooks/123/token', // missing /api/
      '',
      'not-a-url',
    ];

    for (const url of invalidUrls) {
      try {
        validateDiscordWebhookUrl(url);
        expect.fail(`Expected error for URL: ${url}`);
      } catch (error) {
        expect(error).toBeInstanceOf(CCNotifyError);
        expect((error as CCNotifyError).type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    }
  });

  it('should reject non-string inputs', () => {
    const invalidInputs = [null, undefined, 123, {}, []];

    for (const input of invalidInputs) {
      try {
        validateDiscordWebhookUrl(input as any);
        expect.fail(`Expected error for input: ${input}`);
      } catch (error) {
        expect(error).toBeInstanceOf(CCNotifyError);
        expect((error as CCNotifyError).type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    }
  });
});

describe('ntfy Topic Name Validation', () => {
  it('should accept valid ntfy topic names', () => {
    const validTopics = [
      'test',
      'my-topic',
      'my_topic',
      'topic123',
      'a',
      'A',
      '1',
      'test-topic_123',
      'very-long-topic-name-with-many-characters-but-still-valid',
    ];

    for (const topic of validTopics) {
      expect(() => validateNtfyTopicName(topic)).not.toThrow();
    }
  });

  it('should reject invalid ntfy topic names', () => {
    const invalidTopics = [
      '', // empty
      '-test', // starts with hyphen
      '_test', // starts with underscore
      'test-', // ends with hyphen
      'test_', // ends with underscore
      'test topic', // contains space
      'test@topic', // contains special character
      'test.topic', // contains dot
      'test/topic', // contains slash
      'a'.repeat(65), // too long (65 characters)
    ];

    for (const topic of invalidTopics) {
      try {
        validateNtfyTopicName(topic);
        expect.fail(`Expected error for topic: ${topic}`);
      } catch (error) {
        expect(error).toBeInstanceOf(CCNotifyError);
        expect((error as CCNotifyError).type).toBe(ErrorType.INVALID_TOPIC_NAME);
      }
    }
  });

  it('should reject non-string inputs', () => {
    const invalidInputs = [null, undefined, 123, {}, []];

    for (const input of invalidInputs) {
      try {
        validateNtfyTopicName(input as any);
        expect.fail(`Expected error for input: ${input}`);
      } catch (error) {
        expect(error).toBeInstanceOf(CCNotifyError);
        expect((error as CCNotifyError).type).toBe(ErrorType.INVALID_TOPIC_NAME);
      }
    }
  });
});

describe('Input Sanitization', () => {
  it('should remove control characters', () => {
    const input = 'test\x00\x01\x02string\x7F';
    const result = sanitizeInput(input);
    expect(result).toBe('teststring');
  });

  it('should preserve newlines and tabs', () => {
    const input = 'test\nstring\twith\ttabs';
    const result = sanitizeInput(input);
    expect(result).toBe('test\nstring\twith\ttabs');
  });

  it('should trim whitespace', () => {
    const input = '  test string  ';
    const result = sanitizeInput(input);
    expect(result).toBe('test string');
  });

  it('should limit length to 2048 characters', () => {
    const input = 'a'.repeat(3000);
    const result = sanitizeInput(input);
    expect(result).toHaveLength(2048);
    expect(result).toBe('a'.repeat(2048));
  });

  it('should handle empty and null inputs', () => {
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput(null as any)).toBe('');
    expect(sanitizeInput(undefined as any)).toBe('');
  });

  it('should handle non-string inputs', () => {
    expect(sanitizeInput(123 as any)).toBe('');
    expect(sanitizeInput({} as any)).toBe('');
    expect(sanitizeInput([] as any)).toBe('');
  });
});

describe('Combined Validation and Sanitization', () => {
  it('should validate and sanitize Discord URLs', () => {
    const url = '  https://discord.com/api/webhooks/123456789012345678/token123  ';
    const result = validateAndSanitizeDiscordUrl(url);
    expect(result).toBe('https://discord.com/api/webhooks/123456789012345678/token123');
  });

  it('should validate and sanitize ntfy topic names', () => {
    const topic = '  my-topic_123  ';
    const result = validateAndSanitizeNtfyTopic(topic);
    expect(result).toBe('my-topic_123');
  });

  it('should throw errors for invalid inputs after sanitization', () => {
    expect(() => validateAndSanitizeDiscordUrl('  invalid-url  ')).toThrow(CCNotifyError);
    expect(() => validateAndSanitizeNtfyTopic('  -invalid-topic  ')).toThrow(CCNotifyError);
  });
});