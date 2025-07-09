// components/Controls.tsx
'use client';

import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { createNode, sendPacket } from '@/lib/virtual/api';

export default function ControlsPanel() {
  const { addNode } = useStore();
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [type, setType] = useState<'node' | 'router'>('node');

  const handleAdd = async () => {
    if (!name || !ip) return alert('Name and IP are required');
    await createNode(name, ip, type);
    addNode({ id: name, ip, type });
    setName('');
    setIp('');
  };

  const handleSend = async () => {
    const src = prompt('Source Node Name?');
    const dest = prompt('Destination Node Name?');
    const payload = prompt('Payload (optional)?') || '';
    if (!src || !dest) return alert('Source and destination required');
    await sendPacket(src, dest, payload);
  };

  return (
    <div className="p-4 bg-white shadow fixed top-2 left-2 z-10 space-y-2">
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border p-1"
      />
      <input
        placeholder="IP"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
        className="border p-1"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as any)}
        className="border p-1"
      >
        <option value="node">Node</option>
        <option value="router">Router</option>
      </select>
      <button onClick={handleAdd} className="bg-blue-500 text-white px-2 py-1 rounded">
        Add Node
      </button>
      <button onClick={handleSend} className="bg-green-500 text-white px-2 py-1 rounded">
        Send Packet
      </button>
    </div>
  );
}
