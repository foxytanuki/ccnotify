# Requirements Document

## Introduction

A CLI tool called `ccnotify` that simplifies the creation of Stop Hooks for Claude Code. The tool will generate notification hooks for Discord and ntfy services by automatically creating or editing the `.claude/settings.json` configuration file. This eliminates the manual process of writing hook configurations and provides a streamlined way to set up notifications when Claude Code operations complete.

## Requirements

### Requirement 1

**User Story:** As a developer using Claude Code, I want to display help information for the ccnotify tool, so that I can understand available commands and options.

#### Acceptance Criteria

1. WHEN the user runs `ccnotify` without arguments THEN the system SHALL display help information showing available commands and options
2. WHEN the user runs `ccnotify --help` or `ccnotify -h` THEN the system SHALL display comprehensive help documentation
3. THE help output SHALL include command syntax, available options, and usage examples

### Requirement 2

**User Story:** As a developer, I want to create Discord notification Stop Hooks, so that I can receive notifications in Discord when Claude Code operations complete.

#### Acceptance Criteria

1. WHEN the user runs `ccnotify discord <webhook_url>` THEN the system SHALL create or update `.claude/settings.json` in the current directory
2. THE Discord hook configuration SHALL include a properly formatted Stop Hook with the provided webhook URL
3. IF `.claude/settings.json` already exists THEN the system SHALL preserve existing configurations while adding the new Discord hook
4. IF the `.claude` directory does not exist THEN the system SHALL create it
5. THE generated hook SHALL use a command that sends notifications to the specified Discord webhook

### Requirement 3

**User Story:** As a developer, I want to create ntfy notification Stop Hooks, so that I can receive push notifications through ntfy when Claude Code operations complete.

#### Acceptance Criteria

1. WHEN the user runs `ccnotify ntfy <topic_name>` THEN the system SHALL create or update `.claude/settings.json` in the current directory
2. THE ntfy hook configuration SHALL include a properly formatted Stop Hook with the provided topic name
3. IF `.claude/settings.json` already exists THEN the system SHALL preserve existing configurations while adding the new ntfy hook
4. IF the `.claude` directory does not exist THEN the system SHALL create it
5. THE system SHALL generate an `ntfy.sh` script in the same directory as `settings.json`
6. THE ntfy script SHALL extract transcript information and send notifications to the specified topic

### Requirement 4

**User Story:** As a developer working across multiple projects, I want to configure global Stop Hooks, so that I can have consistent notifications across all my Claude Code usage.

#### Acceptance Criteria

1. WHEN the user adds the `--global` or `-g` flag to any command THEN the system SHALL modify `~/.claude/settings.json` instead of the local directory
2. IF the global `.claude` directory does not exist THEN the system SHALL create it in the user's home directory
3. THE global configuration SHALL follow the same format and behavior as local configurations
4. WHEN using global mode with ntfy THEN the system SHALL place the `ntfy.sh` script in the global `.claude` directory

### Requirement 5

**User Story:** As a developer, I want the tool to handle JSON configuration safely, so that my existing Claude Code settings are not corrupted.

#### Acceptance Criteria

1. WHEN modifying existing `settings.json` files THEN the system SHALL preserve all existing configuration properties
2. IF the `hooks` property does not exist THEN the system SHALL create it
3. IF the `Stop` hook array does not exist THEN the system SHALL create it
4. THE system SHALL validate JSON syntax before writing configuration files
5. IF JSON parsing fails THEN the system SHALL display an error message and exit without making changes
6. THE system SHALL create backup copies of existing configuration files before modification

### Requirement 6

**User Story:** As a developer, I want clear error handling and feedback, so that I can troubleshoot issues when the tool fails.

#### Acceptance Criteria

1. WHEN invalid arguments are provided THEN the system SHALL display appropriate error messages and usage information
2. WHEN file system operations fail THEN the system SHALL display descriptive error messages
3. WHEN webhook URLs are malformed THEN the system SHALL validate and provide feedback
4. THE system SHALL exit with appropriate error codes for different failure scenarios
5. ALL error messages SHALL be clear and actionable for the user