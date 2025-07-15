import { dirname } from 'node:path';
import type { Command } from 'commander';
import { configManager } from '../services/config.js';
import { hookGenerator } from '../services/hooks.js';
import { validateAndSanitizeDiscordUrl } from '../services/validation.js';
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
        await handleDiscordCommand({
          webhookUrl,
          options: { global: options.global },
        });
      } catch (error) {
        handleCommandError(error);
      }
    });
}

/**
 * Handle Discord command execution
 */
export async function handleDiscordCommand(args: DiscordCommandArgs): Promise<void> {
  try {
    // Validate and sanitize webhook URL
    const sanitizedWebhookUrl = validateAndSanitizeDiscordUrl(args.webhookUrl);

    // Get configuration path
    const configPath = configManager.getConfigPath(args.options.global ?? false);
    const configDir = dirname(configPath);

    // Ensure configuration directory exists
    await fileSystemService.ensureDirectory(configDir);

    // Load existing configuration
    const existingConfig = await configManager.loadConfig(configPath);

    // Create backup if config file exists
    if (await fileSystemService.fileExists(configPath)) {
      await configManager.backupConfig(configPath);
    }

    // Generate Discord hook
    const discordHook = hookGenerator.generateDiscordHook(sanitizedWebhookUrl);

    // Merge with existing configuration
    const updatedConfig = configManager.mergeConfig(existingConfig, {
      hooks: {
        Stop: [discordHook],
      },
    });

    // Save updated configuration
    await configManager.saveConfig(configPath, updatedConfig);

    // Success message
    const configType = args.options.global ? 'global' : 'local';
    console.log(`✅ Discord Stop Hook created successfully!`);
    console.log(`📁 Configuration: ${configPath} (${configType})`);
    console.log(`🔗 Webhook URL: ${sanitizedWebhookUrl.replace(/\/[\w-]+$/, '/***')}`); // Hide token
  } catch (error) {
    if (error instanceof CCNotifyError) {
      throw error;
    }
    throw new CCNotifyError(
      ErrorType.FILE_PERMISSION_ERROR,
      'Failed to create Discord Stop Hook',
      error as Error,
    );
  }
}

/**
 * Handle command errors with user-friendly messages
 */
function handleCommandError(error: unknown): void {
  if (error instanceof CCNotifyError) {
    console.error(`❌ Error: ${error.message}`);
    if (error.originalError) {
      console.error(`   Details: ${error.originalError.message}`);
    }
    process.exit(getExitCode(error.type));
  } else {
    console.error(`❌ Unexpected error: ${error}`);
    process.exit(1);
  }
}

/**
 * Get appropriate exit code for error type
 */
function getExitCode(errorType: ErrorType): number {
  switch (errorType) {
    case ErrorType.INVALID_WEBHOOK_URL:
      return 2;
    case ErrorType.FILE_PERMISSION_ERROR:
      return 3;
    case ErrorType.JSON_PARSE_ERROR:
      return 4;
    case ErrorType.CONFIG_BACKUP_ERROR:
      return 5;
    default:
      return 1;
  }
}