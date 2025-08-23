'use client';

import RealisticNetworkFlow from '@/components/RealisticNetworkFlow';
import Link from 'next/link';
import { FaHome, FaNetworkWired } from 'react-icons/fa';

export default function RealisticLabPage() {
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
          <div className="flex items-center gap-2 text-green-400">
            <FaNetworkWired />
            <span className="font-semibold">Realistic Network Lab</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="h-[calc(100vh-72px)]">
        <RealisticNetworkFlow />
      </div>
    </div>
  );
}