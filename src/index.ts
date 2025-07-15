#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerDiscordCommand, registerNtfyCommand } from './commands/index.js';

// Get package.json for version info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

/**
 * Create and configure the main CLI program
 */
function createProgram(): Command {
  const program = new Command();

  // Set up basic program info
  program
    .name('ccnotify')
    .description('CLI tool for creating Claude Code Stop Hooks with Discord and ntfy notifications')
    .version(packageJson.version, '-v, --version', 'display version number');

  // Configure help
  program.configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage(),
  });

  // Add custom help text
  program.addHelpText('after', `
Examples:
  $ ccnotify discord https://discord.com/api/webhooks/123/abc
  $ ccnotify ntfy my-topic
  $ ccnotify discord https://discord.com/api/webhooks/123/abc --global
  $ ccnotify ntfy my-topic --global

For more information, visit: https://github.com/your-repo/ccnotify
`);

  return program;
}

/**
 * Register all commands with the program
 */
function registerCommands(program: Command): void {
  // Register Discord command
  registerDiscordCommand(program);
  
  // Register ntfy command
  registerNtfyCommand(program);
}

/**
 * Set up global error handling
 */
function setupErrorHandling(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled promise rejection:', reason);
    process.exit(1);
  });
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  try {
    // Set up error handling
    setupErrorHandling();

    // Create program
    const program = createProgram();

    // Register commands
    registerCommands(program);

    // Parse command line arguments
    await program.parseAsync(process.argv);

    // If no command was provided and no help was shown, show help
    if (process.argv.length <= 2) {
      program.help();
    }
  } catch (error) {
    console.error('❌ CLI initialization error:', error);
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
