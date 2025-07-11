/**
 * Nitro specific utilities for integrating the LoggerService
 */

import { EventHandler, H3Event, defineEventHandler, EventHandlerRequest } from 'h3';
import { inject } from '@analog-tools/inject';
import { LoggerService } from '../index';
import { LogLevel } from './logger.types';

/**
 * Creates a logger middleware for Nitro
 * This will add a logger to the event context
 * @param namespace The namespace for the logger
 * @returns Middleware handler
 */
export function createLoggerMiddleware(namespace = 'api') {
  return defineEventHandler((event) => {
    const logger = inject(LoggerService).forContext(namespace);
    event.context['logger'] = logger;

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
    level?: LogLevel;
    logResponse?: boolean;
  } = {}
): EventHandler<T> {
  const { namespace = 'api', level = 'debug', logResponse = false } = options;

  return defineEventHandler(async (event: H3Event) => {
    const logger = inject(LoggerService).forContext(namespace);
    const start = Date.now();

    try {
      const result = await handler(event);

      const duration = Date.now() - start;
      
      // Map LogLevel to LoggerService method name
      const logMethodMap: Record<LogLevel, keyof LoggerService | undefined> = {
        trace: 'trace',
        debug: 'debug',
        info: 'info',
        warn: 'warn',
        error: 'error',
        fatal: 'fatal',
        silent: undefined, // do not log for silent
      };
      const method = logMethodMap[level];
      if (method && typeof logger[method] === 'function') {
        (logger[method] as typeof logger.debug).call(logger, `Request completed in ${duration}ms`, {
          method: event.method,
          path: event.path,
          duration,
          ...(logResponse && result ? { response: result } : {}),
        });
      }

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
