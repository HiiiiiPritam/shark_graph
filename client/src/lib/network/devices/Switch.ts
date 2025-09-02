import {
  Switch as SwitchInterface,
  NetworkInterface,
  MACAddress,
  EthernetFrame,
  MACTableEntry,
  VLAN,
  PacketTrace,
} from '../types';
import { PacketTracer } from '../protocols/PacketTracer';
import { NetworkStack } from '../protocols/NetworkStack';

export class Switch implements SwitchInterface {
  id: string;
  name: string;
  type: 'switch' = 'switch';
  interfaces: NetworkInterface[];
  position: { x: number; y: number };
  isConfigured: boolean;
  status: 'up' | 'down';
  macAddressTable: MACTableEntry[];
  vlans: VLAN[];
  spanningTreeEnabled: boolean;
  
  private packetTracer: PacketTracer;
  private ageTimer: NodeJS.Timeout | null = null;
  private readonly MAC_AGE_TIME = 300; // 5 minutes in seconds
  private transmitCallback?: (frame: EthernetFrame, fromDevice: string, outgoingInterface: string) => Promise<void>;

  constructor(
    id: string,
    name: string,
    portCount: number = 24,
    position: { x: number; y: number } = { x: 0, y: 0 }
  ) {
    this.id = id;
    this.name = name;
    this.interfaces = [];
    this.position = position;
    this.isConfigured = true; // Switches are typically plug-and-play
    this.status = 'up';
    this.macAddressTable = [];
    this.vlans = [{ id: 1, name: 'default', ports: [] }]; // Default VLAN
    this.spanningTreeEnabled = true;
    
    this.packetTracer = new PacketTracer();

    // Create switch ports
    for (let i = 1; i <= portCount; i++) {
      this.addInterface(`Fa0/${i}`, NetworkStack.generateRandomMAC());
    }

    // Start MAC address aging timer
    this.startMACAddressAging();
  }

  // Set callback for transmitting frames to simulator
  setTransmitCallback(callback: (frame: EthernetFrame, fromDevice: string, outgoingInterface: string) => Promise<void>): void {
    this.transmitCallback = callback;
  }

  // Interface Management
  addInterface(name: string, macAddress: MACAddress): void {
    const newInterface: NetworkInterface = {
      id: `${this.id}-${name}`,
      name,
      macAddress,
      isUp: true,
      speed: 100, // 100 Mbps default
      connectedTo: undefined,
    };
    
    this.interfaces.push(newInterface);
    
    // Add to default VLAN
    this.vlans[0].ports.push(name);
  }

  // Packet Processing - Core Switch Functionality
  async receiveFrame(frame: EthernetFrame, incomingInterface: string): Promise<void> {
    if (this.status === 'down') return;

    console.log(`🔍 Switch ${this.name}: *** RECEIVEFRAME CALLED *** Received frame on ${incomingInterface}`);
    console.log(`🔍 Switch ${this.name}: Source MAC: ${frame.sourceMac.address}, Dest MAC: ${frame.destinationMac.address}`);
    console.log(`🔍 Switch ${this.name}: Current MAC table:`, this.macAddressTable.map(e => `${e.macAddress.address} -> ${e.port}`));
    console.log(`🔍 Switch ${this.name}: About to create detailed traces...`);

    // Step 1: Frame Reception Trace
    const receptionTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'switch',
      action: 'received',
      incomingInterface,
      packet: frame,
      timestamp: performance.now(), // Use high-precision timestamp
      decision: `📥 Frame received on port ${incomingInterface}. Source MAC: ${frame.sourceMac.address}, Destination MAC: ${frame.destinationMac.address}. Beginning Layer 2 processing...`,
    };
    this.packetTracer.addTrace(receptionTrace);

    // Step 2: MAC Address Learning
    const wasLearned = this.learnMACAddressWithTrace(frame.sourceMac, incomingInterface, frame);

    // Step 3: Destination MAC Analysis
    if (this.isBroadcastOrMulticast(frame.destinationMac)) {
      const broadcastTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'switch',
        action: 'processed',
        incomingInterface,
        packet: frame,
        timestamp: performance.now(), // Use high-precision timestamp
        decision: `🔍 Destination analysis: ${frame.destinationMac.address} is ${frame.destinationMac.address === 'ff:ff:ff:ff:ff:ff' ? 'BROADCAST' : 'MULTICAST'}. Must flood to all ports except incoming.`,
      };
      this.packetTracer.addTrace(broadcastTrace);
      
