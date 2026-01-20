/**
 * DependencyGraph
 *
 * Manages task dependencies and provides cycle detection.
 * Uses directed graph representation with adjacency list.
 */

/**
 * Result of cycle detection
 */
export interface CycleDetectionResult {
  /** Whether a cycle was detected */
  hasCycle: boolean;
  /** The cycle path if one exists (array of execution IDs forming the cycle) */
  cycle?: string[];
}

/**
 * DependencyGraph class
 *
 * Manages dependencies between executions and provides:
 * - Cycle detection (prevents deadlocks)
 * - Topological ordering (execution order respecting dependencies)
 * - Dependency validation
 */
export class DependencyGraph {
  /** Adjacency list: executionId -> array of execution IDs it depends on */
  private readonly dependencies: Map<string, string[]> = new Map();
  /** Reverse adjacency list: executionId -> array of execution IDs that depend on it */
  private readonly dependents: Map<string, string[]> = new Map();
  /** Set of completed execution IDs */
  private readonly completed: Set<string> = new Set();

  /**
   * Add a node to the graph
   *
   * @param executionId - Execution ID to add
   * @param dependencies - Array of execution IDs this execution depends on
   * @returns True if added successfully, false if would create a cycle
   */
  addNode(executionId: string, dependencies: string[] = []): boolean {
    // Check if adding these dependencies would create a cycle
    if (this.wouldCreateCycle(executionId, dependencies)) {
      return false;
    }

    // Add node with its dependencies
    this.dependencies.set(executionId, [...dependencies]);

    // Update reverse edges (dependents)
    for (const depId of dependencies) {
      if (!this.dependents.has(depId)) {
        this.dependents.set(depId, []);
      }
      this.dependents.get(depId)!.push(executionId);
    }

    return true;
  }

  /**
   * Remove a node from the graph
   *
   * @param executionId - Execution ID to remove
   */
  removeNode(executionId: string): void {
    // Remove from dependencies
    const deps = this.dependencies.get(executionId) || [];
    this.dependencies.delete(executionId);

    // Remove from reverse edges
    for (const depId of deps) {
      const dependentsList = this.dependents.get(depId);
      if (dependentsList) {
        const index = dependentsList.indexOf(executionId);
        if (index !== -1) {
          dependentsList.splice(index, 1);
        }
      }
    }

    // Remove any dependents entries
    this.dependents.delete(executionId);
  }

  /**
   * Mark an execution as completed
   *
   * @param executionId - Execution ID to mark complete
   */
  markCompleted(executionId: string): void {
    this.completed.add(executionId);
  }

  /**
   * Check if an execution's dependencies are all satisfied
   *
   * @param executionId - Execution ID to check
   * @returns True if all dependencies are completed
   */
  areDependenciesSatisfied(executionId: string): boolean {
    const deps = this.dependencies.get(executionId);
    if (!deps || deps.length === 0) {
      return true;
    }

    return deps.every((depId) => this.completed.has(depId));
  }

