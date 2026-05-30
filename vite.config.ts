import { resolve } from 'node:path'

/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['es'],
    },
    sourcemap: true,
    target: 'es2023',
  },
  test: {
    coverage: {
      exclude: [
        '{benchmark,dev,examples}/**',
        ...coverageConfigDefaults.exclude,
      ],
    },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          include: [
            'src/**/*.test.ts',
          ],
          name: 'test',
        },
      },
      {
        extends: './vite.config.ts',
        test: {
          include: [
            'benchmark/**/*.ts',
          ],
          name: 'bench',
        },
      },
    ],
  },
})
