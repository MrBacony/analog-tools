/**
 * Example usage of logger groups
 */

import { LoggerService } from './logger.service';

// Create a logger instance
const logger = new LoggerService({ level: 'debug' });

// Basic usage
logger.info('Regular log message');

// Group logs together
logger.group('Authentication Process');
logger.debug('Checking user credentials...');
logger.info('User authenticated successfully');
logger.groupEnd('Authentication Process');

// Nested groups
logger.group('API Request');
logger.info('Starting API request to /users');

logger.group('Request Headers');
logger.debug('Content-Type: application/json');
logger.debug('Authorization: Bearer token123');
logger.groupEnd('Request Headers');

logger.group('Request Body');
logger.debug('{ "name": "John", "role": "admin" }');
logger.groupEnd('Request Body');

logger.info('API request completed');
logger.groupEnd('API Request');

// Use with child loggers
const authLogger = logger.forContext('auth');
authLogger.group('Login Process');
authLogger.info('Processing login for user@example.com');
authLogger.debug('Validating password hash');
authLogger.info('Generating session token');
authLogger.groupEnd('Login Process');
