import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

const config = [
  {
    input: 'src/index.ts',
    output: {
      file: './lib/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    plugins: [
      typescript(),
      nodeResolve({
        extensions: ['.js', '.ts'],
      }),
      commonjs(),
    ],
  },
  {
    input: 'src/types/index.d.ts',
    output: [{ file: './lib/types.d.ts', format: 'es' }],
    plugins: [dts()],
  },
];

export default config;
