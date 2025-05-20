// import {Properties} from './properties.js';

// class Component {

//   instances = {};
//   pool = [];

//   static dependencies = [];

//   constructor(ecs) {
//     this.ecs = ecs;
//     this.Instance = this.instance();
//   }

//   static get blueprint() {
//     return this.properties;
//   }

//   create(entityId, values) {
//     const allocated = this.pool.length > 0 ? this.pool.pop() : new this.Instance();
//     this.instances[entityId] = allocated.set(entityId, values);
//     return allocated;
//   }

//   destroy(entityId) {
//     const instance = this.instances[entityId];
//     instance.destroy();
//     this.pool.push(instance);
//     delete this.instances[entityId];
//     this.ecs.markChange(entityId, this.constructor.componentName, false);
//   }

//   get(entityId) {
//     return this.instances[entityId];
//   }

//   instance() {
//     const Component = this;
//     const {constructor} = this;
//     const Instance = class {
//       entityId = 0;
//       $$properties = {};
//       constructor() {
//         this.$$properties.markChange = (change) => {
//           this.markChange(change);
//         }
//         for (const key in constructor.properties) {
//           const propertyBlueprint = constructor.properties[key];
//           const Property = Properties[propertyBlueprint.type];
//           Property.define(this.$$properties, key, propertyBlueprint);
//           let descriptor = Object.getOwnPropertyDescriptor(this.constructor.prototype, key);
//           if (!descriptor) {
//             descriptor = Object.getOwnPropertyDescriptor(this.$$properties, key);
//           }
//           Object.defineProperty(this, key, descriptor);
//         }
//       }
//       destroy() {
//         this.set(undefined);
//       }
//       get entity() {
//         return Component.ecs.entities.get(this.entityId);
//       }
//       markChange(change) {
//         if (this.entityId) {
//           Component.ecs.markChange(this.entityId, constructor.componentName, change);
//           if (this.changing) {
//             this.changing(change);
//           }
//         }
//       }
//       save(defaults) {
//         return this.toJSONWithoutDefaults(defaults);
//       }
//       set(entityId, values = {}) {
//         this.entityId = entityId;
//         for (const key in constructor.properties) {
//           if (key in values) {
//             this[key] = values[key];
//             continue;
//           }
//           const propertyBlueprint = constructor.properties[key];
//           if ('defaultValue' in propertyBlueprint) {
//             this[key] = propertyBlueprint.defaultValue;
//             continue;
//           }
//           const Property = Properties[propertyBlueprint.type];
//           this[key] = Property.defaultValue();
//         }
//         return this;
//       }
//       toJSON() {
//         const json = {};
//         for (const key in constructor.properties) {
//           if ('object' === typeof this[key] && this[key].toJSON) {
//             json[key] = this[key].toJSON();
//           }
//           else {
//             json[key] = this[key];
//           }
//         }
//         return json;
//       }
//       toJSONWithoutDefaults(defaults) {
//         const json = {};
//         for (const key in constructor.properties) {
//           if ('object' === typeof this[key]) {
//             if ('toJSONWithoutDefaults' in this[key]) {
//               const subdefaults = this[key].toJSONWithoutDefaults(defaults?.[key]);
//               let hasAnything = false;
//               for (const i in subdefaults) { // eslint-disable-line no-unused-vars
//                 hasAnything = true;
//                 break;
//               }
//               if (hasAnything) {
//                 json[key] = subdefaults;
//               }
//             }
//             else if ('toJSON' in this[key]) {
//               json[key] = this[key].toJSON();
//             }
//             else {
//               json[key] = this[key];
//             }
//           }
//           else {
//             if (defaults && key in defaults) {
//               if (this[key] !== defaults[key]) {
//                 json[key] = this[key];
//               }
//               continue;
//             }
//             const propertyBlueprint = constructor.properties[key];
//             if ('defaultValue' in propertyBlueprint) {
//               if (this[key] !== propertyBlueprint.defaultValue) {
//                 json[key] = this[key];
//               }
//               continue;
//             }
//             if (this[key] === Properties[propertyBlueprint.type].defaultValue()) {
//               continue;
//             }
//             json[key] = this[key];
//           }
//         }
//         return json;
//       }
//     };
//     return Instance;
//   }

//   static properties = {};

// }

// export default Component;
