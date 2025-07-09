'use client';

import { connectNodes } from '@/lib/virtual/api';
import useStore from '@/store/useStore';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import { useCallback, useEffect } from 'react';


export default function NodeCanvas() {
  const { nodes: storeNodes } = useStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const reactFlowFormatted = storeNodes.map((n) => ({
      id: n.id,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: `${n.type}: ${n.id}` },
    }));
    setNodes(reactFlowFormatted);
  }, [storeNodes, setNodes]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
      await connectNodes(connection.source!, connection.target!);
    },
    [setEdges]
  );

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
    </div>
  );
}