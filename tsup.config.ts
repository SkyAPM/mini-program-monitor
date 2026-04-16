import { defineConfig } from 'tsup';
import pkg from './package.json';

export default defineConfig({
  entry: ['src/index.ts'],
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  minify: true,
  target: 'es5',
  sourcemap: false,
  treeshake: true,
});
