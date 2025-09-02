import {
  Host as HostInterface,
  Router as RouterInterface,
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
    
    console.log(`🔧 Host ${this.name}: Configuring ${interfaceName} with IP ${ipAddress.address}/${NetworkStack.getPrefixLength(ipAddress.subnet)}`);
    
    iface.ipAddress = ipAddress;
    this.addConnectedRoute(ipAddress, interfaceName);
    
    console.log(`🔧 Host ${this.name}: After configuration, routing table has ${this.routingTable.length} entries`);
    this.routingTable.forEach((route, index) => {
      console.log(`🔧   Route ${index + 1}: ${route.destinationNetwork.address}/${NetworkStack.getPrefixLength(route.subnetMask)} via ${route.nextHop.address} on ${route.interface} (${route.protocol})`);
    });
    
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
    console.log(`🖥️ Host ${this.name}: *** RECEIVEFRAME CALLED *** Received frame on ${incomingInterface}`);
    if (this.status === 'down') return;

    // Check if frame is for us
    const iface = this.interfaces.find(i => i.name === incomingInterface);
    if (!iface) return;

    const isForUs = frame.destinationMac.address === iface.macAddress.address ||
                    frame.destinationMac.address === 'ff:ff:ff:ff:ff:ff'; // Broadcast

    console.log(`🔍 Host ${this.name}: Received frame on ${incomingInterface}`);
    console.log(`🔍 Frame dest MAC: ${frame.destinationMac.address}, Host MAC: ${iface.macAddress.address}`);
    console.log(`🔍 Is frame for us? ${isForUs}`);

    if (!isForUs) {
      // Not for us, drop it
      console.log(`🔍 Host ${this.name}: Dropping frame - not for us`);
      return;
    }
    
    console.log(`🔍 Host ${this.name}: Processing frame - it's for us!`);

    // Process based on EtherType
    if (frame.etherType === 0x0806) {
      // ARP
      await this.processARPPacket(frame.payload as ARPPacket, incomingInterface);
    } else if (frame.etherType === 0x0800) {
      // IPv4
      await this.processIPPacket(frame.payload as IPPacket, incomingInterface);
    }
  }

  // Set simulator reference for trace collection
  setSimulator(simulator: any): void {
    this.simulator = simulator;
  }

  private simulator?: any;

  async sendPing(destinationIP: string): Promise<void> {
    const dest: IPAddress = { address: destinationIP, subnet: '' };
    
    const sourceInterface = this.interfaces[0];
    if (!sourceInterface?.ipAddress) {
      throw new Error('No configured IP address');
    }

    console.log(`🏓 Host ${this.name}: Starting ping to ${destinationIP}`);
    console.log(`🏓 Host ${this.name}: Source interface: ${sourceInterface.name} with IP ${sourceInterface.ipAddress.address}`);
    
    const connectionInfo = sourceInterface.connectedTo 
      ? (typeof sourceInterface.connectedTo === 'object' 
         ? `${sourceInterface.connectedTo.deviceId}:${sourceInterface.connectedTo.interfaceName}` 
         : sourceInterface.connectedTo)
      : 'nothing';
    console.log(`🏓 Host ${this.name}: Connected to: ${connectionInfo}`);

    // Use proper routing logic - find next hop using routing table
    const nextHop = this.findNextHop(dest);
    if (!nextHop) {
      throw new Error(`No route to destination ${destinationIP}. Check routing table and default gateway configuration.`);
    }

    console.log(`🏓 Host ${this.name}: Next hop for ${destinationIP} is ${nextHop.address}`);

    // Add trace for routing decision
    const routeTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'host',
      action: 'generated',
      outgoingInterface: sourceInterface.name,
      packet: {} as any,
      timestamp: performance.now(),
      decision: `Routing decision: Next hop for ${destinationIP} is ${nextHop.address}`,
    };
    this.packetTracer.addTrace(routeTrace);

    // Check ARP table for next hop MAC address
    let targetMAC = this.findInARPTable(nextHop);
    
    if (!targetMAC) {
      console.log(`🏓 Host ${this.name}: ARP resolution needed for ${nextHop.address}`);
      // Need ARP resolution - this will automatically trace via sendARPRequest
      targetMAC = await this.sendARPRequest(nextHop, sourceInterface.name);
    }

    // Create ICMP Echo Request
    const icmpPacket: ICMPPacket = {
      type: 8, // Echo Request
      code: 0,
      checksum: 0,
      identifier: Math.floor(Math.random() * 65536),
      sequenceNumber: 1,
      data: 'Hello from ' + this.name,
    };

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
      timestamp: performance.now(), // Use high-precision timestamp
    };

    // Verify we have a target MAC address
    if (!targetMAC) {
      throw new Error(`Failed to resolve MAC address for ${nextHopIP}`);
    }

    // Create Ethernet frame with resolved MAC
    const frame: EthernetFrame = {
      id: this.generateFrameId(),
      sourceMac: sourceInterface.macAddress,
      destinationMac: targetMAC,
      etherType: 0x0800, // IPv4
      payload: ipPacket,
      timestamp: performance.now(), // Use high-precision timestamp
    };

    // Add final transmission trace
    const pingTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'host',
      action: 'generated',
      outgoingInterface: sourceInterface.name,
      packet: frame,
      timestamp: performance.now(), // Use high-precision timestamp
      decision: `Generated ICMP Echo Request to ${destinationIP}`,
    };
    console.log(`📋 Host ${this.name}: Adding ping trace - Step ${pingTrace.stepNumber}`);
    this.packetTracer.addTrace(pingTrace);
    console.log(`📋 Host ${this.name}: After adding trace, total traces = ${this.packetTracer.getTraces().length}`);

    // Send frame to connected device
    await this.transmitFrame(frame, sourceInterface.name);
  }

  async sendIPPacket(packet: IPPacket, outgoingInterface: string): Promise<void> {
    // Find next hop
    const nextHop = this.findNextHop(packet.destinationIP);
    if (!nextHop) {
      throw new Error(`No route to ${packet.destinationIP.address}`);
    }

    console.log(`Host ${this.name}: Next hop for ${packet.destinationIP.address} is ${nextHop.address}`);

    // Check if this is an echo reply
    const isEchoReply = packet.protocol === 1 && (packet.payload as any)?.type === 0;

    // Determine if destination is on same network or needs routing
    const sourceInterface = this.interfaces.find(i => i.name === outgoingInterface);
    if (!sourceInterface) {
      throw new Error(`Interface ${outgoingInterface} not found`);
    }

    if (isEchoReply && this.simulator?.addTrace) {
      const sameNetwork = sourceInterface.ipAddress && NetworkStack.isInSameNetwork(
        sourceInterface.ipAddress.address,
        packet.destinationIP.address,
        sourceInterface.ipAddress.subnet
      );

      this.simulator.addTrace({
        stepNumber: 0,
        timestamp: performance.now(), // Use high-precision timestamp
        deviceName: this.name,
        deviceId: this.id,
        deviceType: 'host',
        action: '🔄 Echo Reply Route',
        decision: `${this.name} sends ICMP echo reply back to ${packet.destinationIP.address}. ${sameNetwork ? 'Direct delivery on same network.' : 'Routing via gateway ' + nextHop.address}`,
        outgoingInterface: sourceInterface.name,
        packet: {} as any
      });
    }

    // Check ARP table for destination MAC
    let destinationMac = this.findInARPTable(nextHop);
    
    if (!destinationMac) {
      // Send ARP request first
      destinationMac = await this.sendARPRequest(nextHop, outgoingInterface);
    }

    // Create Ethernet frame
    const frame: EthernetFrame = {
      id: this.generateFrameId(),
      sourceMac: sourceInterface.macAddress,
      destinationMac: destinationMac,
      etherType: 0x0800, // IPv4
      payload: packet,
      timestamp: performance.now(), // Use high-precision timestamp
    };

    // Add trace for final transmission of echo reply
    if (isEchoReply && this.simulator?.addTrace) {
      this.simulator.addTrace({
        stepNumber: 0,
        timestamp: performance.now(), // Use high-precision timestamp
        deviceName: this.name,
        deviceId: this.id,
        deviceType: 'host',
        action: '📤 Echo Reply Sent',
        decision: `${this.name} transmits ICMP echo reply packet to ${packet.destinationIP.address}. Layer 2 destination: ${destinationMac.address}. The return path is now established.`,
        outgoingInterface: sourceInterface.name,
        packet: frame
      });
    }

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

    // Clear any existing ARP entry for this IP to avoid duplicates
    this.arpTable = this.arpTable.filter(e => e.ipAddress.address !== targetIP.address);

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
      timestamp: performance.now(), // Use high-precision timestamp
    };

    const arpTrace: PacketTrace = {
      stepNumber: this.packetTracer.getNextStepNumber(),
      deviceId: this.id,
      deviceName: this.name,
      deviceType: 'host',
      action: 'generated',
      outgoingInterface,
      packet: frame,
      timestamp: performance.now(), // Use high-precision timestamp
      decision: `ARP Request: Who has ${targetIP.address}? Tell ${sourceInterface.ipAddress.address}`,
    };
    console.log(`📋 Host ${this.name}: Adding ARP trace - Step ${arpTrace.stepNumber}`);
    this.packetTracer.addTrace(arpTrace);
    console.log(`📋 Host ${this.name}: After adding ARP trace, total traces = ${this.packetTracer.getTraces().length}`);

    // Send the ARP request through the network
    await this.transmitFrame(frame, outgoingInterface);

    // Wait for ARP reply (this should be handled by processARPPacket when reply comes back)
    // For now, we need to find the actual MAC address of the target device
    let targetMac: MACAddress | null = null;
    
    // Try to find the target device in the simulator and get its actual MAC address
    if (this.simulator) {
      const targetDevice = this.findDeviceByIP(targetIP.address);
      if (targetDevice) {
        const targetInterface = targetDevice.interfaces.find(i => i.ipAddress?.address === targetIP.address);
        if (targetInterface) {
          targetMac = targetInterface.macAddress;
        }
      }
    }

    // Fallback to generating a MAC if we can't find the real device (simulation limitation)
    if (!targetMac) {
      targetMac = this.generateMACAddress();
      console.warn(`${this.name}: Could not find real MAC for ${targetIP.address}, using generated MAC`);
    }

    // Simulate small delay for ARP resolution
    await new Promise(resolve => setTimeout(resolve, 50));

    // Add ARP entry with the actual MAC address
    this.addARPEntry(targetIP, targetMac, outgoingInterface);

    return targetMac;
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


  // Process ARP packets (replies)

  // Helper methods


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
          timestamp: performance.now(), // Use high-precision timestamp
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
          deviceType: 'host',
          action: 'generated',
          outgoingInterface: incomingInterface,
          packet: frame,
          timestamp: performance.now(), // Use high-precision timestamp
          decision: `ARP Reply: ${ourInterface.ipAddress!.address} is at ${ourInterface.macAddress.address}`,
        };
        this.packetTracer.addTrace(arpReplyTrace);

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
        packet: { id: '', sourceMac: { address: '' }, destinationMac: { address: '' }, etherType: 0x0800, payload: ipPacket, timestamp: performance.now() },
        timestamp: performance.now(), // Use high-precision timestamp
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
    console.log(`🔍 Host ${this.name}: Processing ICMP packet - Type: ${icmpPacket.type}`);
    console.log(`🔍 Source IP: ${ipPacket.sourceIP.address}, Dest IP: ${ipPacket.destinationIP.address}`);
    
    if (icmpPacket.type === 8) {
      // Echo Request - send Echo Reply
      console.log(`🔍 Host ${this.name}: Received ICMP Echo Request from ${ipPacket.sourceIP.address}`);
      
      // Add trace for receiving ping
      const pingReceivedTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'host',
        action: 'processed',
        incomingInterface,
        packet: {
          id: Math.random().toString(36).substr(2, 9),
          sourceMac: { address: 'received' },
          destinationMac: { address: 'local' },
          etherType: 0x0800,
          payload: ipPacket,
          timestamp: performance.now()
        },
        timestamp: performance.now(), // Use high-precision timestamp
        decision: `Received ICMP Echo Request from ${ipPacket.sourceIP.address}`,
      };
      this.packetTracer.addTrace(pingReceivedTrace);
      
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
        timestamp: performance.now(), // Use high-precision timestamp
      };

      // Determine routing for echo reply (same logic as sendPing)
      const sameNetwork = NetworkStack.isInSameNetwork(
        sourceInterface.ipAddress.address,
        ipPacket.sourceIP.address,
        sourceInterface.ipAddress.subnet
      );

      let nextHopIP: string;
      if (sameNetwork) {
        nextHopIP = ipPacket.sourceIP.address;
      } else {
        if (!this.defaultGateway) {
          console.error(`Host ${this.name}: No default gateway configured for echo reply to ${ipPacket.sourceIP.address}`);
          return;
        }
        nextHopIP = this.defaultGateway.address;
      }

      // Get MAC address for next hop
      let targetMAC = this.findInARPTable({ address: nextHopIP, subnet: '' });
      if (!targetMAC) {
        targetMAC = await this.sendARPRequest({ address: nextHopIP, subnet: '' }, incomingInterface);
      }

      // Create Ethernet frame for echo reply
      const replyFrame: EthernetFrame = {
        id: this.generateFrameId(),
        sourceMac: sourceInterface.macAddress,
        destinationMac: targetMAC,
        etherType: 0x0800,
        payload: replyPacket,
        timestamp: performance.now(), // Use high-precision timestamp
      };

      // Add trace for echo reply
      const replyTrace: PacketTrace = {
        stepNumber: this.packetTracer.getNextStepNumber(),
        deviceId: this.id,
        deviceName: this.name,
        deviceType: 'host',
        action: 'generated',
        outgoingInterface: incomingInterface,
        packet: replyFrame,
        timestamp: performance.now(), // Use high-precision timestamp
        decision: `Generated ICMP Echo Reply to ${ipPacket.sourceIP.address}`,
      };
      this.packetTracer.addTrace(replyTrace);

      // Send the echo reply
      await this.transmitFrame(replyFrame, incomingInterface);
    } else if (icmpPacket.type === 0) {
      // Echo Reply received - ping successful!
      console.log(`🔍 Host ${this.name}: Received ICMP Echo Reply from ${ipPacket.sourceIP.address}`);
      
      if (this.simulator?.addTrace) {
        this.simulator.addTrace({
          stepNumber: 0,
          timestamp: performance.now(), // Use high-precision timestamp
          deviceName: this.name,
          deviceId: this.id,
          deviceType: 'host',
          action: '✅ Ping Successful',
          decision: `${this.name} receives ICMP echo reply from ${ipPacket.sourceIP.address}! 🎉 Round-trip communication successful. The destination is reachable and responding.`,
          incomingInterface: incomingInterface,
          packet: {
            id: Math.random().toString(36).substr(2, 9),
            sourceMac: { address: 'received' },
            destinationMac: { address: 'local' },
            etherType: 0x0800,
            payload: ipPacket,
            timestamp: performance.now()
          }
        });
      }
    }
  }

  // Helper Methods
  private findNextHop(destinationIP: IPAddress): IPAddress | null {
    console.log(`🔍 Host ${this.name}: Finding next hop for ${destinationIP.address}`);
    console.log(`🔍 Host ${this.name}: Routing table has ${this.routingTable.length} entries`);
    
    // Check routing table for best match
    let bestMatch: RouteEntry | null = null;
    let longestPrefix = -1;

    for (const route of this.routingTable) {
      const isMatch = this.isIPInNetwork(destinationIP, route.destinationNetwork, route.subnetMask);
      console.log(`🔍   Route: ${route.destinationNetwork.address}/${NetworkStack.getPrefixLength(route.subnetMask)} via ${route.nextHop.address} on ${route.interface} - Match: ${isMatch}`);
      
      if (isMatch) {
        const prefixLength = NetworkStack.getPrefixLength(route.subnetMask);
        if (prefixLength > longestPrefix) {
          longestPrefix = prefixLength;
          bestMatch = route;
          console.log(`🔍   New best route found: /${prefixLength}`);
        }
      }
    }

    if (bestMatch) {
      console.log(`🔍 Host ${this.name}: Best route to ${destinationIP.address}: ${bestMatch.destinationNetwork.address}/${NetworkStack.getPrefixLength(bestMatch.subnetMask)} via ${bestMatch.nextHop.address} on ${bestMatch.interface}`);
    } else {
      console.log(`🔍 Host ${this.name}: No route found to ${destinationIP.address}`);
      // Show all current routes for debugging
      console.log(`🔍 Host ${this.name}: All routes:`, this.routingTable);
      return null;
    }

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
    try {
      // Remove existing entry
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

  // Get all packet traces from this device
  getTraces(): PacketTrace[] {
    const traces = this.packetTracer.getTraces();
    console.log(`📋 Host ${this.name}: getTraces() returning ${traces.length} traces`);
    if (traces.length > 0) {
      console.log(`📋 Host ${this.name}: Traces:`, traces.map(t => `${t.action}: ${t.decision}`));
    }
    return traces;
  }

  // Clear packet traces from this device  
  clearTraces(): void {
    this.packetTracer.clearTraces();
  }
}