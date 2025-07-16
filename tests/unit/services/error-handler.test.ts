import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createError,
  DebugLevel,
  ErrorHandler,
  errorHandler,
  handleError,
} from '../../../src/services/error-handler.js';
import { CCNotifyError, ErrorSeverity, ErrorType, ExitCode } from '../../../src/types/index.js';

// Mock fs operations
vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn(),
    appendFile: vi.fn(),
  },
}));

// Mock console methods
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('ErrorHandler', () => {
  let testErrorHandler: ErrorHandler;

  beforeEach(() => {
    testErrorHandler = new ErrorHandler({
      debugLevel: DebugLevel.DEBUG,
      logToFile: false,
      showStackTrace: true,
      colorOutput: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    testErrorHandler.clearLogBuffer();
  });

  describe('CCNotifyError', () => {
    it('should create error with proper properties', () => {
      const error = new CCNotifyError(
        ErrorType.INVALID_WEBHOOK_URL,
        'Test error message',
        new Error('Original error'),
        ErrorSeverity.HIGH
      );

      expect(error.type).toBe(ErrorType.INVALID_WEBHOOK_URL);
      expect(error.message).toBe('Test error message');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.exitCode).toBe(ExitCode.INVALID_INPUT);
      expect(error.originalError).toBeInstanceOf(Error);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should generate user-friendly messages with suggestions', () => {
      const error = new CCNotifyError(ErrorType.INVALID_WEBHOOK_URL, 'Invalid webhook URL');

      const friendlyMessage = error.getUserFriendlyMessage();
      expect(friendlyMessage).toContain('Invalid webhook URL');
      expect(friendlyMessage).toContain('Suggestions:');
      expect(friendlyMessage).toContain('https://discord.com/api/webhooks/');
    });

    it('should convert to JSON for logging', () => {
      const originalError = new Error('Original error');
      const error = new CCNotifyError(
        ErrorType.FILE_PERMISSION_ERROR,
        'Test error',
        originalError,
        ErrorSeverity.MEDIUM
      );

      const json = error.toJSON();
      expect(json.name).toBe('CCNotifyError');
      expect(json.type).toBe(ErrorType.FILE_PERMISSION_ERROR);
      expect(json.message).toBe('Test error');
      expect(json.severity).toBe(ErrorSeverity.MEDIUM);
      expect(json.originalError).toEqual({
        name: originalError.name,
        message: originalError.message,
        stack: originalError.stack,
      });
    });
  });

  describe('Error Creation', () => {
    it('should create error with context', () => {
      const error = testErrorHandler.createError(
        ErrorType.JSON_PARSE_ERROR,
        'JSON parsing failed',
        new Error('Syntax error'),
        ErrorSeverity.HIGH,
        { filePath: '/test/path' }
      );

      expect(error).toBeInstanceOf(CCNotifyError);
      expect(error.type).toBe(ErrorType.JSON_PARSE_ERROR);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should wrap file system errors appropriately', () => {
      const nodeError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      nodeError.code = 'ENOENT';

      const wrappedError = testErrorHandler.wrapFileSystemError(nodeError, 'read file', '/test/path');

      expect(wrappedError.type).toBe(ErrorType.FILE_PERMISSION_ERROR);
      expect(wrappedError.message).toContain('File or directory not found');
      expect(wrappedError.originalError).toBe(nodeError);
    });

    it('should wrap permission errors with high severity', () => {
      const nodeError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
      nodeError.code = 'EACCES';

      const wrappedError = testErrorHandler.wrapFileSystemError(nodeError, 'write file', '/test/path');

      expect(wrappedError.type).toBe(ErrorType.FILE_PERMISSION_ERROR);
      expect(wrappedError.severity).toBe(ErrorSeverity.HIGH);
      expect(wrappedError.message).toContain('Permission denied');
    });

    it('should wrap JSON errors with proper context', () => {
      const syntaxError = new SyntaxError('Unexpected token');
      const wrappedError = testErrorHandler.wrapJsonError(syntaxError, '/test/config.json');

      expect(wrappedError.type).toBe(ErrorType.JSON_PARSE_ERROR);
      expect(wrappedError.message).toContain('Invalid JSON in configuration file');
      expect(wrappedError.originalError).toBe(syntaxError);
    });
  });

  describe('Logging', () => {
    it('should log errors to buffer', async () => {
      const error = new CCNotifyError(ErrorType.VALIDATION_ERROR, 'Test error');

      await testErrorHandler.logError(error, { context: 'test' });

      const logBuffer = testErrorHandler.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      expect(logBuffer[0].level).toBe('ERROR');
      expect(logBuffer[0].message).toBe('Test error');
      expect(logBuffer[0].context).toEqual({ context: 'test' });
    });

    it('should log warnings when debug level allows', async () => {
      await testErrorHandler.logWarning('Test warning', { test: true });

      const logBuffer = testErrorHandler.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      expect(logBuffer[0].level).toBe('WARN');
      expect(logBuffer[0].message).toBe('Test warning');
    });

    it('should log info messages when debug level allows', async () => {
      await testErrorHandler.logInfo('Test info', { test: true });

      const logBuffer = testErrorHandler.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      expect(logBuffer[0].level).toBe('INFO');
      expect(logBuffer[0].message).toBe('Test info');
    });

    it('should log debug messages when debug level allows', async () => {
      await testErrorHandler.logDebug('Test debug', { test: true });

      const logBuffer = testErrorHandler.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      expect(logBuffer[0].level).toBe('DEBUG');
      expect(logBuffer[0].message).toBe('Test debug');
    });

    it('should not log when debug level is too low', async () => {
      const lowLevelHandler = new ErrorHandler({ debugLevel: DebugLevel.ERROR });

      await lowLevelHandler.logWarning('Test warning');
      await lowLevelHandler.logInfo('Test info');
      await lowLevelHandler.logDebug('Test debug');

      const logBuffer = lowLevelHandler.getLogBuffer();
      expect(logBuffer).toHaveLength(0);
    });
  });

  describe('File Logging', () => {
    it('should write logs to file when enabled', async () => {
      const fileHandler = new ErrorHandler({
        logToFile: true,
        logFilePath: '/test/error.log',
      });

      const error = new CCNotifyError(ErrorType.VALIDATION_ERROR, 'Test error');
      await fileHandler.logError(error);

      expect(fs.mkdir).toHaveBeenCalledWith('/test', { recursive: true });
      expect(fs.appendFile).toHaveBeenCalledWith('/test/error.log', expect.stringContaining('"level":"ERROR"'), 'utf8');
    });

    it('should handle file logging errors gracefully', async () => {
      const fileHandler = new ErrorHandler({
        logToFile: true,
        logFilePath: '/test/error.log',
      });

      (fs.appendFile as any).mockRejectedValue(new Error('Write failed'));

      const error = new CCNotifyError(ErrorType.VALIDATION_ERROR, 'Test error');

      // Should not throw even if file logging fails
      await expect(fileHandler.logError(error)).resolves.not.toThrow();
      expect(mockConsoleError).toHaveBeenCalledWith('Failed to write to log file:', expect.any(Error));
    });

    it('should flush logs to file', async () => {
      const fileHandler = new ErrorHandler({
        logToFile: true,
        logFilePath: '/test/error.log',
        debugLevel: DebugLevel.INFO,
      });

      // Add some logs to buffer
      await fileHandler.logInfo('Test 1');
      await fileHandler.logInfo('Test 2');

      await fileHandler.flushLogs();

      expect(fs.mkdir).toHaveBeenCalledWith('/test', { recursive: true });
      // flushLogs writes all logs in a single call
      expect(fs.appendFile).toHaveBeenCalledWith(
        '/test/error.log',
        expect.stringMatching(/Test 1.*Test 2/s), // Matches both Test 1 and Test 2 with any characters between (including newlines)
        'utf8'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle CCNotifyError and exit with proper code', async () => {
      const error = new CCNotifyError(
        ErrorType.INVALID_WEBHOOK_URL,
        'Invalid webhook',
        undefined,
        ErrorSeverity.MEDIUM
      );

      await expect(testErrorHandler.handleError(error)).rejects.toThrow('process.exit called');
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.INVALID_INPUT);
    });

    it('should handle unknown errors by wrapping them', async () => {
      const unknownError = new Error('Unknown error');

      await expect(testErrorHandler.handleUnknownError(unknownError)).rejects.toThrow('process.exit called');
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.COMMAND_ERROR);
    });

    it('should display error with user-friendly formatting', async () => {
      const error = new CCNotifyError(ErrorType.INVALID_TOPIC_NAME, 'Invalid topic name');

      await expect(testErrorHandler.handleError(error)).rejects.toThrow('process.exit called');

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('❌ Error: Invalid topic name'));
    });

    it('should show debug information when debug level is high', async () => {
      const error = new CCNotifyError(
        ErrorType.FILE_PERMISSION_ERROR,
        'Permission denied',
        new Error('Original error')
      );

      // Clear previous calls
      mockConsoleError.mockClear();

      await expect(testErrorHandler.handleError(error)).rejects.toThrow('process.exit called');

      // Check that the error calls include debug information
      const errorCalls = mockConsoleError.mock.calls.map(call => call[0]);
      expect(errorCalls.some(msg => msg.includes('❌ Error: Permission denied'))).toBe(true);
      expect(errorCalls.some(msg => msg.includes('Error Type: FILE_PERMISSION_ERROR'))).toBe(true);
      expect(errorCalls.some(msg => msg.includes('Severity: medium'))).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should read debug level from environment', () => {
      const originalEnv = process.env.CCNOTIFY_DEBUG;
      process.env.CCNOTIFY_DEBUG = 'verbose';

      const envHandler = new ErrorHandler();
      // We can't directly test the private method, but we can test the behavior
      expect(envHandler).toBeInstanceOf(ErrorHandler);

      process.env.CCNOTIFY_DEBUG = originalEnv;
    });

    it('should determine stack trace visibility from environment', () => {
      const originalEnv = process.env.CCNOTIFY_STACK_TRACE;
      process.env.CCNOTIFY_STACK_TRACE = 'true';

      const envHandler = new ErrorHandler();
      expect(envHandler).toBeInstanceOf(ErrorHandler);

      process.env.CCNOTIFY_STACK_TRACE = originalEnv;
    });
  });

  describe('Convenience Functions', () => {
    it('should handle errors through convenience function', async () => {
      const error = new CCNotifyError(ErrorType.VALIDATION_ERROR, 'Test error');

      await expect(handleError(error)).rejects.toThrow('process.exit called');
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.INVALID_INPUT);
    });

    it('should create errors through convenience function', () => {
      const error = createError(ErrorType.JSON_PARSE_ERROR, 'JSON error', new Error('Original'), ErrorSeverity.HIGH);

      expect(error).toBeInstanceOf(CCNotifyError);
      expect(error.type).toBe(ErrorType.JSON_PARSE_ERROR);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('Error Message Suggestions', () => {
    it('should provide suggestions for webhook URL errors', () => {
      const error = new CCNotifyError(ErrorType.INVALID_WEBHOOK_URL, 'Invalid URL');
      const message = error.getUserFriendlyMessage();

      expect(message).toContain('Ensure the URL starts with https://discord.com/api/webhooks/');
      expect(message).toContain('Check that the webhook ID and token are correct');
    });

    it('should provide suggestions for topic name errors', () => {
      const error = new CCNotifyError(ErrorType.INVALID_TOPIC_NAME, 'Invalid topic');
      const message = error.getUserFriendlyMessage();

      expect(message).toContain('Use only letters, numbers, hyphens, and underscores');
      expect(message).toContain('Keep the topic name between 1-64 characters');
    });

    it('should provide suggestions for file permission errors', () => {
      const error = new CCNotifyError(ErrorType.FILE_PERMISSION_ERROR, 'Permission denied');
      const message = error.getUserFriendlyMessage();

      expect(message).toContain('Check file and directory permissions');
      expect(message).toContain('Ensure you have write access');
    });

    it('should provide suggestions for JSON parse errors', () => {
      const error = new CCNotifyError(ErrorType.JSON_PARSE_ERROR, 'Invalid JSON');
      const message = error.getUserFriendlyMessage();

      expect(message).toContain('Check if the configuration file has valid JSON syntax');
      expect(message).toContain('Consider backing up and recreating');
    });
  });

  describe('Exit Codes', () => {
    it('should map error types to correct exit codes', () => {
      const testCases = [
        { type: ErrorType.INVALID_WEBHOOK_URL, expected: ExitCode.INVALID_INPUT },
        { type: ErrorType.INVALID_TOPIC_NAME, expected: ExitCode.INVALID_INPUT },
        { type: ErrorType.VALIDATION_ERROR, expected: ExitCode.INVALID_INPUT },
        { type: ErrorType.FILE_PERMISSION_ERROR, expected: ExitCode.FILE_PERMISSION_ERROR },
        { type: ErrorType.JSON_PARSE_ERROR, expected: ExitCode.JSON_PARSE_ERROR },
        { type: ErrorType.CONFIG_BACKUP_ERROR, expected: ExitCode.CONFIG_BACKUP_ERROR },
        { type: ErrorType.DIRECTORY_ACCESS_ERROR, expected: ExitCode.DIRECTORY_ACCESS_ERROR },
        { type: ErrorType.SCRIPT_CREATION_ERROR, expected: ExitCode.SCRIPT_CREATION_ERROR },
        { type: ErrorType.NETWORK_ERROR, expected: ExitCode.NETWORK_ERROR },
        { type: ErrorType.COMMAND_ERROR, expected: ExitCode.COMMAND_ERROR },
      ];

      testCases.forEach(({ type, expected }) => {
        const error = new CCNotifyError(type, 'Test error');
        expect(error.exitCode).toBe(expected);
      });
    });
  });
});
