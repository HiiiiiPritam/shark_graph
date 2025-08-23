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

    const trace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'switch',
      action: 'received',
      incomingInterface,
      packet: frame,
      timestamp: Date.now(),
      decision: `Frame received on port ${incomingInterface}`,
    };
    
    this.packetTracer.addTrace(trace);

    // 1. Learn source MAC address
    this.learnMACAddress(frame.sourceMac, incomingInterface);

    // 2. Check if destination is broadcast or multicast
    if (this.isBroadcastOrMulticast(frame.destinationMac)) {
      await this.floodFrame(frame, incomingInterface);
      return;
    }

    // 3. Look up destination MAC in MAC address table
    const destinationPort = this.lookupMACAddress(frame.destinationMac);

    if (destinationPort) {
      // Unicast - forward to specific port
      await this.forwardFrame(frame, destinationPort, incomingInterface);
    } else {
      // Unknown unicast - flood to all ports except incoming
      const floodTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'switch',
        action: 'forwarded',
        incomingInterface,
        packet: frame,
        timestamp: Date.now(),
        decision: `Unknown destination MAC ${frame.destinationMac.address} - flooding to all ports`,
      };
      this.packetTracer.addTrace(floodTrace);
      
      await this.floodFrame(frame, incomingInterface);
    }
  }

  // MAC Address Learning
  private learnMACAddress(sourceMac: MACAddress, port: string): void {
    const existingEntry = this.macAddressTable.find(
      entry => entry.macAddress.address === sourceMac.address
    );

    if (existingEntry) {
      // Update existing entry
      existingEntry.port = port;
      existingEntry.age = 0;
      
      const updateTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'switch',
        action: 'received',
        packet: {} as EthernetFrame, // Placeholder
        timestamp: Date.now(),
        decision: `Updated MAC table: ${sourceMac.address} moved to port ${port}`,
        macTableUsed: existingEntry,
      };
      this.packetTracer.addTrace(updateTrace);
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
      
      const learnTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'switch',
        action: 'received',
        packet: {} as EthernetFrame, // Placeholder
        timestamp: Date.now(),
        decision: `Learned new MAC: ${sourceMac.address} on port ${port}`,
        macTableUsed: newEntry,
      };
      this.packetTracer.addTrace(learnTrace);
    }
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
        timestamp: Date.now(),
        decision: `Dropped frame - would create loop (incoming and outgoing port same: ${outgoingPort})`,
      };
      this.packetTracer.addTrace(loopTrace);
      return;
    }

    const forwardTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'switch',
      action: 'forwarded',
      incomingInterface: incomingPort,
      outgoingInterface: outgoingPort,
      packet: frame,
      timestamp: Date.now(),
      decision: `Forwarding to ${frame.destinationMac.address} via port ${outgoingPort}`,
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

    const floodTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'switch',
      action: 'forwarded',
      incomingInterface: incomingPort,
      packet: frame,
      timestamp: Date.now(),
      decision: `Flooding frame to ${activePorts.length} ports (excluding incoming port ${incomingPort})`,
    };
    this.packetTracer.addTrace(floodTrace);

    // Send frame out all active ports except the incoming port
    for (const port of activePorts) {
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
    // Broadcast
    if (mac.address.toLowerCase() === 'ff:ff:ff:ff:ff:ff') {
      return true;
    }
    
    // Multicast (least significant bit of first octet is 1)
    const firstOctet = parseInt(mac.address.split(':')[0], 16);
    return (firstOctet & 1) === 1;
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
}