import type { Command } from 'commander';
import { errorHandler } from '../services/error-handler.js';
import { NotificationType, notificationLogger } from '../services/notification-logger.js';

/**
 * Register logs command with commander
 */
export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('View notification logs and statistics')
    .option('-t, --type <type>', 'Filter by notification type (discord, ntfy, macos)')
    .option('-f, --failed', 'Show only failed notifications')
    .option('-l, --limit <number>', 'Number of log entries to show (default: 50)', '50')
    .option('-s, --stats', 'Show notification statistics')
    .option('-e, --export <file>', 'Export logs to JSON file')
    .action(async (options: { type?: string; failed?: boolean; limit?: string; stats?: boolean; export?: string }) => {
      try {
        await errorHandler.logInfo('Starting logs command execution', { options });

        await handleLogsCommand(options);
      } catch (error) {
        await errorHandler.handleUnknownError(error, {
          command: 'logs',
          options,
        });
      }
    });
}

/**
 * Handle logs command execution
 */
export async function handleLogsCommand(options: {
  type?: string;
  failed?: boolean;
  limit?: string;
  stats?: boolean;
  export?: string;
}): Promise<void> {
  const limit = parseInt(options.limit || '50', 10);

  // Validate notification type if provided
  if (options.type && !Object.values(NotificationType).includes(options.type as NotificationType)) {
    console.error('❌ Invalid notification type. Valid types: discord, ntfy, macos');
    process.exit(1);
  }

  // Export logs if requested
  if (options.export) {
    await notificationLogger.exportLogs(options.export);
    console.log(`✅ Logs exported to: ${options.export}`);
    return;
  }

  // Show statistics if requested
  if (options.stats) {
    const stats = notificationLogger.getNotificationStats();
    console.log('\n📊 Notification Statistics:');
    console.log('========================');
    console.log(`Total notifications: ${stats.total}`);
    console.log(`Successful: ${stats.success}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Timeout: ${stats.timeout}`);
    console.log(`Skipped: ${stats.skipped}`);

    console.log('\nBy Type:');
    Object.entries(stats.byType).forEach(([type, typeStats]) => {
      if (typeStats.total > 0) {
        const successRate = ((typeStats.success / typeStats.total) * 100).toFixed(1);
        console.log(`  ${type}: ${typeStats.total} total, ${typeStats.success} success (${successRate}%)`);
      }
    });
    return;
  }

  // Get logs based on filters
  let logs;
  if (options.failed) {
    logs = await notificationLogger.getFailedLogs(limit);
  } else if (options.type) {
    logs = await notificationLogger.getLogsByType(options.type as NotificationType, limit);
  } else {
    logs = await notificationLogger.getRecentLogs(limit);
  }

  if (logs.length === 0) {
    console.log('📭 No log entries found matching the criteria.');
    return;
  }

  // Display logs
  console.log(`\n📋 Notification Logs (${logs.length} entries):`);
  console.log('=====================================');

  logs.reverse().forEach((log, index) => {
    const timestamp = new Date(log.timestamp).toLocaleString();
    const levelIcon = getLevelIcon(log.level);
    const resultIcon = getResultIcon(log.result);

    console.log(`\n${index + 1}. ${levelIcon} ${resultIcon} ${log.type.toUpperCase()} - ${timestamp}`);
    console.log(`   Message: ${log.message}`);

    if (log.details) {
      if (log.details.error) {
        console.log(`   Error: ${log.details.error}`);
      }
      if (log.details.responseCode) {
        console.log(`   Response Code: ${log.details.responseCode}`);
      }
      if (log.details.executionTime) {
        console.log(`   Execution Time: ${log.details.executionTime}s`);
      }
      if (log.details.webhookUrl) {
        console.log(`   Webhook: ${log.details.webhookUrl}`);
      }
      if (log.details.topicName) {
        console.log(`   Topic: ${log.details.topicName}`);
      }
      if (log.details.title) {
        console.log(`   Title: ${log.details.title}`);
      }
    }
  });

  console.log(
    `\n💡 Tip: Use 'ccnotify logs --stats' to see statistics or 'ccnotify logs --export <file>' to export logs.`
  );
}

/**
 * Get icon for log level
 */
function getLevelIcon(level: string): string {
  switch (level) {
    case 'ERROR':
      return '❌';
    case 'WARN':
      return '⚠️';
    case 'INFO':
      return 'ℹ️';
    case 'DEBUG':
      return '🐛';
    default:
      return '📝';
  }
}

/**
 * Get icon for notification result
 */
function getResultIcon(result: string): string {
  switch (result) {
    case 'success':
      return '✅';
    case 'failed':
      return '❌';
    case 'timeout':
      return '⏰';
    case 'skipped':
      return '⏭️';
    default:
      return '❓';
  }
}
