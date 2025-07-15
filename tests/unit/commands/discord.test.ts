import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDiscordCommand } from '../../../src/commands/discord.js';
import { configManager } from '../../../src/services/config.js';
import { hookGenerator } from '../../../src/services/hooks.js';
import { validateAndSanitizeDiscordUrl } from '../../../src/services/validation.js';
import { CCNotifyError, type DiscordCommandArgs, ErrorType } from '../../../src/types/index.js';
import { fileSystemService } from '../../../src/utils/file.js';

// Mock all dependencies
vi.mock('../../../src/services/validation.js');
vi.mock('../../../src/services/config.js');
vi.mock('../../../src/services/hooks.js');
vi.mock('../../../src/utils/file.js');

const mockValidateAndSanitizeDiscordUrl = vi.mocked(validateAndSanitizeDiscordUrl);
const mockConfigManager = vi.mocked(configManager);
const mockHookGenerator = vi.mocked(hookGenerator);
const mockFileSystemService = vi.mocked(fileSystemService);

describe('discord command', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockValidateAndSanitizeDiscordUrl.mockReturnValue(
      'https://discord.com/api/webhooks/123/valid-token',
    );
    mockConfigManager.getConfigPath.mockReturnValue('/test/.claude/settings.json');
    mockConfigManager.loadConfig.mockResolvedValue({});
    mockConfigManager.mergeConfig.mockReturnValue({
      hooks: {
        Stop: [
          {
            matcher: 'discord-notification',
            hooks: [{ type: 'command' as const, command: 'curl command here' }],
          },
        ],
      },
    });
    mockFileSystemService.ensureDirectory.mockResolvedValue();
    mockFileSystemService.fileExists.mockResolvedValue(false);
    mockHookGenerator.generateDiscordHook.mockReturnValue({
      matcher: 'discord-notification',
      hooks: [{ type: 'command' as const, command: 'curl command here' }],
    });
    mockConfigManager.saveConfig.mockResolvedValue();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleDiscordCommand', () => {
    it('should create local Discord hook successfully', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      expect(mockValidateAndSanitizeDiscordUrl).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/test-token',
      );
      expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(false);
      expect(mockFileSystemService.ensureDirectory).toHaveBeenCalledWith('/test/.claude');
      expect(mockConfigManager.loadConfig).toHaveBeenCalledWith('/test/.claude/settings.json');
      expect(mockHookGenerator.generateDiscordHook).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/valid-token',
      );
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ Discord Stop Hook created successfully!');
    });

    it('should create global Discord hook successfully', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/456/global-token',
        options: { global: true },
      };

      await handleDiscordCommand(args);

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Configuration: /test/.claude/settings.json (global)'),
      );
    });

    it('should create backup when config file exists', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockConfigManager.backupConfig.mockResolvedValue('/test/.claude/settings.json.backup');

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      expect(mockConfigManager.backupConfig).toHaveBeenCalledWith('/test/.claude/settings.json');
    });

    it('should not create backup when config file does not exist', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(false);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      expect(mockConfigManager.backupConfig).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const validationError = new CCNotifyError(
        ErrorType.INVALID_WEBHOOK_URL,
        'Invalid webhook URL',
      );
      mockValidateAndSanitizeDiscordUrl.mockImplementation(() => {
        throw validationError;
      });

      const args: DiscordCommandArgs = {
        webhookUrl: 'invalid-url',
        options: { global: false },
      };

      await expect(handleDiscordCommand(args)).rejects.toThrow(validationError);
    });

    it('should handle configuration loading errors', async () => {
      const configError = new CCNotifyError(ErrorType.JSON_PARSE_ERROR, 'Failed to parse config');
      mockConfigManager.loadConfig.mockRejectedValue(configError);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await expect(handleDiscordCommand(args)).rejects.toThrow(configError);
    });

    it('should handle file system errors', async () => {
      const fileError = new Error('Permission denied');
      mockFileSystemService.ensureDirectory.mockRejectedValue(fileError);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await expect(handleDiscordCommand(args)).rejects.toThrow(CCNotifyError);
      await expect(handleDiscordCommand(args)).rejects.toThrow(
        'Failed to create Discord Stop Hook',
      );
    });

    it('should handle configuration saving errors', async () => {
      const saveError = new CCNotifyError(ErrorType.FILE_PERMISSION_ERROR, 'Failed to save config');
      mockConfigManager.saveConfig.mockRejectedValue(saveError);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await expect(handleDiscordCommand(args)).rejects.toThrow(saveError);
    });

    it('should merge configuration correctly with existing hooks', async () => {
      const existingConfig = {
        hooks: {
          Stop: [
            {
              matcher: 'existing-hook',
              hooks: [{ type: 'command' as const, command: 'existing command' }],
            },
          ],
        },
        otherProperty: 'preserved',
      };
      mockConfigManager.loadConfig.mockResolvedValue(existingConfig);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      expect(mockConfigManager.mergeConfig).toHaveBeenCalledWith(existingConfig, {
        hooks: {
          Stop: [
            {
              matcher: 'discord-notification',
              hooks: [{ type: 'command' as const, command: 'curl command here' }],
            },
          ],
        },
      });
    });

    it('should display correct success messages', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/my-secret-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      expect(console.log).toHaveBeenCalledWith('✅ Discord Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith(
        '📁 Configuration: /test/.claude/settings.json (local)',
      );
      expect(console.log).toHaveBeenCalledWith(
        '🔗 Webhook URL: https://discord.com/api/webhooks/123/***',
      );
    });

    it('should hide webhook token in success message', async () => {
      mockValidateAndSanitizeDiscordUrl.mockReturnValue(
        'https://discord.com/api/webhooks/123456789/very-secret-token-here',
      );

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123456789/very-secret-token-here',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      expect(console.log).toHaveBeenCalledWith(
        '🔗 Webhook URL: https://discord.com/api/webhooks/123456789/***',
      );
    });

    it('should handle undefined global option', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: {},
      };

      await handleDiscordCommand(args);

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(false);
    });

    it('should use correct config path for global mode', async () => {
      mockConfigManager.getConfigPath.mockReturnValue('/home/user/.claude/settings.json');

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: true },
      };

      await handleDiscordCommand(args);

      expect(mockFileSystemService.ensureDirectory).toHaveBeenCalledWith('/home/user/.claude');
    });

    it('should handle hook generation errors', async () => {
      const hookError = new Error('Hook generation failed');
      mockHookGenerator.generateDiscordHook.mockImplementation(() => {
        throw hookError;
      });

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await expect(handleDiscordCommand(args)).rejects.toThrow(CCNotifyError);
      await expect(handleDiscordCommand(args)).rejects.toThrow(
        'Failed to create Discord Stop Hook',
      );
    });

    it('should handle backup creation errors', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(true);
      const backupError = new CCNotifyError(ErrorType.CONFIG_BACKUP_ERROR, 'Backup failed');
      mockConfigManager.backupConfig.mockRejectedValue(backupError);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await expect(handleDiscordCommand(args)).rejects.toThrow(backupError);
    });

    it('should preserve existing configuration properties', async () => {
      const existingConfig = {
        someOtherSetting: 'value',
        hooks: {
          Start: [{ matcher: 'start-hook', hooks: [] }],
        },
      };
      mockConfigManager.loadConfig.mockResolvedValue(existingConfig);

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        options: { global: false },
      };

      await handleDiscordCommand(args);

      expect(mockConfigManager.mergeConfig).toHaveBeenCalledWith(
        existingConfig,
        expect.objectContaining({
          hooks: {
            Stop: expect.any(Array),
          },
        }),
      );
    });
  });
});
