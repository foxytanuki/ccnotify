import { promises as fs } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../src/services/error-handler.js';
import { CCNotifyError, ErrorSeverity, ErrorType } from '../../../src/types/index.js';
import { fileSystemService, fileUtils } from '../../../src/utils/file.js';

// Mock fs operations
vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn(),
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn(),
  },
}));

// Mock error handler
vi.mock('../../../src/services/error-handler.js', () => ({
  errorHandler: {
    wrapFileSystemError: vi.fn(
      (error, operation, path) =>
        new CCNotifyError(
          ErrorType.FILE_PERMISSION_ERROR,
          `Failed to ${operation}: ${path}`,
          error,
        ),
    ),
    createError: vi.fn(
      (type, message, originalError, severity, context) =>
        new CCNotifyError(type, message, originalError, severity),
    ),
    wrapJsonError: vi.fn(
      (error, filePath) =>
        new CCNotifyError(
          ErrorType.JSON_PARSE_ERROR,
          `Invalid JSON in configuration file: ${filePath}`,
          error,
        ),
    ),
  },
}));

describe('File System Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureDirectory', () => {
    it('should create directory successfully', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);

      await expect(fileSystemService.ensureDirectory('/test/path')).resolves.not.toThrow();
      expect(fs.mkdir).toHaveBeenCalledWith('/test/path', { recursive: true });
    });

    it('should handle directory creation errors with enhanced error handling', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      (fs.mkdir as any).mockRejectedValue(error);

      await expect(fileSystemService.ensureDirectory('/test/path')).rejects.toThrow(CCNotifyError);

      // Verify enhanced error handling was called
      expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
        error,
        'create directory',
        '/test/path',
      );
    });

    it('should handle ENOENT errors appropriately', async () => {
      const error = new Error('No such file or directory') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.mkdir as any).mockRejectedValue(error);

      await expect(fileSystemService.ensureDirectory('/test/path')).rejects.toThrow(CCNotifyError);
      expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
        error,
        'create directory',
        '/test/path',
      );
    });
  });

  describe('fileExists', () => {
    it('should return true for existing files', async () => {
      (fs.access as any).mockResolvedValue(undefined);

      const result = await fileSystemService.fileExists('/test/file.txt');
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false for non-existing files', async () => {
      (fs.access as any).mockRejectedValue(new Error('File not found'));

      const result = await fileSystemService.fileExists('/test/file.txt');
      expect(result).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      (fs.access as any).mockRejectedValue(error);

      const result = await fileSystemService.fileExists('/test/file.txt');
      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file content successfully', async () => {
      const content = 'test content';
      (fs.readFile as any).mockResolvedValue(content);

      const result = await fileSystemService.readFile('/test/file.txt');
      expect(result).toBe(content);
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf-8');
    });

    it('should handle file read errors with enhanced error handling', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as any).mockRejectedValue(error);

      await expect(fileSystemService.readFile('/test/file.txt')).rejects.toThrow(CCNotifyError);
      expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
        error,
        'read file',
        '/test/file.txt',
      );
    });

    it('should handle permission errors with enhanced error handling', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      (fs.readFile as any).mockRejectedValue(error);

      await expect(fileSystemService.readFile('/test/file.txt')).rejects.toThrow(CCNotifyError);
      expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
        error,
        'read file',
        '/test/file.txt',
      );
    });
  });

  describe('writeFile', () => {
    it('should write file content successfully', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      await expect(fileSystemService.writeFile('/test/file.txt', 'content')).resolves.not.toThrow();
      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.txt', 'content', 'utf-8');
    });

    it('should handle file write errors with enhanced error handling', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      (fs.writeFile as any).mockRejectedValue(error);

      await expect(fileSystemService.writeFile('/test/file.txt', 'content')).rejects.toThrow(
        CCNotifyError,
      );
      expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
        error,
        'write file',
        '/test/file.txt',
      );
    });

    it('should handle disk space errors with enhanced error handling', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      const error = new Error('No space left on device') as NodeJS.ErrnoException;
      error.code = 'ENOSPC';
      (fs.writeFile as any).mockRejectedValue(error);

      await expect(fileSystemService.writeFile('/test/file.txt', 'content')).rejects.toThrow(
        CCNotifyError,
      );
      expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
        error,
        'write file',
        '/test/file.txt',
      );
    });
  });

  describe('copyFile', () => {
    it('should copy file successfully', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.copyFile as any).mockResolvedValue(undefined);

      await expect(fileSystemService.copyFile('/source.txt', '/dest.txt')).resolves.not.toThrow();
      expect(fs.copyFile).toHaveBeenCalledWith('/source.txt', '/dest.txt');
    });

    it('should handle file copy errors with enhanced error handling', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      const error = new Error('Source file not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.copyFile as any).mockRejectedValue(error);

      await expect(fileSystemService.copyFile('/source.txt', '/dest.txt')).rejects.toThrow(
        CCNotifyError,
      );
      expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
        error,
        'copy file from /source.txt',
        '/dest.txt',
      );
    });
  });

  describe('createBackup', () => {
    it('should create backup successfully', async () => {
      (fs.access as any).mockResolvedValue(undefined);
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.copyFile as any).mockResolvedValue(undefined);

      const backupPath = await fileSystemService.createBackup('/test/file.txt');
      expect(backupPath).toMatch(/\/test\/file\.txt\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });

    it('should handle backup errors for non-existent files with enhanced error handling', async () => {
      (fs.access as any).mockRejectedValue(new Error('File not found'));

      await expect(fileSystemService.createBackup('/test/file.txt')).rejects.toThrow(CCNotifyError);
      expect(errorHandler.createError).toHaveBeenCalledWith(
        ErrorType.FILE_PERMISSION_ERROR,
        'Cannot backup non-existent file: /test/file.txt',
        undefined,
        ErrorSeverity.MEDIUM,
        expect.objectContaining({
          filePath: '/test/file.txt',
          operation: 'createBackup',
        }),
      );
    });

    it('should handle backup copy errors with enhanced error handling', async () => {
      (fs.access as any).mockResolvedValue(undefined); // File exists
      (fs.mkdir as any).mockResolvedValue(undefined);
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      (fs.copyFile as any).mockRejectedValue(error);

      await expect(fileSystemService.createBackup('/test/file.txt')).rejects.toThrow(CCNotifyError);
      expect(errorHandler.createError).toHaveBeenCalledWith(
        ErrorType.CONFIG_BACKUP_ERROR,
        'Failed to create backup of /test/file.txt',
        error,
        ErrorSeverity.HIGH,
        expect.objectContaining({
          filePath: '/test/file.txt',
          operation: 'createBackup',
        }),
      );
    });
  });
});

