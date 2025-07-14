// Custom error types for LoggerService

export class LoggerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoggerError';
  }
}

export class LoggerContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoggerContextError';
  }
}
