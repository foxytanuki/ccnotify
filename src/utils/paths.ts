import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { errorHandler } from '../services/error-handler.js';
import { CCNotifyError, ErrorSeverity, ErrorType } from '../types/index.js';
import { fileSystemService } from './file.js';

/**
 * Path resolution service interface
 */
export interface PathResolver {
  getConfigPath(isGlobal: boolean): string;
  getConfigDirectory(isGlobal: boolean): string;
  getScriptPath(isGlobal: boolean, scriptName: string): string;
  getHomeDirectory(): string;
  getXdgConfigHome(): string;
  getXdgDataHome(): string;
  getCcnotifyConfigDir(): string;
  getCcnotifyDataDir(): string;
  validateDirectoryPath(path: string): Promise<boolean>;
  ensureConfigDirectory(isGlobal: boolean): Promise<string>;
  ensureCcnotifyConfigDir(): Promise<string>;
  ensureCcnotifyDataDir(): Promise<string>;
}

/**
 * Implementation of path resolution utilities
 */
export class PathResolverImpl implements PathResolver {
  private readonly CONFIG_DIR_NAME = '.claude';
  private readonly CONFIG_FILE_NAME = 'settings.json';

  /**
   * Get XDG config home directory
   */
  getXdgConfigHome(): string {
    const xdgConfigHome = process.env.XDG_CONFIG_HOME;
    if (xdgConfigHome) {
      return xdgConfigHome;
    }
    return join(homedir(), '.config');
  }

  /**
   * Get XDG data home directory
   */
  getXdgDataHome(): string {
    const xdgDataHome = process.env.XDG_DATA_HOME;
    if (xdgDataHome) {
      return xdgDataHome;
    }
    return join(homedir(), '.local', 'share');
  }

  /**
   * Get ccnotify config directory
   */
  getCcnotifyConfigDir(): string {
    return join(this.getXdgConfigHome(), 'ccnotify');
  }

  /**
   * Get ccnotify data directory
   */
  getCcnotifyDataDir(): string {
    return join(this.getXdgDataHome(), 'ccnotify');
  }

  /**
   * Get the configuration file path for local or global mode
   */
  getConfigPath(isGlobal: boolean): string {
    const configDir = this.getConfigDirectory(isGlobal);
    return join(configDir, this.CONFIG_FILE_NAME);
  }

  /**
   * Get the configuration directory path for local or global mode
   */
  getConfigDirectory(isGlobal: boolean): string {
    if (isGlobal) {
      return join(this.getHomeDirectory(), this.CONFIG_DIR_NAME);
    }
    return join(process.cwd(), this.CONFIG_DIR_NAME);
  }

  /**
   * Get the path for a script file in the ccnotify data directory
   */
  getScriptPath(isGlobal: boolean, scriptName: string): string {
    const ccnotifyDataDir = this.getCcnotifyDataDir();
    return join(ccnotifyDataDir, scriptName);
  }

