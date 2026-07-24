/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

// Silence noisy vendor sourcemap warnings from @angular/platform-server.
// Vite emits these per SSR request and inlines entire source files into the
// terminal. They are vendor-only and not actionable from this app.
const SOURCEMAP_NOISE =
  /Sourcemap for .* points to (a source file outside its package|missing source files)/;

function silenceVendorSourcemapWarnings(): Plugin {
  // The warnings are emitted by several loggers (Vite's SSR dev server, Rollup,
  // plain console) that a config-level customLogger does not all reach, so we
  // filter at the process output level. Dev-serve only.
  return {
    name: 'silence-vendor-sourcemap-warnings',
    apply: 'serve',
    enforce: 'pre',
    configResolved() {
      for (const stream of [process.stdout, process.stderr] as const) {
        const original = stream.write.bind(stream);
        stream.write = ((chunk: unknown, ...rest: unknown[]) => {
          if (typeof chunk === 'string' && SOURCEMAP_NOISE.test(chunk)) {
            const cb = rest.find((a) => typeof a === 'function') as
              | ((err?: Error) => void)
              | undefined;
            cb?.();
            return true;
          }
          return (original as (...a: unknown[]) => boolean)(chunk, ...rest);
        }) as typeof stream.write;
      }
    },
  };
}

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
      silenceVendorSourcemapWarnings(),
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
          ...(process.env['VITEST'] ? [tsconfigPaths()] : []),

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
