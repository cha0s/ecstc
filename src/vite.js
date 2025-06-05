import createWabt from 'wabt';

const wabt = await createWabt();
export const plugins = [
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
