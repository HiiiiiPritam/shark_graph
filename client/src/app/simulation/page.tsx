'use client';

import SimPage from '@/components/SimulatedPage';
import Link from 'next/link';
import { FaHome, FaDesktop } from 'react-icons/fa';

export default function SimulationPage() {
  return (
    <div className="relative min-h-screen bg-gray-900 text-white overflow-hidden">
      {/* Navigation Bar */}
      <nav className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/" 
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
          >
            <FaHome /> Home
          </Link>
          <div className="flex items-center gap-2 text-cyan-400">
            <FaDesktop />
            <span className="font-semibold">Basic Network Simulation</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="h-[calc(100vh-72px)] bg-gray-800 rounded-lg p-6 shadow-lg">
        <SimPage />
      </div>
    </div>
  );
}