import { dirname, join } from 'node:path';
import type { Command } from 'commander';
import { configManager } from '../services/config.js';
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
        await handleNtfyCommand({
          topicName,
          options: { global: options.global },
        });
      } catch (error) {
        handleCommandError(error);
      }
    });
}

/**
 * Handle ntfy command execution
 */
export async function handleNtfyCommand(args: NtfyCommandArgs): Promise<void> {
  try {
    // Validate and sanitize topic name
    const sanitizedTopicName = validateAndSanitizeNtfyTopic(args.topicName);

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

    // Generate ntfy hook
    const ntfyHook = hookGenerator.generateNtfyHook(sanitizedTopicName);

    // Merge with existing configuration
    const updatedConfig = configManager.mergeConfig(existingConfig, {
      hooks: {
        Stop: [ntfyHook],
      },
    });

    // Save updated configuration
    await configManager.saveConfig(configPath, updatedConfig);

    // Create ntfy.sh script in the same directory as settings.json
    const scriptPath = join(configDir, 'ntfy.sh');
    await hookGenerator.createNtfyScript(sanitizedTopicName, scriptPath);

    // Success message
    const configType = args.options.global ? 'global' : 'local';
    console.log(`✅ ntfy Stop Hook created successfully!`);
    console.log(`📁 Configuration: ${configPath} (${configType})`);
    console.log(`📜 Script: ${scriptPath}`);
    console.log(`📢 Topic: ${sanitizedTopicName}`);
  } catch (error) {
    if (error instanceof CCNotifyError) {
      throw error;
    }
    throw new CCNotifyError(
      ErrorType.FILE_PERMISSION_ERROR,
      'Failed to create ntfy Stop Hook',
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
    case ErrorType.INVALID_TOPIC_NAME:
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
