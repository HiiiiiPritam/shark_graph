import { Host } from './devices/Host';
import { Switch } from './devices/Switch';
import { Router } from './devices/Router';
import {
  NetworkDevice,
  NetworkLink,
  NetworkTopology,
  EthernetFrame,
  PacketTrace,
  SimulationEvent,
  IPAddress,
  MACAddress,
} from './types';
import { NetworkStack } from './protocols/NetworkStack';

export class NetworkSimulator {
  private devices: Map<string, Host | Switch | Router> = new Map();
  private links: Map<string, NetworkLink> = new Map();
  private events: SimulationEvent[] = [];
  private isRunning: boolean = false;
  private eventCounter: number = 0;

  constructor() {
    console.log('Network Simulator initialized');
  }

  // Device Management
  addHost(id: string, name: string, position: { x: number; y: number } = { x: 0, y: 0 }): Host {
    if (this.devices.has(id)) {
      throw new Error(`Device with ID ${id} already exists`);
    }

    const host = new Host(id, name, position);
    host.setTransmitCallback(this.forwardFrame.bind(this));
    this.devices.set(id, host);
    
    this.addEvent({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'device_up',
      deviceId: id,
      details: { type: 'host', name },
    });

    console.log(`Added host: ${name} (${id})`);
    return host;
  }

  addSwitch(id: string, name: string, portCount: number = 24, position: { x: number; y: number } = { x: 0, y: 0 }): Switch {
    if (this.devices.has(id)) {
      throw new Error(`Device with ID ${id} already exists`);
    }

    const switchDevice = new Switch(id, name, portCount, position);
    switchDevice.setTransmitCallback(this.forwardFrame.bind(this));
    this.devices.set(id, switchDevice);
    
    this.addEvent({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'device_up',
      deviceId: id,
      details: { type: 'switch', name, portCount },
    });

    console.log(`Added switch: ${name} (${id}) with ${portCount} ports`);
    return switchDevice;
  }

  addRouter(id: string, name: string, position: { x: number; y: number } = { x: 0, y: 0 }): Router {
    if (this.devices.has(id)) {
      throw new Error(`Device with ID ${id} already exists`);
    }

    const router = new Router(id, name, position);
    router.setTransmitCallback(this.forwardFrame.bind(this));
    this.devices.set(id, router);
    
    this.addEvent({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'device_up',
      deviceId: id,
      details: { type: 'router', name },
    });

    console.log(`Added router: ${name} (${id})`);
    return router;
  }

  removeDevice(id: string): void {
    const device = this.devices.get(id);
    if (!device) {
      throw new Error(`Device with ID ${id} not found`);
    }

    // Remove all links connected to this device
    const connectedLinks = Array.from(this.links.values()).filter(
      link => link.deviceA === id || link.deviceB === id
    );

    for (const link of connectedLinks) {
      this.removeLink(link.id);
    }

    // Shutdown device
    device.shutdown();
    this.devices.delete(id);
    
    this.addEvent({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'device_down',
      deviceId: id,
      details: { reason: 'removed' },
    });

    console.log(`Removed device: ${device.name} (${id})`);
  }

  // Link Management
  createLink(
    deviceA: string,
    interfaceA: string,
    deviceB: string,
    interfaceB: string,
    bandwidth: number = 100,
    latency: number = 1
  ): NetworkLink {
    const devA = this.devices.get(deviceA);
    const devB = this.devices.get(deviceB);

    if (!devA || !devB) {
      throw new Error('One or both devices not found');
    }

    const ifaceA = devA.interfaces.find(i => i.name === interfaceA);
    const ifaceB = devB.interfaces.find(i => i.name === interfaceB);

    if (!ifaceA || !ifaceB) {
      throw new Error('One or both interfaces not found');
    }

    const linkId = `${deviceA}-${interfaceA}_${deviceB}-${interfaceB}`;
    
    const link: NetworkLink = {
      id: linkId,
      deviceA,
      interfaceA,
      deviceB,
      interfaceB,
      bandwidth,
      latency,
      isUp: true,
      utilization: 0,
    };

    // Update interface connections
    ifaceA.connectedTo = `${deviceB}-${interfaceB}`;
    ifaceB.connectedTo = `${deviceA}-${interfaceA}`;

    this.links.set(linkId, link);
    console.log(`Created link: ${deviceA}:${interfaceA} <-> ${deviceB}:${interfaceB}`);
    
    return link;
  }

