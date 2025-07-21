"use client";

import React, { useState } from 'react';
import { Node, Network } from '../types';

interface Props {
  node: Node;
  networks: Network[];
  onConnect: (nodeId: string, networkId: string) => void;
  onDisconnect: (nodeId: string, networkId: string) => void;
}

export default function NodeItem({ node, networks, onConnect, onDisconnect }: Props) {
  const [selectedNetworkId, setSelectedNetworkId] = useState('');

  const availableNetworks = networks.filter(n => !node.connectedNetworks.includes(n.id));

  const handleConnect = (networkId: string) => {
    onConnect(node.id, networkId);
    setSelectedNetworkId(''); // Reset selection
  };

  return (
    <div className={`rounded-lg text-black shadow-md p-4 m-3 border-l-4 ${node.type === 'router' ? 'border-blue-500' : 'border-green-500'} bg-white`}>
      <h3 className="text-lg font-bold mb-2">
        {node.name}
        <span className="ml-2 text-sm text-gray-500">({node.type})</span>
      </h3>

      <div className="mb-2">
        <p className="text-sm font-semibold text-gray-700">Connected Networks:</p>
        <ul className="list-disc list-inside text-sm">
          {node.connectedNetworks.map(netId => {
            const net = networks.find(n => n.id === netId);
            return (
              <li key={netId} className="flex items-center mb-1 justify-between pr-2">
                <span>{net?.name}</span>
                <button
                  className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                  onClick={() => onDisconnect(node.id, netId)}
                >
                  Disconnect
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {availableNetworks.length > 0 ? (
        <select
          className="mt-2 w-full p-2 border rounded bg-gray-50"
          value={selectedNetworkId}
          onChange={(e) => {
            const value = e.target.value;
            if (value) handleConnect(value);
          }}
        >
          <option value="" disabled>Select network to connect</option>
          {availableNetworks.map(net => (
            <option key={net.id} value={net.id}>{net.name}</option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-gray-400">No available networks</p>
      )}
    </div>
  );
}
