import { ErrorType, CCNotifyError } from '../types/index.js';

/**
 * Discord webhook URL validation
 * Validates that the URL matches Discord's webhook URL format
 */
export function validateDiscordWebhookUrl(url: string): void {
  if (!url || typeof url !== 'string') {
    throw new CCNotifyError(
      ErrorType.INVALID_WEBHOOK_URL,
      'Discord webhook URL is required and must be a string'
    );
  }

  // Discord webhook URL pattern
  const discordWebhookPattern = /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
  
  if (!discordWebhookPattern.test(url)) {
    throw new CCNotifyError(
      ErrorType.INVALID_WEBHOOK_URL,
      'Invalid Discord webhook URL format. Expected format: https://discord.com/api/webhooks/{id}/{token}'
    );
  }
}

/**
 * ntfy topic name validation
 * Validates that the topic name follows ntfy naming conventions
 */
export function validateNtfyTopicName(topicName: string): void {
  if (!topicName || typeof topicName !== 'string') {
    throw new CCNotifyError(
      ErrorType.INVALID_TOPIC_NAME,
      'ntfy topic name is required and must be a string'
    );
  }

  // ntfy topic name pattern: alphanumeric, hyphens, underscores, 1-64 characters
  const ntfyTopicPattern = /^[a-zA-Z0-9_-]{1,64}$/;
  
  if (!ntfyTopicPattern.test(topicName)) {
    throw new CCNotifyError(
      ErrorType.INVALID_TOPIC_NAME,
      'Invalid ntfy topic name. Must be 1-64 characters long and contain only letters, numbers, hyphens, and underscores'
    );
  }

  // Additional validation: topic name cannot start or end with hyphen/underscore
  if (topicName.startsWith('-') || topicName.startsWith('_') || 
      topicName.endsWith('-') || topicName.endsWith('_')) {
    throw new CCNotifyError(
      ErrorType.INVALID_TOPIC_NAME,
      'ntfy topic name cannot start or end with hyphens or underscores'
    );
  }
}

/**
 * General input sanitization
 * Sanitizes string inputs to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters except newlines and tabs
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent extremely long inputs
  if (sanitized.length > 2048) {
    sanitized = sanitized.substring(0, 2048);
  }
  
  return sanitized;
}

/**
 * Validates and sanitizes a Discord webhook URL
 */
export function validateAndSanitizeDiscordUrl(url: string): string {
  const sanitized = sanitizeInput(url);
  validateDiscordWebhookUrl(sanitized);
  return sanitized;
}

/**
 * Validates and sanitizes an ntfy topic name
 */
export function validateAndSanitizeNtfyTopic(topicName: string): string {
  const sanitized = sanitizeInput(topicName);
  validateNtfyTopicName(sanitized);
  return sanitized;
}