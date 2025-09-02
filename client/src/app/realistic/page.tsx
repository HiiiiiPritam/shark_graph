'use client';

import RealisticNetworkFlow from '@/components/RealisticNetworkFlow';
import Link from 'next/link';
import { FaHome, FaNetworkWired } from 'react-icons/fa';
import '@/styles/texts.css'
export default function RealisticLabPage() {
  return (
    <div className="relative min-h-screen bg-gray-900 text-white overflow-hidden">
      {/* Navigation Bar */}
      <nav className="bg-gray-800 p-2 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <Link 
            href="/" 
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 bg-gray-700 hover:bg-gray-600 rounded transition text-sm sm:text-base"
          >
            <FaHome className="text-sm" /> <span className="hidden sm:inline">Home</span><span className="sm:hidden">Back</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2 text-green-400">
            <FaNetworkWired className="text-sm sm:text-base" />
            <span className="font-semibold text-sm sm:text-base">Realistic Network Lab</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="h-[calc(100vh-60px)] sm:h-[calc(100vh-72px)]">
        <RealisticNetworkFlow />
      </div>
    </div>
  );
}