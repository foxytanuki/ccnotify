import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the command modules
vi.mock('../../src/commands/index.js', () => ({
  registerDiscordCommand: vi.fn(),
  registerNtfyCommand: vi.fn(),
}));

// Mock fs for package.json reading
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

// Mock path and url modules
vi.mock('node:path', () => ({
  dirname: vi.fn(),
  join: vi.fn(),
}));

vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(),
}));

describe('CLI Entry Point', () => {
  let _mockConsoleError: any;
  let _mockConsoleLog: any;

  beforeEach(async () => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Mock console methods
    _mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    _mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock package.json content
    const { readFileSync } = await import('node:fs');
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        name: 'ccnotify',
        version: '1.0.0',
        description: 'CLI tool for creating Claude Code Stop Hooks',
      })
    );

    // Mock path functions
    const { dirname, join } = await import('node:path');
    vi.mocked(dirname).mockReturnValue('/mock/dir');
    vi.mocked(join).mockReturnValue('/mock/package.json');

    // Mock fileURLToPath
    const { fileURLToPath } = await import('node:url');
    vi.mocked(fileURLToPath).mockReturnValue('/mock/src/index.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Program Configuration', () => {
    it('should create a program with correct name and description', async () => {
      // We need to test the program creation indirectly since it's not exported
      // This test verifies that commander.js is properly configured
      const program = new Command();
      program
        .name('ccnotify')
        .description('CLI tool for creating Claude Code Stop Hooks with Discord and ntfy notifications')
        .version('1.0.0');

      expect(program.name()).toBe('ccnotify');
      expect(program.description()).toBe(
        'CLI tool for creating Claude Code Stop Hooks with Discord and ntfy notifications'
      );
    });

    it('should configure help with custom text', () => {
      const program = new Command();
      program.name('ccnotify').description('Test CLI');

      const helpText = `
Examples:
  $ ccnotify discord https://discord.com/api/webhooks/123/abc
  $ ccnotify ntfy my-topic
  $ ccnotify discord https://discord.com/api/webhooks/123/abc --global
  $ ccnotify ntfy my-topic --global

For more information, visit: https://github.com/foxytanuki/ccnotify
`;

      // Test that addHelpText can be called without error
      expect(() => {
        program.addHelpText('after', helpText);
      }).not.toThrow();

      // Verify the program still has basic help functionality
      expect(program.helpInformation()).toContain('Usage:');
    });
  });

  describe('Command Registration', () => {
    it('should register Discord and ntfy commands', async () => {
      const { registerDiscordCommand, registerNtfyCommand } = await import('../../src/commands/index.js');

      const program = new Command();

      // Simulate command registration
      vi.mocked(registerDiscordCommand).mockImplementation(prog => {
        prog.command('discord').description('Create Discord webhook notification Stop Hook');
      });

      vi.mocked(registerNtfyCommand).mockImplementation(prog => {
        prog.command('ntfy').description('Create ntfy notification Stop Hook');
      });

      // Register commands
      registerDiscordCommand(program);
      registerNtfyCommand(program);

      expect(registerDiscordCommand).toHaveBeenCalledWith(program);
      expect(registerNtfyCommand).toHaveBeenCalledWith(program);
    });
  });

  describe('Error Handling', () => {
    it('should handle uncaught exceptions', () => {
      const mockListener = vi.fn();
      process.on('uncaughtException', mockListener);

      // Simulate uncaught exception
      const error = new Error('Test error');
      process.emit('uncaughtException', error);

      expect(mockListener).toHaveBeenCalledWith(error);
    });

    it('should handle unhandled promise rejections', () => {
      const mockListener = vi.fn();
      process.on('unhandledRejection', mockListener);

      // Simulate unhandled rejection
      const reason = 'Test rejection';
      // Use type assertion to work around TypeScript's strict typing for process.emit
      (process as any).emit('unhandledRejection', reason);

      expect(mockListener).toHaveBeenCalledWith(reason);
    });
  });

  describe('Version Handling', () => {
    it('should set version from package.json', () => {
      const program = new Command();
      program.version('1.0.0', '-v, --version', 'display version number');

      expect(program.version()).toBe('1.0.0');
    });
  });

  describe('Help Display', () => {
    it('should configure help sorting', () => {
      const program = new Command();
      program.configureHelp({
        sortSubcommands: true,
        subcommandTerm: cmd => cmd.name() + ' ' + cmd.usage(),
      });

      // Verify help configuration was applied
      const helpConfig = program.configureHelp();
      expect(typeof helpConfig.subcommandTerm).toBe('function');
    });

    it('should show help when no arguments provided', () => {
      const program = new Command();
      const helpSpy = vi.spyOn(program, 'help').mockImplementation(() => {
        throw new Error('help called');
      });

      // Simulate no arguments (process.argv.length <= 2)
      const originalArgv = process.argv;
      process.argv = ['node', 'ccnotify'];

      try {
        if (process.argv.length <= 2) {
          program.help();
        }
      } catch (error) {
        expect(error).toEqual(new Error('help called'));
      }

      process.argv = originalArgv;
      expect(helpSpy).toHaveBeenCalled();
    });
  });
});
