import { dirname } from 'node:path';
import type { Command } from 'commander';
import { configManager } from '../services/config.js';
import { errorHandler } from '../services/error-handler.js';
import { hookGenerator } from '../services/hooks.js';
import { validateAndSanitizeNtfyTopic } from '../services/validation.js';
import { CCNotifyError, ErrorType, type NtfyCommandArgs } from '../types/index.js';
import { fileSystemService } from '../utils/file.js';

/**
 * Register ntfy command with commander
 */
export function registerNtfyCommand(program: Command): void {
  program
    .command('ntfy')
    .description('Create ntfy notification Stop Hook')
    .argument('<topic_name>', 'ntfy topic name for notifications')
    .option('-g, --global', 'Create global configuration in ~/.claude/')
    .action(async (topicName: string, options: { global?: boolean }) => {
      try {
        await errorHandler.logInfo('Starting ntfy command execution', {
          topicName,
          global: options.global,
        });

        await handleNtfyCommand({
          topicName,
          options: { global: options.global },
        });
      } catch (error) {
        await errorHandler.handleUnknownError(error, {
          command: 'ntfy',
          topicName,
          global: options.global,
        });
      }
    });
}

/**
 * Handle ntfy command execution
 */
export async function handleNtfyCommand(args: NtfyCommandArgs): Promise<void> {
  try {
    await errorHandler.logDebug('Validating ntfy topic name');

    // Validate and sanitize topic name
    const sanitizedTopicName = validateAndSanitizeNtfyTopic(args.topicName);

    await errorHandler.logDebug('Getting configuration path', { global: args.options.global });

    // Get configuration path
    const configPath = configManager.getConfigPath(args.options.global ?? false);
    const configDir = dirname(configPath);

    await errorHandler.logDebug('Ensuring configuration directory exists', { configDir });

    // Ensure configuration directory exists with enhanced error handling
    try {
      await fileSystemService.ensureDirectory(configDir);
    } catch (error) {
      throw errorHandler.wrapFileSystemError(error, 'create configuration directory', configDir);
    }

    await errorHandler.logDebug('Loading existing configuration', { configPath });

    // Load existing configuration
    const existingConfig = await configManager.loadConfig(configPath);

    // Create backup if config file exists
    if (await fileSystemService.fileExists(configPath)) {
      await errorHandler.logDebug('Creating backup of existing configuration');
      await configManager.backupConfig(configPath);
    }

    await errorHandler.logDebug('Generating ntfy hook');

    // Generate ntfy hook
    const ntfyHook = hookGenerator.generateNtfyHook(sanitizedTopicName);

    await errorHandler.logDebug('Merging configuration');

    // Merge with existing configuration
    const updatedConfig = configManager.mergeConfig(existingConfig, {
      hooks: {
        Stop: [ntfyHook],
      },
    });

    await errorHandler.logDebug('Saving updated configuration');

    // Save updated configuration
    await configManager.saveConfig(configPath, updatedConfig);

    // Success message
    const configType = args.options.global ? 'global' : 'local';
    console.log(`✅ ntfy Stop Hook created successfully!`);
    console.log(`📁 Configuration: ${configPath} (${configType})`);
    console.log(`📢 Topic: ${sanitizedTopicName}`);

    await errorHandler.logInfo('ntfy Stop Hook created successfully', {
      configPath,
      configType,
      topicName: sanitizedTopicName,
    });
  } catch (error) {
    if (error instanceof CCNotifyError) {
      throw error;
    }

    // Wrap unknown errors with context
    throw errorHandler.createError(
      ErrorType.COMMAND_ERROR,
      'Failed to create ntfy Stop Hook',
      error as Error,
      undefined,
      {
        command: 'ntfy',
        global: args.options.global,
        topicName: args.topicName,
      }
    );
  }
}
