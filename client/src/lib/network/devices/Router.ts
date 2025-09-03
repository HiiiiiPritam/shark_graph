import {
  Router as RouterInterface,
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
  AccessList,
  RIPConfig,
  OSPFConfig,
} from '../types';
import { PacketTracer } from '../protocols/PacketTracer';
import { NetworkStack } from '../protocols/NetworkStack';

export class Router implements RouterInterface {
  id: string;
  name: string;
  type: 'router' = 'router';
  interfaces: NetworkInterface[];
  position: { x: number; y: number };
  isConfigured: boolean;
  status: 'up' | 'down';
  routingTable: RouteEntry[];
  arpTable: ARPEntry[];
  routingProtocols: ('static' | 'rip' | 'ospf')[];
  accessLists: AccessList[];
  
  private packetTracer: PacketTracer;
  private ripConfig: RIPConfig;
  private ospfConfig: OSPFConfig;
  private ripTimer: NodeJS.Timeout | null = null;
  private arpTimer: NodeJS.Timeout | null = null;
  private transmitCallback?: (frame: EthernetFrame, fromDevice: string, outgoingInterface: string) => Promise<void>;
  private simulator?: any;
  
  private readonly ARP_TIMEOUT = 240; // 4 minutes
  private readonly RIP_UPDATE_INTERVAL = 30; // 30 seconds

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
    this.routingTable = [];
    this.arpTable = [];
    this.routingProtocols = ['static'];
    this.accessLists = [];
    
    this.packetTracer = new PacketTracer();
    
    this.ripConfig = {
      enabled: false,
      version: 2,
      networks: [],
      updateInterval: this.RIP_UPDATE_INTERVAL,
    };
    
    this.ospfConfig = {
      enabled: false,
      processId: 1,
      routerId: { address: '0.0.0.0', subnet: '' },
      areas: [],
    };

    // Add default interfaces for routers
    this.addInterface('Fa0/0', NetworkStack.generateRandomMAC());
    this.addInterface('Fa0/1', NetworkStack.generateRandomMAC());

