// TypeScript type definitions for ccnotify

/**
 * Claude configuration structure
 */
export interface ClaudeConfig {
  hooks?: {
    Stop?: StopHook[];
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Stop hook configuration
 */
export interface StopHook {
  matcher: string;
  hooks: Hook[];
}

/**
 * Individual hook definition
 */
export interface Hook {
  type: 'command';
  command: string;
}

/**
 * Command options for CLI commands
 */
export interface CommandOptions {
  global?: boolean;
}

/**
 * Discord command arguments
 */
export interface DiscordCommandArgs {
  webhookUrl: string;
  options: CommandOptions;
}

/**
 * ntfy command arguments
 */
export interface NtfyCommandArgs {
  topicName: string;
  options: CommandOptions;
}

/**
 * Error types for the application
 */
export enum ErrorType {
  INVALID_WEBHOOK_URL = 'INVALID_WEBHOOK_URL',
  INVALID_TOPIC_NAME = 'INVALID_TOPIC_NAME',
  FILE_PERMISSION_ERROR = 'FILE_PERMISSION_ERROR',
  JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
  CONFIG_BACKUP_ERROR = 'CONFIG_BACKUP_ERROR',
}

/**
 * Custom error class for ccnotify application
 */
export class CCNotifyError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'CCNotifyError';
  }
}
