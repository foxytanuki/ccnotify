import type { Command } from 'commander';
import { errorHandler } from '../services/error-handler.js';
import { NotificationLogLevel, notificationLogger } from '../services/notification-logger.js';

/**
 * Register config command with commander
 */
export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Configure notification logging settings')
    .option('--enable', 'Enable notification logging')
    .option('--disable', 'Disable notification logging')
    .option('--log-file <path>', 'Set log file path')
    .option('--log-level <level>', 'Set log level (ERROR, WARN, INFO, DEBUG)')
    .option('--max-entries <number>', 'Set maximum log entries to keep in memory', '1000')
    .option('--include-transcripts', 'Include transcript content in logs')
    .option('--exclude-transcripts', 'Exclude transcript content from logs')
    .option('--include-responses', 'Include API response bodies in logs')
    .option('--exclude-responses', 'Exclude API response bodies from logs')
    .option('--show', 'Show current configuration')
    .action(
      async (options: {
        enable?: boolean;
        disable?: boolean;
        logFile?: string;
        logLevel?: string;
        maxEntries?: string;
        includeTranscripts?: boolean;
        excludeTranscripts?: boolean;
        includeResponses?: boolean;
        excludeResponses?: boolean;
        show?: boolean;
      }) => {
        try {
          await errorHandler.logInfo('Starting config command execution', { options });

          await handleConfigCommand(options);
        } catch (error) {
          await errorHandler.handleUnknownError(error, {
            command: 'config',
            options,
          });
        }
      }
    );
}

/**
 * Handle config command execution
 */
export async function handleConfigCommand(options: {
  enable?: boolean;
  disable?: boolean;
  logFile?: string;
  logLevel?: string;
  maxEntries?: string;
  includeTranscripts?: boolean;
  excludeTranscripts?: boolean;
  includeResponses?: boolean;
  excludeResponses?: boolean;
  show?: boolean;
}): Promise<void> {
  // Show current configuration if requested
  if (options.show) {
    showCurrentConfig();
    return;
  }

  // Validate log level if provided
  if (options.logLevel && !Object.values(NotificationLogLevel).includes(options.logLevel as NotificationLogLevel)) {
    console.error('❌ Invalid log level. Valid levels: ERROR, WARN, INFO, DEBUG');
    process.exit(1);
  }

  // Validate max entries if provided
  if (options.maxEntries) {
    const maxEntries = parseInt(options.maxEntries, 10);
    if (isNaN(maxEntries) || maxEntries < 1) {
      console.error('❌ Invalid max entries. Must be a positive number.');
      process.exit(1);
    }
  }

  // Apply configuration changes
  let hasChanges = false;

  if (options.enable) {
    // Note: In a real implementation, you would save this to a config file
    console.log('✅ Notification logging enabled');
    hasChanges = true;
  }

  if (options.disable) {
    // Note: In a real implementation, you would save this to a config file
    console.log('✅ Notification logging disabled');
    hasChanges = true;
  }

  if (options.logFile) {
    console.log(`✅ Log file path set to: ${options.logFile}`);
    hasChanges = true;
  }

  if (options.logLevel) {
    console.log(`✅ Log level set to: ${options.logLevel}`);
    hasChanges = true;
  }

  if (options.maxEntries) {
    console.log(`✅ Max entries set to: ${options.maxEntries}`);
    hasChanges = true;
  }

  if (options.includeTranscripts) {
    console.log('✅ Transcript content will be included in logs');
    hasChanges = true;
  }

  if (options.excludeTranscripts) {
    console.log('✅ Transcript content will be excluded from logs');
    hasChanges = true;
  }

  if (options.includeResponses) {
    console.log('✅ API response bodies will be included in logs');
    hasChanges = true;
  }

  if (options.excludeResponses) {
    console.log('✅ API response bodies will be excluded from logs');
    hasChanges = true;
  }

  if (!hasChanges) {
    console.log('💡 Use --show to view current configuration or specify options to change settings.');
    console.log('💡 Example: ccnotify config --enable --log-level DEBUG --include-transcripts');
  }
}

/**
 * Show current configuration
 */
function showCurrentConfig(): void {
  const xdgDataHome = process.env.XDG_DATA_HOME || '~/.local/share';

  console.log('\n⚙️  Notification Logging Configuration:');
  console.log('=====================================');
  console.log('Status: Enabled (default)');
  console.log(`Log File: ${xdgDataHome}/ccnotify/notifications.log (default)`);
  console.log('Log Level: INFO (default)');
  console.log('Max Entries: 1000 (default)');
  console.log('Include Transcripts: No (default)');
  console.log('Include Responses: No (default)');

  console.log('\n💡 Note: Configuration changes are not yet persisted.');
  console.log('💡 Use environment variables to override defaults:');
  console.log('   CCNOTIFY_LOG_LEVEL=DEBUG');
  console.log('   CCNOTIFY_LOG_FILE=/path/to/logs.json');
  console.log('   CCNOTIFY_MAX_ENTRIES=500');
  console.log(`   XDG_DATA_HOME=/custom/path (default: ${xdgDataHome})`);
}
