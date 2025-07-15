import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMacOSCommand } from '../../../src/commands/macos.js';
import { configManager } from '../../../src/services/config.js';
import { hookGenerator } from '../../../src/services/hooks.js';
import { CCNotifyError, type MacOSCommandArgs, ErrorType } from '../../../src/types/index.js';
import { fileSystemService } from '../../../src/utils/file.js';

// Mock all dependencies
vi.mock('../../../src/services/config.js');
vi.mock('../../../src/services/hooks.js');
vi.mock('../../../src/utils/file.js');

const mockConfigManager = vi.mocked(configManager);
const mockHookGenerator = vi.mocked(hookGenerator);
const mockFileSystemService = vi.mocked(fileSystemService);

describe('macos command', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockConfigManager.getConfigPath.mockReturnValue('/test/.claude/settings.json');
    mockConfigManager.loadConfig.mockResolvedValue({});
    mockConfigManager.mergeConfig.mockReturnValue({
      hooks: {
        Stop: [
          {
            matcher: 'macos-notification',
            hooks: [{ type: 'command' as const, command: 'osascript command here' }],
          },
        ],
      },
    });
    mockFileSystemService.ensureDirectory.mockResolvedValue();
    mockFileSystemService.fileExists.mockResolvedValue(false);
    mockHookGenerator.generateMacOSHook.mockReturnValue({
      matcher: 'macos-notification',
      hooks: [{ type: 'command' as const, command: 'osascript command here' }],
    });
    mockConfigManager.saveConfig.mockResolvedValue();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleMacOSCommand', () => {
    it('should create local macOS hook successfully without title', async () => {
      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(false);
      expect(mockFileSystemService.ensureDirectory).toHaveBeenCalledWith('/test/.claude');
      expect(mockConfigManager.loadConfig).toHaveBeenCalledWith('/test/.claude/settings.json');
      expect(mockHookGenerator.generateMacOSHook).toHaveBeenCalledWith(undefined);
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ macOS Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith('🏷️  Title: User message (dynamic)');
    });

    it('should create local macOS hook successfully with custom title', async () => {
      const args: MacOSCommandArgs = {
        title: 'Custom Notification Title',
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(mockHookGenerator.generateMacOSHook).toHaveBeenCalledWith('Custom Notification Title');
      expect(console.log).toHaveBeenCalledWith('✅ macOS Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith('🏷️  Custom title: Custom Notification Title');
    });

    it('should create global macOS hook successfully', async () => {
      mockConfigManager.getConfigPath.mockReturnValue('/home/user/.claude/settings.json');

      const args: MacOSCommandArgs = {
        options: { global: true },
      };

      await handleMacOSCommand(args);

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(true);
      expect(mockFileSystemService.ensureDirectory).toHaveBeenCalledWith('/home/user/.claude');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Configuration: /home/user/.claude/settings.json (global)'),
      );
    });

    it('should create backup when config file exists', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockConfigManager.backupConfig.mockResolvedValue('/test/.claude/settings.json.backup');

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(mockConfigManager.backupConfig).toHaveBeenCalledWith('/test/.claude/settings.json');
    });

    it('should not create backup when config file does not exist', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(false);

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(mockConfigManager.backupConfig).not.toHaveBeenCalled();
    });

    it('should handle configuration loading errors', async () => {
      const configError = new CCNotifyError(ErrorType.JSON_PARSE_ERROR, 'Failed to parse config');
      mockConfigManager.loadConfig.mockRejectedValue(configError);

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await expect(handleMacOSCommand(args)).rejects.toThrow(configError);
    });

    it('should handle file system errors', async () => {
      const fileError = new Error('Permission denied');
      mockFileSystemService.ensureDirectory.mockRejectedValue(fileError);

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await expect(handleMacOSCommand(args)).rejects.toThrow(CCNotifyError);
      // The error message will be from the wrapped file system error, not the outer catch
      await expect(handleMacOSCommand(args)).rejects.toThrow(
        'Failed to create configuration directory',
      );
    });

    it('should handle configuration saving errors', async () => {
      const saveError = new CCNotifyError(ErrorType.FILE_PERMISSION_ERROR, 'Failed to save config');
      mockConfigManager.saveConfig.mockRejectedValue(saveError);

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await expect(handleMacOSCommand(args)).rejects.toThrow(saveError);
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

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(mockConfigManager.mergeConfig).toHaveBeenCalledWith(existingConfig, {
        hooks: {
          Stop: [
            {
              matcher: 'macos-notification',
              hooks: [{ type: 'command' as const, command: 'osascript command here' }],
            },
          ],
        },
      });
    });

    it('should display correct success messages for local configuration', async () => {
      const args: MacOSCommandArgs = {
        title: 'Test Title',
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(console.log).toHaveBeenCalledWith('✅ macOS Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith(
        '📁 Configuration: /test/.claude/settings.json (local)',
      );
      expect(console.log).toHaveBeenCalledWith('🏷️  Custom title: Test Title');
    });

    it('should display correct success messages for global configuration', async () => {
      mockConfigManager.getConfigPath.mockReturnValue('/home/user/.claude/settings.json');

      const args: MacOSCommandArgs = {
        options: { global: true },
      };

      await handleMacOSCommand(args);

      expect(console.log).toHaveBeenCalledWith('✅ macOS Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith(
        '📁 Configuration: /home/user/.claude/settings.json (global)',
      );
      expect(console.log).toHaveBeenCalledWith('🏷️  Title: User message (dynamic)');
    });

    it('should handle undefined global option', async () => {
      const args: MacOSCommandArgs = {
        options: {},
      };

      await handleMacOSCommand(args);

      expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(false);
    });

    it('should handle hook generation errors', async () => {
      const hookError = new Error('Hook generation failed');
      mockHookGenerator.generateMacOSHook.mockImplementation(() => {
        throw hookError;
      });

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await expect(handleMacOSCommand(args)).rejects.toThrow(CCNotifyError);
      await expect(handleMacOSCommand(args)).rejects.toThrow(
        'Failed to create macOS Stop Hook',
      );
    });

    it('should handle backup creation errors', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(true);
      const backupError = new CCNotifyError(ErrorType.CONFIG_BACKUP_ERROR, 'Backup failed');
      mockConfigManager.backupConfig.mockRejectedValue(backupError);

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await expect(handleMacOSCommand(args)).rejects.toThrow(backupError);
    });

    it('should preserve existing configuration properties', async () => {
      const existingConfig = {
        someOtherSetting: 'value',
        hooks: {
          Start: [{ matcher: 'start-hook', hooks: [] }],
        },
      };
      mockConfigManager.loadConfig.mockResolvedValue(existingConfig);

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(mockConfigManager.mergeConfig).toHaveBeenCalledWith(
        existingConfig,
        expect.objectContaining({
          hooks: {
            Stop: expect.any(Array),
          },
        }),
      );
    });

    it('should handle empty title string', async () => {
      const args: MacOSCommandArgs = {
        title: '',
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(mockHookGenerator.generateMacOSHook).toHaveBeenCalledWith('');
      expect(console.log).toHaveBeenCalledWith('🏷️  Custom title: ');
    });

    it('should handle title with special characters', async () => {
      const args: MacOSCommandArgs = {
        title: 'Title with "quotes" and \'apostrophes\'',
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(mockHookGenerator.generateMacOSHook).toHaveBeenCalledWith('Title with "quotes" and \'apostrophes\'');
      expect(console.log).toHaveBeenCalledWith('🏷️  Custom title: Title with "quotes" and \'apostrophes\'');
    });

    it('should handle very long title', async () => {
      const longTitle = 'A'.repeat(500);
      const args: MacOSCommandArgs = {
        title: longTitle,
        options: { global: false },
      };

      await handleMacOSCommand(args);

      expect(mockHookGenerator.generateMacOSHook).toHaveBeenCalledWith(longTitle);
      expect(console.log).toHaveBeenCalledWith(`🏷️  Custom title: ${longTitle}`);
    });
  });
});