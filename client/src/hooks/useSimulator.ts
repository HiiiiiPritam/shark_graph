"use client";
import { useState } from 'react';
import { Network, Node, NodeType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export default function useSimulator() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);

  const addNode = (name: string, type: NodeType) => {
    const id = uuidv4();
    setNodes(prev => [...prev, { id, name, type, connectedNetworks: [] }]);
  };

  const addNetwork = (name: string) => {
    const id = uuidv4();
    setNetworks(prev => [...prev, { id, name, connectedNodes: [] }]);
  };

  const connectToNetwork = (nodeId: string, networkId: string) => {
    setNodes(prev =>
      prev.map(n => n.id === nodeId ? { ...n, connectedNetworks: [...n.connectedNetworks, networkId] } : n)
    );
    setNetworks(prev =>
      prev.map(net => net.id === networkId ? { ...net, connectedNodes: [...net.connectedNodes, nodeId] } : net)
    );
  };

  const disconnectFromNetwork = (nodeId: string, networkId: string) => {
    setNodes(prev =>
      prev.map(n =>
        n.id === nodeId
          ? { ...n, connectedNetworks: n.connectedNetworks.filter(nid => nid !== networkId) }
          : n
      )
    );
    setNetworks(prev =>
      prev.map(net =>
        net.id === networkId
          ? { ...net, connectedNodes: net.connectedNodes.filter(nid => nid !== nodeId) }
          : net
      )
    );
  };

  const canPing = (sourceId: string, destId: string): boolean => {
    const source = nodes.find(n => n.id === sourceId);
    const dest = nodes.find(n => n.id === destId);

    if (!source || !dest) return false;

    // Direct connection via same network
    const commonNetworks = source.connectedNetworks.filter(nid =>
      dest.connectedNetworks.includes(nid)
    );

    if (commonNetworks.length > 0) return true;

    // Indirect via routers
    // Perform BFS
    const visited = new Set<string>();
    const queue = [sourceId];

    while (queue.length) {
      const currentId = queue.shift()!;
      visited.add(currentId);
      const currentNode = nodes.find(n => n.id === currentId);
      if (!currentNode) continue;

      for (const netId of currentNode.connectedNetworks) {
        const net = networks.find(n => n.id === netId);
        if (!net) continue;

        for (const neighborId of net.connectedNodes) {
          if (visited.has(neighborId)) continue;
          if (neighborId === destId) return true;
          queue.push(neighborId);
        }
      }
    }

    return false;
  };

  return {
    nodes,
    networks,
    addNode,
    addNetwork,
    connectToNetwork,
    disconnectFromNetwork,
    canPing
  };
}