  removeLink(linkId: string): void {
    const link = this.links.get(linkId);
    if (!link) {
      throw new Error(`Link with ID ${linkId} not found`);
    }

    const devA = this.devices.get(link.deviceA);
    const devB = this.devices.get(link.deviceB);

    if (devA && devB) {
      const ifaceA = devA.interfaces.find(i => i.name === link.interfaceA);
      const ifaceB = devB.interfaces.find(i => i.name === link.interfaceB);

      if (ifaceA) ifaceA.connectedTo = undefined;
      if (ifaceB) ifaceB.connectedTo = undefined;
    }

    this.links.delete(linkId);
    console.log(`Removed link: ${linkId}`);
  }

  // Network Configuration
  configureHostIP(hostId: string, interfaceName: string, ipAddress: string, subnetMask: string): void {
    const host = this.devices.get(hostId);
    if (!host || host.type !== 'host') {
      throw new Error('Host not found');
    }

    const ip: IPAddress = { address: ipAddress, subnet: subnetMask };
    (host as Host).configureInterface(interfaceName, ip);
    
    console.log(`Configured ${hostId}:${interfaceName} with IP ${ipAddress}/${NetworkStack.getPrefixLength(subnetMask)}`);
  }

  configureRouterIP(routerId: string, interfaceName: string, ipAddress: string, subnetMask: string): void {
    const router = this.devices.get(routerId);
    if (!router || router.type !== 'router') {
      throw new Error('Router not found');
    }

    const ip: IPAddress = { address: ipAddress, subnet: subnetMask };
    (router as Router).configureInterface(interfaceName, ip);
    
    console.log(`Configured ${routerId}:${interfaceName} with IP ${ipAddress}/${NetworkStack.getPrefixLength(subnetMask)}`);
  }

  setDefaultGateway(hostId: string, gatewayIP: string): void {
    const host = this.devices.get(hostId);
    if (!host || host.type !== 'host') {
      throw new Error('Host not found');
    }

    const gateway: IPAddress = { address: gatewayIP, subnet: '' };
    (host as Host).setDefaultGateway(gateway);
    
    console.log(`Set default gateway for ${hostId} to ${gatewayIP}`);
  }

  addStaticRoute(routerId: string, destination: string, subnetMask: string, nextHop: string, interfaceName: string): void {
    const router = this.devices.get(routerId);
    if (!router || router.type !== 'router') {
      throw new Error('Router not found');
    }

    const destIP: IPAddress = { address: destination, subnet: subnetMask };
    const nextHopIP: IPAddress = { address: nextHop, subnet: '' };
    
    (router as Router).addRoute(destIP, subnetMask, nextHopIP, interfaceName);
    
    console.log(`Added static route: ${destination}/${NetworkStack.getPrefixLength(subnetMask)} via ${nextHop} on ${routerId}`);
  }

  // Simulation Operations
  async ping(sourceHostId: string, destinationIP: string): Promise<PacketTrace[]> {
    const sourceHost = this.devices.get(sourceHostId);
    if (!sourceHost || sourceHost.type !== 'host') {
      throw new Error('Source host not found');
    }

    console.log(`\n🏓 Starting ping from ${sourceHost.name} to ${destinationIP}`);
    
    try {
      const traces = await (sourceHost as Host).sendPing(destinationIP);
      
      // Simulate packet traveling through the network
      await this.simulatePacketFlow(traces);
      
      this.addEvent({
        id: this.generateEventId(),
        timestamp: Date.now(),
        type: 'packet_sent',
        deviceId: sourceHostId,
        details: { 
          type: 'ping', 
          destination: destinationIP, 
          success: traces.length > 0 
        },
      });

      return traces;
    } catch (error) {
      console.error(`Ping failed: ${error}`);
      return [];
    }
  }

