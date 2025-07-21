// simulation/network.ts

import { Node, Router, Network, ID } from "./models";

export class NetworkSimulator {
  nodes: Map<ID, Node> = new Map();
  routers: Map<ID, Router> = new Map();
  networks: Map<ID, Network> = new Map();

  addNode(id: ID, name: string) {
    this.nodes.set(id, { id, name });
  }

  addRouter(id: ID, name: string) {
    this.routers.set(id, { id, name, networkIds: [] });
  }

  addNetwork(id: ID, name: string) {
    this.networks.set(id, { id, name, nodeIds: [], routerIds: [] });
  }

  connectNodeToNetwork(nodeId: ID, networkId: ID) {
    const node = this.nodes.get(nodeId);
    const network = this.networks.get(networkId);
    if (!node || !network) return;
    if (node.networkId) throw new Error("Node already connected to a network");

    node.networkId = networkId;
    network.nodeIds.push(nodeId);
  }

  connectRouterToNetwork(routerId: ID, networkId: ID) {
    const router = this.routers.get(routerId);
    const network = this.networks.get(networkId);
    if (!router || !network) return;

    if (!router.networkIds.includes(networkId)) {
      router.networkIds.push(networkId);
      network.routerIds.push(routerId);
    }
  }

  disconnectNode(nodeId: ID) {
    const node = this.nodes.get(nodeId);
    if (!node?.networkId) return;
    const network = this.networks.get(node.networkId);
    if (network) {
      network.nodeIds = network.nodeIds.filter((id) => id !== nodeId);
    }
    node.networkId = undefined;
  }

  getState() {
    return {
      nodes: [...this.nodes.values()],
      routers: [...this.routers.values()],
      networks: [...this.networks.values()],
    };
  }
}
