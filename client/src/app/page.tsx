"use client";

import type { Engine } from '@tsparticles/engine';
import React, { useState } from 'react';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import { FaDocker, FaDesktop, FaNetworkWired, FaRocket } from 'react-icons/fa';
import DockerPage from '@/components/DockerPage';
import SimPage from '@/components/SimulatedPage';
import '@/styles/animation.css';

export default function Home() {
  const [tab, setTab] = useState<'docker' | 'sim'>('sim');

  return (
    <div className="relative min-h-screen bg-gray-900 text-black overflow-hidden">

      <div className="relative z-10 p-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-cyan-400 animate-flicker flex items-center gap-3">
            <FaRocket className="animate-bounce" /> Network Lab Dashboard
          </h1>
        </header>

        <nav className="flex space-x-4 mb-6">
          <button
            onClick={() => setTab('sim')}
            className={`px-4 py-2 rounded ${
              tab === 'sim' ? 'bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'
            } transition`}
          >
            <FaDesktop className="inline mr-2" /> Simulated Lab
          </button>

          <button
            onClick={() => setTab('docker')}
            className={`px-4 py-2 rounded ${
              tab === 'docker' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            } transition`}
          >
            <FaDocker className="inline mr-2" /> Docker Lab
          </button>
        </nav>

        <main className="bg-gray-800 rounded-lg p-6 shadow-lg with-animation">
          {tab === 'sim' ? <SimPage /> : <DockerPage />}
        </main>
      </div>
    </div>
  );
}