  private async simulatePacketFlow(traces: PacketTrace[]): Promise<void> {
    // Enhanced packet flow simulation with proper routing support
    const processedHops = new Set<string>();
    
    for (let i = 0; i < traces.length; i++) {
      const trace = traces[i];
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log(`Step ${trace.stepNumber}: ${trace.deviceName} - ${trace.decision}`);
      
      // Skip if we've already processed this hop to avoid loops
      const hopKey = `${trace.deviceId}-${trace.outgoingInterface}`;
      if (processedHops.has(hopKey)) {
        continue;
      }
      processedHops.add(hopKey);
      
      if (trace.outgoingInterface && trace.action === 'forwarded') {
        // Find connected device and forward packet
        const sourceDevice = this.devices.get(trace.deviceId);
        if (sourceDevice) {
          const connectedLink = this.findLinkByInterface(trace.deviceId, trace.outgoingInterface);
          if (connectedLink) {
            const targetDeviceId = connectedLink.deviceA === trace.deviceId ? 
              connectedLink.deviceB : connectedLink.deviceA;
            const targetInterface = connectedLink.deviceA === trace.deviceId ? 
              connectedLink.interfaceB : connectedLink.interfaceA;
            
            const targetDevice = this.devices.get(targetDeviceId);
            if (targetDevice) {
              console.log(`Forwarding from ${trace.deviceName} to ${targetDevice.name} via ${trace.outgoingInterface}->${targetInterface}`);
              
              // Forward packet to next device
              if (targetDevice.type === 'host') {
                await (targetDevice as Host).receiveFrame(trace.packet, targetInterface);
              } else if (targetDevice.type === 'switch') {
                await (targetDevice as Switch).receiveFrame(trace.packet, targetInterface);
              } else if (targetDevice.type === 'router') {
                const routerTraces = await (targetDevice as Router).receiveFrame(trace.packet, targetInterface);
                traces.push(...routerTraces);
              }
            }
          } else {
            console.log(`No link found for ${trace.deviceName}:${trace.outgoingInterface}`);
          }
        }
      }
    }
  }

  // Network Analysis
  analyzeNetworkTopology(): {
    deviceCount: { hosts: number; switches: number; routers: number };
    linkCount: number;
    networkSegments: string[];
    potentialIssues: string[];
  } {
    const devices = Array.from(this.devices.values());
    
    const deviceCount = {
      hosts: devices.filter(d => d.type === 'host').length,
      switches: devices.filter(d => d.type === 'switch').length,
      routers: devices.filter(d => d.type === 'router').length,
    };

    const linkCount = this.links.size;
    
    // Analyze network segments
    const networkSegments: string[] = [];
    const potentialIssues: string[] = [];

    devices.forEach(device => {
      if (device.type === 'router') {
        const router = device as Router;
        router.interfaces.forEach(iface => {
          if (iface.ipAddress) {
            const network = NetworkStack.calculateNetworkAddress(iface.ipAddress.address, iface.ipAddress.subnet);
            const segment = `${network}/${NetworkStack.getPrefixLength(iface.ipAddress.subnet)}`;
            if (!networkSegments.includes(segment)) {
              networkSegments.push(segment);
            }
          }
        });
      }
    });

    // Check for potential issues
    if (deviceCount.hosts > 0 && deviceCount.routers === 0) {
      potentialIssues.push('No routers found - hosts may not be able to communicate across subnets');
    }

    if (linkCount === 0) {
      potentialIssues.push('No links configured - devices are isolated');
    }

    const unconnectedDevices = devices.filter(device => 
      !device.interfaces.some(iface => iface.connectedTo)
    );
    
    if (unconnectedDevices.length > 0) {
      potentialIssues.push(`${unconnectedDevices.length} devices are not connected to the network`);
    }

    return {
      deviceCount,
      linkCount,
      networkSegments,
      potentialIssues,
    };
  }

  traceroute(sourceHostId: string, destinationIP: string): PacketTrace[] {
    // Simplified traceroute implementation
    // In a real implementation, this would send packets with incrementing TTL values
    console.log(`Traceroute from ${sourceHostId} to ${destinationIP}`);
    return [];
  }

  // Topology Management
  getTopology(): NetworkTopology {
    return {
      devices: Array.from(this.devices.values()) as NetworkDevice[],
      links: Array.from(this.links.values()),
      lastModified: Date.now(),
    };
  }

  saveTopology(): string {
    const topology = this.getTopology();
    return JSON.stringify(topology, null, 2);
  }

