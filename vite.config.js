import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import {coverageConfigDefaults} from 'vitest/config'

import {plugins} from './src/vite.js';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      fileName: 'index',
      name: 'ecstc',
    },
    sourcemap: true,
    target: 'esnext',
  },
  plugins,
  test: {
    coverage: {
      exclude: [
        '{bench,dev,examples}/**',
        'src/vite.js',
        ...coverageConfigDefaults.exclude,
      ],
    },
  },
});
