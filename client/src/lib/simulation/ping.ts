// simulation/ping.ts

import { NetworkSimulator } from "./network";
import { findRouteBetweenRouters } from "./routing";

export function canPing(sim: NetworkSimulator, nodeAId: string, nodeBId: string): boolean {
  const nodeA = sim.nodes.get(nodeAId);
  const nodeB = sim.nodes.get(nodeBId);
  if (!nodeA || !nodeB || !nodeA.networkId || !nodeB.networkId) return false;

  if (nodeA.networkId === nodeB.networkId) return true;

  const routersA = [...sim.networks.get(nodeA.networkId)?.routerIds || []];
  const routersB = [...sim.networks.get(nodeB.networkId)?.routerIds || []];

  for (const rA of routersA) {
    for (const rB of routersB) {
      if (findRouteBetweenRouters(sim, rA, rB)) return true;
    }
  }

  return false;
}
