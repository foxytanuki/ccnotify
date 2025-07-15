import { homedir } from 'node:os';
import { join } from 'node:path';
import { CCNotifyError, type ClaudeConfig, ErrorType } from '../types/index.js';
import { fileSystemService, fileUtils } from '../utils/file.js';

/**
 * Configuration manager interface
 */
export interface ConfigManager {
  loadConfig(path: string): Promise<ClaudeConfig>;
  saveConfig(path: string, config: ClaudeConfig): Promise<void>;
  backupConfig(path: string): Promise<string>;
  getConfigPath(isGlobal: boolean): string;
  mergeConfig(existing: ClaudeConfig, updates: Partial<ClaudeConfig>): ClaudeConfig;
}

/**
 * Implementation of configuration management
 */
export class ConfigManagerImpl implements ConfigManager {
  /**
   * Load configuration from file with validation
   */
  async loadConfig(path: string): Promise<ClaudeConfig> {
    try {
      // Check if file exists
      if (!(await fileSystemService.fileExists(path))) {
        // Return empty config if file doesn't exist
        return {};
      }

      // Read and parse the configuration
      const config = await fileUtils.readJsonFile<ClaudeConfig>(path);

      // Validate the configuration structure
      this.validateConfig(config);

      return config;
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }
      throw new CCNotifyError(
        ErrorType.JSON_PARSE_ERROR,
        `Failed to load configuration from ${path}`,
        error as Error,
      );
    }
  }

  /**
   * Save configuration to file with atomic operations
   */
  async saveConfig(path: string, config: ClaudeConfig): Promise<void> {
    try {
      // Validate the configuration before saving
      this.validateConfig(config);

      // Use safe write operation with backup
      await fileUtils.safeWriteJsonFile(path, config);
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }
      throw new CCNotifyError(
        ErrorType.FILE_PERMISSION_ERROR,
        `Failed to save configuration to ${path}`,
        error as Error,
      );
    }
  }

  /**
   * Create backup of configuration file
   */
  async backupConfig(path: string): Promise<string> {
    try {
      return await fileSystemService.createBackup(path);
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }
      throw new CCNotifyError(
        ErrorType.CONFIG_BACKUP_ERROR,
        `Failed to backup configuration at ${path}`,
        error as Error,
      );
    }
  }

  /**
   * Get configuration file path based on global flag
   */
  getConfigPath(isGlobal: boolean): string {
    if (isGlobal) {
      return join(homedir(), '.claude', 'settings.json');
    }
    return join(process.cwd(), '.claude', 'settings.json');
  }

  /**
   * Merge existing configuration with updates, preserving existing settings
   */
  mergeConfig(existing: ClaudeConfig, updates: Partial<ClaudeConfig>): ClaudeConfig {
    // Deep clone the existing config to avoid mutations
    const merged = JSON.parse(JSON.stringify(existing)) as ClaudeConfig;

    // Merge top-level properties
    Object.keys(updates).forEach((key) => {
      if (key === 'hooks' && updates.hooks) {
        // Special handling for hooks property
        if (!merged.hooks) {
          merged.hooks = {};
        }

        // Merge hooks, preserving existing hook types
        Object.keys(updates.hooks).forEach((hookType) => {
          if (hookType === 'Stop' && updates.hooks?.Stop && merged.hooks) {
            // Merge Stop hooks array
            if (!merged.hooks.Stop) {
              merged.hooks.Stop = [];
            }

            // Add new Stop hooks, avoiding duplicates based on matcher
            updates.hooks.Stop.forEach((newHook) => {
              const existingIndex =
                merged.hooks?.Stop?.findIndex(
                  (existingHook) => existingHook.matcher === newHook.matcher,
                ) ?? -1;

              if (existingIndex >= 0 && merged.hooks?.Stop) {
                // Replace existing hook with same matcher
                merged.hooks.Stop[existingIndex] = newHook;
              } else if (merged.hooks?.Stop) {
                // Add new hook
                merged.hooks.Stop.push(newHook);
              }
            });
          } else if (merged.hooks && updates.hooks) {
            // For other hook types, directly assign
            merged.hooks[hookType] = updates.hooks[hookType];
          }
        });
      } else {
        // For non-hooks properties, directly assign
        (merged as Record<string, unknown>)[key] = (updates as Record<string, unknown>)[key];
      }
    });

    return merged;
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: unknown): void {
    if (config === null || config === undefined) {
      throw new CCNotifyError(
        ErrorType.JSON_PARSE_ERROR,
        'Configuration cannot be null or undefined',
      );
    }

    if (typeof config !== 'object') {
      throw new CCNotifyError(ErrorType.JSON_PARSE_ERROR, 'Configuration must be an object');
    }

    const configObj = config as Record<string, unknown>;

    // Validate hooks structure if present
    if (configObj.hooks !== undefined) {
      if (typeof configObj.hooks !== 'object' || configObj.hooks === null) {
        throw new CCNotifyError(ErrorType.JSON_PARSE_ERROR, 'hooks property must be an object');
      }

      const hooks = configObj.hooks as Record<string, unknown>;

      // Validate Stop hooks if present
      if (hooks.Stop !== undefined) {
        if (!Array.isArray(hooks.Stop)) {
          throw new CCNotifyError(ErrorType.JSON_PARSE_ERROR, 'hooks.Stop must be an array');
        }

        // Validate each Stop hook
        hooks.Stop.forEach((hook: unknown, index: number) => {
          if (typeof hook !== 'object' || hook === null) {
            throw new CCNotifyError(
              ErrorType.JSON_PARSE_ERROR,
              `Stop hook at index ${index} must be an object`,
            );
          }

          const hookObj = hook as Record<string, unknown>;

          if (typeof hookObj.matcher !== 'string') {
            throw new CCNotifyError(
              ErrorType.JSON_PARSE_ERROR,
              `Stop hook at index ${index} must have a string matcher`,
            );
          }

          if (!Array.isArray(hookObj.hooks)) {
            throw new CCNotifyError(
              ErrorType.JSON_PARSE_ERROR,
              `Stop hook at index ${index} must have a hooks array`,
            );
          }

          // Validate individual hooks
          hookObj.hooks.forEach((individualHook: unknown, hookIndex: number) => {
            if (typeof individualHook !== 'object' || individualHook === null) {
              throw new CCNotifyError(
                ErrorType.JSON_PARSE_ERROR,
                `Hook at index ${index}.${hookIndex} must be an object`,
              );
            }

            const individualHookObj = individualHook as Record<string, unknown>;

            if (individualHookObj.type !== 'command') {
              throw new CCNotifyError(
                ErrorType.JSON_PARSE_ERROR,
                `Hook at index ${index}.${hookIndex} must have type 'command'`,
              );
            }

            if (typeof individualHookObj.command !== 'string') {
              throw new CCNotifyError(
                ErrorType.JSON_PARSE_ERROR,
                `Hook at index ${index}.${hookIndex} must have a string command`,
              );
            }
          });
        });
      }
    }
  }
}

/**
 * Default configuration manager instance
 */
export const configManager = new ConfigManagerImpl();
