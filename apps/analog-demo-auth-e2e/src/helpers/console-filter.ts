import type { Page, ConsoleMessage } from '@playwright/test';

const KNOWN_NOISE_PATTERNS = [
  /\[vite\]/,
  /Download the Angular DevTools/,
  /Angular is running in development mode/,
  /\[HMR\]/,
  /favicon\.ico/,
  /third-party cookie/i,
];

export function createConsoleFilter(page: Page): {
  errors: ConsoleMessage[];
} {
  const errors: ConsoleMessage[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const isNoise = KNOWN_NOISE_PATTERNS.some((p) => p.test(text));
    if (!isNoise) {
      errors.push(msg);
    }
  });

  return { errors };
}
