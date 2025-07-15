# Design Document

## Overview

The `ccnotify` CLI tool is a TypeScript-based command-line application that simplifies the creation of Stop Hooks for Claude Code. It uses commander.js for command parsing, provides Discord and ntfy notification integrations, and safely manages JSON configuration files. The tool supports both local and global configuration modes.

## Architecture

The application follows a modular architecture with clear separation of concerns:

```
src/
├── index.ts           # Entry point and CLI setup
├── commands/          # Command implementations
│   ├── discord.ts     # Discord webhook command
│   ├── ntfy.ts        # ntfy notification command
│   ├── macos.ts       # macOS notification command
│   └── help.ts        # Help command
├── services/          # Core business logic
│   ├── config.ts      # Configuration file management
│   ├── hooks.ts       # Hook generation logic
│   └── validation.ts  # Input validation
├── utils/             # Utility functions
│   ├── file.ts        # File system operations
│   ├── json.ts        # JSON parsing/writing
│   └── paths.ts       # Path resolution
└── types/             # TypeScript type definitions
    └── index.ts       # Shared types
```

## Components and Interfaces

### CLI Interface
- **Commander.js Integration**: Handles command parsing, options, and help generation
- **Command Structure**: 
  - `ccnotify` (default help)
  - `ccnotify discord <webhook_url> [options]`
  - `ccnotify ntfy <topic_name> [options]`
  - `ccnotify macos [title] [options]`
- **Global Options**: `--global/-g` flag for global configuration

### Configuration Manager
```typescript
interface ConfigManager {
  loadConfig(path: string): Promise<ClaudeConfig>;
  saveConfig(path: string, config: ClaudeConfig): Promise<void>;
  backupConfig(path: string): Promise<void>;
  getConfigPath(isGlobal: boolean): string;
}
```

### Hook Generator
```typescript
interface HookGenerator {
  generateDiscordHook(webhookUrl: string): StopHook;
  generateNtfyHook(topicName: string): StopHook;
  generateMacOSHook(title?: string): StopHook;
  createNtfyScript(topicName: string, scriptPath: string): Promise<void>;
}
```

### File System Service
```typescript
interface FileSystemService {
  ensureDirectory(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
}
```

## Data Models

### Claude Configuration
```typescript
interface ClaudeConfig {
  hooks?: {
    Stop?: StopHook[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface StopHook {
  matcher: string;
  hooks: Hook[];
}

interface Hook {
  type: "command";
  command: string;
}
```

### Command Options
```typescript
interface CommandOptions {
  global?: boolean;
}

interface DiscordCommandArgs {
  webhookUrl: string;
  options: CommandOptions;
}

interface NtfyCommandArgs {
  topicName: string;
  options: CommandOptions;
}

interface MacOSCommandArgs {
  title?: string;
  options: CommandOptions;
}
```

## Error Handling

### Validation Strategy
- **URL Validation**: Discord webhook URLs must match Discord webhook format
- **Topic Name Validation**: ntfy topic names must be valid (alphanumeric, hyphens, underscores)
- **File Path Validation**: Ensure write permissions and valid paths
- **JSON Validation**: Validate existing configuration files before modification

### Error Types
```typescript
enum ErrorType {
  INVALID_WEBHOOK_URL = 'INVALID_WEBHOOK_URL',
  INVALID_TOPIC_NAME = 'INVALID_TOPIC_NAME',
  FILE_PERMISSION_ERROR = 'FILE_PERMISSION_ERROR',
  JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
  CONFIG_BACKUP_ERROR = 'CONFIG_BACKUP_ERROR'
}

class CCNotifyError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
  }
}
```

### Error Handling Flow
1. **Input Validation**: Validate all user inputs before processing
2. **File System Checks**: Verify permissions and paths before file operations
3. **Backup Creation**: Always backup existing configurations before modification
4. **Atomic Operations**: Use temporary files for safe configuration updates
5. **Rollback Capability**: Restore backups if operations fail

## Implementation Details

### Discord Hook Generation
- **Webhook Validation**: Validate Discord webhook URL format
- **Command Generation**: Create curl command for Discord webhook API
- **Message Formatting**: Extract and format transcript content for Discord

### ntfy Hook Generation
- **Script Template**: Generate bash script based on provided template
- **Topic Configuration**: Embed topic name in script with fallback to environment variable
- **Transcript Processing**: Extract latest user and assistant messages from transcript
- **Message Truncation**: Limit message length for ntfy compatibility

### macOS Hook Generation
- **osascript Integration**: Use AppleScript via osascript for native macOS notifications
- **Sound Integration**: Play system sound (Pop.aiff) when displaying notifications
- **Message Reuse**: Leverage existing transcript processing logic from ntfy/Discord commands
- **Title Handling**: Use user message as title, with optional custom title fallback
- **Body Formatting**: Display assistant response as notification body with appropriate truncation
- **Character Limits**: Respect macOS notification character limits for title and body

### Configuration Management
- **Safe JSON Operations**: Parse, validate, and merge configurations
- **Backup Strategy**: Create timestamped backups before modifications
- **Path Resolution**: Handle both local (`.claude/`) and global (`~/.claude/`) paths
- **Directory Creation**: Ensure required directories exist

### Build and Distribution
- **TypeScript Compilation**: Compile to JavaScript for Node.js execution
- **Binary Creation**: Use pkg or similar tool to create standalone executables
- **Package Management**: Use pnpm for dependency management
- **Code Quality**: Use Biome for linting and formatting

## Testing Strategy

### Unit Testing
- **Command Parsing**: Test commander.js integration and argument parsing
- **Configuration Management**: Test JSON operations, backup creation, and path resolution
- **Hook Generation**: Test Discord and ntfy hook creation logic
- **Validation**: Test input validation for URLs and topic names

### Integration Testing
- **File System Operations**: Test actual file creation and modification
- **Configuration Merging**: Test preservation of existing settings
- **Script Generation**: Test ntfy script creation and content

### End-to-End Testing
- **CLI Workflow**: Test complete command execution flows
- **Error Scenarios**: Test error handling and recovery
- **Cross-Platform**: Test on different operating systems

### Test Structure
```
tests/
├── unit/
│   ├── commands/
│   ├── services/
│   └── utils/
├── integration/
│   ├── config-management.test.ts
│   └── file-operations.test.ts
└── e2e/
    ├── discord-command.test.ts
    └── ntfy-command.test.ts
```

## Security Considerations

- **Input Sanitization**: Sanitize all user inputs to prevent injection attacks
- **File Path Validation**: Prevent directory traversal attacks
- **Webhook URL Validation**: Ensure webhook URLs are legitimate Discord endpoints
- **Script Generation**: Safely generate bash scripts without code injection vulnerabilities
- **Configuration Backup**: Secure backup files with appropriate permissions