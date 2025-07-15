import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CCNotifyError } from '../../../src/types/index.js';
import { FileSystemServiceImpl, fileSystemService, fileUtils } from '../../../src/utils/file.js';

describe('FileSystemService', () => {
  let testDir: string;
  let service: FileSystemServiceImpl;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = join(tmpdir(), `ccnotify-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    service = new FileSystemServiceImpl();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('ensureDirectory', () => {
    it('should create a directory if it does not exist', async () => {
      const dirPath = join(testDir, 'new-directory');

      await service.ensureDirectory(dirPath);

      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      const dirPath = join(testDir, 'existing-directory');
      await fs.mkdir(dirPath);

      await expect(service.ensureDirectory(dirPath)).resolves.not.toThrow();
    });

    it('should create nested directories', async () => {
      const nestedPath = join(testDir, 'level1', 'level2', 'level3');

      await service.ensureDirectory(nestedPath);

      const stats = await fs.stat(nestedPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should throw CCNotifyError on permission error', async () => {
      // Mock fs.mkdir to simulate permission error
      const mockMkdir = vi.spyOn(fs, 'mkdir').mockRejectedValue(new Error('Permission denied'));

      await expect(service.ensureDirectory('/invalid/path')).rejects.toThrow(CCNotifyError);
      await expect(service.ensureDirectory('/invalid/path')).rejects.toThrow(
        'Failed to create directory',
      );

      mockMkdir.mockRestore();
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(testDir, 'existing-file.txt');
      await fs.writeFile(filePath, 'test content');

      const exists = await service.fileExists(filePath);

      expect(exists).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const filePath = join(testDir, 'non-existing-file.txt');

      const exists = await service.fileExists(filePath);

      expect(exists).toBe(false);
    });

    it('should return true for existing directory', async () => {
      const dirPath = join(testDir, 'existing-directory');
      await fs.mkdir(dirPath);

      const exists = await service.fileExists(dirPath);

      expect(exists).toBe(true);
    });
  });

  describe('readFile', () => {
    it('should read file content correctly', async () => {
      const filePath = join(testDir, 'test-file.txt');
      const content = 'Hello, World!';
      await fs.writeFile(filePath, content);

      const result = await service.readFile(filePath);

      expect(result).toBe(content);
    });

    it('should throw CCNotifyError for non-existing file', async () => {
      const filePath = join(testDir, 'non-existing-file.txt');

      await expect(service.readFile(filePath)).rejects.toThrow(CCNotifyError);
      await expect(service.readFile(filePath)).rejects.toThrow('Failed to read file');
    });

    it('should handle UTF-8 content correctly', async () => {
      const filePath = join(testDir, 'utf8-file.txt');
      const content = 'Hello, 世界! 🌍';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await service.readFile(filePath);

      expect(result).toBe(content);
    });
  });

  describe('writeFile', () => {
    it('should write file content correctly', async () => {
      const filePath = join(testDir, 'new-file.txt');
      const content = 'Hello, World!';

      await service.writeFile(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should create directory if it does not exist', async () => {
      const filePath = join(testDir, 'nested', 'directory', 'file.txt');
      const content = 'test content';

      await service.writeFile(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should overwrite existing file', async () => {
      const filePath = join(testDir, 'existing-file.txt');
      await fs.writeFile(filePath, 'old content');

      const newContent = 'new content';
      await service.writeFile(filePath, newContent);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(newContent);
    });

    it('should handle UTF-8 content correctly', async () => {
      const filePath = join(testDir, 'utf8-file.txt');
      const content = 'Hello, 世界! 🌍';

      await service.writeFile(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });
  });

  describe('copyFile', () => {
    it('should copy file correctly', async () => {
      const sourcePath = join(testDir, 'source.txt');
      const destPath = join(testDir, 'destination.txt');
      const content = 'test content';
      await fs.writeFile(sourcePath, content);

      await service.copyFile(sourcePath, destPath);

      const result = await fs.readFile(destPath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should create destination directory if needed', async () => {
      const sourcePath = join(testDir, 'source.txt');
      const destPath = join(testDir, 'nested', 'destination.txt');
      const content = 'test content';
      await fs.writeFile(sourcePath, content);

      await service.copyFile(sourcePath, destPath);

      const result = await fs.readFile(destPath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should throw CCNotifyError for non-existing source', async () => {
      const sourcePath = join(testDir, 'non-existing.txt');
      const destPath = join(testDir, 'destination.txt');

      await expect(service.copyFile(sourcePath, destPath)).rejects.toThrow(CCNotifyError);
      await expect(service.copyFile(sourcePath, destPath)).rejects.toThrow('Failed to copy file');
    });
  });

  describe('createBackup', () => {
    it('should create backup with timestamp', async () => {
      const filePath = join(testDir, 'original.txt');
      const content = 'original content';
      await fs.writeFile(filePath, content);

      const backupPath = await service.createBackup(filePath);

      expect(backupPath).toMatch(/\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
      const backupContent = await fs.readFile(backupPath, 'utf-8');
      expect(backupContent).toBe(content);
    });

    it('should throw error for non-existing file', async () => {
      const filePath = join(testDir, 'non-existing.txt');

      await expect(service.createBackup(filePath)).rejects.toThrow(CCNotifyError);
      await expect(service.createBackup(filePath)).rejects.toThrow(
        'Cannot backup non-existent file',
      );
    });

    it('should preserve original file content', async () => {
      const filePath = join(testDir, 'original.txt');
      const content = 'original content';
      await fs.writeFile(filePath, content);

      await service.createBackup(filePath);

      const originalContent = await fs.readFile(filePath, 'utf-8');
      expect(originalContent).toBe(content);
    });
  });
});

describe('fileUtils', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccnotify-utils-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('readJsonFile', () => {
    it('should read and parse JSON file correctly', async () => {
      const filePath = join(testDir, 'test.json');
      const data = { name: 'test', value: 42 };
      await fs.writeFile(filePath, JSON.stringify(data));

      const result = await fileUtils.readJsonFile(filePath);

      expect(result).toEqual(data);
    });

    it('should throw CCNotifyError for invalid JSON', async () => {
      const filePath = join(testDir, 'invalid.json');
      await fs.writeFile(filePath, '{ invalid json }');

      await expect(fileUtils.readJsonFile(filePath)).rejects.toThrow(CCNotifyError);
      await expect(fileUtils.readJsonFile(filePath)).rejects.toThrow('Failed to parse JSON file');
    });

    it('should throw CCNotifyError for non-existing file', async () => {
      const filePath = join(testDir, 'non-existing.json');

      await expect(fileUtils.readJsonFile(filePath)).rejects.toThrow(CCNotifyError);
    });
  });

  describe('writeJsonFile', () => {
    it('should write JSON file with proper formatting', async () => {
      const filePath = join(testDir, 'output.json');
      const data = { name: 'test', nested: { value: 42 } };

      await fileUtils.writeJsonFile(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(data);
      expect(content).toContain('  '); // Check for proper indentation
    });

    it('should create directory if needed', async () => {
      const filePath = join(testDir, 'nested', 'output.json');
      const data = { test: true };

      await fileUtils.writeJsonFile(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(data);
    });
  });

  describe('safeWriteJsonFile', () => {
    it('should write JSON file without backup for new file', async () => {
      const filePath = join(testDir, 'new-file.json');
      const data = { test: true };

      await fileUtils.safeWriteJsonFile(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(data);
    });

    it('should create backup before overwriting existing file', async () => {
      const filePath = join(testDir, 'existing.json');
      const originalData = { original: true };
      const newData = { updated: true };

      // Create original file
      await fs.writeFile(filePath, JSON.stringify(originalData));

      // Update with safe write
      await fileUtils.safeWriteJsonFile(filePath, newData);

      // Check new content
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(newData);

      // Check backup exists
      const files = await fs.readdir(testDir);
      const backupFiles = files.filter((f) => f.includes('.backup.'));
      expect(backupFiles.length).toBe(1);
    });

    it('should restore backup on write failure', async () => {
      const filePath = join(testDir, 'existing.json');
      const originalData = { original: true };

      // Create original file
      await fs.writeFile(filePath, JSON.stringify(originalData));

      // Mock writeJsonFile to fail
      const originalWriteJsonFile = fileUtils.writeJsonFile;
      fileUtils.writeJsonFile = vi.fn().mockRejectedValue(new Error('Write failed'));

      try {
        await expect(fileUtils.safeWriteJsonFile(filePath, { new: true })).rejects.toThrow();

        // Check that original content is restored
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed).toEqual(originalData);
      } finally {
        // Restore original function
        fileUtils.writeJsonFile = originalWriteJsonFile;
      }
    });
  });
});

describe('fileSystemService singleton', () => {
  it('should export a default instance', () => {
    expect(fileSystemService).toBeInstanceOf(FileSystemServiceImpl);
  });

  it('should have all required methods', () => {
    expect(typeof fileSystemService.ensureDirectory).toBe('function');
    expect(typeof fileSystemService.fileExists).toBe('function');
    expect(typeof fileSystemService.readFile).toBe('function');
    expect(typeof fileSystemService.writeFile).toBe('function');
    expect(typeof fileSystemService.copyFile).toBe('function');
    expect(typeof fileSystemService.createBackup).toBe('function');
  });
});
