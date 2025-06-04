import {readdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {defineConfig} from 'vite';
import createWabt from 'wabt';

const examples = [];
for (const local of readdirSync(__dirname)) {
  if ('dist' !== local && statSync(join(__dirname, local)).isDirectory()) {
    examples.push([local, resolve(__dirname, join(local, 'index.html'))]);
  }
}

const wabt = await createWabt();
const plugins = [
  {
    name: 'wat-loader',
    transform(code, id) {
      const [path, query] = id.split('?');
      if (!path.endsWith('.wat')) {
        return null;
      }
      const options = query
        ? Object.fromEntries(
          new URLSearchParams(query).entries()
            .map(([key, value]) => [key, !!JSON.parse(value)])
        )
        : {};
      const wasmModule = wabt.parseWat(id, code, options);
      const {buffer} = wasmModule.toBinary({});
      return `export default await new Uint8Array([${Array.from(buffer).join(',')}]);`;
    }
  },
];

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...Object.fromEntries(examples),
      },
    },
  },
  plugins,
});
