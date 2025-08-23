import { Host } from '../devices/Host';
import { IPAddress, MACAddress } from '../types';

export class NetworkStack {
  private host: Host;

  constructor(host: Host) {
    this.host = host;
  }

  // Network utility functions
  static calculateSubnetMask(prefixLength: number): string {
    const mask = (0xffffffff << (32 - prefixLength)) >>> 0;
    return [
      (mask >>> 24) & 0xff,
      (mask >>> 16) & 0xff,
      (mask >>> 8) & 0xff,
      mask & 0xff
    ].join('.');
  }

  static getPrefixLength(subnetMask: string): number {
    return subnetMask.split('.')
      .map(octet => parseInt(octet))
      .reduce((count, octet) => count + octet.toString(2).split('1').length - 1, 0);
  }

  static isValidIPAddress(ip: string): boolean {
    const parts = ip.split('.');
    return parts.length === 4 && parts.every(part => {
      const num = parseInt(part);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  }

  static isValidMACAddress(mac: string): boolean {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  static calculateNetworkAddress(ip: string, subnetMask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = subnetMask.split('.').map(Number);
    return ipParts.map((part, i) => part & maskParts[i]).join('.');
  }

  static calculateBroadcastAddress(ip: string, subnetMask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = subnetMask.split('.').map(Number);
    return ipParts.map((part, i) => part | (255 - maskParts[i])).join('.');
  }

  static isInSameNetwork(ip1: string, ip2: string, subnetMask: string): boolean {
    const network1 = NetworkStack.calculateNetworkAddress(ip1, subnetMask);
    const network2 = NetworkStack.calculateNetworkAddress(ip2, subnetMask);
    return network1 === network2;
  }

  static generateRandomIP(network: string = '192.168.1', hostPart?: number): IPAddress {
    const host = hostPart || Math.floor(Math.random() * 254) + 1;
    return {
      address: `${network}.${host}`,
      subnet: '255.255.255.0'
    };
  }

  static generateRandomMAC(): MACAddress {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += hex[Math.floor(Math.random() * 16)];
      mac += hex[Math.floor(Math.random() * 16)];
    }
    return { address: mac };
  }

  // Checksum calculations
  static calculateIPChecksum(header: number[]): number {
    let sum = 0;
    
    // Sum all 16-bit words
    for (let i = 0; i < header.length; i += 2) {
      const word = (header[i] << 8) + (header[i + 1] || 0);
      sum += word;
    }
    
    // Add carry bits
    while (sum >> 16) {
      sum = (sum & 0xFFFF) + (sum >> 16);
    }
    
    // One's complement
    return (~sum) & 0xFFFF;
  }

  static calculateICMPChecksum(packet: number[]): number {
    return NetworkStack.calculateIPChecksum(packet);
  }

  // Protocol parsing helpers
  static parseEtherType(etherType: number | undefined): string {
    if (etherType === undefined || etherType === null) {
      return 'Unknown';
    }
    switch (etherType) {
      case 0x0800: return 'IPv4';
      case 0x0806: return 'ARP';
      case 0x86DD: return 'IPv6';
      case 0x8100: return '802.1Q VLAN';
      default: return `Unknown (0x${etherType.toString(16)})`;
    }
  }

  static parseIPProtocol(protocol: number | undefined): string {
    if (protocol === undefined || protocol === null) {
      return 'Unknown';
    }
    switch (protocol) {
      case 1: return 'ICMP';
      case 2: return 'IGMP';
      case 6: return 'TCP';
      case 17: return 'UDP';
      case 41: return 'IPv6';
      case 47: return 'GRE';
      case 50: return 'ESP';
      case 51: return 'AH';
      case 89: return 'OSPF';
      default: return `Unknown (${protocol})`;
    }
  }

  static parseICMPType(type: number | undefined): string {
    if (type === undefined || type === null) {
      return 'Unknown';
    }
    switch (type) {
      case 0: return 'Echo Reply';
      case 3: return 'Destination Unreachable';
      case 4: return 'Source Quench';
      case 5: return 'Redirect';
      case 8: return 'Echo Request';
      case 9: return 'Router Advertisement';
      case 10: return 'Router Solicitation';
      case 11: return 'Time Exceeded';
      case 12: return 'Parameter Problem';
      case 13: return 'Timestamp Request';
      case 14: return 'Timestamp Reply';
      default: return `Unknown (${type})`;
    }
  }

  static parseARPOperation(operation: number | undefined): string {
    if (operation === undefined || operation === null) {
      return 'Unknown';
    }
    switch (operation) {
      case 1: return 'Request';
      case 2: return 'Reply';
      case 3: return 'RARP Request';
      case 4: return 'RARP Reply';
      default: return `Unknown (${operation})`;
    }
  }

  // Time and formatting utilities
  static formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  static formatLatency(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
    if (ms < 1000) return `${ms.toFixed(2)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  // Network analysis utilities
  static analyzePacketFlow(traces: any[]): {
    totalHops: number;
    totalLatency: number;
    devicesTraversed: string[];
    protocolsUsed: string[];
  } {
    const devicesTraversed = [...new Set(traces.map(t => t.deviceName))];
    const protocolsUsed = [...new Set(traces.map(t => {
      if (t.packet.etherType === 0x0800) return 'IPv4';
      if (t.packet.etherType === 0x0806) return 'ARP';
      return 'Unknown';
    }))];

    return {
      totalHops: traces.length,
      totalLatency: traces.length > 1 ? 
        traces[traces.length - 1].timestamp - traces[0].timestamp : 0,
      devicesTraversed,
      protocolsUsed
    };
  }
}