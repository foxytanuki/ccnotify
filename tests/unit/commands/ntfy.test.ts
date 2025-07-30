import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleNtfyCommand } from '../../../src/commands/ntfy.js';
import * as configModule from '../../../src/services/config.js';
import * as errorHandlerModule from '../../../src/services/error-handler.js';
import * as hooksModule from '../../../src/services/hooks.js';
import * as validationModule from '../../../src/services/validation.js';
import { CCNotifyError, ErrorType, type NtfyCommandArgs } from '../../../src/types/index.js';
import * as fileModule from '../../../src/utils/file.js';

vi.mock('../../../src/services/config.js');
vi.mock('../../../src/services/hooks.js');
vi.mock('../../../src/utils/file.js');
vi.mock('../../../src/services/error-handler.js');
vi.mock('../../../src/services/validation.js');

const mockConfigManager = configModule.configManager;
const mockHookGenerator = hooksModule.hookGenerator;
const mockFileSystemService = fileModule.fileSystemService;

describe('handleNtfyCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks for successful execution
    mockConfigManager.getConfigPath = vi.fn().mockReturnValue('/dummy/path');
    mockConfigManager.backupConfig = vi.fn().mockResolvedValue('/dummy/backup.json');
    mockConfigManager.loadConfig = vi.fn().mockResolvedValue({});
    mockConfigManager.mergeConfig = vi.fn().mockReturnValue({});
    mockConfigManager.saveConfig = vi.fn().mockResolvedValue(undefined);
    mockHookGenerator.generateNtfyHook = vi.fn().mockResolvedValue({ matcher: 'ntfy', hooks: [] });
    mockFileSystemService.fileExists = vi.fn().mockResolvedValue(false);
    mockFileSystemService.ensureDirectory = vi.fn().mockResolvedValue(undefined);
    (validationModule.validateAndSanitizeNtfyTopic as any) = vi.fn().mockImplementation((topic: string) => topic);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful execution', () => {
    it('should create ntfy hook successfully with local config', async () => {
      const args: NtfyCommandArgs = {
        topicName: 'test-topic',
        options: { global: false },
      };

      await handleNtfyCommand(args);

      // Verify the core business logic: hook generation and config saving
      expect(mockHookGenerator.generateNtfyHook).toHaveBeenCalledWith('test-topic', false);
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ ntfy Stop Hook created successfully!');
    });

    it('should create ntfy hook successfully with global config', async () => {
      const args: NtfyCommandArgs = {
        topicName: 'test-topic',
        options: { global: true },
      };

      await handleNtfyCommand(args);

      expect(mockHookGenerator.generateNtfyHook).toHaveBeenCalledWith('test-topic', true);
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✅ ntfy Stop Hook created successfully!');
    });
  });

  describe('error handling', () => {
    it('should handle validation errors', async () => {
      const validationError = new CCNotifyError(ErrorType.INVALID_TOPIC_NAME, 'Invalid topic name');
      (validationModule.validateAndSanitizeNtfyTopic as any).mockImplementation(() => {
        throw validationError;
      });

      const args: NtfyCommandArgs = {
        topicName: 'invalid-topic',
        options: { global: false },
      };

      await expect(handleNtfyCommand(args)).rejects.toThrow(validationError);
    });

    it('should handle configuration loading errors', async () => {
      const configError = new Error('Config file corrupted');
      (mockConfigManager.loadConfig as any).mockRejectedValue(configError);

      // Mock errorHandler.createError to return a CCNotifyError
      vi.spyOn(errorHandlerModule.errorHandler, 'createError').mockImplementation(
        (type, message, originalError) => new CCNotifyError(type, message, originalError)
      );

      const args: NtfyCommandArgs = {
        topicName: 'test-topic',
        options: { global: false },
      };

      await expect(handleNtfyCommand(args)).rejects.toThrow(CCNotifyError);
      await expect(handleNtfyCommand(args)).rejects.toThrow('Failed to create ntfy Stop Hook');
    });
  });
});
