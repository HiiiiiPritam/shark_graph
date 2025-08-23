import {
  Host as HostInterface,
  NetworkInterface,
  IPAddress,
  MACAddress,
  EthernetFrame,
  IPPacket,
  ICMPPacket,
  ARPPacket,
  ARPEntry,
  RouteEntry,
  PacketTrace,
  HostApplication,
} from '../types';
import { PacketTracer } from '../protocols/PacketTracer';
import { NetworkStack } from '../protocols/NetworkStack';

export class Host implements HostInterface {
  id: string;
  name: string;
  type: 'host' = 'host';
  interfaces: NetworkInterface[];
  position: { x: number; y: number };
  isConfigured: boolean;
  status: 'up' | 'down';
  arpTable: ARPEntry[];
  routingTable: RouteEntry[];
  defaultGateway?: IPAddress;
  applications: HostApplication[];
  
  private networkStack: NetworkStack;
  private packetTracer: PacketTracer;
  private transmitCallback?: (frame: EthernetFrame, fromDevice: string, outgoingInterface: string) => Promise<void>;

  constructor(
    id: string,
    name: string,
    position: { x: number; y: number } = { x: 0, y: 0 }
  ) {
    this.id = id;
    this.name = name;
    this.interfaces = [];
    this.position = position;
    this.isConfigured = false;
    this.status = 'up';
    this.arpTable = [];
    this.routingTable = [];
    this.applications = [];
    
    this.networkStack = new NetworkStack(this);
    this.packetTracer = new PacketTracer();

    // Create default interface
    this.addInterface('eth0', this.generateMACAddress());
  }

  // Set callback for transmitting frames to simulator
  setTransmitCallback(callback: (frame: EthernetFrame, fromDevice: string, outgoingInterface: string) => Promise<void>): void {
    this.transmitCallback = callback;
  }

  // Interface Management
  addInterface(name: string, macAddress: MACAddress, ipAddress?: IPAddress): void {
    const newInterface: NetworkInterface = {
      id: `${this.id}-${name}`,
      name,
      macAddress,
      ipAddress,
      isUp: true,
      speed: 100, // 100 Mbps default
      connectedTo: undefined,
    };
    
    this.interfaces.push(newInterface);
    
    // Add connected route if IP is configured
    if (ipAddress) {
      this.addConnectedRoute(ipAddress, name);
    }
  }

  configureInterface(interfaceName: string, ipAddress: IPAddress): void {
    const iface = this.interfaces.find(i => i.name === interfaceName);
    if (!iface) {
      throw new Error(`Interface ${interfaceName} not found`);
    }
    
    iface.ipAddress = ipAddress;
    this.addConnectedRoute(ipAddress, interfaceName);
    this.isConfigured = true;
  }

  setDefaultGateway(gateway: IPAddress): void {
    this.defaultGateway = gateway;
    
    // Add default route
    this.routingTable.push({
      destinationNetwork: { address: '0.0.0.0', subnet: '0.0.0.0' },
      subnetMask: '0.0.0.0',
      nextHop: gateway,
      interface: this.interfaces[0].name, // Use first interface
      metric: 1,
      protocol: 'static',
    });
  }

  // Packet Processing
  async receiveFrame(frame: EthernetFrame, incomingInterface: string): Promise<void> {
    if (this.status === 'down') return;

    // Check if frame is for us
    const iface = this.interfaces.find(i => i.name === incomingInterface);
    if (!iface) return;

    const isForUs = frame.destinationMac.address === iface.macAddress.address ||
                    frame.destinationMac.address === 'ff:ff:ff:ff:ff:ff'; // Broadcast

    if (!isForUs) {
      // Not for us, drop it
      return;
    }

    // Process based on EtherType
    if (frame.etherType === 0x0806) {
      // ARP
      await this.processARPPacket(frame.payload as ARPPacket, incomingInterface);
    } else if (frame.etherType === 0x0800) {
      // IPv4
      await this.processIPPacket(frame.payload as IPPacket, incomingInterface);
    }
  }

