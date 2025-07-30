import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HookGeneratorImpl } from '../../../src/services/hooks.js';
import { CCNotifyError, ErrorType } from '../../../src/types/index.js';
import { fileSystemService } from '../../../src/utils/file.js';
import { pathResolver } from '../../../src/utils/paths.js';

// Mock the file system service
vi.mock('../../../src/utils/file.js', () => ({
  fileSystemService: {
    ensureDirectory: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// Mock the path resolver
vi.mock('../../../src/utils/paths.js', () => ({
  pathResolver: {
    getScriptPath: vi.fn(),
    ensureCcnotifyDataDir: vi.fn(),
  },
}));

// Mock node:fs/promises for chmod
vi.mock('node:fs/promises', () => ({
  chmod: vi.fn(),
}));

describe('HookGeneratorImpl', () => {
  let hookGenerator: HookGeneratorImpl;
  const mockFileSystemService = vi.mocked(fileSystemService);
  const mockPathResolver = vi.mocked(pathResolver);

  beforeEach(() => {
    hookGenerator = new HookGeneratorImpl();
    vi.clearAllMocks();

    // Setup default mocks
    mockPathResolver.getScriptPath.mockImplementation((isGlobal: boolean, scriptName: string) => {
      return `/home/user/.local/share/ccnotify/${scriptName}`;
    });
    mockPathResolver.ensureCcnotifyDataDir.mockResolvedValue('/home/user/.local/share/ccnotify');
    mockFileSystemService.ensureDirectory.mockResolvedValue(undefined);
    mockFileSystemService.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateDiscordHook', () => {
    it('should generate Discord hook configuration with correct structure', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      const result = await hookGenerator.generateDiscordHook(webhookUrl);

      expect(result).toEqual({
        matcher: 'discord-notification',
        hooks: [
          {
            type: 'command',
            command: '/home/user/.local/share/ccnotify/discord-notification.sh',
          },
        ],
      });
    });

    it('should create Discord script file', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/987654321/fedcba654321';

      await hookGenerator.generateDiscordHook(webhookUrl);

      expect(mockPathResolver.ensureCcnotifyDataDir).toHaveBeenCalled();
      expect(mockFileSystemService.writeFile).toHaveBeenCalledWith(
        '/home/user/.local/share/ccnotify/discord-notification.sh',
        expect.stringContaining('#!/bin/bash')
      );
    });

    it('should include webhook URL in the script content', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/987654321/fedcba654321';

      await hookGenerator.generateDiscordHook(webhookUrl);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain(`DEFAULT_WEBHOOK_URL="${webhookUrl}"`);
      expect(scriptContent).toContain('WEBHOOK_URL="${1:-$DEFAULT_WEBHOOK_URL}"');
      expect(scriptContent).toContain('# Usage: discord-notification.sh [webhook_url]');
    });

    it('should include transcript processing logic in script', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      await hookGenerator.generateDiscordHook(webhookUrl);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('TRANSCRIPT=$(jq -r .transcript_path)');
      expect(scriptContent).toContain('LATEST_MSG=$(grep \'"type":"assistant"\' "$TRANSCRIPT" | tail -1');
      expect(scriptContent).toContain('while IFS= read -r line; do');
    });

    it('should include Discord-specific message formatting in script', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      await hookGenerator.generateDiscordHook(webhookUrl);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('jq -n');
      expect(scriptContent).toContain('--arg title "Claude Code Operation Completed"');
      expect(scriptContent).toContain('embeds: [{');
      expect(scriptContent).toContain('color: 5814783');
    });

    it('should make script executable on Unix-like systems', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const { chmod } = await import('node:fs/promises');
      const mockChmod = vi.mocked(chmod);

      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      await hookGenerator.generateDiscordHook(webhookUrl);

      expect(mockChmod).toHaveBeenCalledWith('/home/user/.local/share/ccnotify/discord-notification.sh', 0o755);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('generateNtfyHook', () => {
    it('should generate ntfy hook configuration with correct structure', async () => {
      const topicName = 'test-topic';

      const result = await hookGenerator.generateNtfyHook(topicName);

      expect(result).toEqual({
        matcher: 'ntfy-notification',
        hooks: [
          {
            type: 'command',
            command: '/home/user/.local/share/ccnotify/ntfy-notification.sh',
          },
        ],
      });
    });

    it('should create ntfy script file', async () => {
      const topicName = 'my-test-topic';

      await hookGenerator.generateNtfyHook(topicName);

      expect(mockPathResolver.ensureCcnotifyDataDir).toHaveBeenCalled();
      expect(mockFileSystemService.writeFile).toHaveBeenCalledWith(
        '/home/user/.local/share/ccnotify/ntfy-notification.sh',
        expect.stringContaining('#!/bin/bash')
      );
    });

    it('should include topic name in the script content', async () => {
      const topicName = 'my-test-topic';

      await hookGenerator.generateNtfyHook(topicName);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain(`DEFAULT_TOPIC_NAME="${topicName}"`);
      expect(scriptContent).toContain('# Usage: ntfy-notification.sh [topic_name]');
      expect(scriptContent).toContain('if [ -n "$1" ]; then');
      expect(scriptContent).toContain('TOPIC_NAME="$1"');
    });

    it('should include transcript processing logic in script', async () => {
      const topicName = 'test-topic';

      await hookGenerator.generateNtfyHook(topicName);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('TRANSCRIPT=$(jq -r .transcript_path)');
      expect(scriptContent).toContain('LATEST_MSG=$(grep \'"type":"assistant"\' "$TRANSCRIPT" | tail -1');
      expect(scriptContent).toContain('while IFS= read -r line; do');
    });
  });

  describe('generateMacOSHook', () => {
    it('should generate macOS hook configuration without title argument when not provided', async () => {
      const result = await hookGenerator.generateMacOSHook();

      expect(result).toEqual({
        matcher: 'macos-notification',
        hooks: [
          {
            type: 'command',
            command: '/home/user/.local/share/ccnotify/macos-notification.sh',
          },
        ],
      });
    });

    it('should create macOS script file', async () => {
      await hookGenerator.generateMacOSHook();

      expect(mockPathResolver.ensureCcnotifyDataDir).toHaveBeenCalled();
      expect(mockFileSystemService.writeFile).toHaveBeenCalledWith(
        '/home/user/.local/share/ccnotify/macos-notification.sh',
        expect.stringContaining('#!/bin/bash')
      );
    });

    it('should include transcript processing logic in script', async () => {
      await hookGenerator.generateMacOSHook();

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('TRANSCRIPT=$(jq -r .transcript_path)');
      expect(scriptContent).toContain('LATEST_MSG=$(tail -1 "$TRANSCRIPT"');
      expect(scriptContent).toContain('while IFS= read -r line; do');
    });

    it('should include user message extraction logic in script', async () => {
      await hookGenerator.generateMacOSHook();

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('TYPE=$(echo "$line" | jq -r \'.type // empty\')');
      expect(scriptContent).toContain('if [ "$TYPE" = "user" ]; then');
      expect(scriptContent).toContain('ROLE=$(echo "$line" | jq -r \'.message.role // empty\')');
      expect(scriptContent).toContain('CONTENT=$(echo "$line" | jq -r \'.message.content // empty\')');
    });

    it('should include proper message truncation for macOS limits in script', async () => {
      await hookGenerator.generateMacOSHook();

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('${USER_MSG:0:256}');
      expect(scriptContent).toContain('${LATEST_MSG:0:1000}');
    });

    it('should include conditional notification sending in script', async () => {
      await hookGenerator.generateMacOSHook();

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('if [ -n "$LATEST_MSG" ]; then');
    });

    it('should include sound and notification commands in script', async () => {
      await hookGenerator.generateMacOSHook();

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('afplay /System/Library/Sounds/Pop.aiff &');
      expect(scriptContent).toContain('osascript -e "display notification');
      expect(scriptContent).toContain('" &');
    });

    it('should include title argument in command when provided', async () => {
      const customTitle = 'Custom Notification Title';

      const result = await hookGenerator.generateMacOSHook(customTitle);

      expect(result.hooks[0].command).toBe(`/home/user/.local/share/ccnotify/macos-notification.sh "${customTitle}"`);
    });

    it('should always use Claude Code as default in script', async () => {
      await hookGenerator.generateMacOSHook('Some Title');

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain('DEFAULT_TITLE="Claude Code"');
      expect(scriptContent).toContain('MAIN_TITLE="${1:-$DEFAULT_TITLE}"');
    });
  });

  describe('error handling', () => {
    it('should handle directory creation errors', async () => {
      const error = new Error('Permission denied');
      mockPathResolver.ensureCcnotifyDataDir.mockRejectedValue(error);

      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      await expect(hookGenerator.generateDiscordHook(webhookUrl)).rejects.toThrow();
    });

    it('should handle file write errors', async () => {
      const error = new Error('Disk full');
      mockFileSystemService.writeFile.mockRejectedValue(error);

      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      await expect(hookGenerator.generateDiscordHook(webhookUrl)).rejects.toThrow(CCNotifyError);
    });

    it('should handle chmod errors gracefully', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const { chmod } = await import('node:fs/promises');
      const mockChmod = vi.mocked(chmod);
      mockChmod.mockRejectedValue(new Error('Permission denied'));

      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      // Should not throw error, just log warning
      await expect(hookGenerator.generateDiscordHook(webhookUrl)).resolves.toBeDefined();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('script content validation', () => {
    it('should generate Discord script with proper webhook URL embedding', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';

      await hookGenerator.generateDiscordHook(webhookUrl);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain(webhookUrl);
    });

    it('should generate ntfy script with proper topic name embedding', async () => {
      const topicName = 'embedded-topic-123';

      await hookGenerator.generateNtfyHook(topicName);

      const [, scriptContent] = mockFileSystemService.writeFile.mock.calls[0];
      expect(scriptContent).toContain(`DEFAULT_TOPIC_NAME="${topicName}"`);
    });

    it('should include proper JSON parsing for transcript in all scripts', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';
      const topicName = 'json-topic';

      await hookGenerator.generateDiscordHook(webhookUrl);
      const discordScript = mockFileSystemService.writeFile.mock.calls[0][1] as string;

      await hookGenerator.generateNtfyHook(topicName);
      const ntfyScript = mockFileSystemService.writeFile.mock.calls[1][1] as string;

      await hookGenerator.generateMacOSHook();
      const macosScript = mockFileSystemService.writeFile.mock.calls[2][1] as string;

      [discordScript, ntfyScript, macosScript].forEach(script => {
        expect(script).toContain('jq -r .transcript_path');
        expect(script).toContain("jq -r '.message.content[0].text // empty'");
        expect(script).toContain("jq -r '.type // empty'");
        expect(script).toContain("jq -r '.message.role // empty'");
        expect(script).toContain("jq -r '.message.content // empty'");
      });
    });

    it('should include proper message filtering logic in all scripts', async () => {
      const webhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef123456';
      const topicName = 'filter-topic';

      await hookGenerator.generateDiscordHook(webhookUrl);
      const discordScript = mockFileSystemService.writeFile.mock.calls[0][1] as string;

      await hookGenerator.generateNtfyHook(topicName);
      const ntfyScript = mockFileSystemService.writeFile.mock.calls[1][1] as string;

      await hookGenerator.generateMacOSHook();
      const macosScript = mockFileSystemService.writeFile.mock.calls[2][1] as string;

      [discordScript, ntfyScript, macosScript].forEach(script => {
        expect(script).toContain('if [ -n "$CONTENT" ] && [ "${CONTENT:0:1}" != "[" ]; then');
        expect(script).toContain('if [ -n "$LATEST_MSG" ]; then');
      });
    });
  });
});
