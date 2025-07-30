import { promises as fs, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Get XDG data home directory
 */
function getXdgDataHome(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return xdgDataHome;
  }
  return join(homedir(), '.local', 'share');
}

/**
 * Get ccnotify data directory
 */
function getCcnotifyDataDir(): string {
  return join(getXdgDataHome(), 'ccnotify');
}

/**
 * Notification log levels
 */
export enum NotificationLogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

/**
 * Notification types
 */
export enum NotificationType {
  DISCORD = 'discord',
  NTFY = 'ntfy',
  MACOS = 'macos',
}

/**
 * Notification execution result
 */
export enum NotificationResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  SKIPPED = 'skipped',
}

/**
 * Notification log entry structure
 */
export interface NotificationLogEntry {
  timestamp: string;
  level: NotificationLogLevel;
  type: NotificationType;
  result: NotificationResult;
  message: string;
  details?: {
    webhookUrl?: string;
    topicName?: string;
    title?: string;
    error?: string;
    responseCode?: number;
    responseBody?: string;
    executionTime?: number;
    transcriptPath?: string;
    userMessage?: string;
    assistantMessage?: string;
  };
  context?: Record<string, any>;
}

/**
 * Notification logger configuration
 */
export interface NotificationLoggerConfig {
  enabled: boolean;
  logToFile: boolean;
  logFilePath?: string;
  logLevel: NotificationLogLevel;
  maxLogEntries: number;
  includeTranscripts: boolean;
  includeResponses: boolean;
}

/**
 * Notification logger service for tracking notification execution
 */
export class NotificationLogger {
  private config: NotificationLoggerConfig;
  private logBuffer: NotificationLogEntry[] = [];
  private readonly defaultLogPath = join(getCcnotifyDataDir(), 'notifications.log');

  constructor(config: Partial<NotificationLoggerConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      logToFile: config.logToFile ?? true,
      logFilePath: config.logFilePath ?? this.defaultLogPath,
      logLevel: config.logLevel ?? NotificationLogLevel.INFO,
      maxLogEntries: config.maxLogEntries ?? 1000,
      includeTranscripts: config.includeTranscripts ?? false,
      includeResponses: config.includeResponses ?? false,
      ...config,
    };

