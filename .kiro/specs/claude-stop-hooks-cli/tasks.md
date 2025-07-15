# Implementation Plan

- [x] 1. Set up project structure and dependencies
  - Initialize TypeScript project with pnpm
  - Configure Biome for linting and formatting
  - Install commander.js and other dependencies
  - Create directory structure for modular architecture
  - _Requirements: All requirements depend on proper project setup_

- [x] 2. Implement core TypeScript types and interfaces
  - Define ClaudeConfig, StopHook, and Hook interfaces
  - Create CommandOptions and command argument types
  - Define error types and CCNotifyError class
  - _Requirements: 2.1, 3.1, 4.1, 5.1_

- [x] 3. Create utility functions for file operations
  - Implement file system service with directory creation
  - Add file existence checking and safe file reading/writing
  - Create backup functionality for configuration files
  - Write unit tests for file operations
  - _Requirements: 5.1, 5.4, 5.5, 5.6_

- [x] 4. Implement JSON configuration management
  - Create configuration loading with JSON parsing and validation
  - Implement safe configuration saving with atomic operations
  - Add configuration merging to preserve existing settings
  - Write unit tests for configuration management
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 5. Create path resolution utilities
  - Implement local and global configuration path resolution
  - Add home directory detection for global mode
  - Create directory structure validation
  - Write unit tests for path resolution
  - _Requirements: 2.2, 3.2, 4.2, 4.3_

- [x] 6. Implement input validation services
  - Create Discord webhook URL validation
  - Add ntfy topic name validation
  - Implement general input sanitization
  - Write unit tests for validation functions
  - _Requirements: 6.1, 6.3_

- [x] 7. Implement ntfy hook generation and script creation
  - Create ntfy hook configuration generation
  - Generate ntfy.sh script with transcript processing logic based on provided reference
  - Implement topic name embedding and environment variable fallback
  - Add message extraction and formatting for ntfy
  - Write unit tests for ntfy hook generation
  - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [x] 8. Create ntfy command implementation
  - Implement ntfy command handler using commander.js
  - Integrate topic name validation
  - Add configuration file and script creation logic
  - Handle global vs local configuration modes
  - Write unit tests for ntfy command
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_

- [x] 9. Create Discord hook generation
  - Implement Discord webhook hook configuration generation
  - Create curl command template for Discord notifications
  - Add Discord-specific message formatting
  - Write unit tests for Discord hook generation
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 10. Create Discord command implementation
  - Implement discord command handler using commander.js
  - Integrate webhook URL validation
  - Add configuration file creation/updating logic
  - Handle global vs local configuration modes
  - Write unit tests for Discord command
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2_

- [x] 11. Implement CLI entry point and help system
  - Create main CLI application using commander.js
  - Set up command registration and option parsing
  - Implement help command and default help display
  - Add global option handling for all commands
  - Write unit tests for CLI setup
  - _Requirements: 1.1, 1.2, 1.3, 4.1_

- [ ] 12. Add comprehensive error handling
  - Implement error catching and user-friendly error messages
  - Add proper exit codes for different error scenarios
  - Create error logging and debugging capabilities
  - Handle file system permission errors gracefully
  - Write unit tests for error handling scenarios
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 13. Create integration tests
  - Write integration tests for complete command workflows
  - Test configuration file creation and modification
  - Verify script generation and placement
  - Test global vs local configuration handling
  - _Requirements: All requirements integration testing_

- [ ] 14. Add end-to-end testing
  - Create E2E tests for Discord command workflow
  - Create E2E tests for ntfy command workflow
  - Test error scenarios and recovery
  - Verify cross-platform compatibility
  - _Requirements: Complete workflow validation_

- [ ] 15. Configure build and packaging
  - Set up TypeScript compilation configuration
  - Configure Biome for code quality checks
  - Create build scripts for development and production
  - Set up package.json with proper bin configuration
  - _Requirements: Tool distribution and usability_

- [ ] 16. Create executable and distribution setup
  - Configure CLI binary creation
  - Test executable generation and functionality
  - Verify all commands work in built executable
  - Create installation and usage documentation
  - _Requirements: Final tool deployment and usability_