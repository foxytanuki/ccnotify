import { describe, expect, it } from 'vitest';
import { validateAndSanitizeDiscordUrl } from '../../../src/services/validation.js';
import { CCNotifyError, ErrorType } from '../../../src/types/index.js';

describe('validateAndSanitizeDiscordUrl', () => {
  describe('valid Discord webhook URLs', () => {
    it('should accept standard Discord webhook URL', () => {
      const url = 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });

    it('should accept Discord app webhook URL', () => {
      const url = 'https://discordapp.com/api/webhooks/123456789/abcdefghijklmnop';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });

    it('should accept webhook URL with hyphens in token', () => {
      const url = 'https://discord.com/api/webhooks/123456789/abc-def-ghi-jkl';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });

    it('should accept webhook URL with underscores in token', () => {
      const url = 'https://discord.com/api/webhooks/123456789/abc_def_ghi_jkl';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });

    it('should sanitize input by trimming whitespace', () => {
      const url = '  https://discord.com/api/webhooks/123456789/abcdefghijklmnop  ';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe('https://discord.com/api/webhooks/123456789/abcdefghijklmnop');
    });

    it('should remove control characters from input', () => {
      const url = 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop\x00\x01';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe('https://discord.com/api/webhooks/123456789/abcdefghijklmnop');
    });

    it('should truncate extremely long URLs', () => {
      const longToken = 'a'.repeat(3000);
      const url = `https://discord.com/api/webhooks/123456789/${longToken}`;
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result.length).toBeLessThanOrEqual(2048);
      expect(result).toMatch(/^https:\/\/discord\.com\/api\/webhooks\/123456789\/a+$/);
    });
  });

  describe('invalid Discord webhook URLs', () => {
    it('should reject empty string', () => {
      try {
        validateAndSanitizeDiscordUrl('');
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject null input', () => {
      try {
        validateAndSanitizeDiscordUrl(null as any);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject non-string input', () => {
      try {
        validateAndSanitizeDiscordUrl(123 as any);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
      try {
        validateAndSanitizeDiscordUrl({} as any);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject HTTP URLs', () => {
      const url = 'http://discord.com/api/webhooks/123456789/abcdefghijklmnop';
      try {
        validateAndSanitizeDiscordUrl(url);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject non-Discord URLs', () => {
      const url = 'https://example.com/api/webhooks/123456789/abcdefghijklmnop';
      try {
        validateAndSanitizeDiscordUrl(url);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject URLs without webhook path', () => {
      const url = 'https://discord.com/api/123456789/abcdefghijklmnop';
      try {
        validateAndSanitizeDiscordUrl(url);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject URLs with non-numeric webhook ID', () => {
      const url = 'https://discord.com/api/webhooks/abc123/abcdefghijklmnop';
      try {
        validateAndSanitizeDiscordUrl(url);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject URLs with empty token', () => {
      const url = 'https://discord.com/api/webhooks/123456789/';
      try {
        validateAndSanitizeDiscordUrl(url);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject URLs with invalid characters in token', () => {
      const url = 'https://discord.com/api/webhooks/123456789/abc@def#ghi';
      try {
        validateAndSanitizeDiscordUrl(url);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject URLs with extra path segments', () => {
      const url = 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop/extra';
      try {
        validateAndSanitizeDiscordUrl(url);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject URLs with query parameters', () => {
      const url = 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop?param=value';
      try {
        validateAndSanitizeDiscordUrl(url);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });

    it('should reject URLs with fragments', () => {
      const url = 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop#fragment';
      try {
        validateAndSanitizeDiscordUrl(url);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect(err.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle minimum valid webhook ID', () => {
      const url = 'https://discord.com/api/webhooks/1/abcdefghijklmnop';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });

    it('should handle maximum valid webhook ID', () => {
      const url = 'https://discord.com/api/webhooks/999999999999999999/abcdefghijklmnop';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });

    it('should handle minimum valid token length', () => {
      const url = 'https://discord.com/api/webhooks/123456789/a';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });

    it('should handle maximum valid token length', () => {
      const longToken = 'a'.repeat(100);
      const url = `https://discord.com/api/webhooks/123456789/${longToken}`;
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });

    it('should handle mixed case in token', () => {
      const url = 'https://discord.com/api/webhooks/123456789/AbCdEfGhIjKlMnOp';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });

    it('should handle numbers in token', () => {
      const url = 'https://discord.com/api/webhooks/123456789/abc123def456';
      const result = validateAndSanitizeDiscordUrl(url);
      expect(result).toBe(url);
    });
  });
});
