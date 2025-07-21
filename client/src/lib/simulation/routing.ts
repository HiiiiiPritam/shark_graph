// simulation/routing.ts

import { NetworkSimulator } from "./network";
import { ID } from "./models";

export function buildAdjacencyGraph(sim: NetworkSimulator) {
  const graph: Map<ID, ID[]> = new Map();

  for (const [networkId, network] of sim.networks.entries()) {
    const allConnected = [...network.routerIds];
    for (const routerId of allConnected) {
      if (!graph.has(routerId)) graph.set(routerId, []);
      for (const other of allConnected) {
        if (other !== routerId && !graph.get(routerId)!.includes(other)) {
          graph.get(routerId)!.push(other);
        }
      }
    }
  }

  return graph;
}

export function findRouteBetweenRouters(sim: NetworkSimulator, startId: ID, endId: ID): boolean {
  const graph = buildAdjacencyGraph(sim);
  const visited = new Set<ID>();

  function dfs(current: ID): boolean {
    if (current === endId) return true;
    visited.add(current);
    for (const neighbor of graph.get(current) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      }
    }
    return false;
  }

  return dfs(startId);
}
