import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PathResolverImpl, pathResolver, pathUtils } from '../../../src/utils/paths.js';
import { CCNotifyError, ErrorType } from '../../../src/types/index.js';
import { fileSystemService } from '../../../src/utils/file.js';

// Mock the file system service
vi.mock('../../../src/utils/file.js', () => ({
  fileSystemService: {
    fileExists: vi.fn(),
    ensureDirectory: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// Mock node:fs for stat operations
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      stat: vi.fn(),
      unlink: vi.fn(),
    },
  };
});

// Mock node:os
vi.mock('node:os', () => ({
  homedir: vi.fn(),
}));

describe('PathResolverImpl', () => {
  let resolver: PathResolverImpl;
  const mockHomedir = '/home/testuser';
  const mockCwd = '/current/working/dir';

  beforeEach(() => {
    resolver = new PathResolverImpl();
    vi.mocked(homedir).mockReturnValue(mockHomedir);
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConfigPath', () => {
    it('should return local config path when isGlobal is false', () => {
      const result = resolver.getConfigPath(false);
      expect(result).toBe(join(mockCwd, '.claude', 'settings.json'));
    });

    it('should return global config path when isGlobal is true', () => {
      const result = resolver.getConfigPath(true);
      expect(result).toBe(join(mockHomedir, '.claude', 'settings.json'));
    });
  });

  describe('getConfigDirectory', () => {
    it('should return local config directory when isGlobal is false', () => {
      const result = resolver.getConfigDirectory(false);
      expect(result).toBe(join(mockCwd, '.claude'));
    });

    it('should return global config directory when isGlobal is true', () => {
      const result = resolver.getConfigDirectory(true);
      expect(result).toBe(join(mockHomedir, '.claude'));
    });
  });

  describe('getScriptPath', () => {
    it('should return local script path when isGlobal is false', () => {
      const result = resolver.getScriptPath(false, 'ntfy.sh');
      expect(result).toBe(join(mockCwd, '.claude', 'ntfy.sh'));
    });

    it('should return global script path when isGlobal is true', () => {
      const result = resolver.getScriptPath(true, 'ntfy.sh');
      expect(result).toBe(join(mockHomedir, '.claude', 'ntfy.sh'));
    });
  });

  describe('getHomeDirectory', () => {
    it('should return home directory from os.homedir()', () => {
      const result = resolver.getHomeDirectory();
      expect(result).toBe(mockHomedir);
      expect(homedir).toHaveBeenCalled();
    });

    it('should throw CCNotifyError when homedir returns empty string', () => {
      vi.mocked(homedir).mockReturnValue('');
      
      expect(() => resolver.getHomeDirectory()).toThrow(CCNotifyError);
      expect(() => resolver.getHomeDirectory()).toThrow('Unable to determine home directory');
    });

    it('should throw CCNotifyError when homedir throws error', () => {
      vi.mocked(homedir).mockImplementation(() => {
        throw new Error('OS error');
      });
      
      expect(() => resolver.getHomeDirectory()).toThrow(CCNotifyError);
      expect(() => resolver.getHomeDirectory()).toThrow('Failed to get home directory');
    });
  });

  describe('validateDirectoryPath', () => {
    it('should return true for valid existing directory', async () => {
      const mockStat = await import('node:fs').then(fs => fs.promises.stat);
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(mockStat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fileSystemService.ensureDirectory).mockResolvedValue();
      vi.mocked(fileSystemService.writeFile).mockResolvedValue();
      
      const mockUnlink = await import('node:fs').then(fs => fs.promises.unlink);
      vi.mocked(mockUnlink).mockResolvedValue();

      const result = await resolver.validateDirectoryPath('/valid/path');
      expect(result).toBe(true);
    });

    it('should return false when path exists but is not a directory', async () => {
      const mockStat = await import('node:fs').then(fs => fs.promises.stat);
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(true);
      vi.mocked(mockStat).mockResolvedValue({ isDirectory: () => false } as any);

      const result = await resolver.validateDirectoryPath('/file/path');
      expect(result).toBe(false);
    });

    it('should return true for non-existing path that can be created', async () => {
      vi.mocked(fileSystemService.fileExists)
        .mockResolvedValueOnce(false) // Directory doesn't exist
        .mockResolvedValueOnce(false); // Test file doesn't exist after cleanup
      vi.mocked(fileSystemService.ensureDirectory).mockResolvedValue();
      vi.mocked(fileSystemService.writeFile).mockResolvedValue();
      
      const mockUnlink = await import('node:fs').then(fs => fs.promises.unlink);
      vi.mocked(mockUnlink).mockResolvedValue();

      const result = await resolver.validateDirectoryPath('/new/path');
      expect(result).toBe(true);
    });

    it('should return false when write test fails', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(false);
      vi.mocked(fileSystemService.ensureDirectory).mockResolvedValue();
      vi.mocked(fileSystemService.writeFile).mockRejectedValue(new Error('Permission denied'));

      const result = await resolver.validateDirectoryPath('/readonly/path');
      expect(result).toBe(false);
    });

    it('should return false when directory creation fails', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(false);
      vi.mocked(fileSystemService.ensureDirectory).mockRejectedValue(new Error('Permission denied'));

      const result = await resolver.validateDirectoryPath('/invalid/path');
      expect(result).toBe(false);
    });
  });

  describe('ensureConfigDirectory', () => {
    it('should create and return local config directory', async () => {
      vi.mocked(fileSystemService.fileExists)
        .mockResolvedValueOnce(false) // Directory doesn't exist
        .mockResolvedValueOnce(false); // Test file cleanup
      vi.mocked(fileSystemService.ensureDirectory).mockResolvedValue();
      vi.mocked(fileSystemService.writeFile).mockResolvedValue();
      
      const mockUnlink = await import('node:fs').then(fs => fs.promises.unlink);
      vi.mocked(mockUnlink).mockResolvedValue();

      const result = await resolver.ensureConfigDirectory(false);
      expect(result).toBe(join(mockCwd, '.claude'));
      expect(fileSystemService.ensureDirectory).toHaveBeenCalledWith(join(mockCwd, '.claude'));
    });

    it('should create and return global config directory', async () => {
      vi.mocked(fileSystemService.fileExists)
        .mockResolvedValueOnce(false) // Directory doesn't exist
        .mockResolvedValueOnce(false); // Test file cleanup
      vi.mocked(fileSystemService.ensureDirectory).mockResolvedValue();
      vi.mocked(fileSystemService.writeFile).mockResolvedValue();
      
      const mockUnlink = await import('node:fs').then(fs => fs.promises.unlink);
      vi.mocked(mockUnlink).mockResolvedValue();

      const result = await resolver.ensureConfigDirectory(true);
      expect(result).toBe(join(mockHomedir, '.claude'));
      expect(fileSystemService.ensureDirectory).toHaveBeenCalledWith(join(mockHomedir, '.claude'));
    });

    it('should throw CCNotifyError when directory validation fails', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(false);
      vi.mocked(fileSystemService.ensureDirectory).mockRejectedValue(new Error('Permission denied'));

      await expect(resolver.ensureConfigDirectory(false)).rejects.toThrow(CCNotifyError);
      await expect(resolver.ensureConfigDirectory(false)).rejects.toThrow('Cannot access or create configuration directory');
    });

    it('should throw CCNotifyError when directory creation fails', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(false);
      vi.mocked(fileSystemService.ensureDirectory).mockRejectedValue(new Error('Permission denied'));

      await expect(resolver.ensureConfigDirectory(false)).rejects.toThrow(CCNotifyError);
      await expect(resolver.ensureConfigDirectory(false)).rejects.toThrow('Cannot access or create configuration directory');
    });
  });
});

