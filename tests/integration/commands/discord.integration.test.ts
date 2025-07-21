import { randomUUID } from 'node:crypto';
import { rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDiscordCommand } from '../../../src/commands/discord.js';
import { configManager } from '../../../src/services/config.js';
import { CCNotifyError, type DiscordCommandArgs, ErrorType } from '../../../src/types/index.js';
import { fileSystemService } from '../../../src/utils/file.js';

describe('Discord command integration tests', () => {
  let testConfigDir: string;
  let testConfigPath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testConfigDir = join(tmpdir(), `ccnotify-test-${randomUUID()}`);
    testConfigPath = join(testConfigDir, 'settings.json');

    // Ensure test directory exists
    await fileSystemService.ensureDirectory(testConfigDir);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      if (await fileSystemService.fileExists(testConfigPath)) {
        await unlink(testConfigPath);
      }
      if (await fileSystemService.fileExists(testConfigDir)) {
        await rmdir(testConfigDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('handleDiscordCommand integration', () => {
    it('should integrate validation, hook generation, and config management', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123456789/test-token',
        options: { global: false },
      };

      // Mock config path to use test directory
      const originalGetConfigPath = configManager.getConfigPath;
      configManager.getConfigPath = vi.fn().mockReturnValue(testConfigPath);

      try {
        await handleDiscordCommand(args);

        // Verify config file was created
        const configExists = await fileSystemService.fileExists(testConfigPath);
        expect(configExists).toBe(true);

        // Verify config content structure
        const configContent = await fileSystemService.readFile(testConfigPath);
        const config = JSON.parse(configContent);

        expect(config).toHaveProperty('hooks');
        expect(config.hooks).toHaveProperty('Stop');
        expect(config.hooks.Stop).toBeInstanceOf(Array);
        expect(config.hooks.Stop).toHaveLength(1);
        expect(config.hooks.Stop[0]).toHaveProperty('matcher', 'discord-notification');
        expect(config.hooks.Stop[0]).toHaveProperty('hooks');
        expect(config.hooks.Stop[0].hooks).toBeInstanceOf(Array);
        expect(config.hooks.Stop[0].hooks).toHaveLength(1);
        expect(config.hooks.Stop[0].hooks[0]).toHaveProperty('type', 'command');
        expect(config.hooks.Stop[0].hooks[0]).toHaveProperty('command');

        // Verify the command contains expected elements
        const command = config.hooks.Stop[0].hooks[0].command;
        expect(command).toContain('curl');
        expect(command).toContain('https://discord.com/api/webhooks/123456789/test-token');
        expect(command).toContain('#!/bin/bash');
      } finally {
        // Restore original function
        configManager.getConfigPath = originalGetConfigPath;
      }
    });

    it('should integrate backup creation with existing config', async () => {
      // Create existing config file
      const existingConfig = {
        someSetting: 'value',
        hooks: {
          Start: [
            {
              matcher: 'existing-start-hook',
              hooks: [{ type: 'command' as const, command: 'existing command' }],
            },
          ],
        },
      };

      await fileSystemService.writeFile(testConfigPath, JSON.stringify(existingConfig, null, 2));

      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123456789/test-token',
        options: { global: false },
      };

      // Mock config path to use test directory
      const originalGetConfigPath = configManager.getConfigPath;
      configManager.getConfigPath = vi.fn().mockReturnValue(testConfigPath);

      try {
        await handleDiscordCommand(args);

        // Verify backup was created
        const backupDir = require('node:path').dirname(testConfigPath);
        const backupBase = require('node:path').basename(testConfigPath) + '.backup.';
        const fs = require('node:fs');
        const backupFiles = fs.readdirSync(backupDir).filter((f: string) => f.startsWith(backupBase));
        expect(backupFiles.length).toBeGreaterThan(0);
        const backupPath = require('node:path').join(backupDir, backupFiles[0]);
        const backupExists = await fileSystemService.fileExists(backupPath);
        expect(backupExists).toBe(true);

        // Verify backup content matches original
        const backupContent = await fileSystemService.readFile(backupPath);
        const backupConfig = JSON.parse(backupContent);
        expect(backupConfig).toEqual(existingConfig);

        // Verify new config contains both old and new hooks
        const configContent = await fileSystemService.readFile(testConfigPath);
        const config = JSON.parse(configContent);

        // Original settings should be preserved
        expect(config).toHaveProperty('someSetting', 'value');
        expect(config.hooks).toHaveProperty('Start');
        expect(config.hooks.Start).toHaveLength(1);
        expect(config.hooks.Start[0]).toHaveProperty('matcher', 'existing-start-hook');

        // New Discord hook should be added
        expect(config.hooks).toHaveProperty('Stop');
        expect(config.hooks.Stop).toHaveLength(1);
        expect(config.hooks.Stop[0]).toHaveProperty('matcher', 'discord-notification');
      } finally {
        // Restore original function
        configManager.getConfigPath = originalGetConfigPath;
      }
    });

    it('should integrate error handling across services', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'invalid-url',
        options: { global: false },
      };

      // Mock config path to use test directory
      const originalGetConfigPath = configManager.getConfigPath;
      configManager.getConfigPath = vi.fn().mockReturnValue(testConfigPath);

      try {
        await expect(handleDiscordCommand(args)).rejects.toThrow(CCNotifyError);
        await expect(handleDiscordCommand(args)).rejects.toThrowError(
          expect.objectContaining({ type: ErrorType.INVALID_WEBHOOK_URL })
        );

        // Verify no config file was created due to validation error
        const configExists = await fileSystemService.fileExists(testConfigPath);
        expect(configExists).toBe(false);
      } finally {
        // Restore original function
        configManager.getConfigPath = originalGetConfigPath;
      }
    });

    it('should integrate file system operations with config management', async () => {
      const args: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123456789/test-token',
        options: { global: false },
      };

      // Mock config path to use test directory
      const originalGetConfigPath = configManager.getConfigPath;
      configManager.getConfigPath = vi.fn().mockReturnValue(testConfigPath);

      try {
        await handleDiscordCommand(args);

        // Verify directory was created
        const dirExists = await fileSystemService.fileExists(testConfigDir);
        expect(dirExists).toBe(true);

        // Verify config file was created in the correct location
        const configExists = await fileSystemService.fileExists(testConfigPath);
        expect(configExists).toBe(true);

        // Verify config file is valid JSON
        const configContent = await fileSystemService.readFile(testConfigPath);
        expect(() => JSON.parse(configContent)).not.toThrow();
      } finally {
        // Restore original function
        configManager.getConfigPath = originalGetConfigPath;
      }
    });

    it('should integrate global vs local config path handling', async () => {
      const localArgs: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123456789/test-token',
        options: { global: false },
      };

      const globalArgs: DiscordCommandArgs = {
        webhookUrl: 'https://discord.com/api/webhooks/123456789/test-token',
        options: { global: true },
      };

      // Mock config paths
      const originalGetConfigPath = configManager.getConfigPath;
      configManager.getConfigPath = vi
        .fn()
        .mockReturnValueOnce(join(testConfigDir, 'local-settings.json'))
        .mockReturnValueOnce(join(testConfigDir, 'global-settings.json'));

      try {
        // Test local config
        await handleDiscordCommand(localArgs);
        const localConfigExists = await fileSystemService.fileExists(join(testConfigDir, 'local-settings.json'));
        expect(localConfigExists).toBe(true);

        // Test global config
        await handleDiscordCommand(globalArgs);
        const globalConfigExists = await fileSystemService.fileExists(join(testConfigDir, 'global-settings.json'));
        expect(globalConfigExists).toBe(true);
      } finally {
        // Restore original function
        configManager.getConfigPath = originalGetConfigPath;
      }
    });
  });
});
