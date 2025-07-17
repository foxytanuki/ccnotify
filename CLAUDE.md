# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ccnotify is a CLI tool that creates Claude Code Stop Hooks with various notification integrations (Discord, ntfy, macOS). It automatically configures `.claude/settings.json` files for notification hooks.

## Development Commands

### Build & Run
- `pnpm build` - Production build
- `pnpm dev` - Run TypeScript directly
- `pnpm build:watch` - Watch mode development

### Testing
- `pnpm test` - Run all tests
- `pnpm test:watch` - Watch mode testing
- `pnpm test tests/unit/services/config.test.ts` - Run specific test file

### Code Quality
- `pnpm lint:fix` - Auto-fix linting issues
- `pnpm format` - Format code
- `pnpm typecheck` - Check TypeScript types
- `pnpm ci:strict` - Full CI check (lint, typecheck, test)

## Architecture

The codebase follows a modular structure:

- **Commands** (`src/commands/`) - Each notification type (discord, ntfy, macos) has its own command module
- **Services** (`src/services/`) - Core logic for config management, hook creation, validation
- **Entry point** (`src/index.ts`) - CLI setup using Commander.js

### Key Design Patterns

1. **Configuration Management**: The `ConfigService` handles both global (`~/.config/ccnotify/`) and local (`./.claude/settings.json`) configurations with proper merging logic.

2. **Hook System**: Hooks are stored as bash commands in the Claude settings file under `stop_hook`. The tool generates appropriate notification commands based on the integration type.

3. **Error Handling**: Comprehensive error handling with user-friendly messages and proper exit codes.

## Testing Approach

Tests are organized in three levels:
- **Unit tests** (`tests/unit/`) - Test individual functions and services
- **Integration tests** (`tests/integration/`) - Test command execution and file operations
- **E2E tests** (`tests/e2e/`) - Test full CLI workflows

Use Vitest for all testing. Mock file system operations when testing config/hook services.

## Important Considerations

1. **Node Version**: Requires Node.js >=20.0.0 (uses native ES modules)
2. **File Paths**: Always use absolute paths for file operations
3. **Settings Merge**: When updating `.claude/settings.json`, preserve existing settings
4. **Error Messages**: Provide clear, actionable error messages for CLI users
5. **Webhook Security**: Validate webhook URLs and sanitize user inputs