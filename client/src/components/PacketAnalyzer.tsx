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

  useEffect(() => {
    console.log(`🔍 PacketAnalyzer: Received ${traces.length} traces:`, traces);
    applyFilter();
  }, [traces, filter]);

  const applyFilter = () => {
    if (!filter.trim()) {
      setFilteredTraces(traces);
      return;
    }

    const filterLower = filter.toLowerCase();
    const filtered = traces.filter(trace => {
      const packet = trace.packet;
      
      // Filter by device name or type
      if (trace.deviceName.toLowerCase().includes(filterLower) ||
          trace.deviceType.toLowerCase().includes(filterLower)) {
        return true;
      }

      // Filter by action
      if (trace.action.toLowerCase().includes(filterLower)) {
        return true;
      }

      // Filter by MAC addresses
      if (packet.sourceMac.address.toLowerCase().includes(filterLower) ||
          packet.destinationMac.address.toLowerCase().includes(filterLower)) {
        return true;
      }

      // Filter by protocol
      const etherType = NetworkStack.parseEtherType(packet.etherType);
      if (etherType.toLowerCase().includes(filterLower)) {
        return true;
      }

      // Filter by IP addresses (if IPv4)
      if (packet.etherType === 0x0800) {
        const ipPacket = packet.payload as IPPacket;
        if (ipPacket.sourceIP.address.includes(filterLower) ||
            ipPacket.destinationIP.address.includes(filterLower)) {
          return true;
        }

        // Filter by IP protocol
        const protocol = NetworkStack.parseIPProtocol(ipPacket.protocol);
        if (protocol.toLowerCase().includes(filterLower)) {
          return true;
        }
      }

      // Filter by interfaces
      if (trace.incomingInterface?.toLowerCase().includes(filterLower) ||
          trace.outgoingInterface?.toLowerCase().includes(filterLower)) {
        return true;
      }

      return false;
    });

    setFilteredTraces(filtered);
  };

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
      const ipPacket = packet.payload as IPPacket;
      length += ipPacket?.totalLength || 0;
    } else if (packet?.etherType === 0x0806) {
      length += 28; // ARP packet size
    }
    
    return length;
  };

  const getPacketProtocol = (packet: EthernetFrame): string => {
    if (packet?.etherType === 0x0800 && packet.payload) {
      const ipPacket = packet.payload as IPPacket;
      return NetworkStack.parseIPProtocol(ipPacket?.protocol);
    } else if (packet?.etherType === 0x0806) {
      return 'ARP';
    }
    return NetworkStack.parseEtherType(packet?.etherType);
  };

  const getPacketInfo = (trace: PacketTrace): string => {
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
        <h3 className="font-semibold text-gray-900">IP Header (IPv{ipPacket.version})</h3>
        <FaExpand className={`transform transition-transform ${expandedSections.has('ip') ? 'rotate-180' : ''} text-gray-700`} />
      </div>
      {expandedSections.has('ip') && (
        <div className="bg-gray-50 p-3 border border-green-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium text-gray-700">Version:</span> <span className="text-gray-900">{ipPacket.version}</span></div>
            <div><span className="font-medium text-gray-700">Header Length:</span> <span className="text-gray-900">{ipPacket.headerLength} bytes</span></div>
            <div><span className="font-medium text-gray-700">Type of Service:</span> <span className="text-gray-900 font-mono">0x{ipPacket.typeOfService.toString(16)}</span></div>
            <div><span className="font-medium text-gray-700">Total Length:</span> <span className="text-gray-900">{ipPacket.totalLength} bytes</span></div>
            <div><span className="font-medium text-gray-700">Identification:</span> <span className="text-gray-900 font-mono">0x{ipPacket.identification.toString(16)}</span></div>
            <div><span className="font-medium text-gray-700">Flags:</span> <span className="text-gray-900 font-mono">0x{ipPacket.flags.toString(16)}</span></div>
            <div><span className="font-medium text-gray-700">Fragment Offset:</span> <span className="text-gray-900">{ipPacket.fragmentOffset}</span></div>
            <div><span className="font-medium text-gray-700">Time to Live:</span> <span className="text-gray-900">{ipPacket.timeToLive}</span></div>
            <div><span className="font-medium text-gray-700">Protocol:</span> <span className="text-gray-900">{ipPacket.protocol} ({NetworkStack.parseIPProtocol(ipPacket.protocol)})</span></div>
            <div><span className="font-medium text-gray-700">Header Checksum:</span> <span className="text-gray-900 font-mono">0x{ipPacket.headerChecksum.toString(16)}</span></div>
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
            <div><span className="font-medium text-gray-700">Checksum:</span> <span className="text-gray-900 font-mono">0x{icmpPacket.checksum.toString(16)}</span></div>
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
            <div><span className="font-medium text-gray-700">Hardware Type:</span> <span className="text-gray-900">{arpPacket.hardwareType} (Ethernet)</span></div>
            <div><span className="font-medium text-gray-700">Protocol Type:</span> <span className="text-gray-900 font-mono">0x{arpPacket.protocolType.toString(16)} (IPv4)</span></div>
            <div><span className="font-medium text-gray-700">Hardware Size:</span> <span className="text-gray-900">{arpPacket.hardwareSize} bytes</span></div>
            <div><span className="font-medium text-gray-700">Protocol Size:</span> <span className="text-gray-900">{arpPacket.protocolSize} bytes</span></div>
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
          <h2 className="font-semibold mb-2 text-gray-900">Step {selectedPacket.stepNumber}: Packet Journey at {selectedPacket.deviceName}</h2>
          <div className="mb-3 p-2 bg-white rounded border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">
                {{
                  'received': '📥',
                  'forwarded': '🔄', 
                  'generated': '📤',
                  'dropped': '❌',
                  'processed': '⚙️'
                }[selectedPacket.action] || '📄'}
              </span>
              <span className="font-medium text-gray-900 capitalize">{selectedPacket.action}</span>
              <span className="text-gray-600">by</span>
              <span className="font-bold text-blue-600">{selectedPacket.deviceName}</span>
              <span className="text-gray-500">({selectedPacket.deviceType})</span>
            </div>
            <div className="text-sm text-gray-700 italic">{selectedPacket.decision}</div>
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
              <h3 className="font-semibold text-gray-900">Routing Information Used</h3>
            </div>
            <div className="bg-gray-50 p-3 border border-indigo-200">
              <div className="text-sm">
                <div><span className="font-medium text-gray-700">Destination:</span> <span className="text-gray-900 font-mono">{selectedPacket.routingTableUsed.destinationNetwork.address}/{selectedPacket.routingTableUsed.subnetMask}</span></div>
                <div><span className="font-medium text-gray-700">Next Hop:</span> <span className="text-gray-900 font-mono">{selectedPacket.routingTableUsed.nextHop.address}</span></div>
                <div><span className="font-medium text-gray-700">Interface:</span> <span className="text-gray-900">{selectedPacket.routingTableUsed.interface}</span></div>
                <div><span className="font-medium text-gray-700">Metric:</span> <span className="text-gray-900">{selectedPacket.routingTableUsed.metric}</span></div>
                <div><span className="font-medium text-gray-700">Protocol:</span> <span className="text-gray-900">{selectedPacket.routingTableUsed.protocol}</span></div>
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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border-r pr-4">
            <input
              type="text"
              placeholder="Filter packets..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            />
            <FaFilter className="text-gray-500" />
          </div>
          
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