      console.log(`🔍 Switch ${this.name}: Broadcasting frame (broadcast/multicast MAC)`);
      await this.floodFrame(frame, incomingInterface);
      return;
    }

    // Step 4: MAC Address Table Lookup
    const destinationPort = this.lookupMACAddress(frame.destinationMac);
    const lookupTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'switch',
      action: 'processed',
      incomingInterface,
      packet: frame,
      timestamp: performance.now(), // Use high-precision timestamp
      decision: destinationPort 
        ? `✅ MAC table lookup: Found ${frame.destinationMac.address} on port ${destinationPort}. Can forward directly (unicast).`
        : `❓ MAC table lookup: ${frame.destinationMac.address} not found in MAC table (${this.macAddressTable.length} entries). Must flood to learn location.`,
      macTableUsed: destinationPort ? this.macAddressTable.find(e => e.macAddress.address === frame.destinationMac.address) : undefined,
    };
    this.packetTracer.addTrace(lookupTrace);

    if (destinationPort) {
      console.log(`🔍 Switch ${this.name}: Forwarding unicast to port ${destinationPort}`);
      await this.forwardFrame(frame, destinationPort, incomingInterface);
    } else {
      console.log(`🔍 Switch ${this.name}: FLOODING frame - destination MAC ${frame.destinationMac.address} not in MAC table`);
      await this.floodFrame(frame, incomingInterface);
    }
  }

  // MAC Address Learning with detailed tracing
  private learnMACAddressWithTrace(sourceMac: MACAddress, port: string, frame: EthernetFrame): boolean {
    const existingEntry = this.macAddressTable.find(
      entry => entry.macAddress.address === sourceMac.address
    );

    let wasNewlyLearned = false;
    let learningTrace: PacketTrace;

    if (existingEntry) {
      // Update existing entry
      const portChanged = existingEntry.port !== port;
      existingEntry.port = port;
      existingEntry.age = 0;
      
      learningTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'switch',
        action: 'processed',
        incomingInterface: port,
        packet: frame, // Use the actual frame for proper trace display
        timestamp: performance.now(), // Use high-precision timestamp
        decision: portChanged 
          ? `🔄 MAC learning: Updated ${sourceMac.address} location to port ${port} (previously on different port). MAC table now has ${this.macAddressTable.length} entries.`
          : `✅ MAC learning: Confirmed ${sourceMac.address} still on port ${port}. Entry refreshed in MAC table.`,
      };
      console.log(`🔍 Switch ${this.name}: Updated MAC ${sourceMac.address} on port ${port}`);
    } else {
      // Add new entry
      const newEntry: MACTableEntry = {
        macAddress: sourceMac,
        port,
        vlan: 1, // Default VLAN
        age: 0,
        type: 'dynamic',
      };
      
      this.macAddressTable.push(newEntry);
      wasNewlyLearned = true;
      
      learningTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'switch',
        action: 'processed',
        incomingInterface: port,
        packet: frame,
        timestamp: performance.now(), // Use high-precision timestamp
        decision: `📚 MAC learning: NEW device learned! ${sourceMac.address} is connected to port ${port}. MAC table now has ${this.macAddressTable.length} entries.`,
      };
      console.log(`🔍 Switch ${this.name}: Learned NEW MAC ${sourceMac.address} on port ${port}`);
    }

    this.packetTracer.addTrace(learningTrace);
    return wasNewlyLearned;
  }

  private generateFrameId(): string {
    return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // MAC Address Learning (legacy method kept for compatibility)
  private learnMACAddress(sourceMac: MACAddress, port: string): void {
    // Create a simple frame for compatibility
    const frame: EthernetFrame = {
      id: this.generateFrameId(),
      sourceMac: sourceMac,
      destinationMac: { address: 'ff:ff:ff:ff:ff:ff' },
      etherType: 0x0800,
      payload: {} as any,
      timestamp: performance.now(), // Use high-precision timestamp
    };
    this.learnMACAddressWithTrace(sourceMac, port, frame);
  }

  // MAC Address Lookup
  private lookupMACAddress(destinationMac: MACAddress): string | null {
    const entry = this.macAddressTable.find(
      entry => entry.macAddress.address === destinationMac.address
    );
    return entry ? entry.port : null;
  }

  // Frame Forwarding
  private async forwardFrame(frame: EthernetFrame, outgoingPort: string, incomingPort: string): Promise<void> {
    // Don't send frame back out the same port it came in on
    if (outgoingPort === incomingPort) {
      const loopTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'switch',
        action: 'dropped',
        incomingInterface: incomingPort,
        packet: frame,
        timestamp: performance.now(), // Use high-precision timestamp
        decision: `❌ Loop prevention: Cannot forward frame back out same port (${outgoingPort}). This prevents Layer 2 loops and broadcast storms.`,
      };
      this.packetTracer.addTrace(loopTrace);
      return;
    }

    // Get protocol information for educational trace
    const protocolInfo = frame.etherType === 0x0800 ? 'IPv4' : 
                        frame.etherType === 0x0806 ? 'ARP' : 
                        `Protocol 0x${frame.etherType.toString(16)}`;

    const forwardTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'switch',
      action: 'forwarded',
      incomingInterface: incomingPort,
      outgoingInterface: outgoingPort,
      packet: frame,
      timestamp: performance.now(), // Use high-precision timestamp
      decision: `🚀 Unicast forwarding: Sending ${protocolInfo} frame to ${frame.destinationMac.address} via port ${outgoingPort}. Layer 2 switching complete - no routing needed.`,
      macTableUsed: this.macAddressTable.find(e => e.macAddress.address === frame.destinationMac.address),
    };
    this.packetTracer.addTrace(forwardTrace);

    // Simulate transmission to connected device
    await this.transmitFrame(frame, outgoingPort);
  }

  // Frame Flooding (Broadcast/Multicast/Unknown Unicast)
  private async floodFrame(frame: EthernetFrame, incomingPort: string): Promise<void> {
    const activePorts = this.interfaces.filter(
      iface => iface.isUp && iface.name !== incomingPort && iface.connectedTo
    );

    // Determine the reason for flooding
    const floodReason = frame.destinationMac.address === 'ff:ff:ff:ff:ff:ff' 
      ? 'BROADCAST destination (ARP request, DHCP, etc.)'
      : frame.destinationMac.address.startsWith('01:00:5e') 
        ? 'MULTICAST destination (group communication)'
        : 'UNKNOWN UNICAST (destination not in MAC table)';

    // Get protocol information for educational trace
    const protocolInfo = frame.etherType === 0x0800 ? 'IPv4' : 
                        frame.etherType === 0x0806 ? 'ARP' : 
                        `Protocol 0x${frame.etherType.toString(16)}`;

    const floodTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'switch',
      action: 'forwarded',
      incomingInterface: incomingPort,
      packet: frame,
      timestamp: performance.now(), // Use high-precision timestamp
      decision: `🌊 Flooding ${protocolInfo} frame: ${floodReason}. Sending to ${activePorts.length} connected ports (excluding ${incomingPort}): ${activePorts.map(p => p.name).join(', ')}.`,
    };
    this.packetTracer.addTrace(floodTrace);

    // Send frame out all active ports except the incoming port
    for (const port of activePorts) {
      // Add individual transmission trace for each port (useful for complex topologies)
      const transmissionTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'switch',
        action: 'generated',
        outgoingInterface: port.name,
        packet: frame,
        timestamp: performance.now(), // Use high-precision timestamp
        decision: `📤 Transmitting flooded ${protocolInfo} frame out port ${port.name} to ${port.connectedTo && typeof port.connectedTo === 'object' && 'deviceName' in port.connectedTo ? (port.connectedTo as any).deviceName : 'connected device'}.`,
      };
      this.packetTracer.addTrace(transmissionTrace);
      
      await this.transmitFrame(frame, port.name);
    }
  }

  // VLAN Management
  createVLAN(vlanId: number, name: string): void {
    if (this.vlans.find(v => v.id === vlanId)) {
      throw new Error(`VLAN ${vlanId} already exists`);
    }
    
    this.vlans.push({
      id: vlanId,
      name,
      ports: [],
    });
  }

  assignPortToVLAN(portName: string, vlanId: number): void {
    const vlan = this.vlans.find(v => v.id === vlanId);
    if (!vlan) {
      throw new Error(`VLAN ${vlanId} does not exist`);
    }

    const port = this.interfaces.find(i => i.name === portName);
    if (!port) {
      throw new Error(`Port ${portName} does not exist`);
    }

    // Remove port from all VLANs first
    this.vlans.forEach(v => {
      v.ports = v.ports.filter(p => p !== portName);
    });

    // Add to target VLAN
    vlan.ports.push(portName);

    // Update MAC table entries for this port
    this.macAddressTable.forEach(entry => {
      if (entry.port === portName) {
        entry.vlan = vlanId;
      }
    });
  }

  // Spanning Tree Protocol (Simplified)
  enableSpanningTree(): void {
    this.spanningTreeEnabled = true;
    // In a real implementation, this would start STP calculations
    console.log(`Spanning Tree Protocol enabled on switch ${this.name}`);
  }

  disableSpanningTree(): void {
    this.spanningTreeEnabled = false;
    console.log(`Spanning Tree Protocol disabled on switch ${this.name}`);
  }

  // MAC Address Table Management
  private startMACAddressAging(): void {
    this.ageTimer = setInterval(() => {
      this.ageOutMACAddresses();
    }, 60000); // Check every minute
  }

  private ageOutMACAddresses(): void {
    const before = this.macAddressTable.length;
    
    this.macAddressTable = this.macAddressTable.filter(entry => {
      entry.age += 60; // Increment age by 60 seconds
      return entry.type === 'static' || entry.age < this.MAC_AGE_TIME;
    });

    const after = this.macAddressTable.length;
    if (before !== after) {
      console.log(`Switch ${this.name}: Aged out ${before - after} MAC addresses`);
    }
  }

  clearMACTable(): void {
    this.macAddressTable = this.macAddressTable.filter(entry => entry.type === 'static');
    console.log(`Switch ${this.name}: Dynamic MAC addresses cleared`);
  }

  // Debugging method to manually learn a MAC address
  public learnMAC(macAddress: MACAddress, port: string): void {
    this.learnMACAddress(macAddress, port);
  }

  addStaticMACEntry(mac: MACAddress, port: string, vlan: number = 1): void {
    // Remove any existing entry for this MAC
    this.macAddressTable = this.macAddressTable.filter(
      entry => entry.macAddress.address !== mac.address
    );

    const staticEntry: MACTableEntry = {
      macAddress: mac,
      port,
      vlan,
      age: 0,
      type: 'static',
    };

    this.macAddressTable.push(staticEntry);
  }

  // Helper Methods
  private isBroadcastOrMulticast(mac: MACAddress): boolean {
    const macLower = mac.address.toLowerCase();
    
    // Broadcast
    if (macLower === 'ff:ff:ff:ff:ff:ff') {
      return true;
    }
    
    // Standard multicast ranges (more precise than just LSB check)
    // IPv4 multicast: 01:00:5e:xx:xx:xx
    if (macLower.startsWith('01:00:5e:')) {
      return true;
    }
    
    // IPv6 multicast: 33:33:xx:xx:xx:xx  
    if (macLower.startsWith('33:33:')) {
      return true;
    }
    
    // Don't treat randomly generated unicast MACs as multicast
    // Only use LSB check for well-known multicast ranges
    return false;
  }

  private async transmitFrame(frame: EthernetFrame, outgoingPort: string): Promise<void> {
    console.log(`Switch ${this.name} transmitting frame on port ${outgoingPort}:`, {
      src: frame.sourceMac.address,
      dst: frame.destinationMac.address,
      type: NetworkStack.parseEtherType(frame.etherType)
    });

    // Use callback to send frame through the network simulator
    if (this.transmitCallback) {
      await this.transmitCallback(frame, this.id, outgoingPort);
    }
  }

  // Device Status Methods
  shutdown(): void {
    this.status = 'down';
    this.interfaces.forEach(i => i.isUp = false);
    if (this.ageTimer) {
      clearInterval(this.ageTimer);
      this.ageTimer = null;
    }
  }

  startup(): void {
    this.status = 'up';
    this.interfaces.forEach(i => i.isUp = true);
    this.startMACAddressAging();
  }

  // Port Management
  shutdownPort(portName: string): void {
    const port = this.interfaces.find(i => i.name === portName);
    if (port) {
      port.isUp = false;
      // Remove MAC entries learned on this port
      this.macAddressTable = this.macAddressTable.filter(
        entry => entry.port !== portName || entry.type === 'static'
      );
      console.log(`Switch ${this.name}: Port ${portName} shutdown`);
    }
  }

  bringUpPort(portName: string): void {
    const port = this.interfaces.find(i => i.name === portName);
    if (port) {
      port.isUp = true;
      console.log(`Switch ${this.name}: Port ${portName} brought up`);
    }
  }

  // Information Display
  showMACTable(): MACTableEntry[] {
    return [...this.macAddressTable];
  }

  showVLANs(): VLAN[] {
    return [...this.vlans];
  }

  showPortStatus(): { port: string; status: string; vlan: number; speed: number }[] {
    return this.interfaces.map(iface => {
      const vlan = this.vlans.find(v => v.ports.includes(iface.name));
      return {
        port: iface.name,
        status: iface.isUp ? 'up' : 'down',
        vlan: vlan?.id || 1,
        speed: iface.speed,
      };
    });
  }

  getStatus(): string {
    const activePorts = this.interfaces.filter(i => i.isUp).length;
    return `Switch ${this.name} (${this.status}) - Ports: ${activePorts}/${this.interfaces.length} up - MAC entries: ${this.macAddressTable.length}`;
  }

  // Get all packet traces from this device
  getTraces(): PacketTrace[] {
    return this.packetTracer.getTraces();
  }

  // Clear packet traces from this device  
  clearTraces(): void {
    this.packetTracer.clearTraces();
  }
}