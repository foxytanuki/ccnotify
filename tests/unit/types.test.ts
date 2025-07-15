import { describe, expect, it } from 'vitest';
import {
  CCNotifyError,
  type ClaudeConfig,
  type CommandOptions,
  type DiscordCommandArgs,
  ErrorType,
  type Hook,
  type NtfyCommandArgs,
  type StopHook,
} from '../../src/types';

describe('TypeScript Types', () => {
  describe('ClaudeConfig', () => {
    it('should allow empty configuration', () => {
      const config: ClaudeConfig = {};
      expect(config).toBeDefined();
    });

    it('should allow configuration with hooks', () => {
      const config: ClaudeConfig = {
        hooks: {
          Stop: [
            {
              matcher: '*',
              hooks: [
                {
                  type: 'command',
                  command: 'echo "test"',
                },
              ],
            },
          ],
        },
      };
      expect(config.hooks?.Stop).toHaveLength(1);
    });

    it('should preserve unknown properties', () => {
      const config: ClaudeConfig = {
        someUnknownProperty: 'value',
        hooks: {
          someOtherHook: ['test'],
        },
      };
      expect(config.someUnknownProperty).toBe('value');
      expect(config.hooks?.someOtherHook).toEqual(['test']);
    });
  });

  describe('Hook interfaces', () => {
    it('should create valid StopHook', () => {
      const stopHook: StopHook = {
        matcher: '*',
        hooks: [
          {
            type: 'command',
            command: 'test command',
          },
        ],
      };
      expect(stopHook.matcher).toBe('*');
      expect(stopHook.hooks).toHaveLength(1);
    });

    it('should create valid Hook', () => {
      const hook: Hook = {
        type: 'command',
        command: 'echo "hello"',
      };
      expect(hook.type).toBe('command');
      expect(hook.command).toBe('echo "hello"');
    });
  });

  describe('Command argument types', () => {
    it('should create valid CommandOptions', () => {
      const options: CommandOptions = {
        global: true,
      };
      expect(options.global).toBe(true);
    });

    it('should create valid DiscordCommandArgs', () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
        options: { global: false },
      };
      expect(args.webhookUrl).toContain('discord.com');
      expect(args.options.global).toBe(false);
    });

    it('should create valid NtfyCommandArgs', () => {
      const args: NtfyCommandArgs = {
        topicName: 'my-topic',
        options: { global: true },
      };
      expect(args.topicName).toBe('my-topic');
      expect(args.options.global).toBe(true);
    });
  });

  describe('Error types', () => {
    it('should have all required error types', () => {
      expect(ErrorType.INVALID_WEBHOOK_URL).toBe('INVALID_WEBHOOK_URL');
      expect(ErrorType.INVALID_TOPIC_NAME).toBe('INVALID_TOPIC_NAME');
      expect(ErrorType.FILE_PERMISSION_ERROR).toBe('FILE_PERMISSION_ERROR');
      expect(ErrorType.JSON_PARSE_ERROR).toBe('JSON_PARSE_ERROR');
      expect(ErrorType.CONFIG_BACKUP_ERROR).toBe('CONFIG_BACKUP_ERROR');
    });

    it('should create CCNotifyError with type and message', () => {
      const error = new CCNotifyError(ErrorType.INVALID_WEBHOOK_URL, 'Invalid URL');
      expect(error.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      expect(error.message).toBe('Invalid URL');
      expect(error.name).toBe('CCNotifyError');
      expect(error.originalError).toBeUndefined();
    });

    it('should create CCNotifyError with original error', () => {
      const originalError = new Error('Original error');
      const error = new CCNotifyError(
        ErrorType.JSON_PARSE_ERROR,
        'JSON parsing failed',
        originalError,
      );
      expect(error.type).toBe(ErrorType.JSON_PARSE_ERROR);
      expect(error.message).toBe('JSON parsing failed');
      expect(error.originalError).toBe(originalError);
    });
  });
});
