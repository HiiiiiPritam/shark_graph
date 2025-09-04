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
    host.setSimulator(this);
    this.devices.set(id, host);
    
    this.addEvent({
      id: this.generateEventId(),
      timestamp: performance.now(),
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
      timestamp: performance.now(),
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
    router.setSimulator(this);
    this.devices.set(id, router);
    
    this.addEvent({
      id: this.generateEventId(),
      timestamp: performance.now(),
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
      timestamp: performance.now(),
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
    interfaceB: string
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
      isUp: true,
    };

    // Update interface connections with proper object format
    ifaceA.connectedTo = { deviceId: deviceB, interfaceName: interfaceB };
    ifaceB.connectedTo = { deviceId: deviceA, interfaceName: interfaceA };

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

  // Helper method to configure multi-router topology with proper routing
  configureMultiRouterNetwork(routers: string[]): void {
    // This method can be used to automatically configure routing between multiple routers
    // For complex topologies, you'd need to call this after setting up interfaces
    console.log(`Configuring multi-router network with ${routers.length} routers`);
    
    routers.forEach(routerId => {
      const router = this.devices.get(routerId);
      if (router?.type === 'router') {
        console.log(`Router ${router.name}: ${(router as Router).showRoutingTable().length} routes configured`);
      }
    });
  }


  // Removed centralized trace collection - now using device-level traces only

  // Collect all traces from all devices
  private getAllTracesFromDevices(): PacketTrace[] {
    const allTraces: PacketTrace[] = [];
    
    console.log(`📋 TRACE COLLECTION: Starting trace collection from ${this.devices.size} devices`);
    
    for (const [deviceId, device] of this.devices.entries()) {
      if (device.type === 'host') {
        const host = device as Host;
        const hostTraces = host.getTraces();
        console.log(`📋 TRACE COLLECTION: Host ${device.name} (${deviceId}) has ${hostTraces.length} traces`);
        hostTraces.forEach((trace, idx) => {
          console.log(`📋   Host trace ${idx + 1}: Step ${trace.stepNumber} - ${trace.action} - ${trace.decision?.substring(0, 80)}...`);
        });
        allTraces.push(...hostTraces);
      } else if (device.type === 'router') {
        const router = device as Router;
        const routerTraces = router.getTraces();
        console.log(`📋 TRACE COLLECTION: Router ${device.name} (${deviceId}) has ${routerTraces.length} traces`);
        routerTraces.forEach((trace, idx) => {
          console.log(`📋   Router trace ${idx + 1}: Step ${trace.stepNumber} - ${trace.action} - ${trace.decision?.substring(0, 80)}...`);
        });
        allTraces.push(...routerTraces);
      } else if (device.type === 'switch') {
        const switchDevice = device as Switch;
        const switchTraces = switchDevice.getTraces();
        console.log(`📋 TRACE COLLECTION: Switch ${device.name} (${deviceId}) has ${switchTraces.length} traces`);
        switchTraces.forEach((trace, idx) => {
          console.log(`📋   Switch trace ${idx + 1}: Step ${trace.stepNumber} - ${trace.action} - ${trace.decision?.substring(0, 80)}...`);
        });
        allTraces.push(...switchTraces);
      }
    }
    
    console.log(`📋 TRACE COLLECTION: Total collected ${allTraces.length} traces from all devices`);
    
    // Enhanced sorting: Primary by timestamp with better handling for async operations
    const sortedTraces = allTraces.sort((a, b) => {
      // Primary: Sort by timestamp (most important)
      const timestampDiff = a.timestamp - b.timestamp;
      if (Math.abs(timestampDiff) > 0.00001) { // If timestamps differ by more than 0.1ms
        return timestampDiff;
      }
      
      // Secondary: For nearly simultaneous events, use device type priority
      // This ensures logical flow: host → switch → router
      const deviceTypePriority = { 'host': 1, 'switch': 2, 'router': 3 };
      const aPriority = deviceTypePriority[a.deviceType as keyof typeof deviceTypePriority] || 4;
      const bPriority = deviceTypePriority[b.deviceType as keyof typeof deviceTypePriority] || 4;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Tertiary: Use action type priority for same device type
      const actionPriority = { 
        'generated': 1, 'forwarded': 2, 'processed': 3, 'dropped': 4 
      };
      const aActionPriority = actionPriority[a.action as keyof typeof actionPriority] || 5;
      const bActionPriority = actionPriority[b.action as keyof typeof actionPriority] || 5;
      
      return aActionPriority - bActionPriority;
    });
    
    // Renumber traces sequentially for proper step numbering
    sortedTraces.forEach((trace, index) => {
      const oldStep = trace.stepNumber;
      trace.stepNumber = index + 1;
      console.log(`📋 TRACE REORDER: Step ${oldStep} (${trace.deviceName}) → Step ${trace.stepNumber}`);
    });
    
    console.log(`📋 TRACE COLLECTION: After enhanced sorting and renumbering, returning ${sortedTraces.length} traces`);
    console.log(`📋 TRACE COLLECTION: Final order:`, sortedTraces.slice(0, 5).map(t => `Step ${t.stepNumber}: ${t.deviceName} - ${t.action} (${t.timestamp})`));
    
    return sortedTraces;
  }

  // Clear all traces from all devices
  private clearAllDeviceTraces(): void {
    for (const device of this.devices.values()) {
      if (device.type === 'host') {
        const host = device as Host;
        host.clearTraces();
      } else if (device.type === 'router') {
        const router = device as Router;
        router.clearTraces();
      } else if (device.type === 'switch') {
        const switchDevice = device as Switch;
        switchDevice.clearTraces();
      }
    }
  }

  // Helper method to find destination host by IP
  private findDestinationHost(destinationIP: string): Host | null {
    const hosts = Array.from(this.devices.values()).filter(d => d.type === 'host') as Host[];
    return hosts.find(host => 
      host.interfaces.some(iface => iface.ipAddress?.address === destinationIP)
    ) || null;
  }

  // Helper method to determine communication scenario
  private determineCommunicationScenario(sourceIP: string, destIP: string): 'same-network' | 'different-networks' | 'unknown' {
    const sourceHost = Array.from(this.devices.values())
      .find(device => device.type === 'host' && 
        device.interfaces.some(iface => iface.ipAddress?.address === sourceIP)) as Host;
    
    if (!sourceHost?.interfaces[0]?.ipAddress) return 'unknown';
    
    const sourceNetwork = NetworkStack.calculateNetworkAddress(
      sourceHost.interfaces[0].ipAddress.address,
      sourceHost.interfaces[0].ipAddress.subnet
    );
    
    const destNetwork = NetworkStack.calculateNetworkAddress(
      destIP,
      sourceHost.interfaces[0].ipAddress.subnet
    );
    
    return sourceNetwork === destNetwork ? 'same-network' : 'different-networks';
  }

  // Simulation Operations
  async ping(sourceHostId: string, destinationIP: string): Promise<PacketTrace[]> {
    const sourceHost = this.devices.get(sourceHostId);
    if (!sourceHost || sourceHost.type !== 'host') {
      throw new Error('Source host not found');
    }

    console.log(`\n🏓 PING: Starting ping from ${sourceHost.name} to ${destinationIP}`);
    
    try {
      // Clear traces from all devices
      console.log(`🏓 PING: Clearing traces from all devices before ping`);
      this.clearAllDeviceTraces();
      
      const sourceIP = (sourceHost as Host).interfaces[0]?.ipAddress?.address || '';
      const scenario = this.determineCommunicationScenario(sourceIP, destinationIP);
      
      console.log(`🏓 PING: Communication scenario: ${scenario}`);
      console.log(`🏓 PING: Sending ping from ${sourceHost.name} (${sourceIP}) to ${destinationIP}`);
      
      // Trigger the ping (echo request)
      await (sourceHost as Host).sendPing(destinationIP);
      
      console.log(`🏓 PING: Ping sent, waiting for network processing...`);
      // Wait for network processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`🏓 PING: Network processing complete, collecting traces...`);
      // Collect all traces from all devices 
      const allTraces = this.getAllTracesFromDevices();
      
      console.log(`🏓 PING: Collection complete - ${allTraces.length} total traces from all devices`);
      console.log(`🏓 PING: Trace details:`, allTraces.map(t => `${t.deviceName}: ${t.action} - ${t.decision?.substring(0, 50)}...`));
      
      this.addEvent({
        id: this.generateEventId(),
        timestamp: performance.now(),
        type: 'packet_sent',
        deviceId: sourceHostId,
        details: { 
          type: 'ping', 
          destination: destinationIP, 
          success: allTraces.length > 0,
          scenario
        },
      });

      console.log(`🏓 PING: Returning ${allTraces.length} traces to UI`);
      return allTraces;
    } catch (error) {
      console.error(`🏓 PING: Failed - ${error}`);
      return [];
    }
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
          link.interfaceB
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

    console.log(`🔄 Forwarding frame from ${fromDevice}:${outgoingInterface} to ${targetDeviceId}:${targetInterface}`);

    // NO CENTRALIZED TRACE COLLECTION - Let each device handle its own detailed traces
    // This allows the detailed step-by-step traces from switches and routers to be preserved
    
    // Forward frame to target device (devices will create their own detailed traces)
    try {
      if (targetDevice.type === 'host') {
        console.log(`📥 Forwarding to HOST: ${targetDevice.name}`);
        await (targetDevice as Host).receiveFrame(frame, targetInterface);
      } else if (targetDevice.type === 'switch') {
        console.log(`🔀 Forwarding to SWITCH: ${targetDevice.name}`);
        await (targetDevice as Switch).receiveFrame(frame, targetInterface);
      } else if (targetDevice.type === 'router') {
        console.log(`🛤️  Forwarding to ROUTER: ${targetDevice.name}`);
        await (targetDevice as Router).receiveFrame(frame, targetInterface);
      }
      
      console.log(`✅ Frame forwarded to ${targetDevice.name} successfully`);
      
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
