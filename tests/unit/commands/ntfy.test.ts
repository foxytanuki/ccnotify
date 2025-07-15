import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleNtfyCommand } from '../../../src/commands/ntfy.js';
import { configManager } from '../../../src/services/config.js';
import { hookGenerator } from '../../../src/services/hooks.js';
import { validateAndSanitizeNtfyTopic } from '../../../src/services/validation.js';
import { CCNotifyError, ErrorType, type NtfyCommandArgs } from '../../../src/types/index.js';
import { fileSystemService } from '../../../src/utils/file.js';

// Mock all dependencies
vi.mock('../../../src/services/validation.js');
vi.mock('../../../src/services/config.js');
vi.mock('../../../src/services/hooks.js');
vi.mock('../../../src/utils/file.js');

const mockValidateAndSanitizeNtfyTopic = vi.mocked(validateAndSanitizeNtfyTopic);
const mockConfigManager = vi.mocked(configManager);
const mockHookGenerator = vi.mocked(hookGenerator);
const mockFileSystemService = vi.mocked(fileSystemService);

describe('ntfy command', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mocks
        mockValidateAndSanitizeNtfyTopic.mockReturnValue('valid-topic');
        mockConfigManager.getConfigPath.mockReturnValue('/test/.claude/settings.json');
        mockConfigManager.loadConfig.mockResolvedValue({});
        mockConfigManager.mergeConfig.mockReturnValue({
            hooks: {
                Stop: [
                    {
                        matcher: 'ntfy-notification',
                        hooks: [{ type: 'command' as const, command: 'bash "$(dirname "$0")/ntfy.sh"' }],
                    },
                ],
            },
        });
        mockFileSystemService.ensureDirectory.mockResolvedValue();
        mockFileSystemService.fileExists.mockResolvedValue(false);
        mockHookGenerator.generateNtfyHook.mockReturnValue({
            matcher: 'ntfy-notification',
            hooks: [{ type: 'command' as const, command: 'bash "$(dirname "$0")/ntfy.sh"' }],
        });
        mockHookGenerator.createNtfyScript.mockResolvedValue();
        mockConfigManager.saveConfig.mockResolvedValue();

        // Mock console methods
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handleNtfyCommand', () => {
        it('should create local ntfy hook successfully', async () => {
            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: { global: false },
            };

            await handleNtfyCommand(args);

            expect(mockValidateAndSanitizeNtfyTopic).toHaveBeenCalledWith('test-topic');
            expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(false);
            expect(mockFileSystemService.ensureDirectory).toHaveBeenCalledWith('/test/.claude');
            expect(mockConfigManager.loadConfig).toHaveBeenCalledWith('/test/.claude/settings.json');
            expect(mockHookGenerator.generateNtfyHook).toHaveBeenCalledWith('valid-topic');
            expect(mockConfigManager.saveConfig).toHaveBeenCalled();
            expect(mockHookGenerator.createNtfyScript).toHaveBeenCalledWith(
                'valid-topic',
                '/test/.claude/ntfy.sh',
            );
            expect(console.log).toHaveBeenCalledWith('✅ ntfy Stop Hook created successfully!');
        });

        it('should create global ntfy hook successfully', async () => {
            const args: NtfyCommandArgs = {
                topicName: 'global-topic',
                options: { global: true },
            };

            await handleNtfyCommand(args);

            expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(true);
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Configuration: /test/.claude/settings.json (global)'),
            );
        });

        it('should create backup when config file exists', async () => {
            mockFileSystemService.fileExists.mockResolvedValue(true);
            mockConfigManager.backupConfig.mockResolvedValue('/test/.claude/settings.json.backup');

            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: { global: false },
            };

            await handleNtfyCommand(args);

            expect(mockConfigManager.backupConfig).toHaveBeenCalledWith('/test/.claude/settings.json');
        });

        it('should not create backup when config file does not exist', async () => {
            mockFileSystemService.fileExists.mockResolvedValue(false);

            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: { global: false },
            };

            await handleNtfyCommand(args);

            expect(mockConfigManager.backupConfig).not.toHaveBeenCalled();
        });

        it('should handle validation errors', async () => {
            const validationError = new CCNotifyError(ErrorType.INVALID_TOPIC_NAME, 'Invalid topic name');
            mockValidateAndSanitizeNtfyTopic.mockImplementation(() => {
                throw validationError;
            });

            const args: NtfyCommandArgs = {
                topicName: 'invalid-topic',
                options: { global: false },
            };

            await expect(handleNtfyCommand(args)).rejects.toThrow(validationError);
        });

        it('should handle configuration loading errors', async () => {
            const configError = new CCNotifyError(ErrorType.JSON_PARSE_ERROR, 'Failed to parse config');
            mockConfigManager.loadConfig.mockRejectedValue(configError);

            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: { global: false },
            };

            await expect(handleNtfyCommand(args)).rejects.toThrow(configError);
        });

        it('should handle file system errors', async () => {
            const fileError = new Error('Permission denied');
            mockFileSystemService.ensureDirectory.mockRejectedValue(fileError);

            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: { global: false },
            };

            await expect(handleNtfyCommand(args)).rejects.toThrow(CCNotifyError);
            await expect(handleNtfyCommand(args)).rejects.toThrow('Failed to create ntfy Stop Hook');
        });

        it('should handle script creation errors', async () => {
            const scriptError = new CCNotifyError(
                ErrorType.FILE_PERMISSION_ERROR,
                'Failed to create script',
            );
            mockHookGenerator.createNtfyScript.mockRejectedValue(scriptError);

            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: { global: false },
            };

            await expect(handleNtfyCommand(args)).rejects.toThrow(scriptError);
        });

        it('should handle configuration saving errors', async () => {
            const saveError = new CCNotifyError(ErrorType.FILE_PERMISSION_ERROR, 'Failed to save config');
            mockConfigManager.saveConfig.mockRejectedValue(saveError);

            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: { global: false },
            };

            await expect(handleNtfyCommand(args)).rejects.toThrow(saveError);
        });

        it('should merge configuration correctly with existing hooks', async () => {
            const existingConfig = {
                hooks: {
                    Stop: [
                        {
                            matcher: 'existing-hook',
                            hooks: [{ type: 'command' as const, command: 'existing command' }],
                        },
                    ],
                },
                otherProperty: 'preserved',
            };
            mockConfigManager.loadConfig.mockResolvedValue(existingConfig);

            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: { global: false },
            };

            await handleNtfyCommand(args);

            expect(mockConfigManager.mergeConfig).toHaveBeenCalledWith(existingConfig, {
                hooks: {
                    Stop: [
                        {
                            matcher: 'ntfy-notification',
                            hooks: [{ type: 'command' as const, command: 'bash "$(dirname "$0")/ntfy.sh"' }],
                        },
                    ],
                },
            });
        });

        it('should use correct script path based on config directory', async () => {
            mockConfigManager.getConfigPath.mockReturnValue('/custom/path/.claude/settings.json');

            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: { global: false },
            };

            await handleNtfyCommand(args);

            expect(mockHookGenerator.createNtfyScript).toHaveBeenCalledWith(
                'valid-topic',
                '/custom/path/.claude/ntfy.sh',
            );
        });

        it('should display correct success messages', async () => {
            const args: NtfyCommandArgs = {
                topicName: 'my-topic',
                options: { global: false },
            };

            await handleNtfyCommand(args);

            expect(console.log).toHaveBeenCalledWith('✅ ntfy Stop Hook created successfully!');
            expect(console.log).toHaveBeenCalledWith(
                '📁 Configuration: /test/.claude/settings.json (local)',
            );
            expect(console.log).toHaveBeenCalledWith('📜 Script: /test/.claude/ntfy.sh');
            expect(console.log).toHaveBeenCalledWith('📢 Topic: valid-topic');
        });

        it('should handle undefined global option', async () => {
            const args: NtfyCommandArgs = {
                topicName: 'test-topic',
                options: {},
            };

            await handleNtfyCommand(args);

            expect(mockConfigManager.getConfigPath).toHaveBeenCalledWith(false);
        });
    });
});
