import { dirname } from 'node:path';
import type { Command } from 'commander';
import { configManager } from '../services/config.js';
import { errorHandler } from '../services/error-handler.js';
import { hookGenerator } from '../services/hooks.js';
import { CCNotifyError, ErrorType, type MacOSCommandArgs } from '../types/index.js';
import { fileSystemService } from '../utils/file.js';

/**
 * Register macOS command with commander
 */
export function registerMacOSCommand(program: Command): void {
  program
    .command('macos')
    .description('Create macOS notification Stop Hook')
    .argument('[title]', 'Optional custom title for notifications (defaults to user message)')
    .option('-g, --global', 'Create global configuration in ~/.claude/')
    .action(async (title: string | undefined, options: { global?: boolean }) => {
      try {
        await errorHandler.logInfo('Starting macOS command execution', {
          title,
          global: options.global,
        });

        await handleMacOSCommand({
          title,
          options: { global: options.global },
        });
      } catch (error) {
        await errorHandler.handleUnknownError(error, {
          command: 'macos',
          title,
          global: options.global,
        });
      }
    });
}

/**
 * Handle macOS command execution
 */
export async function handleMacOSCommand(args: MacOSCommandArgs): Promise<void> {
  try {
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

    await errorHandler.logDebug('Generating macOS hook');

    // Generate macOS hook
    const macosHook = await hookGenerator.generateMacOSHook(args.title, args.options.global ?? false);

    await errorHandler.logDebug('Merging configuration');

    // Merge with existing configuration
    const updatedConfig = configManager.mergeConfig(existingConfig, {
      hooks: {
        Stop: [macosHook],
      },
    });

    await errorHandler.logDebug('Saving updated configuration');

    // Save updated configuration
    await configManager.saveConfig(configPath, updatedConfig);

    // Success message
    const configType = args.options.global ? 'global' : 'local';
    console.log(`✅ macOS Stop Hook created successfully!`);
    console.log(`📁 Configuration: ${configPath} (${configType})`);
    if (args.title !== undefined) {
      console.log(`🏷️  Custom title: ${args.title}`);
    } else {
      console.log(`🏷️  Title: User message (dynamic)`);
    }

    await errorHandler.logInfo('macOS Stop Hook created successfully', {
      configPath,
      configType,
      title: args.title,
    });
  } catch (error) {
    if (error instanceof CCNotifyError) {
      throw error;
    }

    // Wrap unknown errors with context
    throw errorHandler.createError(
      ErrorType.COMMAND_ERROR,
      'Failed to create macOS Stop Hook',
      error as Error,
      undefined,
      {
        command: 'macos',
        global: args.options.global,
        title: args.title,
      }
    );
  }
}
