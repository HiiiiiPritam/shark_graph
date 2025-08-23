'use client';

import DockerPage from '@/components/DockerPage';
import Link from 'next/link';
import { FaHome, FaDocker } from 'react-icons/fa';

export default function DockerLabPage() {
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
          <div className="flex items-center gap-2 text-blue-400">
            <FaDocker />
            <span className="font-semibold">Docker Network Lab</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="h-[calc(100vh-72px)] bg-gray-800 rounded-lg p-6 shadow-lg">
        <DockerPage />
      </div>
    </div>
  );
}