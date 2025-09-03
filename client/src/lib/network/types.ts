// Core network types for realistic simulation

export interface MACAddress {
  address: string; // e.g., "00:1A:2B:3C:4D:5E"
}

export interface IPAddress {
  address: string; // e.g., "192.168.1.1"
  subnet: string;  // e.g., "255.255.255.0" or "/24"
}

export interface NetworkInterface {
  id: string;
  name: string; // e.g., "eth0", "fa0/0"
  macAddress: MACAddress;
  ipAddress?: IPAddress;
  isUp: boolean;
  speed: number; // Mbps
  connectedTo?: { deviceId: string; interfaceName: string } | string; // Connected device info
}

// OSI Layer 2 - Ethernet Frame
export interface EthernetFrame {
  id: string;
  sourceMac: MACAddress;
  destinationMac: MACAddress;
  etherType: number; // 0x0800 for IPv4, 0x0806 for ARP
  payload: IPPacket | ARPPacket;
  timestamp: number;
}

// OSI Layer 3 - IP Packet (Simplified)
export interface IPPacket {
  id: string;
  version: number; // 4 for IPv4
  totalLength: number;
  timeToLive: number;
  protocol: number; // 1 for ICMP
  sourceIP: IPAddress;
  destinationIP: IPAddress;
  payload: ICMPPacket;
  timestamp: number;
}

// ICMP Packet (for ping)
export interface ICMPPacket {
  type: number; // 8 for Echo Request, 0 for Echo Reply
  code: number;
  checksum: number;
  identifier: number;
  sequenceNumber: number;
  data: string;
}

// ARP Packet
export interface ARPPacket {
  hardwareType: number; // 1 for Ethernet
  protocolType: number; // 0x0800 for IPv4
  hardwareSize: number; // 6 for MAC
  protocolSize: number; // 4 for IPv4
  operation: number; // 1 for request, 2 for reply
  senderHardwareAddress: MACAddress;
  senderProtocolAddress: IPAddress;
  targetHardwareAddress: MACAddress;
  targetProtocolAddress: IPAddress;
}


// Routing Table Entry
export interface RouteEntry {
  destinationNetwork: IPAddress;
  subnetMask: string;
  nextHop: IPAddress;
  interface: string;
  metric: number;
  protocol: 'static' | 'rip' | 'ospf' | 'connected';
}

// ARP Table Entry
export interface ARPEntry {
  ipAddress: IPAddress;
  macAddress: MACAddress;
  interface: string;
  type: 'static' | 'dynamic';
  age: number; // seconds
  isStatic?: boolean; // for compatibility
  expirationTime?: number; // optional timestamp for dynamic entries
}

// MAC Address Table Entry (for switches)
export interface MACTableEntry {
  macAddress: MACAddress;
  port: string;
  age: number; // seconds
  type: 'static' | 'dynamic';
}

// Packet Trace Entry
export interface PacketTrace {
  stepNumber: number;
  deviceId: string;
  deviceName: string;
  deviceType: 'host' | 'switch' | 'router';
  action: string; // Flexible to allow educational action descriptions like "🎯 Ping Initiated", "🧭 Route Decision", etc.
  incomingInterface?: string;
  outgoingInterface?: string;
  packet: EthernetFrame;
  timestamp: number;
  decision: string; // Why this action was taken
  routingTableUsed?: RouteEntry;
  arpTableUsed?: ARPEntry;
  macTableUsed?: MACTableEntry;
}

// Network Device Base Interface
export interface NetworkDevice {
  id: string;
  name: string;
  type: 'host' | 'switch' | 'router';
  interfaces: NetworkInterface[];
  position: { x: number; y: number };
  isConfigured: boolean;
  status: 'up' | 'down';
}

// Host Device
export interface Host extends NetworkDevice {
  type: 'host';
  arpTable: ARPEntry[];
  routingTable: RouteEntry[];
  defaultGateway?: IPAddress;
}

// Switch Device
export interface Switch extends NetworkDevice {
  type: 'switch';
  macAddressTable: MACTableEntry[];
  spanningTreeEnabled: boolean;
}

// Router Device
export interface Router extends NetworkDevice {
  type: 'router';
  routingTable: RouteEntry[];
  arpTable: ARPEntry[];
}


// Network Link
export interface NetworkLink {
  id: string;
  deviceA: string;
  interfaceA: string;
  deviceB: string;
  interfaceB: string;
  bandwidth: number; // Mbps
  latency: number; // ms
  isUp: boolean;
  utilization: number; // percentage
}

// Network Topology
export interface NetworkTopology {
  devices: NetworkDevice[];
  links: NetworkLink[];
  lastModified: number;
}

// Simulation Events
export interface SimulationEvent {
  id: string;
  timestamp: number;
  type: 'packet_sent' | 'packet_received' | 'device_down' | 'device_up' | 'route_update';
  deviceId: string;
  details: any;
}