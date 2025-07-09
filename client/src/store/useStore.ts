import { create } from 'zustand';

type NodeType = {
  id: string;
  type: 'router' | 'node';
  ip: string;
};

type SimState = {
  nodes: NodeType[];
  addNode: (node: NodeType) => void;
};

export const useStore = create<SimState>((set) => ({
  nodes: [],
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
}));

export default useStore;