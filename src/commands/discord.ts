import { dirname } from 'node:path';
import type { Command } from 'commander';
import { configManager } from '../services/config.js';
import { hookGenerator } from '../services/hooks.js';
import { validateAndSanitizeDiscordUrl } from '../services/validation.js';
import { errorHandler } from '../services/error-handler.js';
import { CCNotifyError, ErrorType, type DiscordCommandArgs } from '../types/index.js';
import { fileSystemService } from '../utils/file.js';

/**
 * Register Discord command with commander
 */
export function registerDiscordCommand(program: Command): void {
  program
    .command('discord')
    .description('Create Discord webhook notification Stop Hook')
    .argument('<webhook_url>', 'Discord webhook URL for notifications')
    .option('-g, --global', 'Create global configuration in ~/.claude/')
    .action(async (webhookUrl: string, options: { global?: boolean }) => {
      try {
        await errorHandler.logInfo('Starting Discord command execution', {
          webhookUrl: webhookUrl.replace(/\/[\w-]+$/, '/***'), // Hide token in logs
          global: options.global,
        });

        await handleDiscordCommand({
          webhookUrl,
          options: { global: options.global },
        });
      } catch (error) {
        await errorHandler.handleUnknownError(error, {
          command: 'discord',
          webhookUrl: webhookUrl.replace(/\/[\w-]+$/, '/***'),
          global: options.global,
        });
      }
    });
}

/**
 * Handle Discord command execution
 */
export async function handleDiscordCommand(args: DiscordCommandArgs): Promise<void> {
  try {
    await errorHandler.logDebug('Validating Discord webhook URL');
    
    // Validate and sanitize webhook URL
    const sanitizedWebhookUrl = validateAndSanitizeDiscordUrl(args.webhookUrl);

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

    await errorHandler.logDebug('Generating Discord hook');
    
    // Generate Discord hook
    const discordHook = hookGenerator.generateDiscordHook(sanitizedWebhookUrl);

    await errorHandler.logDebug('Merging configuration');
    
    // Merge with existing configuration
    const updatedConfig = configManager.mergeConfig(existingConfig, {
      hooks: {
        Stop: [discordHook],
      },
    });

    await errorHandler.logDebug('Saving updated configuration');
    
    // Save updated configuration
    await configManager.saveConfig(configPath, updatedConfig);

    // Success message
    const configType = args.options.global ? 'global' : 'local';
    console.log(`✅ Discord Stop Hook created successfully!`);
    console.log(`📁 Configuration: ${configPath} (${configType})`);
    console.log(`🔗 Webhook URL: ${sanitizedWebhookUrl.replace(/\/[\w-]+$/, '/***')}`); // Hide token

    await errorHandler.logInfo('Discord Stop Hook created successfully', {
      configPath,
      configType,
    });
  } catch (error) {
    if (error instanceof CCNotifyError) {
      throw error;
    }
    
    // Wrap unknown errors with context
    throw errorHandler.createError(
      ErrorType.COMMAND_ERROR,
      'Failed to create Discord Stop Hook',
      error as Error,
      undefined,
      {
        command: 'discord',
        global: args.options.global,
        webhookUrl: args.webhookUrl.replace(/\/[\w-]+$/, '/***'),
      },
    );
  }
}