  /**
   * Get the user's home directory
   */
  getHomeDirectory(): string {
    try {
      const home = homedir();
      if (!home) {
        throw errorHandler.createError(
          ErrorType.DIRECTORY_ACCESS_ERROR,
          'Unable to determine home directory',
          undefined,
          ErrorSeverity.HIGH,
          { operation: 'getHomeDirectory' }
        );
      }
      return home;
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }
      throw errorHandler.createError(
        ErrorType.DIRECTORY_ACCESS_ERROR,
        'Failed to get home directory',
        error as Error,
        ErrorSeverity.HIGH,
        { operation: 'getHomeDirectory' }
      );
    }
  }

  /**
   * Validate that a directory path is accessible and writable
   */
  async validateDirectoryPath(path: string): Promise<boolean> {
    try {
      // Resolve the path to handle relative paths and symlinks
      const resolvedPath = resolve(path);

      // Check if the directory exists
      if (await fileSystemService.fileExists(resolvedPath)) {
        // If it exists, check if it's actually a directory
        const stats = await import('node:fs').then(fs => fs.promises.stat(resolvedPath));
        if (!stats.isDirectory()) {
          return false;
        }
      }

      // Try to ensure the directory exists (this will create it if needed)
      await fileSystemService.ensureDirectory(resolvedPath);

      // Test write permissions by creating a temporary file
      const testFile = join(resolvedPath, '.ccnotify-test-write');
      try {
        await fileSystemService.writeFile(testFile, 'test');
        // Clean up the test file
        await import('node:fs').then(fs => fs.promises.unlink(testFile));
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Ensure the configuration directory exists and return its path
   */
  async ensureConfigDirectory(isGlobal: boolean): Promise<string> {
    const configDir = this.getConfigDirectory(isGlobal);

    try {
      // Validate the directory path
      const isValid = await this.validateDirectoryPath(configDir);
      if (!isValid) {
        throw errorHandler.createError(
          ErrorType.DIRECTORY_ACCESS_ERROR,
          `Cannot access or create configuration directory: ${configDir}`,
          undefined,
          ErrorSeverity.HIGH,
          { configDir, isGlobal, operation: 'ensureConfigDirectory' }
        );
      }

      // Ensure the directory exists
      await fileSystemService.ensureDirectory(configDir);

      return configDir;
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }
      throw errorHandler.createError(
        ErrorType.DIRECTORY_ACCESS_ERROR,
        `Failed to ensure configuration directory: ${configDir}`,
        error as Error,
        ErrorSeverity.HIGH,
        { configDir, isGlobal, operation: 'ensureConfigDirectory' }
      );
    }
  }

  /**
   * Ensure the ccnotify config directory exists and return its path
   */
  async ensureCcnotifyConfigDir(): Promise<string> {
    const ccnotifyConfigDir = this.getCcnotifyConfigDir();

    try {
      // Validate the directory path
      const isValid = await this.validateDirectoryPath(ccnotifyConfigDir);
      if (!isValid) {
        throw errorHandler.createError(
          ErrorType.DIRECTORY_ACCESS_ERROR,
          `Cannot access or create ccnotify config directory: ${ccnotifyConfigDir}`,
          undefined,
          ErrorSeverity.HIGH,
          { ccnotifyConfigDir, operation: 'ensureCcnotifyConfigDir' }
        );
      }

      // Ensure the directory exists
      await fileSystemService.ensureDirectory(ccnotifyConfigDir);

      return ccnotifyConfigDir;
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }
      throw errorHandler.createError(
        ErrorType.DIRECTORY_ACCESS_ERROR,
        `Failed to ensure ccnotify config directory: ${ccnotifyConfigDir}`,
        error as Error,
        ErrorSeverity.HIGH,
        { ccnotifyConfigDir, operation: 'ensureCcnotifyConfigDir' }
      );
    }
  }

  /**
   * Ensure the ccnotify data directory exists and return its path
   */
  async ensureCcnotifyDataDir(): Promise<string> {
    const ccnotifyDataDir = this.getCcnotifyDataDir();

    try {
      // Validate the directory path
      const isValid = await this.validateDirectoryPath(ccnotifyDataDir);
      if (!isValid) {
        throw errorHandler.createError(
          ErrorType.DIRECTORY_ACCESS_ERROR,
          `Cannot access or create ccnotify data directory: ${ccnotifyDataDir}`,
          undefined,
          ErrorSeverity.HIGH,
          { ccnotifyDataDir, operation: 'ensureCcnotifyDataDir' }
        );
      }

      // Ensure the directory exists
      await fileSystemService.ensureDirectory(ccnotifyDataDir);

      return ccnotifyDataDir;
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }
      throw errorHandler.createError(
        ErrorType.DIRECTORY_ACCESS_ERROR,
        `Failed to ensure ccnotify data directory: ${ccnotifyDataDir}`,
        error as Error,
        ErrorSeverity.HIGH,
        { ccnotifyDataDir, operation: 'ensureCcnotifyDataDir' }
      );
    }
  }
}

/**
 * Default path resolver instance
 */
export const pathResolver = new PathResolverImpl();

/**
 * Utility functions for common path operations
 */
export const pathUtils = {
  /**
   * Get the configuration file path with validation
   */
  async getValidatedConfigPath(isGlobal: boolean): Promise<string> {
    await pathResolver.ensureConfigDirectory(isGlobal);
    return pathResolver.getConfigPath(isGlobal);
  },

  /**
   * Get the script path with directory validation
   */
  async getValidatedScriptPath(isGlobal: boolean, scriptName: string): Promise<string> {
    await pathResolver.ensureConfigDirectory(isGlobal);
    return pathResolver.getScriptPath(isGlobal, scriptName);
  },

  /**
   * Check if we're in a valid project directory (has package.json or similar)
   */
  async isValidProjectDirectory(path?: string): Promise<boolean> {
    const checkPath = path || process.cwd();
    const indicators = ['package.json', '.git', 'tsconfig.json', 'pyproject.toml', 'Cargo.toml'];

    for (const indicator of indicators) {
      const indicatorPath = join(checkPath, indicator);
      if (await fileSystemService.fileExists(indicatorPath)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Get a relative path from current working directory
   */
  getRelativePath(targetPath: string): string {
    const cwd = process.cwd();
    const relativePath = targetPath.startsWith(cwd) ? targetPath.slice(cwd.length + 1) : targetPath;
    return relativePath || '.';
  },
};
