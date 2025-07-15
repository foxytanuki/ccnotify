import { promises as fs } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { errorHandler } from '../services/error-handler.js';
import { CCNotifyError, ErrorSeverity, ErrorType } from '../types/index.js';

/**
 * File system service interface
 */
export interface FileSystemService {
  ensureDirectory(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
  createBackup(filePath: string): Promise<string>;
}

/**
 * Implementation of file system operations
 */
export class FileSystemServiceImpl implements FileSystemService {
  /**
   * Ensure a directory exists, creating it if necessary
   */
  async ensureDirectory(path: string): Promise<void> {
    try {
      await fs.mkdir(path, { recursive: true });
    } catch (error) {
      throw errorHandler.wrapFileSystemError(error, 'create directory', path);
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file content safely
   */
  async readFile(path: string): Promise<string> {
    try {
      return await fs.readFile(path, 'utf-8');
    } catch (error) {
      throw errorHandler.wrapFileSystemError(error, 'read file', path);
    }
  }

  /**
   * Write file content safely, ensuring directory exists
   */
  async writeFile(path: string, content: string): Promise<void> {
    try {
      // Ensure the directory exists
      const dir = dirname(path);
      await this.ensureDirectory(dir);

      // Write the file
      await fs.writeFile(path, content, 'utf-8');
    } catch (error) {
      throw errorHandler.wrapFileSystemError(error, 'write file', path);
    }
  }

  /**
   * Copy a file from source to destination
   */
  async copyFile(source: string, destination: string): Promise<void> {
    try {
      // Ensure destination directory exists
      const dir = dirname(destination);
      await this.ensureDirectory(dir);

      // Copy the file
      await fs.copyFile(source, destination);
    } catch (error) {
      throw errorHandler.wrapFileSystemError(error, `copy file from ${source}`, destination);
    }
  }

  /**
   * Create a backup of a file with timestamp, keeping only the latest backup
   */
  async createBackup(filePath: string): Promise<string> {
    try {
      // Check if the original file exists
      if (!(await this.fileExists(filePath))) {
        throw errorHandler.createError(
          ErrorType.FILE_PERMISSION_ERROR,
          `Cannot backup non-existent file: ${filePath}`,
          undefined,
          ErrorSeverity.MEDIUM,
          { filePath, operation: 'createBackup' },
        );
      }

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.backup.${timestamp}`;

      // Copy the file to backup location
      await this.copyFile(filePath, backupPath);

      // Clean up old backup files after creating the new one
      await this.cleanupOldBackups(filePath);

      return backupPath;
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }
      throw errorHandler.createError(
        ErrorType.CONFIG_BACKUP_ERROR,
        `Failed to create backup of ${filePath}`,
        error as Error,
        ErrorSeverity.HIGH,
        { filePath, operation: 'createBackup' },
      );
    }
  }

  /**
   * Clean up old backup files, keeping only the most recent one
   */
  private async cleanupOldBackups(filePath: string): Promise<void> {
    try {
      const dir = dirname(filePath);
      const fileName = basename(filePath);
      const backupPattern = `${fileName}.backup.`;

      // Read directory contents
      const files = await fs.readdir(dir);

      // Find all backup files for this specific file
      const backupFiles = files
        .filter(file => file.startsWith(backupPattern))
        .map(file => ({
          name: file,
          path: join(dir, file),
          // Extract timestamp from filename for sorting
          timestamp: file.replace(backupPattern, '')
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Sort by timestamp descending

      // Remove all but the most recent backup (keep index 0, remove 1+)
      for (let i = 1; i < backupFiles.length; i++) {
        try {
          await fs.unlink(backupFiles[i].path);
        } catch (error) {
          // Log but don't throw - cleanup is best effort
          console.warn(`Failed to remove old backup file ${backupFiles[i].path}:`, error);
        }
      }
    } catch (error) {
      // Log but don't throw - cleanup is best effort
      console.warn(`Failed to cleanup old backups for ${filePath}:`, error);
    }
  }
}

/**
 * Default file system service instance
 */
export const fileSystemService = new FileSystemServiceImpl();

/**
 * Utility functions for common file operations
 */
export const fileUtils = {
  /**
   * Safely read a JSON file and parse it
   */
  async readJsonFile<T = any>(path: string): Promise<T> {
    try {
      const content = await fileSystemService.readFile(path);
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }

      // Use enhanced JSON error wrapping
      if (error instanceof SyntaxError) {
        throw errorHandler.wrapJsonError(error, path);
      }

      throw errorHandler.createError(
        ErrorType.JSON_PARSE_ERROR,
        `Failed to parse JSON file: ${path}`,
        error as Error,
        ErrorSeverity.MEDIUM,
        { path, operation: 'readJsonFile' },
      );
    }
  },

  /**
   * Safely write an object to a JSON file
   */
  async writeJsonFile(path: string, data: any): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      await fileSystemService.writeFile(path, content);
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }
      throw errorHandler.createError(
        ErrorType.FILE_PERMISSION_ERROR,
        `Failed to write JSON file: ${path}`,
        error as Error,
        ErrorSeverity.MEDIUM,
        { path, operation: 'writeJsonFile' },
      );
    }
  },

  /**
   * Safely backup and write a JSON file
   */
  async safeWriteJsonFile(path: string, data: any): Promise<void> {
    let backupPath: string | null = null;

    try {
      // Create backup if file exists
      if (await fileSystemService.fileExists(path)) {
        backupPath = await fileSystemService.createBackup(path);
      }

      // Write the new content
      await fileUtils.writeJsonFile(path, data);
    } catch (error) {
      // If we created a backup and writing failed, try to restore it
      if (backupPath && (await fileSystemService.fileExists(backupPath))) {
        try {
          await fileSystemService.copyFile(backupPath, path);
        } catch (restoreError) {
          // Log restore error but throw original error
          console.error(`Failed to restore backup: ${restoreError}`);
        }
      }
      throw error;
    }
  },
};
