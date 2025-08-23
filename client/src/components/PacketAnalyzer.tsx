'use client';

import { useState, useEffect } from 'react';
import { PacketTrace, EthernetFrame, IPPacket, ICMPPacket, ARPPacket } from '@/lib/network/types';
import { NetworkStack } from '@/lib/network/protocols/NetworkStack';
import { FaSearch, FaPlay, FaPause, FaStop, FaDownload, FaFilter, FaExpand } from 'react-icons/fa';

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

  useEffect(() => {
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

  const exportCapture = () => {
    const data = {
      timestamp: new Date().toISOString(),
      captureInfo: {
        totalPackets: traces.length,
        filteredPackets: filteredTraces.length,
        duration: traces.length > 0 ? 
          traces[traces.length - 1].timestamp - traces[0].timestamp : 0,
      },
      traces: filteredTraces,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-capture-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  const getPacketLength = (packet: EthernetFrame): number => {
    // Simplified packet length calculation
    let length = 14; // Ethernet header
    
    if (packet.etherType === 0x0800) {
      const ipPacket = packet.payload as IPPacket;
      length += ipPacket.totalLength;
    } else if (packet.etherType === 0x0806) {
      length += 28; // ARP packet size
    }
    
    return length;
  };

  const getPacketProtocol = (packet: EthernetFrame): string => {
    if (packet.etherType === 0x0800) {
      const ipPacket = packet.payload as IPPacket;
      return NetworkStack.parseIPProtocol(ipPacket.protocol);
    } else if (packet.etherType === 0x0806) {
      return 'ARP';
    }
    return NetworkStack.parseEtherType(packet.etherType);
  };

  const getPacketInfo = (trace: PacketTrace): string => {
    const packet = trace.packet;
    
    if (packet.etherType === 0x0800) {
      const ipPacket = packet.payload as IPPacket;
      
      if (ipPacket.protocol === 1) { // ICMP
        const icmpPacket = ipPacket.payload as ICMPPacket;
        const icmpType = NetworkStack.parseICMPType(icmpPacket.type);
        return `${ipPacket.sourceIP.address} → ${ipPacket.destinationIP.address} ${icmpType}`;
      }
      
      return `${ipPacket.sourceIP.address} → ${ipPacket.destinationIP.address} ${NetworkStack.parseIPProtocol(ipPacket.protocol)}`;
    } else if (packet.etherType === 0x0806) {
      const arpPacket = packet.payload as ARPPacket;
      const operation = NetworkStack.parseARPOperation(arpPacket.operation);
      return `${arpPacket.senderProtocolAddress.address} → ${arpPacket.targetProtocolAddress.address} ARP ${operation}`;
    }
    
    return `${packet.sourceMac.address} → ${packet.destinationMac.address} ${NetworkStack.parseEtherType(packet.etherType)}`;
  };

  const renderEthernetHeader = (frame: EthernetFrame) => (
    <div className="mb-4">
      <div
        className="bg-blue-100 p-2 cursor-pointer flex items-center justify-between"
        onClick={() => toggleSection('ethernet')}
      >
        <h3 className="font-semibold">Ethernet II Header</h3>
        <FaExpand className={`transform ${expandedSections.has('ethernet') ? 'rotate-180' : ''}`} />
      </div>
      {expandedSections.has('ethernet') && (
        <div className="bg-gray-50 p-3 border border-blue-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">Destination MAC:</span> {frame.destinationMac.address}</div>
            <div><span className="font-medium">Source MAC:</span> {frame.sourceMac.address}</div>
            <div><span className="font-medium">EtherType:</span> 0x{frame.etherType.toString(16).padStart(4, '0')} ({NetworkStack.parseEtherType(frame.etherType)})</div>
            <div><span className="font-medium">Frame ID:</span> {frame.id}</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderIPHeader = (ipPacket: IPPacket) => (
    <div className="mb-4">
      <div
        className="bg-green-100 p-2 cursor-pointer flex items-center justify-between"
        onClick={() => toggleSection('ip')}
      >
        <h3 className="font-semibold">IP Header (IPv{ipPacket.version})</h3>
        <FaExpand className={`transform ${expandedSections.has('ip') ? 'rotate-180' : ''}`} />
      </div>
      {expandedSections.has('ip') && (
        <div className="bg-gray-50 p-3 border border-green-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">Version:</span> {ipPacket.version}</div>
            <div><span className="font-medium">Header Length:</span> {ipPacket.headerLength} bytes</div>
            <div><span className="font-medium">Type of Service:</span> 0x{ipPacket.typeOfService.toString(16)}</div>
            <div><span className="font-medium">Total Length:</span> {ipPacket.totalLength} bytes</div>
            <div><span className="font-medium">Identification:</span> 0x{ipPacket.identification.toString(16)}</div>
            <div><span className="font-medium">Flags:</span> 0x{ipPacket.flags.toString(16)}</div>
            <div><span className="font-medium">Fragment Offset:</span> {ipPacket.fragmentOffset}</div>
            <div><span className="font-medium">Time to Live:</span> {ipPacket.timeToLive}</div>
            <div><span className="font-medium">Protocol:</span> {ipPacket.protocol} ({NetworkStack.parseIPProtocol(ipPacket.protocol)})</div>
            <div><span className="font-medium">Header Checksum:</span> 0x{ipPacket.headerChecksum.toString(16)}</div>
            <div><span className="font-medium">Source IP:</span> {ipPacket.sourceIP.address}</div>
            <div><span className="font-medium">Destination IP:</span> {ipPacket.destinationIP.address}</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderICMPHeader = (icmpPacket: ICMPPacket) => (
    <div className="mb-4">
      <div
        className="bg-yellow-100 p-2 cursor-pointer flex items-center justify-between"
        onClick={() => toggleSection('icmp')}
      >
        <h3 className="font-semibold">ICMP Header</h3>
        <FaExpand className={`transform ${expandedSections.has('icmp') ? 'rotate-180' : ''}`} />
      </div>
      {expandedSections.has('icmp') && (
        <div className="bg-gray-50 p-3 border border-yellow-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">Type:</span> {icmpPacket.type} ({NetworkStack.parseICMPType(icmpPacket.type)})</div>
            <div><span className="font-medium">Code:</span> {icmpPacket.code}</div>
            <div><span className="font-medium">Checksum:</span> 0x{icmpPacket.checksum.toString(16)}</div>
            <div><span className="font-medium">Identifier:</span> {icmpPacket.identifier}</div>
            <div><span className="font-medium">Sequence Number:</span> {icmpPacket.sequenceNumber}</div>
            <div><span className="font-medium">Data:</span> {icmpPacket.data}</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderARPHeader = (arpPacket: ARPPacket) => (
    <div className="mb-4">
      <div
        className="bg-purple-100 p-2 cursor-pointer flex items-center justify-between"
        onClick={() => toggleSection('arp')}
      >
        <h3 className="font-semibold">ARP Header</h3>
        <FaExpand className={`transform ${expandedSections.has('arp') ? 'rotate-180' : ''}`} />
      </div>
      {expandedSections.has('arp') && (
        <div className="bg-gray-50 p-3 border border-purple-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">Hardware Type:</span> {arpPacket.hardwareType} (Ethernet)</div>
            <div><span className="font-medium">Protocol Type:</span> 0x{arpPacket.protocolType.toString(16)} (IPv4)</div>
            <div><span className="font-medium">Hardware Size:</span> {arpPacket.hardwareSize} bytes</div>
            <div><span className="font-medium">Protocol Size:</span> {arpPacket.protocolSize} bytes</div>
            <div><span className="font-medium">Operation:</span> {arpPacket.operation} ({NetworkStack.parseARPOperation(arpPacket.operation)})</div>
            <div><span className="font-medium">Sender MAC:</span> {arpPacket.senderHardwareAddress.address}</div>
            <div><span className="font-medium">Sender IP:</span> {arpPacket.senderProtocolAddress.address}</div>
            <div><span className="font-medium">Target MAC:</span> {arpPacket.targetHardwareAddress.address}</div>
            <div><span className="font-medium">Target IP:</span> {arpPacket.targetProtocolAddress.address}</div>
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
      <div className="p-4 overflow-y-auto">
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <h2 className="font-semibold mb-2">Packet Trace Information</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">Device:</span> {selectedPacket.deviceName} ({selectedPacket.deviceType})</div>
            <div><span className="font-medium">Action:</span> {selectedPacket.action}</div>
            <div><span className="font-medium">Timestamp:</span> {formatTimestamp(selectedPacket.timestamp)}</div>
            <div><span className="font-medium">Step:</span> {selectedPacket.stepNumber}</div>
            {selectedPacket.incomingInterface && (
              <div><span className="font-medium">Incoming Interface:</span> {selectedPacket.incomingInterface}</div>
            )}
            {selectedPacket.outgoingInterface && (
              <div><span className="font-medium">Outgoing Interface:</span> {selectedPacket.outgoingInterface}</div>
            )}
          </div>
          <div className="mt-2">
            <span className="font-medium">Decision:</span> {selectedPacket.decision}
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
              <h3 className="font-semibold">Routing Information Used</h3>
            </div>
            <div className="bg-gray-50 p-3 border border-indigo-200">
              <div className="text-sm">
                <div><span className="font-medium">Destination:</span> {selectedPacket.routingTableUsed.destinationNetwork.address}/{selectedPacket.routingTableUsed.subnetMask}</div>
                <div><span className="font-medium">Next Hop:</span> {selectedPacket.routingTableUsed.nextHop.address}</div>
                <div><span className="font-medium">Interface:</span> {selectedPacket.routingTableUsed.interface}</div>
                <div><span className="font-medium">Metric:</span> {selectedPacket.routingTableUsed.metric}</div>
                <div><span className="font-medium">Protocol:</span> {selectedPacket.routingTableUsed.protocol}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-300">
        <h2 className="text-xl font-bold">Network Packet Analyzer</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border-r pr-4">
            <input
              type="text"
              placeholder="Filter packets..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <FaFilter className="text-gray-500" />
          </div>
          
          <button
            onClick={isCapturing ? onStopCapture : onStartCapture}
            className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
              isCapturing ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}
          >
            {isCapturing ? <FaStop /> : <FaPlay />}
            {isCapturing ? 'Stop' : 'Start'}
          </button>
          
          <button
            onClick={exportCapture}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm flex items-center gap-1"
            disabled={filteredTraces.length === 0}
          >
            <FaDownload />
            Export
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex">
        {/* Packet List */}
        <div className="w-1/2 border-r border-gray-300">
          <div className="bg-gray-100 p-2 border-b border-gray-300">
            <div className="text-sm font-medium">
              Packets: {filteredTraces.length} {filter && `(filtered from ${traces.length})`}
            </div>
          </div>
          
          <div className="overflow-y-auto h-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left border-b">#</th>
                  <th className="px-2 py-1 text-left border-b">Time</th>
                  <th className="px-2 py-1 text-left border-b">Device</th>
                  <th className="px-2 py-1 text-left border-b">Protocol</th>
                  <th className="px-2 py-1 text-left border-b">Length</th>
                  <th className="px-2 py-1 text-left border-b">Info</th>
                </tr>
              </thead>
              <tbody>
                {filteredTraces.map((trace, idx) => (
                  <tr
                    key={idx}
                    className={`cursor-pointer hover:bg-blue-50 ${
                      selectedPacket === trace ? 'bg-blue-100' : ''
                    }`}
                    onClick={() => setSelectedPacket(trace)}
                  >
                    <td className="px-2 py-1 border-b">{trace.stepNumber}</td>
                    <td className="px-2 py-1 border-b">{formatTimestamp(trace.timestamp)}</td>
                    <td className="px-2 py-1 border-b">{trace.deviceName}</td>
                    <td className="px-2 py-1 border-b">{getPacketProtocol(trace.packet)}</td>
                    <td className="px-2 py-1 border-b">{getPacketLength(trace.packet)}</td>
                    <td className="px-2 py-1 border-b truncate">{getPacketInfo(trace)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Packet Details */}
        <div className="w-1/2">
          <div className="bg-gray-100 p-2 border-b border-gray-300">
            <div className="text-sm font-medium">Packet Details</div>
          </div>
          {renderPacketDetails()}
        </div>
      </div>
    </div>
  );
}