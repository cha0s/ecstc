export function isObjectEmpty(object) {
  for (const key in object) {
    return false;
  }
  return true;
}

export function objectWithoutDefaults(object, defaults) {
  const json = {};
  for (const key in object) {
    if ('object' === typeof object[key]) {
      const propertyDiff = objectWithoutDefaults(object[key], defaults?.[key]);
      if (!isObjectEmpty(propertyDiff)) {
        json[key] = propertyDiff;
      }
    }
    if (object[key] !== defaults?.[key]) {
      json[key] = object[key];
    }
  }
  return json;
}