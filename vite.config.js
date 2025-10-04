import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import ViteWabt from 'vite-plugin-wabt';
import { coverageConfigDefaults } from 'vitest/config'
import wabt from 'wabt';

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
  plugins: [
    new ViteWabt(await wabt()),
  ],
  test: {
    coverage: {
      exclude: [
        '{bench,dev,examples}/**',
        ...coverageConfigDefaults.exclude,
      ],
    },
  },
});
