import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HookGeneratorImpl } from '../../../src/services/hooks.js';
import { CCNotifyError, ErrorType } from '../../../src/types/index.js';
import { fileSystemService } from '../../../src/utils/file.js';

// Mock the file system service
vi.mock('../../../src/utils/file.js', () => ({
  fileSystemService: {
    ensureDirectory: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// Mock node:fs/promises for chmod
vi.mock('node:fs/promises', () => ({
  chmod: vi.fn(),
}));

describe('HookGeneratorImpl', () => {
  let hookGenerator: HookGeneratorImpl;
  const mockFileSystemService = vi.mocked(fileSystemService);

  beforeEach(() => {
    hookGenerator = new HookGeneratorImpl();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateDiscordHook', () => {
    it('should generate Discord hook configuration with correct structure', () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      const result = hookGenerator.generateDiscordHook(webhookUrl);

      expect(result).toEqual({
        matcher: 'discord-notification',
        hooks: [
          {
            type: 'command',
            command: expect.stringContaining('TRANSCRIPT=$(jq -r .transcript_path)'),
          },
        ],
      });
    });

    it('should include webhook URL in the command', () => {
      const webhookUrl = 'https://discord.com/api/webhooks/987654321/fedcba654321';

      const result = hookGenerator.generateDiscordHook(webhookUrl);

      expect(result.hooks[0].command).toContain(webhookUrl);
    });

    it('should include transcript processing logic', () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      const result = hookGenerator.generateDiscordHook(webhookUrl);
      const command = result.hooks[0].command;

      expect(command).toContain('TRANSCRIPT=$(jq -r .transcript_path)');
      expect(command).toContain('LATEST_MSG=$(tail -1 "$TRANSCRIPT"');
      expect(command).toContain('while IFS= read -r line; do');
    });

    it('should include Discord-specific message formatting', () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      const result = hookGenerator.generateDiscordHook(webhookUrl);
      const command = result.hooks[0].command;

      expect(command).toContain('FORMATTED_MSG=$(echo "$LATEST_MSG" | head -c 1800');
      expect(command).toContain('"title": "Claude Code Operation Completed"');
      expect(command).toContain('"embeds": [{');
      expect(command).toContain('"color": 5814783');
    });

    it('should include user message extraction logic', () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      const result = hookGenerator.generateDiscordHook(webhookUrl);
      const command = result.hooks[0].command;

      expect(command).toContain('TYPE=$(echo "$line" | jq -r \'.type // empty\')');
      expect(command).toContain('if [ "$TYPE" = "user" ]; then');
      expect(command).toContain('ROLE=$(echo "$line" | jq -r \'.message.role // empty\')');
      expect(command).toContain('CONTENT=$(echo "$line" | jq -r \'.message.content // empty\')');
    });

    it('should include proper JSON escaping for Discord payload', () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      const result = hookGenerator.generateDiscordHook(webhookUrl);
      const command = result.hooks[0].command;

      expect(command).toContain('sed \'s/"/\\\\"/g\'');
    });

    it('should include timestamp in Discord embed', () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      const result = hookGenerator.generateDiscordHook(webhookUrl);
      const command = result.hooks[0].command;

      expect(command).toContain('"timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"');
    });

    it('should include message truncation for Discord limits', () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      const result = hookGenerator.generateDiscordHook(webhookUrl);
      const command = result.hooks[0].command;

      expect(command).toContain('head -c 1800');
      expect(command).toContain('${USER_MSG:0:200}');
      expect(command).toContain('${FORMATTED_MSG:0:1000}');
    });

    it('should include conditional message sending', () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      const result = hookGenerator.generateDiscordHook(webhookUrl);
      const command = result.hooks[0].command;

      expect(command).toContain('if [ -n "$LATEST_MSG" ]; then');
      expect(command).toContain('curl -H "Content-Type: application/json"');
    });
  });

  describe('generateNtfyHook', () => {
    it('should generate ntfy hook configuration with correct structure', () => {
      const topicName = 'test-topic';

      const result = hookGenerator.generateNtfyHook(topicName);

      expect(result).toEqual({
        matcher: 'ntfy-notification',
        hooks: [
          {
            type: 'command',
            command: expect.stringContaining('TRANSCRIPT=$(jq -r .transcript_path)'),
          },
        ],
      });
    });

    it('should include topic name in the command', () => {
      const topicName = 'my-test-topic';

      const result = hookGenerator.generateNtfyHook(topicName);

      expect(result.hooks[0].command).toContain(`DEFAULT_TOPIC_NAME="${topicName}"`);
    });

    it('should include transcript processing logic', () => {
      const topicName = 'test-topic';

      const result = hookGenerator.generateNtfyHook(topicName);
      const command = result.hooks[0].command;

      expect(command).toContain('TRANSCRIPT=$(jq -r .transcript_path)');
      expect(command).toContain('LATEST_MSG=$(tail -1 "$TRANSCRIPT"');
      expect(command).toContain('while IFS= read -r line; do');
    });
  });

  describe('generateMacOSHook', () => {
    it('should generate macOS hook configuration with correct structure', () => {
      const result = hookGenerator.generateMacOSHook();

      expect(result).toEqual({
        matcher: 'macos-notification',
        hooks: [
          {
            type: 'command',
            command: expect.stringContaining('TRANSCRIPT=$(jq -r .transcript_path)'),
          },
        ],
      });
    });

    it('should include transcript processing logic', () => {
      const result = hookGenerator.generateMacOSHook();
      const command = result.hooks[0].command;

      expect(command).toContain('TRANSCRIPT=$(jq -r .transcript_path)');
      expect(command).toContain('LATEST_MSG=$(tail -1 "$TRANSCRIPT"');
      expect(command).toContain('while IFS= read -r line; do');
    });

    it('should include user message extraction logic', () => {
      const result = hookGenerator.generateMacOSHook();
      const command = result.hooks[0].command;

      expect(command).toContain('TYPE=$(echo "$line" | jq -r \'.type // empty\')');
      expect(command).toContain('if [ "$TYPE" = "user" ]; then');
      expect(command).toContain('ROLE=$(echo "$line" | jq -r \'.message.role // empty\')');
      expect(command).toContain('CONTENT=$(echo "$line" | jq -r \'.message.content // empty\')');
    });

    it('should include proper message truncation for macOS limits', () => {
      const result = hookGenerator.generateMacOSHook();
      const command = result.hooks[0].command;

      expect(command).toContain('${USER_MSG:0:256}');
      expect(command).toContain('${LATEST_MSG:0:1000}');
    });

    it('should include conditional notification sending', () => {
      const result = hookGenerator.generateMacOSHook();
      const command = result.hooks[0].command;

      expect(command).toContain('if [ -n "$LATEST_MSG" ]; then');
    });

    it('should run sound and notification in background', () => {
      const result = hookGenerator.generateMacOSHook();
      const command = result.hooks[0].command;

      expect(command).toContain('afplay /System/Library/Sounds/Pop.aiff &');
      expect(command).toContain('osascript -e "display notification');
      expect(command).toContain('" &');
    });
  });

  describe('createNtfyScript', () => {
    beforeEach(() => {
      mockFileSystemService.ensureDirectory.mockResolvedValue(undefined);
      mockFileSystemService.writeFile.mockResolvedValue(undefined);
    });

    it('should create ntfy script with correct topic name', async () => {
      const topicName = 'my-test-topic';
      const scriptPath = '/path/to/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      expect(mockFileSystemService.ensureDirectory).toHaveBeenCalledWith('/path/to');
      expect(mockFileSystemService.writeFile).toHaveBeenCalledWith(
        scriptPath,
        expect.stringContaining(`DEFAULT_TOPIC_NAME="${topicName}"`)
      );
    });

    it('should create script with proper bash shebang', async () => {
      const topicName = 'test-topic';
      const scriptPath = '/path/to/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toMatch(/^#!\/bin\/bash/);
    });

    it('should include environment variable fallback logic', async () => {
      const topicName = 'env-test-topic';
      const scriptPath = '/path/to/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('TOPIC_NAME="${NTFY_TOPIC:-$DEFAULT_TOPIC_NAME}"');
    });

    it('should include transcript processing logic', async () => {
      const topicName = 'transcript-topic';
      const scriptPath = '/path/to/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('TRANSCRIPT=$(jq -r .transcript_path)');
      expect(scriptContent).toContain('LATEST_MSG=$(tail -1 "$TRANSCRIPT"');
      expect(scriptContent).toContain('while IFS= read -r line; do');
    });

    it('should include message extraction and formatting', async () => {
      const topicName = 'format-topic';
      const scriptPath = '/path/to/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('head -c 500');
      expect(scriptContent).toContain('curl -H "Title: ${USER_MSG:0:100}"');
      expect(scriptContent).toContain('ntfy.sh/${TOPIC_NAME}');
    });

    it('should include user message extraction logic', async () => {
      const topicName = 'user-msg-topic';
      const scriptPath = '/path/to/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('TYPE=$(echo "$line" | jq -r \'.type // empty\')');
      expect(scriptContent).toContain('if [ "$TYPE" = "user" ]; then');
      expect(scriptContent).toContain('ROLE=$(echo "$line" | jq -r \'.message.role // empty\')');
    });

    it('should handle directory creation errors', async () => {
      const topicName = 'error-topic';
      const scriptPath = '/invalid/path/ntfy.sh';
      const error = new Error('Permission denied');

      mockFileSystemService.ensureDirectory.mockRejectedValue(error);

      await expect(hookGenerator.createNtfyScript(topicName, scriptPath)).rejects.toThrow(CCNotifyError);

      try {
        await hookGenerator.createNtfyScript(topicName, scriptPath);
      } catch (err) {
        expect(err).toBeInstanceOf(CCNotifyError);
        expect((err as CCNotifyError).type).toBe(ErrorType.FILE_PERMISSION_ERROR);
        expect((err as CCNotifyError).message).toContain('Failed to create script directory');
      }
    });

    it('should handle file write errors', async () => {
      const topicName = 'write-error-topic';
      const scriptPath = '/path/to/ntfy.sh';
      const error = new Error('Disk full');

      mockFileSystemService.ensureDirectory.mockResolvedValue(undefined);
      mockFileSystemService.writeFile.mockRejectedValue(error);

      await expect(hookGenerator.createNtfyScript(topicName, scriptPath)).rejects.toThrow(CCNotifyError);
    });

    it('should make script executable on Unix-like systems', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const { chmod } = await import('node:fs/promises');
      const mockChmod = vi.mocked(chmod);

      const topicName = 'executable-topic';
      const scriptPath = '/path/to/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      expect(mockChmod).toHaveBeenCalledWith(scriptPath, 0o755);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should not attempt chmod on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const topicName = 'windows-topic';
      const scriptPath = 'C:\\path\\to\\ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      // chmod should not be called on Windows
      const { chmod } = await import('node:fs/promises');
      const mockChmod = vi.mocked(chmod);
      expect(mockChmod).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('script content validation', () => {
    it('should generate script with proper topic name embedding', async () => {
      const topicName = 'embedded-topic-123';
      const scriptPath = '/test/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain(`DEFAULT_TOPIC_NAME="${topicName}"`);
    });

    it('should include proper JSON parsing for transcript', async () => {
      const topicName = 'json-topic';
      const scriptPath = '/test/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('jq -r .transcript_path');
      expect(scriptContent).toContain("jq -r '.message.content[0].text // empty'");
      expect(scriptContent).toContain("jq -r '.type // empty'");
      expect(scriptContent).toContain("jq -r '.message.role // empty'");
      expect(scriptContent).toContain("jq -r '.message.content // empty'");
    });

    it('should include proper message filtering logic', async () => {
      const topicName = 'filter-topic';
      const scriptPath = '/test/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('if [ -n "$CONTENT" ] && [ "${CONTENT:0:1}" != "[" ]; then');
      expect(scriptContent).toContain('if [ -n "$LATEST_MSG" ]; then');
    });

    it('should include proper message truncation and formatting', async () => {
      const topicName = 'truncate-topic';
      const scriptPath = '/test/ntfy.sh';

      await hookGenerator.createNtfyScript(topicName, scriptPath);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('head -c 500');
      expect(scriptContent).toContain('${USER_MSG:0:100}');
      expect(scriptContent).toContain("sed 's/^/ /'");
    });
  });
});