  loadTopology(topologyData: string): void {
    try {
      const topology: NetworkTopology = JSON.parse(topologyData);
      
      // Clear existing network
      this.clear();
      
      // Recreate devices
      for (const device of topology.devices) {
        if (device.type === 'host') {
          this.addHost(device.id, device.name, device.position);
        } else if (device.type === 'switch') {
          this.addSwitch(device.id, device.name, device.interfaces.length, device.position);
        } else if (device.type === 'router') {
          this.addRouter(device.id, device.name, device.position);
        }
        
        // Configure interfaces
        const newDevice = this.devices.get(device.id);
        if (newDevice) {
          device.interfaces.forEach(iface => {
            if (iface.ipAddress) {
              if (newDevice.type === 'host') {
                (newDevice as Host).configureInterface(iface.name, iface.ipAddress);
              } else if (newDevice.type === 'router') {
                (newDevice as Router).configureInterface(iface.name, iface.ipAddress);
              }
            }
          });
        }
      }
      
      // Recreate links
      for (const link of topology.links) {
        this.createLink(
          link.deviceA,
          link.interfaceA,
          link.deviceB,
          link.interfaceB,
          link.bandwidth,
          link.latency
        );
      }
      
      console.log('Topology loaded successfully');
    } catch (error) {
      console.error('Failed to load topology:', error);
      throw new Error('Invalid topology data');
    }
  }

  // Utility Methods
  getDevice(id: string): Host | Switch | Router | undefined {
    return this.devices.get(id);
  }

  getLink(id: string): NetworkLink | undefined {
    return this.links.get(id);
  }

  getAllDevices(): (Host | Switch | Router)[] {
    return Array.from(this.devices.values());
  }

  getAllLinks(): NetworkLink[] {
    return Array.from(this.links.values());
  }

  // Forward frame from one device to connected device
  private async forwardFrame(frame: EthernetFrame, fromDevice: string, outgoingInterface: string): Promise<void> {
    const link = this.findLinkByInterface(fromDevice, outgoingInterface);
    if (!link) {
      console.log(`No link found for ${fromDevice}:${outgoingInterface}`);
      return;
    }

    // Determine target device and interface
    const targetDeviceId = link.deviceA === fromDevice ? link.deviceB : link.deviceA;
    const targetInterface = link.deviceA === fromDevice ? link.interfaceB : link.interfaceA;
    
    const targetDevice = this.devices.get(targetDeviceId);
    if (!targetDevice) {
      console.log(`Target device ${targetDeviceId} not found`);
      return;
    }

    console.log(`Forwarding frame from ${fromDevice}:${outgoingInterface} to ${targetDeviceId}:${targetInterface}`);

    // Forward frame to target device
    try {
      if (targetDevice.type === 'host') {
        await (targetDevice as Host).receiveFrame(frame, targetInterface);
      } else if (targetDevice.type === 'switch') {
        await (targetDevice as Switch).receiveFrame(frame, targetInterface);
      } else if (targetDevice.type === 'router') {
        const traces = await (targetDevice as Router).receiveFrame(frame, targetInterface);
        // Router might generate additional traces, but we don't need to handle them here
        // as the router will use its own callback to forward packets
      }
    } catch (error) {
      console.error(`Error forwarding frame to ${targetDeviceId}:`, error);
    }
  }

  private findLinkByInterface(deviceId: string, interfaceName: string): NetworkLink | null {
    for (const link of this.links.values()) {
      if ((link.deviceA === deviceId && link.interfaceA === interfaceName) ||
          (link.deviceB === deviceId && link.interfaceB === interfaceName)) {
        return link;
      }
    }
    return null;
  }

  private addEvent(event: SimulationEvent): void {
    this.events.push(event);
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  private generateEventId(): string {
    return `evt_${++this.eventCounter}_${Date.now()}`;
  }

  getEvents(): SimulationEvent[] {
    return [...this.events];
  }

  clear(): void {
    // Shutdown all devices
    for (const device of this.devices.values()) {
      device.shutdown();
    }
    
    this.devices.clear();
    this.links.clear();
    this.events = [];
    this.eventCounter = 0;
    
    console.log('Network simulation cleared');
  }

  start(): void {
    this.isRunning = true;
    console.log('Network simulation started');
  }

  stop(): void {
    this.isRunning = false;
    console.log('Network simulation stopped');
  }

  getStatus(): {
    isRunning: boolean;
    deviceCount: number;
    linkCount: number;
    eventCount: number;
  } {
    return {
      isRunning: this.isRunning,
      deviceCount: this.devices.size,
      linkCount: this.links.size,
      eventCount: this.events.length,
    };
  }
}