  async sendPing(destinationIP: string): Promise<void> {
    const dest: IPAddress = { address: destinationIP, subnet: '' };
    
    // Create ICMP Echo Request
    const icmpPacket: ICMPPacket = {
      type: 8, // Echo Request
      code: 0,
      checksum: 0,
      identifier: Math.floor(Math.random() * 65536),
      sequenceNumber: 1,
      data: 'Hello from ' + this.name,
    };

    const sourceInterface = this.interfaces[0];
    if (!sourceInterface?.ipAddress) {
      throw new Error('No configured IP address');
    }

    // Create IP packet
    const ipPacket: IPPacket = {
      id: this.generatePacketId(),
      version: 4,
      headerLength: 20,
      typeOfService: 0,
      totalLength: 64,
      identification: Math.floor(Math.random() * 65536),
      flags: 0,
      fragmentOffset: 0,
      timeToLive: 64,
      protocol: 1, // ICMP
      headerChecksum: 0,
      sourceIP: sourceInterface.ipAddress,
      destinationIP: dest,
      payload: icmpPacket,
      timestamp: Date.now(),
    };

    // Send the packet through network simulator
    await this.sendIPPacket(ipPacket, sourceInterface.name);
  }

  async sendIPPacket(packet: IPPacket, outgoingInterface: string): Promise<void> {
    // Find next hop
    const nextHop = this.findNextHop(packet.destinationIP);
    if (!nextHop) {
      throw new Error(`No route to ${packet.destinationIP.address}`);
    }

    console.log(`Host ${this.name}: Next hop for ${packet.destinationIP.address} is ${nextHop.address}`);

    // Check ARP table for destination MAC
    let destinationMac = this.findInARPTable(nextHop);
    
    if (!destinationMac) {
      // Send ARP request first
      destinationMac = await this.sendARPRequest(nextHop, outgoingInterface);
    }

    const sourceInterface = this.interfaces.find(i => i.name === outgoingInterface);
    if (!sourceInterface) {
      throw new Error(`Interface ${outgoingInterface} not found`);
    }

    // Create Ethernet frame
    const frame: EthernetFrame = {
      id: this.generateFrameId(),
      sourceMac: sourceInterface.macAddress,
      destinationMac: destinationMac,
      etherType: 0x0800, // IPv4
      payload: packet,
      timestamp: Date.now(),
    };

    // Send frame to connected device (simulation)
    await this.transmitFrame(frame, outgoingInterface);
  }

  // ARP Protocol Implementation
  async sendARPRequest(targetIP: IPAddress, outgoingInterface: string): Promise<MACAddress> {
    const sourceInterface = this.interfaces.find(i => i.name === outgoingInterface);
    if (!sourceInterface?.ipAddress) {
      throw new Error(`Interface ${outgoingInterface} not configured`);
    }

    // Check if interface is connected
    if (!sourceInterface.connectedTo) {
      throw new Error(`Interface ${outgoingInterface} is not connected to any device`);
    }

    const arpRequest: ARPPacket = {
      hardwareType: 1, // Ethernet
      protocolType: 0x0800, // IPv4
      hardwareSize: 6,
      protocolSize: 4,
      operation: 1, // Request
      senderHardwareAddress: sourceInterface.macAddress,
      senderProtocolAddress: sourceInterface.ipAddress,
      targetHardwareAddress: { address: '00:00:00:00:00:00' },
      targetProtocolAddress: targetIP,
    };

    const frame: EthernetFrame = {
      id: this.generateFrameId(),
      sourceMac: sourceInterface.macAddress,
      destinationMac: { address: 'ff:ff:ff:ff:ff:ff' }, // Broadcast
      etherType: 0x0806, // ARP
      payload: arpRequest,
      timestamp: Date.now(),
    };

    // Add trace
    const trace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'host',
      action: 'generated',
      outgoingInterface,
      packet: frame,
      timestamp: Date.now(),
      decision: `Generated ARP request for ${targetIP.address}`,
    };
    
    this.packetTracer.addTrace(trace);

    // Send the ARP request through the network
    await this.transmitFrame(frame, outgoingInterface);

