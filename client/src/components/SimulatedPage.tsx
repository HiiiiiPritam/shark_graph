"use client";

import React, { useEffect, useState } from 'react';
import Controls from '@/components/Controls';
import NodeItem from '@/components/NodeItem';
import useSimulator from '@/hooks/useSimulator';
import { FaNetworkWired, FaPaperPlane } from 'react-icons/fa';

export default function Home() {
  const {
    nodes,
    networks,
    addNode,
    addNetwork,
    connectToNetwork,
    disconnectFromNetwork,
    canPing
  } = useSimulator();

  useEffect(() => {
    console.log("Nodes:", nodes);
    console.log("Networks:", networks);
  }, [nodes, networks]);

  const [srcId, setSrcId] = useState('');
  const [destId, setDestId] = useState('');
  const [pingResult, setPingResult] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 flex items-center gap-2 text-indigo-600">
          <FaNetworkWired /> Network Simulator
        </h1>
        <div className='flex gap-4'>
            <div className='w-1/3'>
              <Controls onAddNode={addNode} onAddNetwork={addNetwork} />
            </div>

            <div className="mt-4">
              <h2 className="text-2xl font-semibold mb-1 text-gray-800">Nodes</h2>
              <hr className="border-t h-[10px] border-gray-900 w-max" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nodes.map(node => (
                  <NodeItem
                    key={node.id}
                    node={node}
                    networks={networks}
                    onConnect={connectToNetwork}
                    onDisconnect={disconnectFromNetwork}
                  />
                ))}
              </div>
            </div>
        </div>

        

        <div className="mt-12 border-t border-gray-300 pt-8">
          <h3 className="text-xl font-medium text-gray-800 mb-4 flex items-center gap-2">
            <FaPaperPlane /> Ping Test
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <select
              className="p-2 rounded border border-gray-300"
              onChange={e => setSrcId(e.target.value)}
              value={srcId}
            >
              <option value="">Source Node</option>
              {nodes.filter(n => n.type === "computer").map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>

            <select
              className="p-2 rounded border border-gray-300"
              onChange={e => setDestId(e.target.value)}
              value={destId}
            >
              <option value="">Destination Node</option>
              {nodes.filter(n => n.type === "computer").map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>

            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
              onClick={() => {
                const result = canPing(srcId, destId);
                setPingResult(result ? '✅ Ping Successful' : '❌ Ping Failed');
              }}
            >
              Ping
            </button>
          </div>

          {pingResult && (
            <p className={`mt-4 font-semibold ${pingResult.includes('Successful') ? 'text-green-600' : 'text-red-600'}`}>
              {pingResult}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
