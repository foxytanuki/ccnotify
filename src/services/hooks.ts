import { dirname } from 'node:path';
import { CCNotifyError, ErrorSeverity, ErrorType, type StopHook } from '../types/index.js';
import { fileSystemService } from '../utils/file.js';
import { pathResolver } from '../utils/paths.js';
import { errorHandler } from './error-handler.js';
import { NotificationType, notificationLogger } from './notification-logger.js';

/**
 * Hook generator interface
 */
export interface HookGenerator {
  generateDiscordHook(webhookUrl: string, isGlobal?: boolean): Promise<StopHook>;
  generateNtfyHook(topicName: string, isGlobal?: boolean): Promise<StopHook>;
  generateMacOSHook(title?: string, isGlobal?: boolean): Promise<StopHook>;
}

/**
 * Implementation of hook generation logic
 */
export class HookGeneratorImpl implements HookGenerator {
  /**
   * Generate Discord webhook Stop Hook configuration
   */
  async generateDiscordHook(webhookUrl: string, isGlobal: boolean = false): Promise<StopHook> {
    const scriptName = 'discord-notification.sh';
    const scriptPath = pathResolver.getScriptPath(isGlobal, scriptName);

    // Ensure ccnotify data directory exists
    await pathResolver.ensureCcnotifyDataDir();

    // Create the script file
    await this.createDiscordScript(webhookUrl, scriptPath);

    return {
      matcher: 'discord-notification',
      hooks: [
        {
          type: 'command',
          command: scriptPath,
        },
      ],
    };
  }

  /**
   * Generate ntfy Stop Hook configuration
   */
  async generateNtfyHook(topicName: string, isGlobal: boolean = false): Promise<StopHook> {
    const scriptName = 'ntfy-notification.sh';
    const scriptPath = pathResolver.getScriptPath(isGlobal, scriptName);

    // Ensure ccnotify data directory exists
    await pathResolver.ensureCcnotifyDataDir();

    // Create the script file
    await this.createNtfyScript(topicName, scriptPath);

    return {
      matcher: 'ntfy-notification',
      hooks: [
        {
          type: 'command',
          command: scriptPath,
        },
      ],
    };
  }

  /**
   * Generate macOS notification Stop Hook configuration
   */
  async generateMacOSHook(title?: string, isGlobal: boolean = false): Promise<StopHook> {
    const scriptName = 'macos-notification.sh';
    const scriptPath = pathResolver.getScriptPath(isGlobal, scriptName);

    // Ensure ccnotify data directory exists
    await pathResolver.ensureCcnotifyDataDir();

    // Create the script file
    await this.createMacOSScript(title, scriptPath);

    return {
      matcher: 'macos-notification',
      hooks: [
        {
          type: 'command',
          command: scriptPath,
        },
      ],
    };
  }

