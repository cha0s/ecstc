import Property from '../property.js';
import {PropertyRegistry} from '../register.js';

export class object extends Property {

  propertyDefinitions = {};

  constructor(key, blueprint) {
    super(key, blueprint);
    for (const [propertyKey, propertyBlueprint] of Object.entries(blueprint.properties)) {
      const Property = PropertyRegistry[propertyBlueprint.type];
      const property = new Property(propertyKey, {
        ...propertyBlueprint,
        ...blueprint.onChange && {
          onChange: (lkey, value) => {
            blueprint.onChange(key, {[lkey]: value});
          },
        },
      });
      const {definitions} = property;
      for (const key of Reflect.ownKeys(definitions)) {
        this.propertyDefinitions[key] = definitions[key];
      }
    }
  }

  get defaultValue() {
    return Object.defineProperties({}, this.propertyDefinitions);
  }

}

