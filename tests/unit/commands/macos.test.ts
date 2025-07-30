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
    mockHookGenerator.generateMacOSHook = vi.fn().mockResolvedValue({ matcher: 'macos', hooks: [] });
    mockFileSystemService.fileExists = vi.fn().mockResolvedValue(false);
    mockFileSystemService.ensureDirectory = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful execution', () => {
    it('should create macOS hook successfully without title', async () => {
      const args: MacOSCommandArgs = {
        options: { global: false },
      };

      await handleMacOSCommand(args);

      // Verify the core business logic: hook generation and config saving
      expect(mockHookGenerator.generateMacOSHook).toHaveBeenCalledWith(undefined, false);
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ macOS Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith('🏷️  Title: Claude Code');
    });

    it('should create macOS hook successfully with title', async () => {
      const args: MacOSCommandArgs = {
        title: 'GLOBAL',
        options: { global: true },
      };

      await handleMacOSCommand(args);

      expect(mockHookGenerator.generateMacOSHook).toHaveBeenCalledWith('GLOBAL', true);
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ macOS Stop Hook created successfully!');
      expect(console.log).toHaveBeenCalledWith('🏷️  Title: GLOBAL');
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
