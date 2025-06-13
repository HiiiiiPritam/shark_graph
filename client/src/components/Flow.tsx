'use client';

import { useState, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from "axios";
import {
  createContainer,
  createNetwork,
  connectToNetwork,
  pingContainer,
  BASE_URL,
} from '../lib/api';

let id = 3;
const getId = () => `${id++}`;

export default function Flow() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [containers, setContainers] = useState<Record<string, string>>({});
  const [networks, setNetworks] = useState<Record<string, string>>({});
  const [pingMode, setPingMode] = useState(false);
  const [pingSource, setPingSource] = useState<Node | null>(null);


  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      const sourceDockerId = containers[connection.source];
      const targetDockerId = networks[connection.target];

      if (sourceDockerId && targetDockerId) {
        await connectToNetwork(sourceDockerId, targetDockerId);
      }

      setEdges((eds) => addEdge({ ...connection, type: 'step' }, eds));
    },
    [containers, networks]
  );

  const addContainerNode = async () => {
    const data = await createContainer();
    const nodeId = getId();

    setContainers((prev) => ({
      ...prev,
      [nodeId]: data.id,
    }));

    setNodes((nds) => [
      ...nds,
      {
        id: nodeId,
        data: { label: `🟦 Node ${nodeId}` },
        position: { x: Math.random() * 400, y: Math.random() * 300 },
        type: 'default',
        style: { background: '#FFC0CB', color: '#333' },
      },
    ]);
  };

  const addRouterNode = async () => {
    const data = await createNetwork();
    const nodeId = getId();

    setNetworks((prev) => ({
      ...prev,
      [nodeId]: data.id,
    }));

    setNodes((nds) => [
      ...nds,
      {
        id: nodeId,
        data: { label: `🟨 Router ${nodeId}` },
        position: { x: Math.random() * 400, y: Math.random() * 300 },
        type: 'default',
        style: { background: '#ADD8E6', color: '#333' },
      },
    ]);
  };

  const onNodeClick = async (_event: any, node: Node) => {
    if (!pingMode) return;

    if (!pingSource) {
      setPingSource(node);

      alert(`Selected source node: ${node.data.label}`);
    } else {
      const sourceContainerId = containers[pingSource.id];
      const targetContainerId = containers[node.id];

      if (!sourceContainerId || !targetContainerId) {
        alert("Ping is only supported between container nodes.");
        setPingSource(null);
        return;
      }

      //console.log(sourceContainerId,"//////////////////",targetContainerId);
      

      try {
        const res = await axios.get(`${BASE_URL}/containers/${targetContainerId}`);
        console.log(res.data);
        const targetIp = res.data.IPAddress;
        console.log(targetIp);
      
        const result = await pingContainer(sourceContainerId, targetIp);
        console.log(result);

        alert(`✅ Ping Result:\n${result.output}`);
      } catch (error) {
        alert(`❌ Ping Failed`);
      }

      setPingSource(null);
    }
  };


  return (
    <div className="w-full h-screen flex flex-col items-start p-4">
      <div className="mb-4 space-x-2">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={addContainerNode}
        >
          ➕ Add Node
        </button>
        <button
          className="px-4 py-2 bg-yellow-500 text-black rounded"
          onClick={addRouterNode}
        >
          ➕ Add Router
        </button>
        <button
        className={`px-4 py-2 ${pingMode ? 'bg-red-500 text-white' : 'bg-green-500 text-white'} rounded`}
        onClick={() => {
          setPingMode(!pingMode);
          setPingSource(null);
        }}
        >
        {pingMode ? '❌ Cancel Ping' : '📡 Ping Tool'}
        </button>

      </div>

      <div className="w-full h-full border border-gray-300 rounded">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
