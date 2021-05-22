import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
export default {
  input: 'src/index.ts',
  output: {
    file: './lib/index.js',
    format: 'cjs', // "amd", "cjs", "system", "es", "iife" or "umd"
    sourcemap: true,
  },
  plugins: [
    typescript({
      useTsconfigDeclarationDir: true,
    }),
    resolve(),
    commonjs(),
  ],
};
