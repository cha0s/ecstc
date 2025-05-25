function registerCodecs(Codecs) {

  class SparseArray {

    constructor(blueprint) {
      this.$$isSparseCodec = new Codecs.bool();
      this.$$arrayCodec = new Codecs.array(blueprint);
      this.$$keyCodec = new Codecs.varuint();
    }

    decode(view, target) {
      const isSparse = this.$$isSparseCodec.decode(view, target);
      if (isSparse) {
        const length = view.getUint32(target.byteOffset);
        target.byteOffset += 4;
        const entries = [];
        for (let i = 0; i < length; ++i) {
          entries[i] = [this.$$keyCodec.decode(view, target)];
        }
        for (let i = 0; i < length; ++i) {
          entries[i][1] = this.$$arrayCodec.$$elementCodec.decode(view, target);
        }
        return Object.fromEntries(entries);
      }
      else {
        return this.$$arrayCodec.decode(view, target);
      }
    }

    encode(value, view, byteOffset) {
      let written = 0;
      if (Array.isArray(value)) {
        written += this.$$isSparseCodec.encode(false, view, byteOffset + written);
        written += this.$$arrayCodec.encode(value, view, byteOffset + written);
      }
      else {
        written += this.$$isSparseCodec.encode(true, view, byteOffset + written);
        const headerIndex = byteOffset + written;
        written += 4;
        let i = 0;
        for (const key in value) {
          written += this.$$keyCodec.encode(parseInt(key), view, byteOffset + written);
          i += 1;
        }
        for (const key in value) {
          written += this.$$arrayCodec.$$elementCodec.encode(value[key], view, byteOffset + written);
        }
        view.setUint32(headerIndex, i);
      }
      return written;
    }

    size(value, byteOffset) {
      let size = this.$$isSparseCodec.size();
      if (Array.isArray(value)) {
        size += this.$$arrayCodec.size(value, size + byteOffset);
      }
      else {
        size += 4;
        for (const key in value) {
          size += this.$$keyCodec.size(parseInt(key));
          size += this.$$arrayCodec.$$elementCodec.size(value[key]);
        }
      }
      return size;
    }

  }

  class CoercedMap extends Codecs.map {

    decode(view, target) {
      const map = super.decode(view, target);
      for (const [key, mapValue] of map) {
        map.set(key, mapValue ? mapValue.maybeValue : undefined);
      }
      return map;
    }

    encode(value, view, byteOffset) {
      const entries = [];
      if (!value[Symbol.iterator]) {
        for (const key in value) {
          entries.push([key, {maybeValue: value[key]}]);
        }
      }
      else {
        for (const [key, mapValue] of value) {
          entries.push([key, {maybeValue: mapValue}]);
        }
      }
      return super.encode(entries, view, byteOffset);
    }

    size(value, byteOffset) {
      const entries = [];
      if (!value[Symbol.iterator]) {
        for (const key in value) {
          entries.push([key, {maybeValue: value[key]}]);
        }
      }
      else {
        for (const [key, mapValue] of value) {
          entries.push([key, {maybeValue: mapValue}]);
        }
      }
      return super.size(entries, byteOffset);
    }

  }

  class MaybeDeletion extends Codecs.object {

    constructor(blueprint) {
      super(blueprint);
      this.$$isDeletion = new Codecs.bool();
    }

    decode(view, target) {
      const isDeletion = this.$$isDeletion.decode(view, target);
      if (isDeletion) {
        return false;
      }
      return super.decode(view, target);
    }

    encode(value, view, byteOffset) {
      let written = 0;
      written += this.$$isDeletion.encode(false === value, view, byteOffset);
      if (value) {
        written += super.encode(value, view, byteOffset + written);
      }
      return written;
    }

    size(value, byteOffset) {
      let size = this.$$isDeletion.size();
      if (value) {
        size += super.size(value, size + byteOffset);
      }
      return size;
    }

  }

  function convertProperties(blueprint) {
    if ('map' === blueprint.type) {
      return {
        type: 'ecstc-coerced-map',
        key: blueprint.key,
        value: {
          type: 'object',
          properties: {
            maybeValue: {...convertProperties(blueprint.value), optional: true},
          },
        },
      };
    }
    if ('array' === blueprint.type) {
      return {
        type: 'ecstc-sparse-array',
        element: convertProperties(blueprint.element),
      };
    }
    else if ('properties' in blueprint) {
      const newBlueprint = {properties: {}, type: blueprint.type};
      for (const key in blueprint.properties) {
        newBlueprint.properties[key] = {
          ...convertProperties(blueprint.properties[key]),
          optional: true,
        };
      }
      return newBlueprint;
    }
    else {
      return blueprint;
    }
  }

  class Component extends MaybeDeletion {

    constructor(blueprint) {
      super(convertProperties(blueprint));
    }

    decode(view, target) {
      const isDeletion = this.$$isDeletion.decode(view, target);
      if (isDeletion) {
        return false;
      }
      return super.decode(view, target);
    }

    encode(value, view, byteOffset) {
      let written = 0;
      written += this.$$isDeletion.encode(false === value, view, byteOffset);
      if (value) {
        written += super.encode(value, view, byteOffset + written);
      }
      return written;
    }

    size(value, byteOffset) {
      let size = this.$$isDeletion.size();
      if (value) {
        size += super.size(value, size + byteOffset);
      }
      return size;
    }

  }

  class Entity extends MaybeDeletion {

    constructor(blueprint) {
      const {Components} = blueprint;
      const properties = {};
      for (const componentName in Components) {
        const Component = Components[componentName];
        properties[componentName] = {
          optional: true,
          type: 'ecstc-component',
          properties: Component.properties,
        };
      }
      super({properties});
    }

  }

  class World extends Codecs.map {

    constructor(blueprint) {
      super({
        key: {type: 'varuint'},
        value: {type: 'ecstc-entity', Components: blueprint.Components},
      });
    }

  }

  Codecs['ecstc-world'] = World;
  Codecs['ecstc-entity'] = Entity;
  Codecs['ecstc-component'] = Component;
  Codecs['ecstc-coerced-map'] = CoercedMap;
  Codecs['ecstc-sparse-array'] = SparseArray;
}

export default registerCodecs;
