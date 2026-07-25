/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';

// Silence noisy vendor sourcemap warnings from @angular/platform-server.
// Vite emits these per SSR request and inlines entire source files into the
// terminal. They are vendor-only and not actionable from this app.
const SOURCEMAP_NOISE =
  /Sourcemap for .* points to (a source file outside its package|missing source files)/;

// Drop only the offending lines so unrelated diagnostics batched into the same
// chunk still reach the terminal.
function stripNoise(chunk: string): string {
  if (!SOURCEMAP_NOISE.test(chunk)) return chunk;
  return chunk
    .split(/(?<=\n)/)
    .filter((line) => !SOURCEMAP_NOISE.test(line))
    .join('');
}

function silenceVendorSourcemapWarnings(): Plugin {
  // The warnings are emitted by several loggers (Vite's SSR dev server, Rollup,
  // plain console) that a config-level customLogger does not all reach, so we
  // filter at the process output level. Dev-serve only, and the original
  // writers are restored when the server shuts down.
  let restore: (() => void) | null = null;

  return {
    name: 'silence-vendor-sourcemap-warnings',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      // Guard against stacking wrappers if the config is loaded more than once.
      if (restore) return;

      const originals = [process.stdout, process.stderr].map((stream) => {
        const original = stream.write;
        const call = original as unknown as (
          this: typeof stream,
          ...a: unknown[]
        ) => boolean;
        const patched = function (
          this: typeof stream,
          chunk: unknown,
          ...rest: unknown[]
        ) {
          if (typeof chunk === 'string') {
            const kept = stripNoise(chunk);
            if (kept === '') {
              const cb = rest.find((a) => typeof a === 'function') as
                | ((err?: Error) => void)
                | undefined;
              cb?.();
              return true;
            }
            return call.call(this ?? stream, kept, ...rest);
          }
          return call.call(this ?? stream, chunk, ...rest);
        } as typeof stream.write;

        stream.write = patched;
        return { stream, original, patched };
      });

      restore = () => {
        for (const { stream, original, patched } of originals) {
          // Only revert if nothing else patched on top of us in the meantime.
          if (stream.write === patched) {
            stream.write = original as typeof stream.write;
          }
        }
        restore = null;
      };

      const onClose = restore;
      server.httpServer?.once('close', onClose);
      const previousClose = server.close.bind(server);
      server.close = async () => {
        onClose();
        await previousClose();
      };
    },
  };
}

export default defineConfig(() => {
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
