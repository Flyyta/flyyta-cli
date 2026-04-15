import type { DependencyGraph } from "./types";
import { addDependency, createDependencyGraph } from "./utils";

export class BuildGraph {
  readonly state: DependencyGraph;

  constructor() {
    this.state = createDependencyGraph();
  }

  connect(from: string, to: string): void {
    addDependency(this.state, from, to);
  }

  dependentsOf(node: string): string[] {
    return Array.from(this.state.reverseEdges.get(node) || []);
  }

  dependenciesOf(node: string): string[] {
    return Array.from(this.state.edges.get(node) || []);
  }

  serialize(): Record<string, string[]> {
    return Object.fromEntries(
      Array.from(this.state.edges.entries()).map(([key, values]) => [key, Array.from(values)])
    );
  }
}
