import {readdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {defineConfig} from 'vite';
import ViteWabt from 'vite-plugin-wabt';
import wabt from 'wabt';


const examples = [];
for (const local of readdirSync(__dirname)) {
  if ('dist' !== local && statSync(join(__dirname, local)).isDirectory()) {
    examples.push([local, resolve(__dirname, join(local, 'index.html'))]);
  }
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...Object.fromEntries(examples),
      },
    },
  },
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  },
  plugins: [
    new ViteWabt(await wabt()),
  ],
});