describe('File Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readJsonFile', () => {
    it('should read and parse JSON file successfully', async () => {
      const jsonContent = '{"test": "value"}';
      (fs.readFile as any).mockResolvedValue(jsonContent);

      const result = await fileUtils.readJsonFile('/test/config.json');
      expect(result).toEqual({ test: 'value' });
    });

    it('should handle JSON parse errors with enhanced error handling', async () => {
      const invalidJson = '{"invalid": json}';
      (fs.readFile as any).mockResolvedValue(invalidJson);

      await expect(fileUtils.readJsonFile('/test/config.json')).rejects.toThrow(CCNotifyError);
      expect(errorHandler.wrapJsonError).toHaveBeenCalledWith(
        expect.any(SyntaxError),
        '/test/config.json',
      );
    });

    it('should handle file read errors with enhanced error handling', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as any).mockRejectedValue(error);

      await expect(fileUtils.readJsonFile('/test/config.json')).rejects.toThrow(CCNotifyError);
      expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
        error,
        'read file',
        '/test/config.json',
      );
    });

    it('should handle other JSON errors with enhanced error handling', async () => {
      const jsonContent = '{"test": "value"}';
      (fs.readFile as any).mockResolvedValue(jsonContent);

      // Mock JSON.parse to throw a different error
      const originalParse = JSON.parse;
      JSON.parse = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(fileUtils.readJsonFile('/test/config.json')).rejects.toThrow(CCNotifyError);
      expect(errorHandler.createError).toHaveBeenCalledWith(
        ErrorType.JSON_PARSE_ERROR,
        'Failed to parse JSON file: /test/config.json',
        expect.any(Error),
        ErrorSeverity.MEDIUM,
        expect.objectContaining({
          path: '/test/config.json',
          operation: 'readJsonFile',
        }),
      );

      // Restore original JSON.parse
      JSON.parse = originalParse;
    });
  });

  describe('writeJsonFile', () => {
    it('should write JSON file successfully', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      const data = { test: 'value' };
      await expect(fileUtils.writeJsonFile('/test/config.json', data)).resolves.not.toThrow();
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/config.json',
        JSON.stringify(data, null, 2),
        'utf-8',
      );
    });

    it('should handle write errors with enhanced error handling', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      (fs.writeFile as any).mockRejectedValue(error);

      await expect(fileUtils.writeJsonFile('/test/config.json', {})).rejects.toThrow(CCNotifyError);
      expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
        error,
        'write file',
        '/test/config.json',
      );
    });

    it('should handle JSON stringify errors with enhanced error handling', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);

      // Create circular reference to cause JSON.stringify to fail
      const circularData: any = { test: 'value' };
      circularData.circular = circularData;

      await expect(fileUtils.writeJsonFile('/test/config.json', circularData)).rejects.toThrow(
        CCNotifyError,
      );
      expect(errorHandler.createError).toHaveBeenCalledWith(
        ErrorType.FILE_PERMISSION_ERROR,
        'Failed to write JSON file: /test/config.json',
        expect.any(Error),
        ErrorSeverity.MEDIUM,
        expect.objectContaining({
          path: '/test/config.json',
          operation: 'writeJsonFile',
        }),
      );
    });
  });

  describe('safeWriteJsonFile', () => {
    it('should write JSON file safely with backup', async () => {
      (fs.access as any).mockResolvedValue(undefined); // File exists
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.copyFile as any).mockResolvedValue(undefined); // Backup creation
      (fs.writeFile as any).mockResolvedValue(undefined);

      const data = { test: 'value' };
      await expect(fileUtils.safeWriteJsonFile('/test/config.json', data)).resolves.not.toThrow();
    });

    it('should restore backup on write failure', async () => {
      (fs.access as any)
        .mockResolvedValueOnce(undefined) // File exists for backup check
        .mockResolvedValueOnce(undefined); // Backup file exists for restore
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.copyFile as any).mockResolvedValue(undefined); // Backup creation and restore
      (fs.writeFile as any).mockRejectedValue(new Error('Write failed'));

      await expect(fileUtils.safeWriteJsonFile('/test/config.json', {})).rejects.toThrow();
      // Should attempt to restore backup
      expect(fs.copyFile).toHaveBeenCalledTimes(2); // Once for backup, once for restore
    });

    it('should handle backup creation failure', async () => {
      (fs.access as any).mockResolvedValue(undefined); // File exists
      (fs.mkdir as any).mockResolvedValue(undefined);
      const backupError = new Error('Backup failed') as NodeJS.ErrnoException;
      backupError.code = 'EACCES';
      (fs.copyFile as any).mockRejectedValueOnce(backupError); // Backup creation fails

      await expect(fileUtils.safeWriteJsonFile('/test/config.json', {})).rejects.toThrow();
      expect(errorHandler.createError).toHaveBeenCalledWith(
        ErrorType.CONFIG_BACKUP_ERROR,
        expect.stringContaining('Failed to create backup'),
        backupError,
        ErrorSeverity.HIGH,
        expect.any(Object),
      );
    });

    it('should handle restore failure gracefully', async () => {
      (fs.access as any)
        .mockResolvedValueOnce(undefined) // File exists for backup check
        .mockResolvedValueOnce(undefined); // Backup file exists for restore
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.copyFile as any)
        .mockResolvedValueOnce(undefined) // Backup creation succeeds
        .mockRejectedValueOnce(new Error('Restore failed')); // Restore fails
      (fs.writeFile as any).mockRejectedValue(new Error('Write failed'));

      // Should still throw the original write error, not the restore error
      await expect(fileUtils.safeWriteJsonFile('/test/config.json', {})).rejects.toThrow(
        'Write failed',
      );
    });
  });

  describe('Error Code Handling', () => {
    it('should handle various file system error codes', async () => {
      const errorCodes = [
        { code: 'ENOENT', description: 'File not found' },
        { code: 'EACCES', description: 'Permission denied' },
        { code: 'EPERM', description: 'Operation not permitted' },
        { code: 'ENOTDIR', description: 'Not a directory' },
        { code: 'EISDIR', description: 'Is a directory' },
        { code: 'ENOSPC', description: 'No space left on device' },
        { code: 'EMFILE', description: 'Too many open files' },
        { code: 'ENFILE', description: 'File table overflow' },
      ];

      for (const { code, description } of errorCodes) {
        const error = new Error(description) as NodeJS.ErrnoException;
        error.code = code;
        (fs.readFile as any).mockRejectedValue(error);

        await expect(fileSystemService.readFile('/test/file.txt')).rejects.toThrow(CCNotifyError);
        expect(errorHandler.wrapFileSystemError).toHaveBeenCalledWith(
          error,
          'read file',
          '/test/file.txt',
        );

        vi.clearAllMocks();
      }
    });
  });
});