describe('pathResolver (default instance)', () => {
  beforeEach(() => {
    vi.mocked(homedir).mockReturnValue('/home/testuser');
    vi.spyOn(process, 'cwd').mockReturnValue('/current/working/dir');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be an instance of PathResolverImpl', () => {
    expect(pathResolver).toBeInstanceOf(PathResolverImpl);
  });

  it('should provide the same functionality as PathResolverImpl', () => {
    const result = pathResolver.getConfigPath(false);
    expect(result).toBe(join('/current/working/dir', '.claude', 'settings.json'));
  });
});

describe('pathUtils', () => {
  beforeEach(() => {
    vi.mocked(homedir).mockReturnValue('/home/testuser');
    vi.spyOn(process, 'cwd').mockReturnValue('/current/working/dir');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getValidatedConfigPath', () => {
    it('should return config path after ensuring directory exists', async () => {
      vi.mocked(fileSystemService.fileExists)
        .mockResolvedValueOnce(false) // Directory doesn't exist
        .mockResolvedValueOnce(false); // Test file cleanup
      vi.mocked(fileSystemService.ensureDirectory).mockResolvedValue();
      vi.mocked(fileSystemService.writeFile).mockResolvedValue();
      
      const mockUnlink = await import('node:fs').then(fs => fs.promises.unlink);
      vi.mocked(mockUnlink).mockResolvedValue();

      const result = await pathUtils.getValidatedConfigPath(false);
      expect(result).toBe(join('/current/working/dir', '.claude', 'settings.json'));
    });
  });

  describe('getValidatedScriptPath', () => {
    it('should return script path after ensuring directory exists', async () => {
      vi.mocked(fileSystemService.fileExists)
        .mockResolvedValueOnce(false) // Directory doesn't exist
        .mockResolvedValueOnce(false); // Test file cleanup
      vi.mocked(fileSystemService.ensureDirectory).mockResolvedValue();
      vi.mocked(fileSystemService.writeFile).mockResolvedValue();
      
      const mockUnlink = await import('node:fs').then(fs => fs.promises.unlink);
      vi.mocked(mockUnlink).mockResolvedValue();

      const result = await pathUtils.getValidatedScriptPath(true, 'ntfy.sh');
      expect(result).toBe(join('/home/testuser', '.claude', 'ntfy.sh'));
    });
  });

  describe('isValidProjectDirectory', () => {
    it('should return true when package.json exists', async () => {
      vi.mocked(fileSystemService.fileExists).mockImplementation(async (path: string) => {
        return path.endsWith('package.json');
      });

      const result = await pathUtils.isValidProjectDirectory();
      expect(result).toBe(true);
    });

    it('should return true when .git exists', async () => {
      vi.mocked(fileSystemService.fileExists).mockImplementation(async (path: string) => {
        return path.endsWith('.git');
      });

      const result = await pathUtils.isValidProjectDirectory();
      expect(result).toBe(true);
    });

    it('should return false when no project indicators exist', async () => {
      vi.mocked(fileSystemService.fileExists).mockResolvedValue(false);

      const result = await pathUtils.isValidProjectDirectory();
      expect(result).toBe(false);
    });

    it('should check custom path when provided', async () => {
      const customPath = '/custom/project/path';
      vi.mocked(fileSystemService.fileExists).mockImplementation(async (path: string) => {
        return path.startsWith(customPath) && path.endsWith('tsconfig.json');
      });

      const result = await pathUtils.isValidProjectDirectory(customPath);
      expect(result).toBe(true);
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path from current working directory', () => {
      const targetPath = '/current/working/dir/src/file.ts';
      const result = pathUtils.getRelativePath(targetPath);
      expect(result).toBe('src/file.ts');
    });

    it('should return full path when not under current working directory', () => {
      const targetPath = '/other/path/file.ts';
      const result = pathUtils.getRelativePath(targetPath);
      expect(result).toBe('/other/path/file.ts');
    });

    it('should return "." when target path is current working directory', () => {
      const targetPath = '/current/working/dir';
      const result = pathUtils.getRelativePath(targetPath);
      expect(result).toBe('.');
    });
  });
});