  /**
   * Create Discord notification script file
   */
  private async createDiscordScript(webhookUrl: string, scriptPath: string): Promise<void> {
    try {
      await errorHandler.logDebug('Creating Discord script', { scriptPath });

      // Ensure the directory exists
      const scriptDir = dirname(scriptPath);
      try {
        await fileSystemService.ensureDirectory(scriptDir);
      } catch (error) {
        throw errorHandler.wrapFileSystemError(error, 'create script directory', scriptDir);
      }

      // Generate the script content
      const scriptContent = this.generateDiscordScriptContent(webhookUrl);

      // Write the script file
      try {
        await fileSystemService.writeFile(scriptPath, scriptContent);
      } catch (error) {
        throw errorHandler.wrapFileSystemError(error, 'write script file', scriptPath);
      }

      // Make the script executable (Unix-like systems)
      if (process.platform !== 'win32') {
        try {
          const { chmod } = await import('node:fs/promises');
          await chmod(scriptPath, 0o755);
          await errorHandler.logDebug('Discord script made executable');
        } catch (error) {
          // Log warning but don't fail - script can still work without execute permissions
          await errorHandler.logWarning('Failed to make Discord script executable', {
            scriptPath,
            error: (error as Error).message,
          });
        }
      }

      await errorHandler.logDebug('Discord script created successfully');
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }

      throw errorHandler.createError(
        ErrorType.SCRIPT_CREATION_ERROR,
        `Failed to create Discord script at ${scriptPath}`,
        error as Error,
        ErrorSeverity.HIGH,
        { webhookUrl: webhookUrl.replace(/\/[\w-]+$/, '/***'), scriptPath, operation: 'createDiscordScript' }
      );
    }
  }

  /**
   * Create ntfy notification script file
   */
  private async createNtfyScript(topicName: string, scriptPath: string): Promise<void> {
    try {
      await errorHandler.logDebug('Creating ntfy script', { topicName, scriptPath });

      // Ensure the directory exists
      const scriptDir = dirname(scriptPath);
      try {
        await fileSystemService.ensureDirectory(scriptDir);
      } catch (error) {
        throw errorHandler.wrapFileSystemError(error, 'create script directory', scriptDir);
      }

      // Generate the script content
      const scriptContent = this.generateNtfyScriptContent(topicName);

      // Write the script file
      try {
        await fileSystemService.writeFile(scriptPath, scriptContent);
      } catch (error) {
        throw errorHandler.wrapFileSystemError(error, 'write script file', scriptPath);
      }

      // Make the script executable (Unix-like systems)
      if (process.platform !== 'win32') {
        try {
          const { chmod } = await import('node:fs/promises');
          await chmod(scriptPath, 0o755);
          await errorHandler.logDebug('ntfy script made executable');
        } catch (error) {
          // Log warning but don't fail - script can still work without execute permissions
          await errorHandler.logWarning('Failed to make ntfy script executable', {
            scriptPath,
            error: (error as Error).message,
          });
        }
      }

      await errorHandler.logDebug('ntfy script created successfully');
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }

      throw errorHandler.createError(
        ErrorType.SCRIPT_CREATION_ERROR,
        `Failed to create ntfy script at ${scriptPath}`,
        error as Error,
        ErrorSeverity.HIGH,
        { topicName, scriptPath, operation: 'createNtfyScript' }
      );
    }
  }

  /**
   * Create macOS notification script file
   */
  private async createMacOSScript(title?: string, scriptPath?: string): Promise<void> {
    if (!scriptPath) {
      throw errorHandler.createError(
        ErrorType.SCRIPT_CREATION_ERROR,
        'Script path is required for macOS script creation',
        undefined,
        ErrorSeverity.HIGH,
        { title, operation: 'createMacOSScript' }
      );
    }

    try {
      await errorHandler.logDebug('Creating macOS script', { title, scriptPath });

      // Ensure the directory exists
      const scriptDir = dirname(scriptPath);
      try {
        await fileSystemService.ensureDirectory(scriptDir);
      } catch (error) {
        throw errorHandler.wrapFileSystemError(error, 'create script directory', scriptDir);
      }

      // Generate the script content
      const scriptContent = this.generateMacOSScriptContent(title);

      // Write the script file
      try {
        await fileSystemService.writeFile(scriptPath, scriptContent);
      } catch (error) {
        throw errorHandler.wrapFileSystemError(error, 'write script file', scriptPath);
      }

      // Make the script executable (Unix-like systems)
      if (process.platform !== 'win32') {
        try {
          const { chmod } = await import('node:fs/promises');
          await chmod(scriptPath, 0o755);
          await errorHandler.logDebug('macOS script made executable');
        } catch (error) {
          // Log warning but don't fail - script can still work without execute permissions
          await errorHandler.logWarning('Failed to make macOS script executable', {
            scriptPath,
            error: (error as Error).message,
          });
        }
      }

      await errorHandler.logDebug('macOS script created successfully');
    } catch (error) {
      if (error instanceof CCNotifyError) {
        throw error;
      }

      throw errorHandler.createError(
        ErrorType.SCRIPT_CREATION_ERROR,
        `Failed to create macOS script at ${scriptPath}`,
        error as Error,
        ErrorSeverity.HIGH,
        { title, scriptPath, operation: 'createMacOSScript' }
      );
    }
  }

  /**
   * Generate Discord script content
   */
  private generateDiscordScriptContent(webhookUrl: string): string {
    return `#!/bin/bash
# Process transcript and send to Discord with logging
TRANSCRIPT=$(jq -r .transcript_path)
XDG_DATA_HOME="\${XDG_DATA_HOME:-\$HOME/.local/share}"
LOG_FILE="\$XDG_DATA_HOME/ccnotify/notifications.log"
LOG_DIR="\$XDG_DATA_HOME/ccnotify"

# Ensure log directory exists
mkdir -p "\$LOG_DIR"

# Log function
log_notification() {
  local level="$1"
  local message="$2"
  local details="$3"
  echo "{\\"timestamp\\":\\"\$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\\",\\"level\\":\\"$level\\",\\"type\\":\\"discord\\",\\"message\\":\\"$message\\",\\"details\\":$details}" >> "$LOG_FILE"
}

# Get latest assistant message
LATEST_MSG=$(tail -1 "$TRANSCRIPT" | jq -r '.message.content[0].text // empty')

# Get latest user message using a temporary file for portability
USER_MSG=""
TEMP_FILE=$(mktemp)
tac "$TRANSCRIPT" > "$TEMP_FILE"
while IFS= read -r line; do
  TYPE=$(echo "$line" | jq -r '.type // empty')
  if [ "$TYPE" = "user" ]; then
    ROLE=$(echo "$line" | jq -r '.message.role // empty')
    if [ "$ROLE" = "user" ]; then
      CONTENT=$(echo "$line" | jq -r '.message.content // empty')
      if [ -n "$CONTENT" ] && [ "\${CONTENT:0:1}" != "[" ]; then
        USER_MSG="$CONTENT"
        break
      fi
    fi
  fi
done < "$TEMP_FILE"
rm -f "$TEMP_FILE"

# Log notification start
log_notification "INFO" "Starting discord notification" "{\\"webhookUrl\\":\\"${webhookUrl.replace(/\/[\w-]+$/, '/***')}\\",\\"transcriptPath\\":\\"$TRANSCRIPT\\"}"

# Format message for Discord
if [ -n "$LATEST_MSG" ]; then
  # Truncate and format the assistant message
  FORMATTED_MSG=$(echo "$LATEST_MSG" | head -c 1800 | sed 's/"/\\\\"/g')
  
  # Create Discord embed payload
  DISCORD_PAYLOAD=$(cat <<EOF
{
  "embeds": [{
    "title": "Claude Code Operation Completed",
    "description": "\${USER_MSG:0:200}",
    "color": 5814783,
    "fields": [{
      "name": "Assistant Response",
      "value": "\${FORMATTED_MSG:0:1000}",
      "inline": false
    }],
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
  }]
}
EOF
)
  
  # Send to Discord webhook with timeout and logging
  START_TIME=$(date +%s)
  RESPONSE=$(curl -s -w "\\n%{http_code}" --max-time 30 -H "Content-Type: application/json" -d "$DISCORD_PAYLOAD" "${webhookUrl}" 2>&1)
  END_TIME=$(date +%s)
  EXECUTION_TIME=$((END_TIME - START_TIME))
  
  # Extract response code and body
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)
  
  if [ "$HTTP_CODE" = "204" ]; then
    log_notification "INFO" "Discord notification sent successfully" "{\\"webhookUrl\\":\\"${webhookUrl.replace(/\/[\w-]+$/, '/***')}\\",\\"responseCode\\":$HTTP_CODE,\\"executionTime\\":$EXECUTION_TIME}"
  else
    log_notification "ERROR" "Discord notification failed" "{\\"webhookUrl\\":\\"${webhookUrl.replace(/\/[\w-]+$/, '/***')}\\",\\"responseCode\\":$HTTP_CODE,\\"responseBody\\":\\"$RESPONSE_BODY\\",\\"executionTime\\":$EXECUTION_TIME,\\"error\\":\\"HTTP $HTTP_CODE\\"}"
  fi
else
  log_notification "DEBUG" "Discord notification skipped" "{\\"webhookUrl\\":\\"${webhookUrl.replace(/\/[\w-]+$/, '/***')}\\",\\"reason\\":\\"No assistant message found\\"}"
fi`;
  }

  /**
   * Generate ntfy script content
   */
  private generateNtfyScriptContent(topicName: string): string {
    return `#!/bin/bash
# Process transcript and send to ntfy with logging
TRANSCRIPT=$(jq -r .transcript_path)
XDG_DATA_HOME="\${XDG_DATA_HOME:-\$HOME/.local/share}"
LOG_FILE="\$XDG_DATA_HOME/ccnotify/notifications.log"
LOG_DIR="\$XDG_DATA_HOME/ccnotify"

# Ensure log directory exists
mkdir -p "\$LOG_DIR"

# Log function
log_notification() {
  local level="$1"
  local message="$2"
  local details="$3"
  echo "{\\"timestamp\\":\\"\$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\\",\\"level\\":\\"$level\\",\\"type\\":\\"ntfy\\",\\"message\\":\\"$message\\",\\"details\\":$details}" >> "$LOG_FILE"
}

# Default topic name with unique identifier
DEFAULT_TOPIC_NAME="${topicName}"

# Configuration (use environment variable if set, otherwise use default)
TOPIC_NAME="\${NTFY_TOPIC:-$DEFAULT_TOPIC_NAME}"

# Get latest assistant message
LATEST_MSG=$(tail -1 "$TRANSCRIPT" | jq -r '.message.content[0].text // empty')

# Get latest user message using a temporary file for portability
USER_MSG=""
TEMP_FILE=$(mktemp)
tac "$TRANSCRIPT" > "$TEMP_FILE"
while IFS= read -r line; do
  TYPE=$(echo "$line" | jq -r '.type // empty')
  if [ "$TYPE" = "user" ]; then
    ROLE=$(echo "$line" | jq -r '.message.role // empty')
    if [ "$ROLE" = "user" ]; then
      CONTENT=$(echo "$line" | jq -r '.message.content // empty')
      # Only use content if it's a string and doesn't start with [
      if [ -n "$CONTENT" ] && [ "\${CONTENT:0:1}" != "[" ]; then
        USER_MSG="$CONTENT"
        break
      fi
    fi
  fi
done < "$TEMP_FILE"
rm -f "$TEMP_FILE"

# Log notification start
log_notification "INFO" "Starting ntfy notification" "{\\"topicName\\":\\"$TOPIC_NAME\\",\\"transcriptPath\\":\\"$TRANSCRIPT\\"}"

# Send message only if not empty
if [ -n "$LATEST_MSG" ]; then
  START_TIME=$(date +%s)
  RESPONSE=$(curl -s -w "\\n%{http_code}" --max-time 30 -H "Title: \${USER_MSG:0:100}" -d "$LATEST_MSG" "ntfy.sh/\${TOPIC_NAME}" 2>&1)
  END_TIME=$(date +%s)
  EXECUTION_TIME=$((END_TIME - START_TIME))
  
  # Extract response code and body
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)
  
  if [ "$HTTP_CODE" = "200" ]; then
    log_notification "INFO" "Ntfy notification sent successfully" "{\\"topicName\\":\\"$TOPIC_NAME\\",\\"responseCode\\":$HTTP_CODE,\\"executionTime\\":$EXECUTION_TIME}"
  else
    log_notification "ERROR" "Ntfy notification failed" "{\\"topicName\\":\\"$TOPIC_NAME\\",\\"responseCode\\":$HTTP_CODE,\\"responseBody\\":\\"$RESPONSE_BODY\\",\\"executionTime\\":$EXECUTION_TIME,\\"error\\":\\"HTTP $HTTP_CODE\\"}"
  fi
else
  log_notification "DEBUG" "Ntfy notification skipped" "{\\"topicName\\":\\"$TOPIC_NAME\\",\\"reason\\":\\"No assistant message found\\"}"
fi`;
  }

  /**
   * Generate macOS script content
   */
  private generateMacOSScriptContent(title?: string): string {
    // Generate the bash script with proper title handling
    const mainTitleLogic = title ? `MAIN_TITLE="${title.replace(/"/g, '\\"')}"` : 'MAIN_TITLE="Claude Code"';

    return `#!/bin/bash
# Process transcript and send macOS notification with logging
TRANSCRIPT=$(jq -r .transcript_path)
XDG_DATA_HOME="\${XDG_DATA_HOME:-\$HOME/.local/share}"
LOG_FILE="\$XDG_DATA_HOME/ccnotify/notifications.log"
LOG_DIR="\$XDG_DATA_HOME/ccnotify"

# Ensure log directory exists
mkdir -p "\$LOG_DIR"

# Log function
log_notification() {
  local level="\$1"
  local message="\$2"
  local details="\$3"
  echo "{\\"timestamp\\":\\"\$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\\",\\"level\\":\\"\$level\\",\\"type\\":\\"macos\\",\\"message\\":\\"\$message\\",\\"details\\":\$details}" >> "\$LOG_FILE"
}

# Get latest assistant message
LATEST_MSG=$(tail -1 "\$TRANSCRIPT" | jq -r '.message.content[0].text // empty')

# Get latest user message using a temporary file for portability
USER_MSG=""
TEMP_FILE=$(mktemp)
tac "\$TRANSCRIPT" > "\$TEMP_FILE"
while IFS= read -r line; do
  TYPE=$(echo "\$line" | jq -r '.type // empty')
  if [ "\$TYPE" = "user" ]; then
    ROLE=$(echo "\$line" | jq -r '.message.role // empty')
    if [ "\$ROLE" = "user" ]; then
      CONTENT=$(echo "\$line" | jq -r '.message.content // empty')
      # Only use content if it's a string and doesn't start with [
      if [ -n "\$CONTENT" ] && [ "\${CONTENT:0:1}" != "[" ]; then
        USER_MSG="\$CONTENT"
        break
      fi
    fi
  fi
done < "\$TEMP_FILE"
rm -f "\$TEMP_FILE"

# Log notification start
log_notification "INFO" "Starting macOS notification" "{\\"title\\":\\"${title || 'Claude Code'}\\",\\"transcriptPath\\":\\"\$TRANSCRIPT\\"}"

# Send notification only if assistant message is not empty
if [ -n "\$LATEST_MSG" ]; then
  # Set main notification title (custom title if provided, otherwise default "Claude Code")
  ${mainTitleLogic}
  
  # Use user message as subtitle (truncated to 256 chars for macOS limit)
  SUBTITLE="\${USER_MSG:0:256}"
  
  # Use assistant message as body (truncated to 1000 chars for macOS limit)
  NOTIFICATION_BODY="\${LATEST_MSG:0:1000}"
  
  # Escape quotes for AppleScript
  ESCAPED_MAIN_TITLE=$(echo "\$MAIN_TITLE" | sed 's/"/\\\\"/g')
  ESCAPED_SUBTITLE=$(echo "\$SUBTITLE" | sed 's/"/\\\\"/g')
  ESCAPED_BODY=$(echo "\$NOTIFICATION_BODY" | sed 's/"/\\\\"/g')
  
  START_TIME=$(date +%s)
  
  # Play sound and display macOS notification
  afplay /System/Library/Sounds/Pop.aiff & 
  osascript -e "display notification \\"\$ESCAPED_BODY\\" with title \\"\$ESCAPED_MAIN_TITLE\\" subtitle \\"\$ESCAPED_SUBTITLE\\"" &
  
  END_TIME=$(date +%s)
  EXECUTION_TIME=\$((END_TIME - START_TIME))
  
  # Check if osascript command was successful
  if [ \$? -eq 0 ]; then
    log_notification "INFO" "macOS notification sent successfully" "{\\"title\\":\\"\$MAIN_TITLE\\",\\"executionTime\\":\$EXECUTION_TIME}"
  else
    log_notification "ERROR" "macOS notification failed" "{\\"title\\":\\"\$MAIN_TITLE\\",\\"executionTime\\":\$EXECUTION_TIME,\\"error\\":\\"osascript command failed\\"}"
  fi
else
  log_notification "DEBUG" "macOS notification skipped" "{\\"title\\":\\"${title || 'Claude Code'}\\",\\"reason\\":\\"No assistant message found\\"}"
fi`;
  }
}

/**
 * Default hook generator instance
 */
export const hookGenerator = new HookGeneratorImpl();
