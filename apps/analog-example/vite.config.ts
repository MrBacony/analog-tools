/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// @ts-expect-error @tailwindcss/vite currently uses mts. TypeScript is complaining this, but it works as expected.
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    root: __dirname,
    cacheDir: `../../node_modules/.vite`,

    ssr: {
      noExternal: ['@analogjs/trpc', '@trpc/server'],
    },

    build: {
      outDir: '../../dist/apps/analog-example/client',
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
      tailwindcss(),

      analog({
        nitro: {
          alias: {
            '@analog-tools/auth': resolve(
              __dirname,
              '../../packages/auth/src/index.ts'
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

      nxViteTsPaths(),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['**/*.spec.ts'],
      reporters: ['default'],
    },
    define: {
      'import.meta.vitest': mode !== 'production',
    },
  };
});
