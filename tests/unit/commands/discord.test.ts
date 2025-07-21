import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDiscordCommand } from '../../../src/commands/discord.js';
import * as configModule from '../../../src/services/config.js';
import * as errorHandlerModule from '../../../src/services/error-handler.js';
import * as hooksModule from '../../../src/services/hooks.js';
import * as validationModule from '../../../src/services/validation.js';
import { CCNotifyError, type DiscordCommandArgs, ErrorType } from '../../../src/types/index.js';
import * as fileModule from '../../../src/utils/file.js';

vi.mock('../../../src/services/config.js');
vi.mock('../../../src/services/hooks.js');
vi.mock('../../../src/utils/file.js');
vi.mock('../../../src/services/error-handler.js');
vi.mock('../../../src/services/validation.js');

const mockConfigManager = configModule.configManager;
const mockHookGenerator = hooksModule.hookGenerator;
const mockFileSystemService = fileModule.fileSystemService;

describe('handleDiscordCommand unit tests (improved)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all mock functions to default values for normal case
    mockConfigManager.getConfigPath = vi.fn().mockReturnValue('/dummy/path') as ReturnType<typeof vi.fn>;
    mockConfigManager.backupConfig = vi.fn().mockResolvedValue('/dummy/backup.json') as ReturnType<typeof vi.fn>;
    mockConfigManager.loadConfig = vi.fn().mockResolvedValue({}) as ReturnType<typeof vi.fn>;
    mockConfigManager.mergeConfig = vi.fn().mockReturnValue({}) as ReturnType<typeof vi.fn>;
    mockConfigManager.saveConfig = vi.fn().mockResolvedValue(undefined) as ReturnType<typeof vi.fn>;
    mockHookGenerator.generateDiscordHook = vi.fn().mockReturnValue({ matcher: 'discord', hooks: [] }) as ReturnType<
      typeof vi.fn
    >;
    mockFileSystemService.fileExists = vi.fn().mockResolvedValue(false) as ReturnType<typeof vi.fn>;
    mockFileSystemService.ensureDirectory = vi.fn().mockResolvedValue(undefined) as ReturnType<typeof vi.fn>;
    // validation
    (validationModule.validateAndSanitizeDiscordUrl as any) = vi.fn().mockImplementation((url: string) => url);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('input validation logic', () => {
    it('should validate webhook URL using actual validation logic', async () => {
      // mockValidateAndSanitizeDiscordUrlが呼ばれることを検証するため、spyを再取得
      const mockValidateAndSanitizeDiscordUrl = validationModule.validateAndSanitizeDiscordUrl as ReturnType<
        typeof vi.fn
      >;
      mockValidateAndSanitizeDiscordUrl.mockImplementation((url: string) => url);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      expect(mockValidateAndSanitizeDiscordUrl).toHaveBeenCalledWith('https://discord.com/api/webhooks/123/test-token');
    });

    it('should propagate validation errors correctly', async () => {
      const validationError = new CCNotifyError(ErrorType.INVALID_WEBHOOK_URL, 'Invalid webhook URL');
      const mockValidateAndSanitizeDiscordUrl = validationModule.validateAndSanitizeDiscordUrl as ReturnType<
        typeof vi.fn
      >;
      mockValidateAndSanitizeDiscordUrl.mockImplementation(() => {
        throw validationError;
      });

      const args: DiscordCommandArgs = {
        webhookUrl: 'invalid-url',
        options: { global: false },
      };

      await expect(handleDiscordCommand(args)).rejects.toThrow(validationError);
    });
  });

  describe('configuration path decision logic', () => {
    it('should determine local config path when global is false', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      // Ensure config path decision logic works correctly
      expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(false);
    });

    it('should determine global config path when global is true', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: true },
      };

      await handleDiscordCommand(args);

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(true);
    });

    it('should default to local when global option is undefined', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: {},
      };

      await handleDiscordCommand(args);

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(false);
    });
  });

  describe('backup decision logic', () => {
    it('should create backup when config file exists', async () => {
      (mockFileSystemService.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (mockConfigManager.backupConfig as ReturnType<typeof vi.fn>).mockResolvedValue('/test/backup.json');

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      // Ensure backup creation logic works correctly
      expect(mockConfigManager.backupConfig).toHaveBeenCalled();
    });

    it('should not create backup when config file does not exist', async () => {
      (mockFileSystemService.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      // Ensure backup creation logic works correctly (should not be called)
      expect(mockConfigManager.backupConfig).not.toHaveBeenCalled();
    });
  });

  describe('hook generation flow logic', () => {
    it('should generate Discord hook with validated URL', async () => {
      const mockValidateAndSanitizeDiscordUrl = validationModule.validateAndSanitizeDiscordUrl as ReturnType<
        typeof vi.fn
      >;
      mockValidateAndSanitizeDiscordUrl.mockReturnValue('https://discord.com/api/webhooks/123/valid-token');

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      expect(mockHookGenerator.generateDiscordHook).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/valid-token'
      );
    });
  });

  describe('configuration merging logic', () => {
    it('should merge new hook with existing configuration correctly', async () => {
      const existingConfig = { existing: 'data' };
      const newHook = { matcher: 'discord-notification', hooks: [] };

      (mockConfigManager.loadConfig as ReturnType<typeof vi.fn>).mockResolvedValue(existingConfig);
      (mockHookGenerator.generateDiscordHook as ReturnType<typeof vi.fn>).mockReturnValue(newHook);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      // Ensure config merging logic works correctly
      expect(mockConfigManager.mergeConfig).toHaveBeenCalledWith(existingConfig, {
        hooks: {
          Stop: [newHook],
        },
      });
    });
  });

  describe('success message logic', () => {
    it('should display correct success messages for local config', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      // Ensure success message logic works correctly (local config)
      expect(console.log).toHaveBeenCalledWith('✅ Discord Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('(local)'));
    });

    it('should display correct success messages for global config', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: true },
      };

      await handleDiscordCommand(args);

      expect(console.log).toHaveBeenCalledWith('✅ Discord Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('(global)'));
    });

    it('should hide webhook token in success message for security', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123456789/very-secret-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      // Ensure security logic works correctly (hide webhook token)
      expect(console.log).toHaveBeenCalledWith('🔗 Webhook URL: https://discord.com/api/webhooks/123456789/***');
    });
  });

  describe('error handling logic', () => {
    it('should wrap unknown errors with context for better debugging', async () => {
      const unknownError = new Error('Unknown error');
      (mockConfigManager.loadConfig as ReturnType<typeof vi.fn>).mockRejectedValue(unknownError);

      // errorHandler.createErrorを本物のCCNotifyErrorをthrowするようにmock
      vi.spyOn(errorHandlerModule.errorHandler, 'createError').mockImplementation(
        (type, message, originalError) => new CCNotifyError(type, message, originalError)
      );

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await expect(handleDiscordCommand(args)).rejects.toThrow(CCNotifyError);
      await expect(handleDiscordCommand(args)).rejects.toThrow('Failed to create Discord Stop Hook');
    });

    it('should preserve CCNotifyError without wrapping to avoid double wrapping', async () => {
      const ccError = new CCNotifyError(ErrorType.JSON_PARSE_ERROR, 'Config error');
      (mockConfigManager.loadConfig as ReturnType<typeof vi.fn>).mockRejectedValue(ccError);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      // Ensure error handling logic works correctly (preserve CCNotifyError)
      await expect(handleDiscordCommand(args)).rejects.toThrow(ccError);
    });
  });
});
