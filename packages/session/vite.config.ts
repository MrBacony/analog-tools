import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/session',
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  publicDir: false,
  build: {
    outDir: '../../node_modules/@analog-tools/session',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'session',
      fileName: (format) => {
        let prefix = 'js';
        if (format === 'cjs') {
          prefix = 'cjs';
        }
        if (format === 'es') {
          prefix = 'js';
        }

        return `index.${prefix}`;
      },
      formats: ['es' as const, 'cjs' as const],
    },
    rollupOptions: {
      // Anything listed here becomes a bare `require()` in index.cjs, so it
      // must ship a CommonJS build - an ESM-only package breaks every CJS
      // consumer of this library.
      external: [
        'node:buffer',
        'h3',
        'defu',
        'uncrypto',
        'unstorage',
        'ioredis',
      ],
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/session',
      provider: 'v8' as const,
    },
  },
}));
