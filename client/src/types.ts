export type NodeType = 'computer' | 'router';

export interface Network {
  id: string;
  name: string;
  connectedNodes: string[]; // Node IDs
}

export interface Node {
  id: string;
  name: string;
  type: NodeType;
  connectedNetworks: string[]; // Network IDs
}