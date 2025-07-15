import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigManagerImpl } from '../../../src/services/config.js';
import { CCNotifyError, type ClaudeConfig } from '../../../src/types/index.js';
import { fileSystemService, fileUtils } from '../../../src/utils/file.js';

// Mock the file utilities
vi.mock('../../../src/utils/file.js', () => ({
  fileSystemService: {
    fileExists: vi.fn(),
    createBackup: vi.fn(),
  },
  fileUtils: {
    readJsonFile: vi.fn(),
    safeWriteJsonFile: vi.fn(),
  },
}));

describe('ConfigManagerImpl', () => {
  let configManager: ConfigManagerImpl;

  beforeEach(() => {
    configManager = new ConfigManagerImpl();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadConfig', () => {
    it('should return empty config when file does not exist', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(false);

      const result = await configManager.loadConfig('/path/to/config.json');

      expect(result).toEqual({});
      expect(fileSystemService.fileExists).toHaveBeenCalledWith('/path/to/config.json');
    });

    it('should load and validate existing config', async () => {
      const mockConfig: ClaudeConfig = {
        hooks: {
          Stop: [
            {
              matcher: 'test',
              hooks: [{ type: 'command', command: 'echo test' }],
            },
          ],
        },
      };

      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue(mockConfig);

      const result = await configManager.loadConfig('/path/to/config.json');

      expect(result).toEqual(mockConfig);
      expect(fileUtils.readJsonFile).toHaveBeenCalledWith('/path/to/config.json');
    });

    it('should throw CCNotifyError when JSON parsing fails', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockRejectedValue(new Error('Parse error'));

      await expect(configManager.loadConfig('/path/to/config.json')).rejects.toThrow(CCNotifyError);
    });

    it('should validate config structure and throw on invalid config', async () => {
      const invalidConfig = {
        hooks: {
          Stop: 'invalid', // Should be array
        },
      };

      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue(invalidConfig);

      await expect(configManager.loadConfig('/path/to/config.json')).rejects.toThrow(CCNotifyError);
    });
  });

  describe('saveConfig', () => {
    it('should save valid config using safe write', async () => {
      const config: ClaudeConfig = {
        hooks: {
          Stop: [
            {
              matcher: 'test',
              hooks: [{ type: 'command', command: 'echo test' }],
            },
          ],
        },
      };

      vi.mocked(fileUtils.safeWriteJsonFile).mockResolvedValue();

      await configManager.saveConfig('/path/to/config.json', config);

      expect(fileUtils.safeWriteJsonFile).toHaveBeenCalledWith('/path/to/config.json', config);
    });

    it('should throw CCNotifyError when validation fails', async () => {
      const invalidConfig = {
        hooks: {
          Stop: 'invalid',
        },
      } as any;

      await expect(configManager.saveConfig('/path/to/config.json', invalidConfig)).rejects.toThrow(
        CCNotifyError,
      );
    });

    it('should throw CCNotifyError when file write fails', async () => {
      const config: ClaudeConfig = {};
      vi.mocked(fileUtils.safeWriteJsonFile).mockRejectedValue(new Error('Write error'));

      await expect(configManager.saveConfig('/path/to/config.json', config)).rejects.toThrow(
        CCNotifyError,
      );
    });
  });

  describe('backupConfig', () => {
    it('should create backup using file system service', async () => {
      const backupPath = '/path/to/config.json.backup.2023-01-01T00-00-00-000Z';
      vi.mocked(fileSystemService.createBackup).mockResolvedValue(backupPath);

      const result = await configManager.backupConfig('/path/to/config.json');

      expect(result).toBe(backupPath);
      expect(fileSystemService.createBackup).toHaveBeenCalledWith('/path/to/config.json');
    });

    it('should throw CCNotifyError when backup fails', async () => {
      vi.mocked(fileSystemService.createBackup).mockRejectedValue(new Error('Backup error'));

      await expect(configManager.backupConfig('/path/to/config.json')).rejects.toThrow(
        CCNotifyError,
      );
    });
  });

  describe('getConfigPath', () => {
    it('should return global path when isGlobal is true', () => {
      const result = configManager.getConfigPath(true);
      const expected = join(homedir(), '.claude', 'settings.json');

      expect(result).toBe(expected);
    });

    it('should return local path when isGlobal is false', () => {
      const result = configManager.getConfigPath(false);
      const expected = join(process.cwd(), '.claude', 'settings.json');

      expect(result).toBe(expected);
    });
  });

  describe('mergeConfig', () => {
    it('should merge simple properties', () => {
      const existing: ClaudeConfig = {
        existingProp: 'value1',
      };

      const updates: Partial<ClaudeConfig> = {
        newProp: 'value2',
      };

      const result = configManager.mergeConfig(existing, updates);

      expect(result).toEqual({
        existingProp: 'value1',
        newProp: 'value2',
      });
    });

    it('should merge hooks preserving existing ones', () => {
      const existing: ClaudeConfig = {
        hooks: {
          Stop: [
            {
              matcher: 'existing',
              hooks: [{ type: 'command', command: 'existing command' }],
            },
          ],
          Start: [],
        },
      };

      const updates: Partial<ClaudeConfig> = {
        hooks: {
          Stop: [
            {
              matcher: 'new',
              hooks: [{ type: 'command', command: 'new command' }],
            },
          ],
        },
      };

      const result = configManager.mergeConfig(existing, updates);

      expect(result.hooks?.Stop).toHaveLength(2);
      expect(result.hooks?.Stop?.[0].matcher).toBe('existing');
      expect(result.hooks?.Stop?.[1].matcher).toBe('new');
      expect(result.hooks?.Start).toEqual([]);
    });

    it('should replace existing hook with same matcher', () => {
      const existing: ClaudeConfig = {
        hooks: {
          Stop: [
            {
              matcher: 'test',
              hooks: [{ type: 'command', command: 'old command' }],
            },
          ],
        },
      };

      const updates: Partial<ClaudeConfig> = {
        hooks: {
          Stop: [
            {
              matcher: 'test',
              hooks: [{ type: 'command', command: 'new command' }],
            },
          ],
        },
      };

      const result = configManager.mergeConfig(existing, updates);

      expect(result.hooks?.Stop).toHaveLength(1);
      expect(result.hooks?.Stop?.[0].hooks[0].command).toBe('new command');
    });

    it('should create hooks structure if it does not exist', () => {
      const existing: ClaudeConfig = {};

      const updates: Partial<ClaudeConfig> = {
        hooks: {
          Stop: [
            {
              matcher: 'test',
              hooks: [{ type: 'command', command: 'test command' }],
            },
          ],
        },
      };

      const result = configManager.mergeConfig(existing, updates);

      expect(result.hooks?.Stop).toHaveLength(1);
      expect(result.hooks?.Stop?.[0].matcher).toBe('test');
    });

    it('should not mutate original config', () => {
      const existing: ClaudeConfig = {
        hooks: {
          Stop: [],
        },
      };

      const updates: Partial<ClaudeConfig> = {
        hooks: {
          Stop: [
            {
              matcher: 'test',
              hooks: [{ type: 'command', command: 'test command' }],
            },
          ],
        },
      };

      configManager.mergeConfig(existing, updates);

      // Original should remain unchanged
      expect(existing.hooks?.Stop).toHaveLength(0);
    });
  });

  describe('config validation', () => {
    it('should accept valid empty config', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue({});

      const result = await configManager.loadConfig('/path/to/config.json');
      expect(result).toEqual({});
    });

    it('should accept valid config with hooks', async () => {
      const validConfig: ClaudeConfig = {
        hooks: {
          Stop: [
            {
              matcher: 'test',
              hooks: [{ type: 'command', command: 'echo test' }],
            },
          ],
        },
        otherProperty: 'value',
      };

      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue(validConfig);

      const result = await configManager.loadConfig('/path/to/config.json');
      expect(result).toEqual(validConfig);
    });

    it('should reject null config', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue(null);

      await expect(configManager.loadConfig('/path/to/config.json')).rejects.toThrow(
        'Configuration cannot be null or undefined',
      );
    });

    it('should reject non-object config', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue('string config');

      await expect(configManager.loadConfig('/path/to/config.json')).rejects.toThrow(
        'Configuration must be an object',
      );
    });

    it('should reject invalid hooks structure', async () => {
      const invalidConfig = {
        hooks: 'not an object',
      };

      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue(invalidConfig);

      await expect(configManager.loadConfig('/path/to/config.json')).rejects.toThrow(
        'hooks property must be an object',
      );
    });

    it('should reject invalid Stop hooks array', async () => {
      const invalidConfig = {
        hooks: {
          Stop: 'not an array',
        },
      };

      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue(invalidConfig);

      await expect(configManager.loadConfig('/path/to/config.json')).rejects.toThrow(
        'hooks.Stop must be an array',
      );
    });

    it('should reject Stop hook without matcher', async () => {
      const invalidConfig = {
        hooks: {
          Stop: [
            {
              hooks: [{ type: 'command', command: 'test' }],
            },
          ],
        },
      };

      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue(invalidConfig);

      await expect(configManager.loadConfig('/path/to/config.json')).rejects.toThrow(
        'Stop hook at index 0 must have a string matcher',
      );
    });

    it('should reject Stop hook with invalid hook type', async () => {
      const invalidConfig = {
        hooks: {
          Stop: [
            {
              matcher: 'test',
              hooks: [{ type: 'invalid', command: 'test' }],
            },
          ],
        },
      };

      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue(invalidConfig);

      await expect(configManager.loadConfig('/path/to/config.json')).rejects.toThrow(
        "Hook at index 0.0 must have type 'command'",
      );
    });

    it('should reject Stop hook without command', async () => {
      const invalidConfig = {
        hooks: {
          Stop: [
            {
              matcher: 'test',
              hooks: [{ type: 'command' }],
            },
          ],
        },
      };

      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(fileUtils.readJsonFile).mockResolvedValue(invalidConfig);

      await expect(configManager.loadConfig('/path/to/config.json')).rejects.toThrow(
        'Hook at index 0.0 must have a string command',
      );
    });
  });
});
