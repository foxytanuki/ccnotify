import { dirname } from 'node:path';
import { CCNotifyError, ErrorSeverity, ErrorType, type StopHook } from '../types/index.js';
import { fileSystemService } from '../utils/file.js';
import { errorHandler } from './error-handler.js';

/**
 * Hook generator interface
 */
export interface HookGenerator {
  generateDiscordHook(webhookUrl: string): StopHook;
  generateNtfyHook(topicName: string): StopHook;
  createNtfyScript(topicName: string, scriptPath: string): Promise<void>;
}

/**
 * Implementation of hook generation logic
 */
export class HookGeneratorImpl implements HookGenerator {
  /**
   * Generate Discord webhook Stop Hook configuration
   */
  generateDiscordHook(webhookUrl: string): StopHook {
    const discordCommand = this.createDiscordCommand(webhookUrl);

    return {
      matcher: 'discord-notification',
      hooks: [
        {
          type: 'command',
          command: discordCommand,
        },
      ],
    };
  }

  /**
   * Generate ntfy Stop Hook configuration
   */
  generateNtfyHook(topicName: string): StopHook {
    const ntfyCommand = this.createNtfyCommand(topicName);

    return {
      matcher: 'ntfy-notification',
      hooks: [
        {
          type: 'command',
          command: ntfyCommand,
        },
      ],
    };
  }

  /**
   * Create ntfy.sh script with transcript processing logic
   */
  async createNtfyScript(topicName: string, scriptPath: string): Promise<void> {
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
          await errorHandler.logDebug('Script made executable');
        } catch (error) {
          // Log warning but don't fail - script can still work without execute permissions
          await errorHandler.logWarning('Failed to make script executable', {
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
        { topicName, scriptPath, operation: 'createNtfyScript' },
      );
    }
  }

  /**
   * Create Discord webhook command with transcript processing
   */
  private createDiscordCommand(webhookUrl: string): string {
    // Create a command that processes the transcript and formats for Discord using portable shell syntax
    const command = `#!/bin/bash
# Process transcript and send to Discord
TRANSCRIPT=$(jq -r .transcript_path)

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
  
  # Send to Discord webhook
  curl -H "Content-Type: application/json" -d "$DISCORD_PAYLOAD" "${webhookUrl}"
fi`.trim();

    return command;
  }

  /**
   * Create ntfy command with embedded script content
   */
  private createNtfyCommand(topicName: string): string {
    const command = `#!/bin/bash
# Process transcript and send to ntfy
TRANSCRIPT=$(jq -r .transcript_path)

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

# Send message only if not empty
if [ -n "$LATEST_MSG" ]; then
  echo "$LATEST_MSG" | sed 's/^/ /' | head -c 500 | \\
  curl -H "Title: \${USER_MSG:0:100}" -d @- "ntfy.sh/\${TOPIC_NAME}"
fi`.trim();

    return command;
  }

  /**
   * Generate ntfy.sh script content based on the provided reference
   */
  private generateNtfyScriptContent(topicName: string): string {
    return `#!/bin/bash

# Default topic name with unique identifier
DEFAULT_TOPIC_NAME="${topicName}"

# Configuration (use environment variable if set, otherwise use default)
TOPIC_NAME="\${NTFY_TOPIC:-$DEFAULT_TOPIC_NAME}"

# Get transcript path from stdin
TRANSCRIPT=$(jq -r .transcript_path)

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

# Send message only if not empty
if [ -n "$LATEST_MSG" ]; then
  echo "$LATEST_MSG" | sed 's/^/ /' | head -c 500 | \\
  curl -H "Title: \${USER_MSG:0:100}" -d @- "ntfy.sh/\${TOPIC_NAME}"
fi
`;
  }
}

/**
 * Default hook generator instance
 */
export const hookGenerator = new HookGeneratorImpl();
