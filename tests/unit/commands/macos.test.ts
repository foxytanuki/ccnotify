import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMacOSCommand } from '../../../src/commands/macos.js';
import * as configModule from '../../../src/services/config.js';
import * as errorHandlerModule from '../../../src/services/error-handler.js';
import * as hooksModule from '../../../src/services/hooks.js';
import { CCNotifyError, ErrorType, type MacOSCommandArgs } from '../../../src/types/index.js';
import * as fileModule from '../../../src/utils/file.js';

vi.mock('../../../src/services/config.js');
vi.mock('../../../src/services/hooks.js');
vi.mock('../../../src/utils/file.js');
vi.mock('../../../src/services/error-handler.js');

const mockConfigManager = configModule.configManager;
const mockHookGenerator = hooksModule.hookGenerator;
const mockFileSystemService = fileModule.fileSystemService;

describe('handleMacOSCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks for successful execution
    mockConfigManager.getConfigPath = vi.fn().mockReturnValue('/dummy/path');
    mockConfigManager.backupConfig = vi.fn().mockResolvedValue('/dummy/backup.json');
    mockConfigManager.loadConfig = vi.fn().mockResolvedValue({});
    mockConfigManager.mergeConfig = vi.fn().mockReturnValue({});
    mockConfigManager.saveConfig = vi.fn().mockResolvedValue(undefined);
    mockHookGenerator.generateMacOSHook = vi.fn().mockReturnValue({ matcher: 'macos', hooks: [] });
    mockFileSystemService.fileExists = vi.fn().mockResolvedValue(false);
    mockFileSystemService.ensureDirectory = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful execution', () => {
    it('should create macOS hook successfully with local config and default title', async () => {
      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await handleMacOSCommand(args);

      // Verify the core business logic: hook generation and config saving
      expect(mockHookGenerator.generateMacOSHook).toHaveBeenCalledWith(undefined);
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ macOS Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith('🏷️  Title: User message (dynamic)');
    });

    it('should create macOS hook successfully with global config and custom title', async () => {
      const args: MacOSCommandArgs = {
        title: 'Custom Title',
        options: { global: true },
      };

      await handleMacOSCommand(args);

      expect(mockHookGenerator.generateMacOSHook).toHaveBeenCalledWith('Custom Title');
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ macOS Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith('🏷️  Custom title: Custom Title');
    });
  });

  describe('title handling', () => {
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
  });

  describe('error handling', () => {
    it('should handle configuration loading errors', async () => {
      const configError = new Error('Config file corrupted');
      (mockConfigManager.loadConfig as any).mockRejectedValue(configError);

      // Mock errorHandler.createError to return a CCNotifyError
      vi.spyOn(errorHandlerModule.errorHandler, 'createError').mockImplementation(
        (type, message, originalError) => new CCNotifyError(type, message, originalError)
      );

      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await expect(handleMacOSCommand(args)).rejects.toThrow(CCNotifyError);
      await expect(handleMacOSCommand(args)).rejects.toThrow('Failed to create macOS Stop Hook');
    });
  });
});
