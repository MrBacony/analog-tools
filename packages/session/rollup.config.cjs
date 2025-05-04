const { withNx } = require('@nx/rollup/with-nx');

module.exports = withNx(
  {
    main: './src/index.ts',
    outputPath: '../../node_modules/@analog-tools/session',
    tsConfig: './tsconfig.lib.json',
    compiler: 'swc',
    format: ['cjs', 'esm'],
    assets: [{ input: 'packages/session', output: '.', glob: 'README.md' }],
  },
  {
    // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
    // e.g.
    // output: { sourcemap: true },
  }
);
