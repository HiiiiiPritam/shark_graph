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
  createBridgeRouter,
} from '../lib/api';

let id = 1;
const getId = () => `${id++}`;

export default function Flow() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [containers, setContainers] = useState<Record<string, string>>({});
  const [networks, setNetworks] = useState<Record<string, string>>({});
  const [pingMode, setPingMode] = useState(false);
  const [pingSource, setPingSource] = useState<Node | null>(null);


  const onNodesChange = useCallback(
  async (changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === 'remove') {
        const nodeId = change.id;

        if (containers[nodeId]) {
          // It's a container node
          const containerId = containers[nodeId];

          //////////////////// May need to review this ///////////////////////////////////////////////////////////////////////
          // Disconnect from each network it's connected to
          // const relatedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
          // for (const edge of relatedEdges) {
          //   const networkNodeId = edge.source === nodeId ? edge.target : edge.source;
          //   const networkId = networks[networkNodeId];
          //   if (networkId) {
          //     await axios.post(`${BASE_URL}/networks/disconnect`, {
          //       containerId,
          //       networkId,
          //     });
          //   }
          // }

          // Remove from map
          setContainers(prev => {
            const copy = { ...prev };
            delete copy[nodeId];
            return copy;
          });
          
          setNodes(nds => applyNodeChanges(changes, nds));
          // Delete the container
          await axios.delete(`${BASE_URL}/containers/${containerId}`);

          return
        } else if (networks[nodeId]) {
          // It's a networks/router node
          const networkId = networks[nodeId];

          //Disconnect any container connected to this network
          const relatedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
          for (const edge of relatedEdges) {
            const containerNodeId = edge.source === nodeId ? edge.target : edge.source;
            const containerId = containers[containerNodeId];
            if (containerId) {
              await axios.post(`${BASE_URL}/networks/disconnect`, {
                containerId,
                networkId,
              });
            }
          }

          setNodes(nds => applyNodeChanges(changes, nds));
          // Delete the network
          const resp= await axios.delete(`${BASE_URL}/networks/${networkId}`);
          if(resp.status == 500) return
          //else 
          // Remove from map
          setNetworks(prev => {
            const copy = { ...prev };
            delete copy[nodeId];
            return copy;
          });

          return
        }

        // Remove related edges
        setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));

      }
    }
    // Apply remaining changes to nodes
    setNodes(nds => applyNodeChanges(changes, nds));
  },
  [containers, networks, edges]
);


  const onEdgesChange = useCallback(
    async (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          const removedEdge = edges.find((e) => e.id === change.id);
          if (!removedEdge) continue;

          const { source, target } = removedEdge;

          const sourceId = containers[source];
          const targetId = containers[target];
          const sourceNetwork = networks[source];
          const targetNetwork = networks[target];

          // Case 2: Router ↔ Router → remove bridge router container
          if (sourceNetwork && targetNetwork) {
            console.log("Removing bridge router:", sourceNetwork, targetNetwork);
            
            try {
              await axios.post(`${BASE_URL}/networks/remove-bridge-router`, {
                network1: sourceNetwork,
                network2: targetNetwork,
              });
            } catch (err) {
              console.warn("Error removing bridge router:", err);
            }
          }
          // Case 1: Container ↔ Network (Node ↔ Router)
          if (sourceId && targetNetwork) {
            try {
              await axios.post(`${BASE_URL}/networks/disconnect`, {
                containerId: sourceId,
                networkId: targetNetwork,
              });
            } catch (err) {
              console.warn("Error disconnecting from network:", err);
            }
          }

          if (targetId && sourceNetwork) {
            try {
              await axios.post(`${BASE_URL}/networks/disconnect`, {
                containerId: targetId,
                networkId: sourceNetwork,
              });
            } catch (err) {
              console.warn("Error disconnecting from network:", err);
            }
          }

          
        }
      }

      // Finally update local edge state
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [edges, containers, networks]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      const sourceDockerId = containers[connection.source] || containers[connection.target];
      const targetDockerId = networks[connection.target] || networks[connection.source];
      console.log(connection.source, connection.target, sourceDockerId, targetDockerId);
      if (networks[connection.source] && networks[connection.target]) {
        // Both are routers → create a bridge router container
        const result = await createBridgeRouter(networks[connection.source], networks[connection.target]);
        console.log("Bridge container ID", result.containerId);
        setEdges((eds) => addEdge({ ...connection, type: 'step' }, eds));
        return;
      }
      if (sourceDockerId && targetDockerId) {
        await connectToNetwork(sourceDockerId, targetDockerId);
        setEdges((eds) => addEdge({ ...connection, type: 'step' }, eds));
      }

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
        style: { background: '#FFC0CB', color: '#333', border:"white" },
      },
    ]);
  };

  const addRouterNode = async () => {
    const data = await createNetwork();
    const nodeId = getId();
    //console.log(data.name);
    

    setNetworks((prev) => ({
      ...prev,
      [nodeId]: data.name,
    }));

    setNodes((nds) => [
      ...nds,
      {
        id: nodeId,
        data: { label: `🟨 Router ${nodeId}` },
        position: { x: Math.random() * 400, y: Math.random() * 300 },
        type: 'default',
        style: { background: '#ADD8E6', color: '#333', border:"white"  },
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
      

      try {
        console.log(targetContainerId, sourceContainerId);
      
        const result = await pingContainer(sourceContainerId, targetContainerId);
        console.log(result);

        alert(`✅ Ping Result:\n${result.output}`);
      } catch (error) {
        alert(`❌ Ping Failed`);
      }

      setPingSource(null);
    }
  };


  return (
    <div className="w-full bg-black h-screen flex flex-col items-start p-4">
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
        <div className='text-white text-2xl font-bold'>The nodes here are actual docker containers</div>
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
