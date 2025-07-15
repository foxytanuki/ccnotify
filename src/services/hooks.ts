import { dirname } from 'node:path';
import { CCNotifyError, ErrorType, type StopHook } from '../types/index.js';
import { fileSystemService } from '../utils/file.js';

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
  generateNtfyHook(_topicName: string): StopHook {
    const ntfyCommand = this.createNtfyCommand();

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
      // Ensure the directory exists
      const scriptDir = dirname(scriptPath);
      await fileSystemService.ensureDirectory(scriptDir);

      // Generate the script content
      const scriptContent = this.generateNtfyScriptContent(topicName);

      // Write the script file
      await fileSystemService.writeFile(scriptPath, scriptContent);

      // Make the script executable (Unix-like systems)
      if (process.platform !== 'win32') {
        const { chmod } = await import('node:fs/promises');
        await chmod(scriptPath, 0o755);
      }
    } catch (error) {
      throw new CCNotifyError(
        ErrorType.FILE_PERMISSION_ERROR,
        `Failed to create ntfy script at ${scriptPath}`,
        error as Error,
      );
    }
  }

  /**
   * Create Discord webhook command
   */
  private createDiscordCommand(webhookUrl: string): string {
    return `curl -H "Content-Type: application/json" -d '{"content": "Claude Code operation completed"}' "${webhookUrl}"`;
  }

  /**
   * Create ntfy command that calls the generated script
   */
  private createNtfyCommand(): string {
    return 'bash "$(dirname "$0")/ntfy.sh"';
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

# Get latest user message
USER_MSG=""

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
done < <(tac "$TRANSCRIPT")

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
