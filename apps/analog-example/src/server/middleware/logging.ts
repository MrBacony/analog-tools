/**
 * Logging middleware for AnalogJS
 * Logs incoming requests with sanitization for sensitive data
 * Automatically masks passwords, tokens, API keys, emails, credit cards, and IP addresses
 */

import { defineEventHandler, H3Event, getHeader, readRawBody, getQuery } from 'h3';
import { inject } from '@analog-tools/inject';
import { LoggerService } from '@analog-tools/logger';

/**
 * Demo request metadata interface
 */
interface RequestMetadata {
  method: string;
  path: string;
  userAgent?: string;
  contentType?: string;
  contentLength?: number;
  body?: unknown;
  queryParams?: Record<string, string | string[]>;
}

/**
 * Extract request metadata and sanitize sensitive data
 */
function extractRequestMetadata(event: H3Event): RequestMetadata {
  const metadata: RequestMetadata = {
    method: event.method || 'UNKNOWN',
    path: event.path || '/',
    userAgent: getHeader(event, 'user-agent'),
    contentType: getHeader(event, 'content-type'),
  };

  const contentLength = getHeader(event, 'content-length');
  if (contentLength) {
    metadata.contentLength = parseInt(contentLength, 10);
  }

  // Extract query parameters (h3 automatically parses them)
  const query = getQuery(event);
  if (Object.keys(query).length > 0) {
    metadata.queryParams = query as Record<string, string | string[]>;
  }

  return metadata;
}

/**
 * Main logging middleware for AnalogJS
 * Logs all incoming requests with automatic sanitization
 */
export default defineEventHandler(async (event: H3Event) => {
  // Initialize logger with namespace
  // The LoggerService automatically applies sanitization to all logged data
  // hiding passwords, tokens, API keys, emails, credit cards, and IPs
  const logger = inject(LoggerService).forContext('http');

  // Track request timing
  const startTime = Date.now();

  // Extract request metadata
  const requestMetadata = extractRequestMetadata(event);

  // Attempt to read and parse body (only for POST, PUT, PATCH requests)
  if (['POST', 'PUT', 'PATCH'].includes(event.method || '')) {
    try {
      const rawBody = await readRawBody(event);
      if (rawBody) {
        const contentType = getHeader(event, 'content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            requestMetadata.body = JSON.parse(rawBody.toString());
          } catch {
            requestMetadata.body = rawBody.toString();
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          requestMetadata.body = Object.fromEntries(
            new URLSearchParams(rawBody.toString())
          );
        } else {
          requestMetadata.body = rawBody.toString();
        }
      }
    } catch {
      // Silently fail if body reading is not possible (already consumed, etc.)
    }
  }

  // ==================== DEMO LOGGING ====================
  // Log demo information at different levels to showcase the logger

  // Trace level: Most detailed, startup information
  logger.trace('📨 HTTP Request initiated', {
    timestamp: new Date().toISOString(),
    middleware: 'logging',
  });

  // Debug level: Request details
  logger.debug('🔍 Request details', {
    method: requestMetadata.method,
    path: requestMetadata.path,
    userAgent: requestMetadata.userAgent,
    contentType: requestMetadata.contentType,
    contentLength: requestMetadata.contentLength,
  });

  // Log request body if present (sanitizer automatically removes sensitive data)
  if (requestMetadata.body) {
    logger.info('📦 Request body received', {
      body: requestMetadata.body,
      size: requestMetadata.contentLength,
    });
  }

  // Log query parameters if any
  if (
    requestMetadata.queryParams &&
    Object.keys(requestMetadata.queryParams).length > 0
  ) {
    logger.debug('🔗 Query parameters', requestMetadata.queryParams);
  }

  // Demo: Log custom context information
  logger.debug('⚙️ Request context', {
    remoteIP: event.node.req.socket.remoteAddress || 'unknown',
    port: event.node.req.socket.remotePort || 'unknown',
    protocol: event.node.req.httpVersion || 'unknown',
  });

  // ==================== SANITIZATION DEMO ====================
  // Demonstrate sanitization with example sensitive data
  const demoSensitiveData = {
    apiKey: 'sk-proj-abc123def456ghi789jkl012mno345pqr',
    jwtToken:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    password: 'mySecurePassword123!',
    email: 'user@example.com',
    creditCard: '0000-0000-0000-0000',
    ipAddress: '192.168.1.100',
  };

  // Show what gets sanitized
  logger.warn('🔐 Sanitization demo - these values will be masked/hashed:', {
    before: demoSensitiveData,
  });

  // Timing information
  const duration = Date.now() - startTime;
  logger.trace('✨ Logging middleware completed setup', {
    duration: `${duration}ms`,
    requestPath: requestMetadata.path,
  });

  // Warn about slow requests (demo)
  if (duration > 100) {
    logger.warn('⚠️ Middleware setup took longer than expected', {
      duration: `${duration}ms`,
    });
  }
});
