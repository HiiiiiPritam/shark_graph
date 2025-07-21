// lib/networkEngine.ts

type NodeType = 'computer' | 'router';

interface Network {
  id: string;
  subnet: string; // e.g., "192.168.1.0/24"
}

interface Node {
  id: string;
  label: string;
  type: NodeType;
  networkId?: string;
  ip?: string;
  routingTable?: Record<string, string>; // destinationNodeId -> nextHopNodeId
}

class NetworkEngine {
  private nodes: Map<string, Node> = new Map();
  private networks: Map<string, Network> = new Map();

  // === NETWORKS ===
  addNetwork(subnet: string): Network {
    const id = `net-${Date.now()}`;
    const network: Network = { id, subnet };
    this.networks.set(id, network);
    return network;
  }

  getNetworks(): Network[] {
    return Array.from(this.networks.values());
  }

  // === NODES ===
  addNode(label: string, type: NodeType): Node {
    const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const node: Node = { id, label, type };
    this.nodes.set(id, node);
    return node;
  }

  getNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  connectNodeToNetwork(nodeId: string, networkId: string): void {
    const node = this.nodes.get(nodeId);
    const network = this.networks.get(networkId);

    if (!node || !network) {
      throw new Error('Invalid node or network');
    }

    node.networkId = networkId;
    node.ip = this.generateIPAddress(networkId);
    this.nodes.set(nodeId, node);
  }

  private generateIPAddress(networkId: string): string {
    const network = this.networks.get(networkId);
    if (!network) throw new Error('Invalid network');

    const usedIPs = Array.from(this.nodes.values())
      .filter((n) => n.networkId === networkId && n.ip)
      .map((n) => n.ip?.split('.').pop())
      .filter(Boolean) as string[];

    let hostPart = 2;
    while (usedIPs.includes(hostPart.toString())) {
      hostPart++;
    }

    const base = network.subnet.split('.')[0] + '.' + network.subnet.split('.')[1] + '.' + network.subnet.split('.')[2];
    return `${base}.${hostPart}`;
  }

  configureRouting(nodeId: string, destinationNodeId: string, nextHopNodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node || node.type !== 'router') {
      throw new Error('Routing config only allowed for routers');
    }

    if (!node.routingTable) node.routingTable = {};
    node.routingTable[destinationNodeId] = nextHopNodeId;
  }

  getRoutingTable(nodeId: string): Record<string, string> | undefined {
    const node = this.nodes.get(nodeId);
    return node?.routingTable;
  }

  // === PING SIMULATION ===
  ping(sourceId: string, destinationId: string): string[] {
    const path: string[] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string): boolean => {
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      path.push(currentId);

      if (currentId === destinationId) return true;

      const currentNode = this.nodes.get(currentId);
      if (!currentNode) return false;

      // Same network direct ping
      const destNode = this.nodes.get(destinationId);
      if (
        currentNode.networkId &&
        destNode?.networkId &&
        currentNode.networkId === destNode.networkId
      ) {
        path.push(destinationId);
        return true;
      }

      // Use routing table
      const nextHop = currentNode.routingTable?.[destinationId];
      if (nextHop && dfs(nextHop)) {
        return true;
      }

      path.pop(); // backtrack
      return false;
    };

    const success = dfs(sourceId);
    return success ? path : [];
  }
}

// Export a singleton instance
export const networkEngine = new NetworkEngine();