    // Wait for ARP response (in simulation, we need to wait a bit for the network to process)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if we received an ARP reply
    const arpEntry = this.findInARPTable(targetIP);
    if (arpEntry) {
      console.log(`ARP resolved: ${targetIP.address} -> ${arpEntry.address}`);
      return arpEntry;
    } else {
      throw new Error(`ARP request timed out for ${targetIP.address} - no response received`);
    }
  }

  private isInSameNetwork(sourceIP: IPAddress, targetIP: IPAddress): boolean {
    if (!sourceIP || !sourceIP.subnet) return false;
    
    // Simple network comparison - in a real implementation this would be more sophisticated
    const sourceParts = sourceIP.address.split('.');
    const targetParts = targetIP.address.split('.');
    const subnetParts = sourceIP.subnet.split('.');
    
    for (let i = 0; i < 4; i++) {
      const sourceByte = parseInt(sourceParts[i]) & parseInt(subnetParts[i]);
      const targetByte = parseInt(targetParts[i]) & parseInt(subnetParts[i]);
      if (sourceByte !== targetByte) {
        return false;
      }
    }
    return true;
  }

  async processARPPacket(arpPacket: ARPPacket, incomingInterface: string): Promise<void> {
    console.log(`Host ${this.name} processing ARP ${arpPacket.operation === 1 ? 'request' : 'reply'} for ${arpPacket.targetProtocolAddress.address}`);
    
    if (arpPacket.operation === 1) {
      // ARP Request - check if it's for us
      const ourInterface = this.interfaces.find(i => 
        i.name === incomingInterface && 
        i.ipAddress?.address === arpPacket.targetProtocolAddress.address
      );

      if (ourInterface) {
        console.log(`Host ${this.name} sending ARP reply to ${arpPacket.senderProtocolAddress.address}`);
        
        // Send ARP Reply
        const arpReply: ARPPacket = {
          hardwareType: 1,
          protocolType: 0x0800,
          hardwareSize: 6,
          protocolSize: 4,
          operation: 2, // Reply
          senderHardwareAddress: ourInterface.macAddress,
          senderProtocolAddress: ourInterface.ipAddress!,
          targetHardwareAddress: arpPacket.senderHardwareAddress,
          targetProtocolAddress: arpPacket.senderProtocolAddress,
        };

        const frame: EthernetFrame = {
          id: this.generateFrameId(),
          sourceMac: ourInterface.macAddress,
          destinationMac: arpPacket.senderHardwareAddress,
          etherType: 0x0806,
          payload: arpReply,
          timestamp: Date.now(),
        };

        // Add our entry to ARP table first
        this.addARPEntry(
          arpPacket.senderProtocolAddress,
          arpPacket.senderHardwareAddress,
          incomingInterface
        );

        await this.transmitFrame(frame, incomingInterface);
      } else {
        console.log(`Host ${this.name} ignoring ARP request for ${arpPacket.targetProtocolAddress.address} (not for us)`);
      }
    } else if (arpPacket.operation === 2) {
      // ARP Reply - update our ARP table
      console.log(`Host ${this.name} received ARP reply: ${arpPacket.senderProtocolAddress.address} -> ${arpPacket.senderHardwareAddress.address}`);
      this.addARPEntry(
        arpPacket.senderProtocolAddress,
        arpPacket.senderHardwareAddress,
        incomingInterface
      );
    }
  }

  async processIPPacket(ipPacket: IPPacket, incomingInterface: string): Promise<void> {
    // Check if packet is for us
    const isForUs = this.interfaces.some(i => 
      i.ipAddress?.address === ipPacket.destinationIP.address
    );

    if (!isForUs) {
      // Not for us, drop it (hosts don't forward)
      const trace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'host',
        action: 'dropped',
        incomingInterface,
        packet: { id: '', sourceMac: { address: '' }, destinationMac: { address: '' }, etherType: 0x0800, payload: ipPacket, timestamp: Date.now() },
        timestamp: Date.now(),
        decision: `Packet not destined for this host (IP: ${ipPacket.destinationIP.address})`,
      };
      this.packetTracer.addTrace(trace);
      return;
    }

    // Process based on protocol
    if (ipPacket.protocol === 1) {
      // ICMP
      await this.processICMPPacket(ipPacket.payload as ICMPPacket, ipPacket, incomingInterface);
    }
  }

  async processICMPPacket(icmpPacket: ICMPPacket, ipPacket: IPPacket, incomingInterface: string): Promise<void> {
    if (icmpPacket.type === 8) {
      // Echo Request - send Echo Reply
      const echoReply: ICMPPacket = {
        type: 0, // Echo Reply
        code: 0,
        checksum: 0,
        identifier: icmpPacket.identifier,
        sequenceNumber: icmpPacket.sequenceNumber,
        data: icmpPacket.data,
      };

      const sourceInterface = this.interfaces.find(i => i.name === incomingInterface);
      if (!sourceInterface?.ipAddress) return;

      const replyPacket: IPPacket = {
        id: this.generatePacketId(),
        version: 4,
        headerLength: 20,
        typeOfService: 0,
        totalLength: 64,
        identification: Math.floor(Math.random() * 65536),
        flags: 0,
        fragmentOffset: 0,
        timeToLive: 64,
        protocol: 1, // ICMP
        headerChecksum: 0,
        sourceIP: sourceInterface.ipAddress,
        destinationIP: ipPacket.sourceIP,
        payload: echoReply,
        timestamp: Date.now(),
      };

      const trace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'host',
        action: 'generated',
        outgoingInterface: incomingInterface,
        packet: { id: '', sourceMac: { address: '' }, destinationMac: { address: '' }, etherType: 0x0800, payload: replyPacket, timestamp: Date.now() },
        timestamp: Date.now(),
        decision: `Generated ICMP Echo Reply to ${ipPacket.sourceIP.address}`,
      };
      this.packetTracer.addTrace(trace);

      await this.sendIPPacket(replyPacket, incomingInterface);
    }
  }

  // Helper Methods
  private findNextHop(destinationIP: IPAddress): IPAddress | null {
    // Check routing table for best match
    let bestMatch: RouteEntry | null = null;
    let longestPrefix = -1;

    for (const route of this.routingTable) {
      if (this.isIPInNetwork(destinationIP, route.destinationNetwork, route.subnetMask)) {
        const prefixLength = NetworkStack.getPrefixLength(route.subnetMask);
        if (prefixLength > longestPrefix) {
          longestPrefix = prefixLength;
          bestMatch = route;
        }
      }
    }

    if (!bestMatch) return null;

    // For directly connected routes (nextHop = 0.0.0.0), the next hop is the destination itself
    if (bestMatch.nextHop.address === '0.0.0.0') {
      return destinationIP;
    }

    return bestMatch.nextHop;
  }

  private findInARPTable(ip: IPAddress): MACAddress | null {
    const entry = this.arpTable.find(e => e.ipAddress.address === ip.address);
    return entry ? entry.macAddress : null;
  }

  private addARPEntry(ip: IPAddress, mac: MACAddress, interfaceName: string): void {
    // Remove existing entry
    this.arpTable = this.arpTable.filter(e => e.ipAddress.address !== ip.address);
    
    // Add new entry
    this.arpTable.push({
      ipAddress: ip,
      macAddress: mac,
      interface: interfaceName,
      type: 'dynamic',
      age: 0,
    });
  }

  private addConnectedRoute(ip: IPAddress, interfaceName: string): void {
    const networkAddress = this.getNetworkAddress(ip);
    this.routingTable.push({
      destinationNetwork: networkAddress,
      subnetMask: ip.subnet,
      nextHop: { address: '0.0.0.0', subnet: '' }, // Directly connected
      interface: interfaceName,
      metric: 0,
      protocol: 'connected',
    });
  }

  private generateMACAddress(): MACAddress {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += hex[Math.floor(Math.random() * 16)];
      mac += hex[Math.floor(Math.random() * 16)];
    }
    return { address: mac };
  }

  private generatePacketId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateFrameId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private isIPInNetwork(ip: IPAddress, network: IPAddress, subnetMask: string): boolean {
    return NetworkStack.isInSameNetwork(ip.address, network.address, subnetMask);
  }


  private getNetworkAddress(ip: IPAddress): IPAddress {
    return {
      address: NetworkStack.calculateNetworkAddress(ip.address, ip.subnet),
      subnet: ip.subnet,
    };
  }

  // This would connect to the simulation engine in a real implementation
  private async transmitFrame(frame: EthernetFrame, outgoingInterface: string): Promise<void> {
    console.log(`Host ${this.name} transmitting frame on ${outgoingInterface}:`, {
      src: frame.sourceMac.address,
      dst: frame.destinationMac.address,
      type: frame.etherType === 0x0800 ? 'IPv4' : frame.etherType === 0x0806 ? 'ARP' : 'Unknown'
    });

    // Use callback to send frame through the network simulator
    if (this.transmitCallback) {
      await this.transmitCallback(frame, this.id, outgoingInterface);
    }
  }

  // Device Status Methods
  shutdown(): void {
    this.status = 'down';
    this.interfaces.forEach(i => i.isUp = false);
  }

  startup(): void {
    this.status = 'up';
    this.interfaces.forEach(i => i.isUp = true);
  }

  getStatus(): string {
    return `Host ${this.name} (${this.status}) - Interfaces: ${this.interfaces.length}`;
  }
}