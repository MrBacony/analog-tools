/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  return {
    root: __dirname,
    cacheDir: `../../node_modules/.vite`,
    resolve: {
      tsconfigPaths: true,
    },

    ssr: {
      noExternal: [
        '@analog-tools/auth',
        '@analog-tools/inject',
        '@analog-tools/logger',
        '@analog-tools/session',
      ],
    },

    build: {
      outDir: '../../dist/apps/analog-demo-auth/client',
      reportCompressedSize: true,
      target: ['es2020'],
      sourcemap: true,
    },
    server: {
      fs: {
        allow: ['.'],
      },
    },
    plugins: [
      analog({
        nitro: {
          alias: {
            '@analog-tools/auth': resolve(
              __dirname,
              '../../packages/auth/src/index.ts'
            ),
            '@analog-tools/auth/angular': resolve(
              __dirname,
              '../../packages/auth-angular/src/index.ts'
            ),
            '@analog-tools/session': resolve(
              __dirname,
              '../../packages/session/src/index.ts'
            ),
            '@analog-tools/inject': resolve(
              __dirname,
              '../../packages/inject/src/index.ts'
            ),
            '@analog-tools/logger': resolve(
              __dirname,
              '../../packages/logger/src/index.ts'
            ),
          },
          routeRules: {
            '/': {
              prerender: false,
            },
          },
        },
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['**/*.spec.ts'],
      reporters: ['default'],
    },
  };
});
