"use client";

import React, { useState } from 'react';
import { NodeType } from '../types';
import { ComputerDesktopIcon, PlusIcon, ServerStackIcon, GlobeAltIcon } from '@heroicons/react/24/solid';

interface Props {
  onAddNode: (name: string, type: NodeType) => void;
  onAddNetwork: (name: string) => void;
}

export default function Controls({ onAddNode, onAddNetwork }: Props) {
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState<NodeType>('computer');
  const [networkName, setNetworkName] = useState('');

  const resetNodeForm = () => setNodeName('');
  const resetNetworkForm = () => setNetworkName('');

  return (
    <div className="bg-white text-black p-6 rounded-lg shadow-md w-full max-w-md mx-auto mb-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <PlusIcon className="h-5 w-5 text-blue-500" />
        Create Node
      </h2>

      <div className="mb-4">
        <input
          type="text"
          value={nodeName}
          onChange={e => setNodeName(e.target.value)}
          placeholder="Enter node name"
          className="w-full p-2 border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={nodeType}
          onChange={e => setNodeType(e.target.value as NodeType)}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="computer">💻 Computer</option>
          <option value="router">🛜 Router</option>
        </select>
        <button
          className="mt-3 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          onClick={() => {
            if (nodeName.trim()) {
              onAddNode(nodeName, nodeType);
              resetNodeForm();
            }
          }}
        >
          Add Node
        </button>
      </div>

      <hr className="my-4 border-gray-300" />

      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <GlobeAltIcon className="h-5 w-5 text-green-500" />
        Create Network
      </h2>

      <div>
        <input
          type="text"
          value={networkName}
          onChange={e => setNetworkName(e.target.value)}
          placeholder="Enter network name"
          className="w-full p-2 border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <button
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
          onClick={() => {
            if (networkName.trim()) {
              onAddNetwork(networkName);
              resetNetworkForm();
            }
          }}
        >
          Add Network
        </button>
      </div>
    </div>
  );
}
