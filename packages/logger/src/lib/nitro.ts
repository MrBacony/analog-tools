/**
 * Nitro specific utilities for integrating the LoggerService
 */

import { EventHandler, defineEventHandler, EventHandlerRequest } from 'h3';
import { inject } from '@analog-tools/inject';
import { LoggerService } from '../index';

/**
 * Creates a logger middleware for Nitro
 * This will add a logger to the event context
 * @param namespace The namespace for the logger
 * @returns Middleware handler
 */
export function createLoggerMiddleware(namespace = 'api') {
  return defineEventHandler((event) => {
    const logger = inject(LoggerService).forContext(namespace);
    event.context.logger = logger;

    logger.debug('Request received', {
      method: event.method,
      path: event.path,
      requestId: event.context['id'],
    });
  });
}

/**
 * Wraps an event handler with logging
 * @param handler The original event handler
 * @param options Options for the wrapper
 * @returns A new event handler with logging
 */
export function withLogging<T extends EventHandlerRequest>(
  handler: EventHandler<T>,
  options: {
    namespace?: string;
    level?: 'debug' | 'info';
    logResponse?: boolean;
  } = {}
): EventHandler<T> {
  const { namespace = 'api', level = 'debug', logResponse = false } = options;

  return defineEventHandler(async (event) => {
    const logger = getLogger(event);
    const start = Date.now();

    try {
      const result = await handler(event);

      const duration = Date.now() - start;
      const logMethod = level === 'debug' ? logger.debug : logger.info;

      logMethod.call(logger, `Request completed in ${duration}ms`, {
        method: event.method,
        path: event.path,
        duration,
        ...(logResponse && result ? { response: result } : {}),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error(`Request failed after ${duration}ms`, error, {
        method: event.method,
        path: event.path,
        duration,
      });

      throw error;
    }
  });
}
