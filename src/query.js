export default class Query {

  criteria = {with: [], without: []};
  map = new Map();

  constructor(parameters) {
    for (let i = 0; i < parameters.length; ++i) {
      const parameter = parameters[i];
      switch (parameter.charCodeAt(0)) {
        case '!'.charCodeAt(0):
          this.criteria.without.push(parameter.slice(1));
          break;
        default:
          this.criteria.with.push(parameter);
          break;
      }
    }
  }

  get count() {
    return this.map.size;
  }

  deindex(entity) {
    this.map.delete(entity.id);
  }

  reindex(entity) {
    if (0 === this.criteria.with.length && 0 === this.criteria.without.length) {
      this.map.set(entity.id, entity);
      return;
    }
    let should = true;
    for (let j = 0; j < this.criteria.with.length; ++j) {
      if (!entity.has(this.criteria.with[j])) {
        should = false;
        break;
      }
    }
    if (should) {
      for (let j = 0; j < this.criteria.without.length; ++j) {
        if (entity.has(this.criteria.without[j])) {
          should = false;
          break;
        }
      }
    }
    if (should) {
      this.map.set(entity.id, entity);
    }
    else if (!should) {
      this.map.delete(entity.id);
    }
  }

  select() {
    return this.map.values();
  }

}