    // Load existing logs from file
    this.loadLogsFromFile();
  }

  /**
   * Log notification execution start
   */
  async logNotificationStart(
    type: NotificationType,
    details: {
      webhookUrl?: string;
      topicName?: string;
      title?: string;
      transcriptPath?: string;
    }
  ): Promise<void> {
    if (!this.config.enabled) return;

    const entry: NotificationLogEntry = {
      timestamp: new Date().toISOString(),
      level: NotificationLogLevel.INFO,
      type,
      result: NotificationResult.SUCCESS,
      message: `Starting ${type} notification`,
      details: {
        ...details,
        webhookUrl: details.webhookUrl ? this.maskWebhookUrl(details.webhookUrl) : undefined,
      },
    };

    await this.addLogEntry(entry);
  }

  /**
   * Log notification execution success
   */
  async logNotificationSuccess(
    type: NotificationType,
    details: {
      webhookUrl?: string;
      topicName?: string;
      title?: string;
      responseCode?: number;
      responseBody?: string;
      executionTime?: number;
      userMessage?: string;
      assistantMessage?: string;
    }
  ): Promise<void> {
    if (!this.config.enabled) return;

    const entry: NotificationLogEntry = {
      timestamp: new Date().toISOString(),
      level: NotificationLogLevel.INFO,
      type,
      result: NotificationResult.SUCCESS,
      message: `${type} notification sent successfully`,
      details: {
        ...details,
        webhookUrl: details.webhookUrl ? this.maskWebhookUrl(details.webhookUrl) : undefined,
        responseBody: this.config.includeResponses ? details.responseBody : undefined,
        userMessage: this.config.includeTranscripts ? details.userMessage : undefined,
        assistantMessage: this.config.includeTranscripts ? details.assistantMessage : undefined,
      },
    };

    await this.addLogEntry(entry);
  }

  /**
   * Log notification execution failure
   */
  async logNotificationFailure(
    type: NotificationType,
    error: string,
    details: {
      webhookUrl?: string;
      topicName?: string;
      title?: string;
      responseCode?: number;
      responseBody?: string;
      executionTime?: number;
      userMessage?: string;
      assistantMessage?: string;
    }
  ): Promise<void> {
    if (!this.config.enabled) return;

    const entry: NotificationLogEntry = {
      timestamp: new Date().toISOString(),
      level: NotificationLogLevel.ERROR,
      type,
      result: NotificationResult.FAILED,
      message: `${type} notification failed: ${error}`,
      details: {
        ...details,
        error,
        webhookUrl: details.webhookUrl ? this.maskWebhookUrl(details.webhookUrl) : undefined,
        responseBody: this.config.includeResponses ? details.responseBody : undefined,
        userMessage: this.config.includeTranscripts ? details.userMessage : undefined,
        assistantMessage: this.config.includeTranscripts ? details.assistantMessage : undefined,
      },
    };

    await this.addLogEntry(entry);
  }

  /**
   * Log notification timeout
   */
  async logNotificationTimeout(
    type: NotificationType,
    details: {
      webhookUrl?: string;
      topicName?: string;
      title?: string;
      executionTime?: number;
    }
  ): Promise<void> {
    if (!this.config.enabled) return;

    const entry: NotificationLogEntry = {
      timestamp: new Date().toISOString(),
      level: NotificationLogLevel.WARN,
      type,
      result: NotificationResult.TIMEOUT,
      message: `${type} notification timed out`,
      details: {
        ...details,
        webhookUrl: details.webhookUrl ? this.maskWebhookUrl(details.webhookUrl) : undefined,
      },
    };

    await this.addLogEntry(entry);
  }

  /**
   * Log notification skipped
   */
  async logNotificationSkipped(
    type: NotificationType,
    reason: string,
    details: {
      webhookUrl?: string;
      topicName?: string;
      title?: string;
      userMessage?: string;
      assistantMessage?: string;
    }
  ): Promise<void> {
    if (!this.config.enabled) return;

    const entry: NotificationLogEntry = {
      timestamp: new Date().toISOString(),
      level: NotificationLogLevel.DEBUG,
      type,
      result: NotificationResult.SKIPPED,
      message: `${type} notification skipped: ${reason}`,
      details: {
        ...details,
        webhookUrl: details.webhookUrl ? this.maskWebhookUrl(details.webhookUrl) : undefined,
        userMessage: this.config.includeTranscripts ? details.userMessage : undefined,
        assistantMessage: this.config.includeTranscripts ? details.assistantMessage : undefined,
      },
    };

    await this.addLogEntry(entry);
  }

  /**
   * Log debug information
   */
  async logDebug(type: NotificationType, message: string, details?: Record<string, any>): Promise<void> {
    if (!this.config.enabled || this.config.logLevel < NotificationLogLevel.DEBUG) return;

    const entry: NotificationLogEntry = {
      timestamp: new Date().toISOString(),
      level: NotificationLogLevel.DEBUG,
      type,
      result: NotificationResult.SUCCESS,
      message,
      details,
    };

    await this.addLogEntry(entry);
  }

  /**
   * Get recent notification logs
   */
  async getRecentLogs(limit: number = 50): Promise<NotificationLogEntry[]> {
    return this.logBuffer.slice(-limit);
  }

  /**
   * Get notification logs by type
   */
  async getLogsByType(type: NotificationType, limit: number = 50): Promise<NotificationLogEntry[]> {
    return this.logBuffer.filter(entry => entry.type === type).slice(-limit);
  }

  /**
   * Get failed notification logs
   */
  async getFailedLogs(limit: number = 50): Promise<NotificationLogEntry[]> {
    return this.logBuffer.filter(entry => entry.result === NotificationResult.FAILED).slice(-limit);
  }

  /**
   * Clear log buffer
   */
  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Export logs to file
   */
  async exportLogs(filePath: string): Promise<void> {
    try {
      const logDir = join(filePath, '..');
      await fs.mkdir(logDir, { recursive: true });

      const logData = {
        exportTimestamp: new Date().toISOString(),
        totalEntries: this.logBuffer.length,
        entries: this.logBuffer,
      };

      await fs.writeFile(filePath, JSON.stringify(logData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to export notification logs:', error);
    }
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): {
    total: number;
    success: number;
    failed: number;
    timeout: number;
    skipped: number;
    byType: Record<NotificationType, { total: number; success: number; failed: number }>;
  } {
    const stats = {
      total: this.logBuffer.length,
      success: 0,
      failed: 0,
      timeout: 0,
      skipped: 0,
      byType: {
        [NotificationType.DISCORD]: { total: 0, success: 0, failed: 0 },
        [NotificationType.NTFY]: { total: 0, success: 0, failed: 0 },
        [NotificationType.MACOS]: { total: 0, success: 0, failed: 0 },
      },
    };

    for (const entry of this.logBuffer) {
      switch (entry.result) {
        case NotificationResult.SUCCESS:
          stats.success++;
          stats.byType[entry.type].success++;
          break;
        case NotificationResult.FAILED:
          stats.failed++;
          stats.byType[entry.type].failed++;
          break;
        case NotificationResult.TIMEOUT:
          stats.timeout++;
          break;
        case NotificationResult.SKIPPED:
          stats.skipped++;
          break;
      }
      stats.byType[entry.type].total++;
    }

    return stats;
  }

  /**
   * Add log entry to buffer and file
   */
  private async addLogEntry(entry: NotificationLogEntry): Promise<void> {
    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.config.maxLogEntries) {
      this.logBuffer.shift();
    }

    // Log to file if enabled
    if (this.config.logToFile) {
      await this.logToFile(entry);
    }
  }

  /**
   * Log to file
   */
  private async logToFile(entry: NotificationLogEntry): Promise<void> {
    if (!this.config.logFilePath) return;

    try {
      // Ensure log directory exists
      const logDir = join(this.config.logFilePath, '..');
      await fs.mkdir(logDir, { recursive: true });

      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.config.logFilePath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to notification log file:', error);
    }
  }

  /**
   * Mask webhook URL for security
   */
  private maskWebhookUrl(url: string): string {
    return url.replace(/\/[\w-]+$/, '/***');
  }

  /**
   * Load existing logs from file
   */
  private loadLogsFromFile(): void {
    if (!this.config.logFilePath) return;

    try {
      const logContent = readFileSync(this.config.logFilePath, 'utf8');
      const lines = logContent.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as NotificationLogEntry;

          // Handle logs from older versions that don't have result field
          if (!entry.result) {
            // Infer result from message
            if (entry.message.includes('sent successfully')) {
              entry.result = NotificationResult.SUCCESS;
            } else if (entry.message.includes('failed')) {
              entry.result = NotificationResult.FAILED;
            } else if (entry.message.includes('timed out')) {
              entry.result = NotificationResult.TIMEOUT;
            } else if (entry.message.includes('skipped')) {
              entry.result = NotificationResult.SKIPPED;
            } else {
              // Default to success for "Starting" messages
              entry.result = NotificationResult.SUCCESS;
            }
          }

          this.logBuffer.push(entry);
        } catch (parseError) {
          // Skip invalid JSON lines
        }
      }

      // Trim buffer to max entries
      if (this.logBuffer.length > this.config.maxLogEntries) {
        this.logBuffer = this.logBuffer.slice(-this.config.maxLogEntries);
      }
    } catch (error) {
      // File might not exist yet, which is fine
    }
  }
}

/**
 * Default notification logger instance
 */
export const notificationLogger = new NotificationLogger();
