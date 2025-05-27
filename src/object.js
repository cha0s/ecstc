export function isObjectEmpty(object) {
  for (const key in object) {
    return false;
  }
  return true;
}
