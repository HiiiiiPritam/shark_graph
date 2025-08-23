"use client";

import Link from 'next/link';
import { FaDocker, FaDesktop, FaNetworkWired, FaRocket, FaArrowRight } from 'react-icons/fa';
import '@/styles/animation.css';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-gray-900 text-white overflow-hidden">
      <div className="relative z-10 p-8 max-w-7xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-cyan-400 animate-flicker flex items-center justify-center gap-3 mb-4">
            <FaRocket className="animate-bounce" /> Shark3
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Comprehensive Network Simulation and Learning Platform
          </p>
          <p className="text-gray-400 mt-2">
            Choose your learning mode below to start exploring networking concepts
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Realistic Network Lab */}
          <Link href="/realistic" className="group">
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-500 hover:border-green-400 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 h-full">
              <div className="text-center mb-4">
                <FaNetworkWired className="text-5xl text-green-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h2 className="text-2xl font-bold text-green-400 mb-2">Realistic Network Lab</h2>
              </div>
              <div className="space-y-3 text-gray-300 mb-6">
                <p className="text-sm">🔧 <strong>Full protocol implementation</strong></p>
                <p className="text-sm">📡 <strong>Ethernet, IP, ARP, ICMP</strong></p>
                <p className="text-sm">🔄 <strong>Real packet forwarding</strong></p>
                <p className="text-sm">📊 <strong>Packet analysis</strong></p>
                <p className="text-sm">⚙️ <strong>CLI device configuration</strong></p>
              </div>
              <div className="flex items-center justify-between text-green-400 group-hover:text-green-300">
                <span className="font-semibold">Start Lab</span>
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Basic Simulation */}
          <Link href="/simulation" className="group">
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-cyan-500 hover:border-cyan-400 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 h-full">
              <div className="text-center mb-4">
                <FaDesktop className="text-5xl text-cyan-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h2 className="text-2xl font-bold text-cyan-400 mb-2">Basic Simulation</h2>
              </div>
              <div className="space-y-3 text-gray-300 mb-6">
                <p className="text-sm">🎓 <strong>Beginner-friendly</strong></p>
                <p className="text-sm">📚 <strong>Simplified networking</strong></p>
                <p className="text-sm">🎮 <strong>Interactive learning</strong></p>
                <p className="text-sm">📋 <strong>Step-by-step guides</strong></p>
                <p className="text-sm">🔍 <strong>Concept visualization</strong></p>
              </div>
              <div className="flex items-center justify-between text-cyan-400 group-hover:text-cyan-300">
                <span className="font-semibold">Start Learning</span>
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Docker Lab */}
          <Link href="/docker" className="group">
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-blue-500 hover:border-blue-400 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 h-full">
              <div className="text-center mb-4">
                <FaDocker className="text-5xl text-blue-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h2 className="text-2xl font-bold text-blue-400 mb-2">Docker Network Lab</h2>
              </div>
              <div className="space-y-3 text-gray-300 mb-6">
                <p className="text-sm">🐳 <strong>Real Docker containers</strong></p>
                <p className="text-sm">🌐 <strong>Actual Linux networking</strong></p>
                <p className="text-sm">🔗 <strong>Container orchestration</strong></p>
                <p className="text-sm">⚡ <strong>Production-like setup</strong></p>
                <p className="text-sm">🛠️ <strong>Advanced scenarios</strong></p>
              </div>
              <div className="flex items-center justify-between text-blue-400 group-hover:text-blue-300">
                <span className="font-semibold">Launch Lab</span>
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>

        {/* Features Section */}
        <div className="text-center bg-gray-800 rounded-lg p-8 border border-gray-700">
          <h3 className="text-2xl font-bold text-white mb-4">Why Choose Shark3?</h3>
          <div className="grid md:grid-cols-3 gap-6 text-gray-300">
            <div>
              <h4 className="font-semibold text-cyan-400 mb-2">Educational Focus</h4>
              <p className="text-sm">Designed specifically for learning networking concepts with real-world accuracy</p>
            </div>
            <div>
              <h4 className="font-semibold text-green-400 mb-2">Multiple Modes</h4>
              <p className="text-sm">From basic concepts to advanced protocols, choose your learning path</p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Hands-On Experience</h4>
              <p className="text-sm">Build, configure, and troubleshoot networks just like in real environments</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