    this.startARPAging();
  }

  // Set callback for transmitting frames to simulator
  setTransmitCallback(callback: (frame: EthernetFrame, fromDevice: string, outgoingInterface: string) => Promise<void>): void {
    this.transmitCallback = callback;
  }

  // Set simulator reference for trace collection
  setSimulator(simulator: any): void {
    this.simulator = simulator;
  }

  // Helper method to find device by IP address in the simulator
  private findDeviceByIP(ipAddress: string): HostInterface | RouterInterface | null {
    if (!this.simulator) return null;
    
    try {
      const allDevices = this.simulator.getAllDevices();
      for (const device of allDevices) {
        if (device.type === 'host' || device.type === 'router') {
          const networkDevice = device as HostInterface | RouterInterface;
          for (const iface of networkDevice.interfaces) {
            if (iface.ipAddress?.address === ipAddress) {
              return networkDevice;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error finding device by IP:', error);
    }
    
    return null;
  }

  // Interface Management
  addInterface(name: string, macAddress: MACAddress, ipAddress?: IPAddress): void {
    const newInterface: NetworkInterface = {
      id: `${this.id}-${name}`,
      name,
      macAddress,
      ipAddress,
      isUp: true,
      speed: 1000, // 1 Gbps default for routers
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

  // Packet Processing - Core Router Functionality
  async receiveFrame(frame: EthernetFrame, incomingInterface: string): Promise<void> {
    console.log(`🛤️ Router ${this.name}: *** RECEIVEFRAME CALLED *** Received frame on ${incomingInterface}`);
    if (this.status === 'down') return;

    // Check if frame is for us (MAC address check)
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

  // IP Packet Processing
  async processIPPacket(ipPacket: IPPacket, incomingInterface: string): Promise<void> {
    // Decrement TTL for routing loop prevention
    ipPacket.timeToLive--;
    
    if (ipPacket.timeToLive <= 0) {
      await this.sendICMPTimeExceeded(ipPacket, incomingInterface);
      return;
    }

    // Check if packet is for us
    const isForUs = this.interfaces.some(i => 
      i.ipAddress?.address === ipPacket.destinationIP.address
    );

    if (isForUs) {
      // Process packet destined for router
      if (ipPacket.protocol === 1) {
        // ICMP
        await this.processICMPPacket(ipPacket.payload as ICMPPacket, ipPacket, incomingInterface);
      }
      // Add support for other protocols (RIP, OSPF) here
      return;
    }

    // Forward packet (routing)
    await this.forwardIPPacket(ipPacket, incomingInterface);
  }

  // IP Packet Forwarding
  async forwardIPPacket(ipPacket: IPPacket, incomingInterface: string): Promise<void> {
    console.log(`🛤️ Router ${this.name}: Forwarding packet from ${ipPacket.sourceIP.address} to ${ipPacket.destinationIP.address}`);
    console.log(`🛤️ Router ${this.name}: Received on interface: ${incomingInterface}`);
    
    // Find best route
    const route = this.findBestRoute(ipPacket.destinationIP);
    
    if (!route) {
      // No route to destination - add detailed trace for debugging
      const noRouteTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'router',
        action: 'dropped',
        incomingInterface,
        packet: { id: '', sourceMac: { address: '' }, destinationMac: { address: '' }, etherType: 0x0800, payload: ipPacket, timestamp: performance.now() },
        timestamp: performance.now(),
        decision: `No route to destination ${ipPacket.destinationIP.address}. Available routes: ${this.routingTable.map(r => `${r.destinationNetwork.address}/${NetworkStack.getPrefixLength(r.subnetMask)}`).join(', ')}`,
      };
      this.packetTracer.addTrace(noRouteTrace);
      
      console.error(`🛤️ Router ${this.name}: No route to ${ipPacket.destinationIP.address}`);
      console.error(`🛤️ Router ${this.name}: Available routes:`, this.routingTable.map(r => 
        `${r.destinationNetwork.address}/${NetworkStack.getPrefixLength(r.subnetMask)} via ${r.nextHop.address} on ${r.interface}`
      ));
      
      await this.sendICMPDestinationUnreachable(ipPacket, incomingInterface);
      return;
    }

    const outgoingInterface = this.interfaces.find(i => i.name === route.interface);
    if (!outgoingInterface?.ipAddress) {
      throw new Error(`Outgoing interface ${route.interface} not configured`);
    }

    // Determine next hop IP
    let nextHopIP: IPAddress;
    if (route.nextHop.address === '0.0.0.0') {
      // Directly connected - use destination IP
      nextHopIP = ipPacket.destinationIP;
    } else {
      // Use next hop
      nextHopIP = route.nextHop;
    }

    // Get next hop MAC address via ARP
    let nextHopMAC = this.findInARPTable(nextHopIP);
    if (!nextHopMAC) {
      nextHopMAC = await this.sendARPRequest(nextHopIP, route.interface);
    }

    // Create new Ethernet frame
    const newFrame: EthernetFrame = {
      id: this.generateFrameId(),
      sourceMac: outgoingInterface.macAddress,
      destinationMac: nextHopMAC,
      etherType: 0x0800,
      payload: ipPacket,
      timestamp: performance.now(), // Use high-precision timestamp
    };

    console.log(`🛤️ Router ${this.name}: Selected route - Outgoing interface: ${route.interface}, Next hop: ${nextHopIP.address}`);
    console.log(`🛤️ Router ${this.name}: Forwarding from ${incomingInterface} → ${route.interface}`);

    const forwardTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'router',
      action: 'forwarded',
      incomingInterface,
      outgoingInterface: route.interface,
      packet: newFrame,
      timestamp: performance.now(), // Use high-precision timestamp
      decision: `Forwarded to ${ipPacket.destinationIP.address} via ${route.interface} (received on ${incomingInterface})`,
      routingTableUsed: route,
    };
    this.packetTracer.addTrace(forwardTrace);

    // Transmit frame
    await this.transmitFrame(newFrame, route.interface);
  }

  // Routing Table Management
  addRoute(destination: IPAddress, subnetMask: string, nextHop: IPAddress, interfaceName: string, metric: number = 1, protocol: 'static' | 'rip' | 'ospf' = 'static'): void {
    // Remove existing route to same destination
    this.routingTable = this.routingTable.filter(route => 
      !(route.destinationNetwork.address === destination.address && 
        route.subnetMask === subnetMask)
    );

    const newRoute: RouteEntry = {
      destinationNetwork: destination,
      subnetMask,
      nextHop,
      interface: interfaceName,
      metric,
      protocol,
    };

    this.routingTable.push(newRoute);
    this.sortRoutingTable();
  }

  removeRoute(destination: IPAddress, subnetMask: string): void {
    this.routingTable = this.routingTable.filter(route => 
      !(route.destinationNetwork.address === destination.address && 
        route.subnetMask === subnetMask)
    );
  }

  private addConnectedRoute(ip: IPAddress, interfaceName: string): void {
    const networkAddress = this.getNetworkAddress(ip);
    this.addRoute(networkAddress, ip.subnet, { address: '0.0.0.0', subnet: '' }, interfaceName, 0, 'static');
  }

  private findBestRoute(destination: IPAddress): RouteEntry | null {
    let bestRoute: RouteEntry | null = null;
    let longestPrefix = -1;
    let lowestMetric = Infinity;

    console.log(`🔍 Router ${this.name}: Finding route to ${destination.address}`);
    console.log(`🔍 Router ${this.name}: Routing table has ${this.routingTable.length} entries`);

    for (const route of this.routingTable) {
      const isMatch = this.isIPInNetwork(destination, route.destinationNetwork, route.subnetMask);
      console.log(`🔍   Route: ${route.destinationNetwork.address}/${NetworkStack.getPrefixLength(route.subnetMask)} via ${route.nextHop.address} - Match: ${isMatch}`);
      
      if (isMatch) {
        const prefixLength = NetworkStack.getPrefixLength(route.subnetMask);
        
        // Longest prefix match, then lowest metric
        if (prefixLength > longestPrefix || 
            (prefixLength === longestPrefix && route.metric < lowestMetric)) {
          longestPrefix = prefixLength;
          lowestMetric = route.metric;
          bestRoute = route;
          console.log(`🔍   New best route found: /${prefixLength} metric ${route.metric}`);
        }
      }
    }

    if (bestRoute) {
      console.log(`🔍 Router ${this.name}: Best route to ${destination.address}: ${bestRoute.destinationNetwork.address}/${NetworkStack.getPrefixLength(bestRoute.subnetMask)} via ${bestRoute.nextHop.address} on ${bestRoute.interface}`);
    } else {
      console.log(`🔍 Router ${this.name}: No route found to ${destination.address}`);
    }

    return bestRoute;
  }

  private sortRoutingTable(): void {
    this.routingTable.sort((a, b) => {
      // Sort by prefix length (longest first), then by metric (lowest first)
      const prefixLengthA = NetworkStack.getPrefixLength(a.subnetMask);
      const prefixLengthB = NetworkStack.getPrefixLength(b.subnetMask);
      
      if (prefixLengthA !== prefixLengthB) {
        return prefixLengthB - prefixLengthA;
      }
      
      return a.metric - b.metric;
    });
  }

  // ARP Implementation
  async sendARPRequest(targetIP: IPAddress, outgoingInterface: string): Promise<MACAddress> {
    const sourceInterface = this.interfaces.find(i => i.name === outgoingInterface);
    if (!sourceInterface?.ipAddress) {
      throw new Error(`Interface ${outgoingInterface} not configured`);
    }

    // Check if interface is connected
    if (!sourceInterface.connectedTo) {
      throw new Error(`Interface ${outgoingInterface} is not connected to any device`);
    }

    // Clear any existing ARP entry for this IP to avoid duplicates
    this.arpTable = this.arpTable.filter(e => e.ipAddress.address !== targetIP.address);

    const arpRequest: ARPPacket = {
      hardwareType: 1,
      protocolType: 0x0800,
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
      timestamp: performance.now(),
    };

    const arpTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'router',
      action: 'generated',
      outgoingInterface,
      packet: frame,
      timestamp: performance.now(),
      decision: `ARP Request: Who has ${targetIP.address}? Tell ${sourceInterface.ipAddress.address}`,
    };
    this.packetTracer.addTrace(arpTrace);

    // Send the ARP request through the network
    await this.transmitFrame(frame, outgoingInterface);

    // Wait for ARP reply - check ARP table periodically until we get a response
    const maxWaitTime = 5000; // 5 seconds maximum wait
    const checkInterval = 50; // Check every 50ms
    let waitedTime = 0;
    let targetMac: MACAddress | null = null;

    console.log(`🔍 Router ${this.name}: Waiting for ARP reply for ${targetIP.address}...`);
    
    while (waitedTime < maxWaitTime && !targetMac) {
      // Check if we received an ARP reply (processARPPacket would have updated our table)
      targetMac = this.findInARPTable(targetIP);
      
      if (!targetMac) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitedTime += checkInterval;
      }
    }

    if (!targetMac) {
      // If we still don't have the MAC after waiting, try the simulator fallback
      console.warn(`⚠️ Router ${this.name}: ARP timeout for ${targetIP.address}, trying simulator fallback`);
      
      if (this.simulator) {
        const targetDevice = this.findDeviceByIP(targetIP.address);
        if (targetDevice) {
          const targetInterface = targetDevice.interfaces.find(i => i.ipAddress?.address === targetIP.address);
          if (targetInterface) {
            targetMac = targetInterface.macAddress;
            console.log(`🔧 Router ${this.name}: Found MAC via simulator fallback: ${targetMac.address}`);
          }
        }
      }

      // Final fallback - generate random MAC (should rarely happen)
      if (!targetMac) {
        targetMac = NetworkStack.generateRandomMAC();
        console.error(`❌ Router ${this.name}: Could not resolve MAC for ${targetIP.address}, using generated MAC: ${targetMac.address}`);
      }

      // Add to ARP table since we got it via fallback
      this.addARPEntry(targetIP, targetMac, outgoingInterface);
    }
    
    console.log(`✅ Router ${this.name}: ARP resolution complete for ${targetIP.address} -> ${targetMac.address}`);
    return targetMac;
  }

  async processARPPacket(arpPacket: ARPPacket, incomingInterface: string): Promise<void> {
    console.log(`Router ${this.name} processing ARP ${arpPacket.operation === 1 ? 'request' : 'reply'} for ${arpPacket.targetProtocolAddress.address}`);
    
    if (arpPacket.operation === 1) {
      // ARP Request - check if it's for us
      const ourInterface = this.interfaces.find(i => 
        i.name === incomingInterface && 
        i.ipAddress?.address === arpPacket.targetProtocolAddress.address
      );

      if (ourInterface) {
        console.log(`Router ${this.name} sending ARP reply to ${arpPacket.senderProtocolAddress.address}`);
        
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
          timestamp: performance.now(),
        };

        // Add our entry to ARP table first
        this.addARPEntry(
          arpPacket.senderProtocolAddress,
          arpPacket.senderHardwareAddress,
          incomingInterface
        );

        const arpReplyTrace: PacketTrace = {
          stepNumber: this.packetTracer.getNextStepNumber(),
          deviceId: this.id,
          deviceName: this.name,
          deviceType: 'router',
          action: 'generated',
          outgoingInterface: incomingInterface,
          packet: frame,
          timestamp: performance.now(),
          decision: `ARP Reply: ${ourInterface.ipAddress!.address} is at ${ourInterface.macAddress.address}`,
        };
        this.packetTracer.addTrace(arpReplyTrace);

        await this.transmitFrame(frame, incomingInterface);
      } else {
        console.log(`Router ${this.name} ignoring ARP request for ${arpPacket.targetProtocolAddress.address} (not for us)`);
      }
    } else if (arpPacket.operation === 2) {
      // ARP Reply - update our ARP table
      console.log(`Router ${this.name} received ARP reply: ${arpPacket.senderProtocolAddress.address} -> ${arpPacket.senderHardwareAddress.address}`);
      this.addARPEntry(
        arpPacket.senderProtocolAddress,
        arpPacket.senderHardwareAddress,
        incomingInterface
      );
    }
  }

  // ICMP Implementation
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
        protocol: 1,
        headerChecksum: 0,
        sourceIP: sourceInterface.ipAddress,
        destinationIP: ipPacket.sourceIP,
        payload: echoReply,
        timestamp: performance.now(), // Use high-precision timestamp
      };

      const pingReplyTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'router',
        action: 'generated',
        outgoingInterface: incomingInterface,
        packet: { id: '', sourceMac: { address: '' }, destinationMac: { address: '' }, etherType: 0x0800, payload: replyPacket, timestamp: performance.now() },
        timestamp: performance.now(), // Use high-precision timestamp
        decision: `Generated ICMP Echo Reply to ${ipPacket.sourceIP.address}`,
      };
      this.packetTracer.addTrace(pingReplyTrace);

      // Route the reply back
      await this.forwardIPPacket(replyPacket, incomingInterface);
    }
  }

  async sendICMPDestinationUnreachable(originalPacket: IPPacket, incomingInterface: string): Promise<void> {
    const sourceInterface = this.interfaces.find(i => i.name === incomingInterface);
    if (!sourceInterface?.ipAddress) return;

    const icmpPacket: ICMPPacket = {
      type: 3, // Destination Unreachable
      code: 0, // Network Unreachable
      checksum: 0,
      identifier: 0,
      sequenceNumber: 0,
      data: 'Network Unreachable',
    };

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
      protocol: 1,
      headerChecksum: 0,
      sourceIP: sourceInterface.ipAddress,
      destinationIP: originalPacket.sourceIP,
      payload: icmpPacket,
      timestamp: performance.now(), // Use high-precision timestamp
    };

    await this.forwardIPPacket(replyPacket, incomingInterface);
  }

  async sendICMPTimeExceeded(originalPacket: IPPacket, incomingInterface: string): Promise<void> {
    const sourceInterface = this.interfaces.find(i => i.name === incomingInterface);
    if (!sourceInterface?.ipAddress) return;

    const icmpPacket: ICMPPacket = {
      type: 11, // Time Exceeded
      code: 0, // TTL Exceeded
      checksum: 0,
      identifier: 0,
      sequenceNumber: 0,
      data: 'TTL Exceeded',
    };

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
      protocol: 1,
      headerChecksum: 0,
      sourceIP: sourceInterface.ipAddress,
      destinationIP: originalPacket.sourceIP,
      payload: icmpPacket,
      timestamp: performance.now(), // Use high-precision timestamp
    };

    const ttlTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'router',
      action: 'generated',
      packet: { id: '', sourceMac: { address: '' }, destinationMac: { address: '' }, etherType: 0x0800, payload: replyPacket, timestamp: performance.now() },
      timestamp: performance.now(), // Use high-precision timestamp
      decision: `Generated ICMP Time Exceeded - TTL expired for packet to ${originalPacket.destinationIP.address}`,
    };
    this.packetTracer.addTrace(ttlTrace);

    await this.forwardIPPacket(replyPacket, incomingInterface);
  }

  // RIP Protocol (Simplified Implementation)
  enableRIP(version: 1 | 2 = 2, networks: string[] = []): void {
    this.ripConfig.enabled = true;
    this.ripConfig.version = version;
    this.ripConfig.networks = networks;
    
    if (!this.routingProtocols.includes('rip')) {
      this.routingProtocols.push('rip');
    }

    // Start RIP updates
    this.startRIPUpdates();
  }

  disableRIP(): void {
    this.ripConfig.enabled = false;
    this.routingProtocols = this.routingProtocols.filter(p => p !== 'rip');
    
    if (this.ripTimer) {
      clearInterval(this.ripTimer);
      this.ripTimer = null;
    }

    // Remove RIP routes
    this.routingTable = this.routingTable.filter(route => route.protocol !== 'rip');
  }

  private startRIPUpdates(): void {
    this.ripTimer = setInterval(() => {
      this.sendRIPUpdates();
    }, this.ripConfig.updateInterval * 1000);
  }

  private async sendRIPUpdates(): Promise<void> {
    // Send RIP updates on all configured interfaces
    for (const iface of this.interfaces) {
      if (iface.isUp && iface.ipAddress) {
        await this.sendRIPUpdate(iface.name);
      }
    }
  }

  private async sendRIPUpdate(interfaceName: string): Promise<void> {
    // Simplified RIP update - would contain routing table in real implementation
    console.log(`Router ${this.name}: Sending RIP update on ${interfaceName}`);
  }

  // Helper Methods
  private findInARPTable(ip: IPAddress): MACAddress | null {
    const entry = this.arpTable.find(e => e.ipAddress.address === ip.address);
    return entry ? entry.macAddress : null;
  }

  private addARPEntry(ip: IPAddress, mac: MACAddress, interfaceName: string): void {
    try {
      // Remove existing entry to prevent duplicates
      this.arpTable = this.arpTable.filter(e => e.ipAddress.address !== ip.address);
      
      // Add new entry with consistent structure
      this.arpTable.push({
        ipAddress: ip,
        macAddress: mac,
        interface: interfaceName,
        type: 'dynamic',
        age: 0,
      });
      
      console.log(`${this.name}: Added ARP entry - ${ip.address} -> ${mac.address}`);
    } catch (error) {
      console.error(`${this.name}: Error adding ARP entry:`, error);
    }
  }

  private startARPAging(): void {
    this.arpTimer = setInterval(() => {
      this.ageOutARPEntries();
    }, 60000); // Check every minute
  }

  private ageOutARPEntries(): void {
    const before = this.arpTable.length;
    
    this.arpTable = this.arpTable.filter(entry => {
      entry.age += 60; // Increment age by 60 seconds
      return entry.type === 'static' || entry.age < this.ARP_TIMEOUT;
    });

    const after = this.arpTable.length;
    if (before !== after) {
      console.log(`Router ${this.name}: Aged out ${before - after} ARP entries`);
    }
  }

  // Utility Methods
  private isIPInNetwork(ip: IPAddress, network: IPAddress, subnetMask: string): boolean {
    return NetworkStack.isInSameNetwork(ip.address, network.address, subnetMask);
  }

  private getNetworkAddress(ip: IPAddress): IPAddress {
    return {
      address: NetworkStack.calculateNetworkAddress(ip.address, ip.subnet),
      subnet: ip.subnet,
    };
  }

  private generatePacketId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateFrameId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async transmitFrame(frame: EthernetFrame, outgoingInterface: string): Promise<void> {
    console.log(`Router ${this.name} transmitting frame on ${outgoingInterface}:`, {
      src: frame.sourceMac.address,
      dst: frame.destinationMac.address,
      type: NetworkStack.parseEtherType(frame.etherType)
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
    
    if (this.ripTimer) {
      clearInterval(this.ripTimer);
      this.ripTimer = null;
    }
    
    if (this.arpTimer) {
      clearInterval(this.arpTimer);
      this.arpTimer = null;
    }
  }

  startup(): void {
    this.status = 'up';
    this.interfaces.forEach(i => i.isUp = true);
    this.startARPAging();
    
    if (this.ripConfig.enabled) {
      this.startRIPUpdates();
    }
  }

  // Information Display
  showRoutingTable(): RouteEntry[] {
    return [...this.routingTable];
  }

  showARPTable(): ARPEntry[] {
    return [...this.arpTable];
  }

  showInterfaces(): { name: string; ip: string; status: string; mac: string }[] {
    return this.interfaces.map(iface => ({
      name: iface.name,
      ip: iface.ipAddress?.address || 'unassigned',
      status: iface.isUp ? 'up' : 'down',
      mac: iface.macAddress.address,
    }));
  }

  getStatus(): string {
    const activeInterfaces = this.interfaces.filter(i => i.isUp).length;
    const protocols = this.routingProtocols.join(', ');
    return `Router ${this.name} (${this.status}) - Interfaces: ${activeInterfaces}/${this.interfaces.length} up - Routes: ${this.routingTable.length} - Protocols: ${protocols}`;
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