  /**
   * Check if adding dependencies would create a cycle
   *
   * Uses DFS to detect if adding an edge would create a cycle.
   *
   * When adding `executionId` with dependencies [depA, depB, ...],
   * we're adding edges: executionId → depA, executionId → depB, etc.
   *
   * A cycle would be created if there's already a path from any dependency
   * back to executionId through the existing dependency relationships.
   *
   * For example:
   * - If we have A → B (A depends on B)
   * - And we try to add B → A (B depends on A)
   * - We check: is there a path from A back to B? Yes: B → A
   * - This would create a cycle: B → A → B
   *
   * @param executionId - Execution ID to add
   * @param dependencies - Dependencies to add
   * @returns True if would create a cycle
   */
  private wouldCreateCycle(executionId: string, dependencies: string[]): boolean {
    // For each dependency, check if there's a path from that dependency
    // back to executionId through the existing dependencies
    for (const depId of dependencies) {
      if (this.hasPathThroughDependencies(depId, executionId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if there's a path from source to target through the dependencies graph
   *
   * Follows the dependency chain: if A depends on B, and B depends on C,
   * then there's a path from A to C.
   *
   * @param source - Source execution ID
   * @param target - Target execution ID
   * @returns True if path exists
   */
  private hasPathThroughDependencies(source: string, target: string): boolean {
    if (source === target) {
      return true;
    }

    const visited = new Set<string>();
    const stack = [source];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      if (current === target) {
        return true;
      }

      // Follow the dependencies (things that current depends on)
      const deps = this.dependencies.get(current);
      if (deps) {
        stack.push(...deps);
      }
    }

    return false;
  }


  /**
   * Detect cycles in the graph
   *
   * Uses DFS with three colors (white, gray, black) to detect back edges.
   * - White: unvisited
   * - Gray: currently visiting (in recursion stack)
   * - Black: fully visited
   *
   * A back edge (edge to a gray node) indicates a cycle.
   *
   * @returns Cycle detection result with cycle path if found
   */
  detectCycle(): CycleDetectionResult {
    const white = new Set<string>(this.dependencies.keys());
    const gray = new Set<string>();
    const black = new Set<string>();
    const parent = new Map<string, string>();

    // DFS visit function
    const visit = (node: string): string | null => {
      white.delete(node);
      gray.add(node);

      const deps = this.dependents.get(node) || [];
      for (const dep of deps) {
        // Skip completed nodes (no cycle risk)
        if (this.completed.has(dep)) {
          continue;
        }

        if (black.has(dep)) {
          continue;
        }

        if (gray.has(dep)) {
          // Back edge found - cycle detected
          return dep;
        }

        parent.set(dep, node);
        const cycleNode = visit(dep);
        if (cycleNode) {
          return cycleNode;
        }
      }

      gray.delete(node);
      black.add(node);
      return null;
    };

    // Visit all white nodes
    for (const node of Array.from(white)) {
      if (!gray.has(node) && !black.has(node)) {
        const cycleNode = visit(node);
        if (cycleNode) {
          // Reconstruct cycle path
          const cycle = [cycleNode];
          let current = parent.get(cycleNode);
          while (current && current !== cycleNode) {
            cycle.unshift(current);
            current = parent.get(current);
          }
          cycle.unshift(cycleNode);

          return { hasCycle: true, cycle };
        }
      }
    }

    return { hasCycle: false };
  }

  /**
   * Get all execution IDs that are ready to execute (dependencies satisfied)
   *
   * @returns Array of execution IDs ready for execution
   */
  getReadyExecutions(): string[] {
    const ready: string[] = [];

    for (const [executionId] of this.dependencies) {
      if (!this.completed.has(executionId) && this.areDependenciesSatisfied(executionId)) {
        ready.push(executionId);
      }
    }

    return ready;
  }

  /**
   * Get dependencies for an execution
   *
   * @param executionId - Execution ID
   * @returns Array of dependency execution IDs
   */
  getDependencies(executionId: string): string[] {
    return this.dependencies.get(executionId) || [];
  }

  /**
   * Get dependents for an execution (executions that depend on this one)
   *
   * @param executionId - Execution ID
   * @returns Array of dependent execution IDs
   */
  getDependents(executionId: string): string[] {
    return this.dependents.get(executionId) || [];
  }

  /**
   * Get all execution IDs in the graph
   *
   * @returns Array of all execution IDs
   */
  getAllExecutions(): string[] {
    return Array.from(this.dependencies.keys());
  }

  /**
   * Get all completed execution IDs
   *
   * @returns Array of completed execution IDs
   */
  getCompletedExecutions(): string[] {
    return Array.from(this.completed);
  }

  /**
   * Clear all data from the graph
   */
  clear(): void {
    this.dependencies.clear();
    this.dependents.clear();
    this.completed.clear();
  }

  /**
   * Get statistics about the dependency graph
   *
   * @returns Graph statistics
   */
  getStatistics(): {
    totalNodes: number;
    completedNodes: number;
    readyNodes: number;
    blockedNodes: number;
  } {
    const totalNodes = this.dependencies.size;
    const completedNodes = this.completed.size;
    const readyNodes = this.getReadyExecutions().length;
    const blockedNodes = totalNodes - completedNodes - readyNodes;

    return {
      totalNodes,
      completedNodes,
      readyNodes,
      blockedNodes,
    };
  }
}
