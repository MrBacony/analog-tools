import { beforeEach, vi, afterEach } from 'vitest';

// Reset mocks between tests
beforeEach(() => {
  vi.resetAllMocks();
});

// Clean up after all tests
afterEach(() => {
  vi.restoreAllMocks();
});

// Mock the crypto module
vi.mock('uncrypto', () => ({
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn(),
    verify: vi.fn(),
  },
  randomUUID: vi.fn().mockReturnValue('test-uuid'),
}));

// Mock the Buffer from node:buffer
// Mock the Buffer module
vi.mock('node:buffer', async (importOriginal) => {
  const actual: {Buffer: typeof Buffer} = await importOriginal();
  return {
    ...actual,
    Buffer: {
      ...actual.Buffer,
      from: vi.fn().mockImplementation(() => ({
        toString: vi
          .fn()
          .mockReturnValue('signature-part-exactly-43-characters-long-x'),
      })),
    },
  };
});

// Mock console methods to keep test output clean
global.console.error = vi.fn();
global.console.log = vi.fn();

// Setup the TextEncoder mock
global.TextEncoder = class {
  encode(input: string) {
    return new Uint8Array([...input].map(char => char.charCodeAt(0)));
  }
} as unknown as typeof TextEncoder;
