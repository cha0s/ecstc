import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import {coverageConfigDefaults} from 'vitest/config'

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
  test: {
    coverage: {
      exclude: [
        '{bench,dev}/**',
        ...coverageConfigDefaults.exclude,
      ],
    },
  },
});
