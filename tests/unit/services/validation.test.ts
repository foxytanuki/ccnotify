import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../src/services/error-handler.js';
import {
  sanitizeInput,
  validateAndSanitizeDiscordUrl,
  validateAndSanitizeNtfyTopic,
  validateDiscordWebhookUrl,
  validateNtfyTopicName,
} from '../../../src/services/validation.js';
import { CCNotifyError, ErrorSeverity, ErrorType } from '../../../src/types/index.js';

// Mock the error handler
vi.mock('../../../src/services/error-handler.js', () => ({
  errorHandler: {
    createError: vi.fn(
      (type, message, originalError, severity, context) => new CCNotifyError(type, message, originalError, severity)
    ),
  },
}));

describe('Validation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateDiscordWebhookUrl', () => {
    it('should accept valid Discord webhook URLs', () => {
      const validUrls = [
        'https://discord.com/api/webhooks/123456789/abcdef123456',
        'https://discordapp.com/api/webhooks/987654321/xyz789abc123',
      ];

      validUrls.forEach(url => {
        expect(() => validateDiscordWebhookUrl(url)).not.toThrow();
      });
    });

    it('should reject invalid Discord webhook URLs with enhanced error handling', () => {
      const invalidUrls = [
        'https://example.com/webhook',
        'http://discord.com/api/webhooks/123/abc', // http instead of https
        'https://discord.com/api/webhook/123/abc', // missing 's' in webhooks
        'https://discord.com/webhooks/123/abc', // missing api
        'discord.com/api/webhooks/123/abc', // missing protocol
        '',
        'not-a-url',
      ];

      invalidUrls.forEach(url => {
        expect(() => validateDiscordWebhookUrl(url)).toThrow(CCNotifyError);
        expect(() => validateDiscordWebhookUrl(url)).toThrow(ErrorType.INVALID_WEBHOOK_URL);

        // Verify enhanced error handling was called
        expect(errorHandler.createError).toHaveBeenCalledWith(
          ErrorType.INVALID_WEBHOOK_URL,
          expect.stringContaining('Invalid Discord webhook URL format'),
          undefined,
          ErrorSeverity.MEDIUM,
          expect.objectContaining({
            url: expect.any(String),
            validation: 'format_check',
            pattern: 'discord_webhook_url',
          })
        );
      });
    });

    it('should reject non-string inputs with enhanced error handling', () => {
      const invalidInputs = [null, undefined, 123, {}, []];

      invalidInputs.forEach(input => {
        expect(() => validateDiscordWebhookUrl(input as any)).toThrow(CCNotifyError);
        expect(() => validateDiscordWebhookUrl(input as any)).toThrow(ErrorType.INVALID_WEBHOOK_URL);

        // Verify enhanced error handling was called
        expect(errorHandler.createError).toHaveBeenCalledWith(
          ErrorType.INVALID_WEBHOOK_URL,
          'Discord webhook URL is required and must be a string',
          undefined,
          ErrorSeverity.MEDIUM,
          expect.objectContaining({
            url: typeof input,
            validation: 'required_string_check',
          })
        );
      });
    });

    it('should hide webhook tokens in error context', () => {
      const urlWithToken = 'https://discord.com/api/webhooks/123456789/secret-token-here';

      expect(() => validateDiscordWebhookUrl('invalid-url')).toThrow();

      // The error context should not contain the full URL with token
      expect(errorHandler.createError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        undefined,
        expect.any(String),
        expect.objectContaining({
          url: expect.not.stringContaining('secret-token-here'),
        })
      );
    });
  });

  describe('validateNtfyTopicName', () => {
    it('should accept valid ntfy topic names', () => {
      const validTopics = [
        'my-topic',
        'topic_name',
        'Topic123',
        'a',
        'a'.repeat(64), // 64 characters (max length)
        'valid-topic-name',
        'valid_topic_name',
        'ValidTopicName123',
      ];

      validTopics.forEach(topic => {
        expect(() => validateNtfyTopicName(topic)).not.toThrow();
      });
    });

    it('should reject invalid ntfy topic names with enhanced error handling', () => {
      const invalidTopics = [
        { topic: '', reason: 'empty' },
        { topic: 'a'.repeat(65), reason: 'too long' },
        { topic: 'has spaces', reason: 'contains spaces' },
        { topic: 'has@special!chars', reason: 'special characters' },
        { topic: 'has.dots', reason: 'contains dots' },
        { topic: 'has/slashes', reason: 'contains slashes' },
      ];

      invalidTopics.forEach(({ topic, reason }) => {
        expect(() => validateNtfyTopicName(topic)).toThrow(CCNotifyError);
        expect(() => validateNtfyTopicName(topic)).toThrow(ErrorType.INVALID_TOPIC_NAME);

        // Verify enhanced error handling was called with context
        expect(errorHandler.createError).toHaveBeenCalledWith(
          ErrorType.INVALID_TOPIC_NAME,
          expect.stringContaining('Invalid ntfy topic name'),
          undefined,
          ErrorSeverity.MEDIUM,
          expect.objectContaining({
            topicName: topic,
            validation: 'format_check',
            pattern: 'ntfy_topic_name',
            length: topic.length,
          })
        );
      });
    });

    it('should reject topic names with invalid boundaries', () => {
      const boundaryInvalidTopics = [
        '-starts-with-hyphen',
        '_starts-with-underscore',
        'ends-with-hyphen-',
        'ends-with-underscore_',
      ];

      boundaryInvalidTopics.forEach(topic => {
        expect(() => validateNtfyTopicName(topic)).toThrow(CCNotifyError);

        // Verify boundary check error context
        expect(errorHandler.createError).toHaveBeenCalledWith(
          ErrorType.INVALID_TOPIC_NAME,
          'ntfy topic name cannot start or end with hyphens or underscores',
          undefined,
          ErrorSeverity.MEDIUM,
          expect.objectContaining({
            topicName: topic,
            validation: 'boundary_check',
            startsWithInvalid: expect.any(Boolean),
            endsWithInvalid: expect.any(Boolean),
          })
        );
      });
    });

    it('should reject non-string inputs with enhanced error handling', () => {
      const invalidInputs = [null, undefined, 123, {}, []];

      invalidInputs.forEach(input => {
        expect(() => validateNtfyTopicName(input as any)).toThrow(CCNotifyError);
        expect(() => validateNtfyTopicName(input as any)).toThrow(ErrorType.INVALID_TOPIC_NAME);

        // Verify enhanced error handling was called
        expect(errorHandler.createError).toHaveBeenCalledWith(
          ErrorType.INVALID_TOPIC_NAME,
          'ntfy topic name is required and must be a string',
          undefined,
          ErrorSeverity.MEDIUM,
          expect.objectContaining({
            topicName: typeof input,
            validation: 'required_string_check',
          })
        );
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should remove control characters', () => {
      const input = 'hello\x00\x01world\x7f';
      const result = sanitizeInput(input);
      expect(result).toBe('helloworld');
    });

    it('should preserve newlines and tabs', () => {
      const input = 'hello\nworld\ttab';
      const result = sanitizeInput(input);
      expect(result).toBe('hello\nworld\ttab');
    });

    it('should trim whitespace', () => {
      const input = '  hello world  ';
      const result = sanitizeInput(input);
      expect(result).toBe('hello world');
    });

    it('should limit length to 2048 characters', () => {
      const input = 'a'.repeat(3000);
      const result = sanitizeInput(input);
      expect(result).toHaveLength(2048);
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput(123 as any)).toBe('');
    });

    it('should handle edge cases', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput('   ')).toBe('');
      expect(sanitizeInput('\n\t')).toBe('\n\t');
    });
  });

  describe('validateAndSanitizeDiscordUrl', () => {
    it('should sanitize and validate Discord URLs', () => {
      const input = '  https://discord.com/api/webhooks/123/abc  ';
      const result = validateAndSanitizeDiscordUrl(input);
      expect(result).toBe('https://discord.com/api/webhooks/123/abc');
    });

    it('should throw for invalid URLs after sanitization', () => {
      const input = '  invalid-url  ';
      expect(() => validateAndSanitizeDiscordUrl(input)).toThrow(CCNotifyError);
      expect(() => validateAndSanitizeDiscordUrl(input)).toThrow(ErrorType.INVALID_WEBHOOK_URL);
    });

    it('should handle control characters in URLs', () => {
      const input = 'https://discord.com/api/webhooks/123/abc\x00\x01';
      const result = validateAndSanitizeDiscordUrl(input);
      expect(result).toBe('https://discord.com/api/webhooks/123/abc');
    });
  });

  describe('validateAndSanitizeNtfyTopic', () => {
    it('should sanitize and validate ntfy topics', () => {
      const input = '  valid-topic  ';
      const result = validateAndSanitizeNtfyTopic(input);
      expect(result).toBe('valid-topic');
    });

    it('should throw for invalid topics after sanitization', () => {
      const input = '  -invalid-topic  ';
      expect(() => validateAndSanitizeNtfyTopic(input)).toThrow(CCNotifyError);
      expect(() => validateAndSanitizeNtfyTopic(input)).toThrow(ErrorType.INVALID_TOPIC_NAME);
    });

    it('should handle control characters in topics', () => {
      const input = 'valid-topic\x00\x01';
      const result = validateAndSanitizeNtfyTopic(input);
      expect(result).toBe('valid-topic');
    });

    it('should handle length limits after sanitization', () => {
      const input = 'a'.repeat(70) + '\x00\x01   '; // Over limit with control chars and spaces
      expect(() => validateAndSanitizeNtfyTopic(input)).toThrow(CCNotifyError);
    });
  });

  describe('Error Context and Logging', () => {
    it('should provide detailed context for validation errors', () => {
      const testUrl = 'https://example.com/not-discord';

      expect(() => validateDiscordWebhookUrl(testUrl)).toThrow();

      expect(errorHandler.createError).toHaveBeenCalledWith(
        ErrorType.INVALID_WEBHOOK_URL,
        expect.any(String),
        undefined,
        ErrorSeverity.MEDIUM,
        expect.objectContaining({
          validation: 'format_check',
          pattern: 'discord_webhook_url',
        })
      );
    });

    it('should provide detailed context for topic validation errors', () => {
      const testTopic = 'invalid@topic';

      expect(() => validateNtfyTopicName(testTopic)).toThrow();

      expect(errorHandler.createError).toHaveBeenCalledWith(
        ErrorType.INVALID_TOPIC_NAME,
        expect.any(String),
        undefined,
        ErrorSeverity.MEDIUM,
        expect.objectContaining({
          topicName: testTopic,
          validation: 'format_check',
          pattern: 'ntfy_topic_name',
          length: testTopic.length,
        })
      );
    });
  });
});
