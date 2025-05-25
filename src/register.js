import * as Numbers from './property/numbers.js';
import {array} from './property/array.js';
import {map} from './property/map.js';
import {object} from './property/object.js';
import {string} from './property/string.js';
import PropertyRegistry from './registry/property.js';

// register properties
for (const type in Numbers) {
  PropertyRegistry[type] = Numbers[type];
}
PropertyRegistry.array = array;
PropertyRegistry.map = map;
PropertyRegistry.object = object;
PropertyRegistry.string = string;

export {PropertyRegistry};
