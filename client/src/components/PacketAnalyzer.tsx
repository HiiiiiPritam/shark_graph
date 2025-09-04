'use client';

import { useState, useEffect } from 'react';
import { PacketTrace, EthernetFrame, IPPacket, ICMPPacket, ARPPacket } from '@/lib/network/types';
import { NetworkStack } from '@/lib/network/protocols/NetworkStack';
import { FaSearch, FaPlay, FaPause, FaStop, FaDownload, FaFilter, FaExpand, FaInfoCircle } from 'react-icons/fa';

interface PacketAnalyzerProps {
  traces: PacketTrace[];
  onStartCapture: () => void;
  onStopCapture: () => void;
  isCapturing: boolean;
}

export default function PacketAnalyzer({ traces, onStartCapture, onStopCapture, isCapturing }: PacketAnalyzerProps) {
  const [selectedPacket, setSelectedPacket] = useState<PacketTrace | null>(null);
  const [filter, setFilter] = useState('');
  const [filteredTraces, setFilteredTraces] = useState<PacketTrace[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['ethernet']));
  const [showHelp, setShowHelp] = useState(false);


  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  const getPacketLength = (packet: EthernetFrame): number => {
    // Simplified packet length calculation
    let length = 14; // Ethernet header
    
    if (packet?.etherType === 0x0800 && packet.payload) {
      // IP packet - estimate size (real world would use totalLength field)
      length += 64; // Default IP + ICMP size
    } else if (packet?.etherType === 0x0806) {
      length += 28; // ARP packet size
    }
    
    return length;
  };

  const getPacketProtocol = (packet: EthernetFrame): string => {
    // Enhanced debugging for protocol detection
    console.log('🔍 PacketAnalyzer getPacketProtocol: Analyzing packet:', {
      etherType: packet?.etherType,
      etherTypeHex: packet?.etherType?.toString(16),
      hasPayload: !!packet?.payload,
      payloadType: typeof packet?.payload,
      payloadKeys: packet?.payload ? Object.keys(packet.payload) : null
    });

    // Check for ARP (0x0806)
    if (packet?.etherType === 0x0806) {
      console.log('🔍 PacketAnalyzer: ✅ ARP packet detected via etherType!', packet);
      return 'ARP';
    } 
    
    // Check for IPv4 (0x0800)
    if (packet?.etherType === 0x0800 && packet.payload) {
      const ipPacket = packet.payload as IPPacket;
      const protocol = NetworkStack.parseIPProtocol(ipPacket?.protocol);
      console.log('🔍 PacketAnalyzer: ✅ IPv4 packet detected, protocol:', protocol);
      return protocol;
    } 
    
    // Fallback: Check if this might be an ARP packet with missing etherType
    if (packet?.payload && typeof packet.payload === 'object' && 'operation' in packet.payload) {
      console.log('🔍 PacketAnalyzer: ⚠️ ARP packet detected via payload inspection (etherType incorrect):', packet.etherType, packet);
      return 'ARP';
    }

    // Default fallback
    const fallback = NetworkStack.parseEtherType(packet?.etherType);
    console.log('🔍 PacketAnalyzer: Using fallback protocol detection:', fallback, 'for etherType:', packet?.etherType);
    return fallback;
  };

  const getPacketInfo = (trace: PacketTrace): string => {
    // Use the educational decision text if available, otherwise fall back to old format
    if (trace.decision) {
      return trace.decision;
    }

    // Fallback for older traces without decision field
    const packet = trace.packet;
    const actionEmoji = {
      'received': '📥',
      'forwarded': '🔄', 
      'generated': '📤',
      'dropped': '❌',
      'processed': '⚙️'
    }[trace.action] || '📄';
    
    const safeAction = trace.action?.toUpperCase() || 'UNKNOWN';
    
    if (packet?.etherType === 0x0800 && packet.payload) {
      const ipPacket = packet.payload as IPPacket;
      const sourceIP = ipPacket?.sourceIP?.address || 'Unknown';
      const destIP = ipPacket?.destinationIP?.address || 'Unknown';
      
      if (ipPacket?.protocol === 1 && ipPacket.payload) { // ICMP
        const icmpPacket = ipPacket.payload as ICMPPacket;
        const icmpType = NetworkStack.parseICMPType(icmpPacket?.type);
        return `${actionEmoji} ${safeAction} | ${sourceIP} → ${destIP} | ${icmpType}`;
      }
      
      const protocol = NetworkStack.parseIPProtocol(ipPacket?.protocol);
      return `${actionEmoji} ${safeAction} | ${sourceIP} → ${destIP} | ${protocol}`;
    } else if (packet?.etherType === 0x0806 && packet.payload) {
      const arpPacket = packet.payload as ARPPacket;
      const senderIP = arpPacket?.senderProtocolAddress?.address || 'Unknown';
      const targetIP = arpPacket?.targetProtocolAddress?.address || 'Unknown';
      const operation = NetworkStack.parseARPOperation(arpPacket?.operation);
      return `${actionEmoji} ${safeAction} | ${senderIP} → ${targetIP} | ARP ${operation}`;
    }
    
    const srcMac = packet?.sourceMac?.address || 'Unknown';
    const dstMac = packet?.destinationMac?.address || 'Unknown';
    const etherType = NetworkStack.parseEtherType(packet?.etherType);
    return `${actionEmoji} ${safeAction} | ${srcMac} → ${dstMac} | ${etherType}`;
  };

  const renderEthernetHeader = (frame: EthernetFrame) => (
    <div className="mb-4">
      <div
        className="bg-blue-100 p-2 cursor-pointer flex items-center justify-between hover:bg-blue-200 transition-colors"
        onClick={() => toggleSection('ethernet')}
      >
        <h3 className="font-semibold text-gray-900">Ethernet II Header</h3>
        <FaExpand className={`transform transition-transform ${expandedSections.has('ethernet') ? 'rotate-180' : ''} text-gray-700`} />
      </div>
      {expandedSections.has('ethernet') && (
        <div className="bg-gray-50 p-3 border border-blue-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium text-gray-700">Destination MAC:</span> <span className="text-gray-900 font-mono">{frame?.destinationMac?.address || 'Unknown'}</span></div>
            <div><span className="font-medium text-gray-700">Source MAC:</span> <span className="text-gray-900 font-mono">{frame?.sourceMac?.address || 'Unknown'}</span></div>
            <div><span className="font-medium text-gray-700">EtherType:</span> <span className="text-gray-900 font-mono">0x{frame?.etherType?.toString(16).padStart(4, '0') || '????'} ({NetworkStack.parseEtherType(frame?.etherType)})</span></div>
            <div><span className="font-medium text-gray-700">Frame ID:</span> <span className="text-gray-900">{frame?.id || 'Unknown'}</span></div>
          </div>
        </div>
      )}
    </div>
  );

  const renderIPHeader = (ipPacket: IPPacket) => (
    <div className="mb-4">
      <div
        className="bg-green-100 p-2 cursor-pointer flex items-center justify-between hover:bg-green-200 transition-colors"
        onClick={() => toggleSection('ip')}
      >
        <h3 className="font-semibold text-gray-900">IP Header (IPv4)</h3>
        <FaExpand className={`transform transition-transform ${expandedSections.has('ip') ? 'rotate-180' : ''} text-gray-700`} />
      </div>
      {expandedSections.has('ip') && (
        <div className="bg-gray-50 p-3 border border-green-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium text-gray-700">Time to Live:</span> <span className="text-gray-900">{ipPacket.timeToLive}</span></div>
            <div><span className="font-medium text-gray-700">Protocol:</span> <span className="text-gray-900">{ipPacket.protocol} ({NetworkStack.parseIPProtocol(ipPacket.protocol)})</span></div>
            <div><span className="font-medium text-gray-700">Source IP:</span> <span className="text-gray-900 font-mono">{ipPacket.sourceIP.address}</span></div>
            <div><span className="font-medium text-gray-700">Destination IP:</span> <span className="text-gray-900 font-mono">{ipPacket.destinationIP.address}</span></div>
          </div>
        </div>
      )}
    </div>
  );

  const renderICMPHeader = (icmpPacket: ICMPPacket) => (
    <div className="mb-4">
      <div
        className="bg-yellow-100 p-2 cursor-pointer flex items-center justify-between hover:bg-yellow-200 transition-colors"
        onClick={() => toggleSection('icmp')}
      >
        <h3 className="font-semibold text-gray-900">ICMP Header</h3>
        <FaExpand className={`transform transition-transform ${expandedSections.has('icmp') ? 'rotate-180' : ''} text-gray-700`} />
      </div>
      {expandedSections.has('icmp') && (
        <div className="bg-gray-50 p-3 border border-yellow-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium text-gray-700">Type:</span> <span className="text-gray-900">{icmpPacket.type} ({NetworkStack.parseICMPType(icmpPacket.type)})</span></div>
            <div><span className="font-medium text-gray-700">Code:</span> <span className="text-gray-900">{icmpPacket.code}</span></div>
            <div><span className="font-medium text-gray-700">Identifier:</span> <span className="text-gray-900">{icmpPacket.identifier}</span></div>
            <div><span className="font-medium text-gray-700">Sequence Number:</span> <span className="text-gray-900">{icmpPacket.sequenceNumber}</span></div>
            <div><span className="font-medium text-gray-700">Data:</span> <span className="text-gray-900">{icmpPacket.data}</span></div>
          </div>
        </div>
      )}
    </div>
  );

  const renderARPHeader = (arpPacket: ARPPacket) => (
    <div className="mb-4">
      <div
        className="bg-purple-100 p-2 cursor-pointer flex items-center justify-between hover:bg-purple-200 transition-colors"
        onClick={() => toggleSection('arp')}
      >
        <h3 className="font-semibold text-gray-900">ARP Header</h3>
        <FaExpand className={`transform transition-transform ${expandedSections.has('arp') ? 'rotate-180' : ''} text-gray-700`} />
      </div>
      {expandedSections.has('arp') && (
        <div className="bg-gray-50 p-3 border border-purple-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium text-gray-700">Protocol Type:</span> <span className="text-gray-900 font-mono">0x{arpPacket.protocolType.toString(16)} (IPv4)</span></div>
            <div><span className="font-medium text-gray-700">Operation:</span> <span className="text-gray-900">{arpPacket.operation} ({NetworkStack.parseARPOperation(arpPacket.operation)})</span></div>
            <div><span className="font-medium text-gray-700">Sender MAC:</span> <span className="text-gray-900 font-mono">{arpPacket.senderHardwareAddress.address}</span></div>
            <div><span className="font-medium text-gray-700">Sender IP:</span> <span className="text-gray-900 font-mono">{arpPacket.senderProtocolAddress.address}</span></div>
            <div><span className="font-medium text-gray-700">Target MAC:</span> <span className="text-gray-900 font-mono">{arpPacket.targetHardwareAddress.address}</span></div>
            <div><span className="font-medium text-gray-700">Target IP:</span> <span className="text-gray-900 font-mono">{arpPacket.targetProtocolAddress.address}</span></div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPacketDetails = () => {
    if (!selectedPacket) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <FaSearch className="mx-auto text-4xl mb-4" />
            <p>Select a packet to view details</p>
          </div>
        </div>
      );
    }

    const { packet } = selectedPacket;

    return (
      <div className="p-4">
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <h2 className="font-semibold mb-2 text-gray-900">🚀 Step {selectedPacket.stepNumber}: Network Journey</h2>
          <div className="mb-3 p-2 bg-white rounded border">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-lg">
                {{
                  'received': '📥',
                  'forwarded': '🔄', 
                  'generated': '📤',
                  'dropped': '❌',
                  'processed': '⚙️',
                  '🎯 Ping Initiated': '🎯',
                  '🧭 Route Decision': '🧭',
                  '🚪 Gateway Required': '🚪',
                  '📡 ARP Resolution': '📡',
                  '🗺️ Routing Table Lookup': '🗺️',
                  '✅ Route Found': '✅',
                  '🚀 Packet Forwarded': '🚀',
                  '📥 Packet Received': '📥',
                  '💬 Reply Generated': '💬',
                  '✅ Ping Successful': '✅'
                }[selectedPacket.action] || '📄'}
              </span>
              <span className="font-medium text-gray-900">{selectedPacket.action.replace(/^[🎯🧭🚪📡🗺️✅🚀📥💬❌⚙️🔄📤]+\s*/, '')}</span>
              <span className="text-gray-600">at</span>
              <span className="font-bold text-blue-600">{selectedPacket.deviceName}</span>
              <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">{selectedPacket.deviceType.toUpperCase()}</span>
            </div>
            <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded border-l-4 border-blue-400">
              <div className="font-medium text-gray-800 mb-1">Educational Details:</div>
              <div>{selectedPacket.decision}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div><span className="font-medium text-gray-700">Timestamp:</span> <span className="text-gray-900 font-mono text-xs">{formatTimestamp(selectedPacket.timestamp)}</span></div>
              {selectedPacket.incomingInterface && (
                <div><span className="font-medium text-gray-700">Incoming Port:</span> <span className="text-gray-900 bg-gray-100 px-2 py-1 rounded font-mono text-xs">{selectedPacket.incomingInterface}</span></div>
              )}
              {selectedPacket.outgoingInterface && (
                <div><span className="font-medium text-gray-700">Outgoing Port:</span> <span className="text-gray-900 bg-gray-100 px-2 py-1 rounded font-mono text-xs">{selectedPacket.outgoingInterface}</span></div>
              )}
            </div>
            <div className="space-y-1">
              {selectedPacket.incomingInterface && selectedPacket.outgoingInterface && (
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <div className="text-green-800 text-xs font-medium mb-1">Packet Flow:</div>
                  <div className="text-green-700 font-mono text-xs">{selectedPacket.incomingInterface} → {selectedPacket.deviceName} → {selectedPacket.outgoingInterface}</div>
                </div>
              )}
              {selectedPacket.routingTableUsed && (
                <div className="bg-orange-50 border border-orange-200 rounded p-2">
                  <div className="text-orange-800 text-xs font-medium">Used Routing Entry</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {renderEthernetHeader(packet)}

        {packet.etherType === 0x0800 && (
          <>
            {renderIPHeader(packet.payload as IPPacket)}
            {(packet.payload as IPPacket).protocol === 1 && 
             renderICMPHeader((packet.payload as IPPacket).payload as ICMPPacket)}
          </>
        )}

        {packet.etherType === 0x0806 && renderARPHeader(packet.payload as ARPPacket)}

        {selectedPacket.routingTableUsed && (
          <div className="mb-4">
            <div className="bg-indigo-100 p-2">
              <h3 className="font-semibold text-gray-900">🗺️ Routing Decision Details</h3>
            </div>
            <div className="bg-gray-50 p-3 border border-indigo-200">
              <div className="text-sm grid grid-cols-1 gap-2">
                <div><span className="font-medium text-gray-700">Destination Network:</span> <span className="text-gray-900 font-mono">{selectedPacket.routingTableUsed.destinationNetwork.address}/{NetworkStack.getPrefixLength(selectedPacket.routingTableUsed.subnetMask)}</span></div>
                <div><span className="font-medium text-gray-700">Next Hop:</span> <span className="text-gray-900 font-mono">{selectedPacket.routingTableUsed.nextHop.address === '0.0.0.0' ? 'Directly Connected' : selectedPacket.routingTableUsed.nextHop.address}</span></div>
                <div><span className="font-medium text-gray-700">Exit Interface:</span> <span className="text-gray-900 font-mono">{selectedPacket.routingTableUsed.interface}</span></div>
                <div><span className="font-medium text-gray-700">Route Metric:</span> <span className="text-gray-900">{selectedPacket.routingTableUsed.metric} (lower = better)</span></div>
                <div><span className="font-medium text-gray-700">Route Source:</span> <span className="text-gray-900 capitalize">{selectedPacket.routingTableUsed.protocol}</span></div>
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <div className="text-blue-800 text-xs font-medium">Routing Logic:</div>
                  <div className="text-blue-700 text-xs">
                    Router used longest prefix match to find this /{NetworkStack.getPrefixLength(selectedPacket.routingTableUsed.subnetMask)} route, 
                    then forwarded packet {selectedPacket.routingTableUsed.nextHop.address === '0.0.0.0' ? 'directly to the destination subnet' : 'to the next-hop router'}.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedPacket.arpTableUsed && (
          <div className="mb-4">
            <div className="bg-purple-100 p-2">
              <h3 className="font-semibold text-gray-900">📡 ARP Resolution Used</h3>
            </div>
            <div className="bg-gray-50 p-3 border border-purple-200">
              <div className="text-sm grid grid-cols-1 gap-2">
                <div><span className="font-medium text-gray-700">Resolved IP:</span> <span className="text-gray-900 font-mono">{selectedPacket.arpTableUsed.ipAddress.address}</span></div>
                <div><span className="font-medium text-gray-700">MAC Address:</span> <span className="text-gray-900 font-mono">{selectedPacket.arpTableUsed.macAddress.address}</span></div>
                <div><span className="font-medium text-gray-700">Interface:</span> <span className="text-gray-900">{selectedPacket.arpTableUsed.interface}</span></div>
                <div><span className="font-medium text-gray-700">Entry Type:</span> <span className="text-gray-900">{selectedPacket.arpTableUsed.isStatic ? 'Static' : 'Dynamic'}</span></div>
                <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded">
                  <div className="text-purple-800 text-xs font-medium">ARP Process:</div>
                  <div className="text-purple-700 text-xs">
                    Device resolved Layer 3 IP address to Layer 2 MAC address for frame delivery. This MAC address is now cached for future use.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white max-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-300 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">Packet Analyzer</h2>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-blue-500 hover:text-blue-700 transition-colors"
            title="Show/Hide Help"
          >
            <FaInfoCircle className="text-sm" />
          </button>
        </div>
      </div>

      {/* Help Section */}
      {showHelp && (
        <div className="bg-blue-50 border-b border-blue-200 p-3 text-sm flex-shrink-0">
          <div className="text-blue-800">
            <strong className="text-blue-900">📊 Packet Analyzer Guide:</strong>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-blue-900 mb-1">How to capture packets:</p>
                <ul className="text-blue-700 space-y-1">
                  <li>1. Connect devices in the main network view</li>
                  <li>2. Configure IP addresses on devices</li>
                  <li>3. Start ping mode and ping between hosts</li>
                  <li>4. Watch packets appear in the table below</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-blue-900 mb-1">What you'll see:</p>
                <ul className="text-blue-700 space-y-1">
                  <li>• Complete packet journey step-by-step</li>
                  <li>• Each device the packet visits</li>
                  <li>• Routing decisions and forwarding actions</li>
                  <li>• Protocol details (Ethernet, IP, ICMP, ARP)</li>
                </ul>
              </div>
            </div>
            <p className="mt-2 text-blue-600">💡 <strong>Tip:</strong> Click on any packet row to see detailed protocol information!</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Packet List */}
        <div className="w-1/2 border-r border-gray-300 flex flex-col min-h-0">
          <div className="bg-gray-100 p-2 border-b border-gray-300 flex-shrink-0">
            <div className="text-sm font-medium text-gray-800">
              Packets: {filteredTraces.length} {filter && `(filtered from ${traces.length})`}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left border-b text-gray-900 font-semibold">#</th>
                  <th className="px-2 py-2 text-left border-b text-gray-900 font-semibold">Time</th>
                  <th className="px-2 py-2 text-left border-b text-gray-900 font-semibold">Device</th>
                  <th className="px-2 py-2 text-left border-b text-gray-900 font-semibold">Protocol</th>
                  <th className="px-2 py-2 text-left border-b text-gray-900 font-semibold">Length</th>
                  <th className="px-2 py-2 text-left border-b text-gray-900 font-semibold">Info</th>
                </tr>
              </thead>
              <tbody>
                {filteredTraces.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <div className="space-y-2">
                        <p className="text-sm">🔍 No packets to display</p>
                        <p className="text-xs">Start a ping between devices to see packet traces here</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredTraces.map((trace, idx) => (
                  <tr
                    key={idx}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                      selectedPacket === trace ? 'bg-blue-100 border-l-4 border-blue-500' : 'border-l-4 border-transparent'
                    }`}
                    onClick={() => setSelectedPacket(trace)}
                  >
                    <td className="px-2 py-2 border-b text-gray-900">{trace.stepNumber}</td>
                    <td className="px-2 py-2 border-b text-gray-700 font-mono text-xs">{formatTimestamp(trace.timestamp)}</td>
                    <td className="px-2 py-2 border-b text-gray-800 font-medium">{trace.deviceName}</td>
                    <td className="px-2 py-2 border-b text-gray-700">{getPacketProtocol(trace.packet)}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{getPacketLength(trace.packet)}</td>
                    <td className="px-2 py-2 border-b text-gray-700 max-w-0" title={getPacketInfo(trace)}>
                      <div className="truncate">{getPacketInfo(trace)}</div>
                      {trace.outgoingInterface && (
                        <div className="text-xs text-gray-500 mt-1">
                          {trace.incomingInterface ? `${trace.incomingInterface} → ${trace.outgoingInterface}` : `→ ${trace.outgoingInterface}`}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='h-[30dvh] w-1.5 bg-amber-200'></div>
        </div>

        {/* Packet Details */}
        <div className="w-1/2 flex flex-col min-h-0">
          <div className="bg-gray-100 p-2 border-b border-gray-300 flex-shrink-0">
            <div className="text-sm font-medium text-gray-800">Packet Details</div>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            {renderPacketDetails()}
          </div>
          <div className='h-[30dvh] w-1.5 bg-amber-200'></div>
        </div>
      </div>
    </div>
  );
}