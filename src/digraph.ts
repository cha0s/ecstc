export class Digraph<T = string> {

  arcs = new Map<T, Set<T>>()

  addDependency(head: T, tail: T) {
    this.ensureTail(head)
    this.ensureTail(tail).add(head)
  }

  ensureTail(tail: T) {
    if (!this.arcs.has(tail)) {
      this.arcs.set(tail, new Set())
    }
    return this.arcs.get(tail)!
  }

  sort() {
    const visited = new Set()
    const scores = new Map<T, number>()
    const walk = (vertex: T, score: number) => {
      visited.add(vertex)
      const neighbors = this.arcs.get(vertex)!.values()
      for (let current = neighbors.next(); true !== current.done; current = neighbors.next()) {
        const {value: neighbor} = current
        if (!visited.has(neighbor)) {
          score = walk(neighbor, score)
        }
      }
      scores.set(vertex, score)
      return score - 1
    }
    let score = this.arcs.size - 1
    const tails = this.arcs.keys()
    for (let current = tails.next(); true !== current.done; current = tails.next()) {
      const {value: vertex} = current
      if (!visited.has(vertex)) {
        score = walk(vertex, score)
      }
    }
    return Array.from(scores.entries())
      .sort(([, l], [, r]) => l - r)
      .map(([vertex]) => vertex)
  }

  visit(tail: T, fn: (node: T) => void) {
    fn(tail)
    const dependents = this.arcs.get(tail)
    if (dependents && dependents.size > 0) {
      for (const dependent of dependents) {
        this.visit(dependent, fn)
      }
    }
  }

}
