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
  private globalStepCounter: number = 0;

  constructor() {
    console.log('Network Simulator initialized');
  }

  // Global step counter for proper trace ordering
  getNextGlobalStepNumber(): number {
    return ++this.globalStepCounter;
  }

  // Get synchronized timestamp for trace ordering
  getSyncedTimestamp(): number {
    return performance.now();
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

  // Get network topology analysis for complex scenarios
  analyzeComplexTopology(): {
    routerCount: number;
    hostCount: number;
    switchCount: number;
    routingTableSizes: { [routerId: string]: number };
    networkSegments: string[];
    potentialRoutingIssues: string[];
  } {
    const routers = Array.from(this.devices.values()).filter(d => d.type === 'router') as Router[];
    const hosts = Array.from(this.devices.values()).filter(d => d.type === 'host') as Host[];
    const switches = Array.from(this.devices.values()).filter(d => d.type === 'switch');
    
    const routingTableSizes: { [routerId: string]: number } = {};
    const networkSegments: string[] = [];
    const potentialRoutingIssues: string[] = [];

    routers.forEach(router => {
      const routingTable = router.showRoutingTable();
      routingTableSizes[router.id] = routingTable.length;
      
      // Analyze each router's interfaces for network segments
      router.interfaces.forEach(iface => {
        if (iface.ipAddress) {
          const network = NetworkStack.calculateNetworkAddress(iface.ipAddress.address, iface.ipAddress.subnet);
          const segment = `${network}/${NetworkStack.getPrefixLength(iface.ipAddress.subnet)}`;
          if (!networkSegments.includes(segment)) {
            networkSegments.push(segment);
          }
        }
      });

      // Check for potential routing issues
      if (routingTable.length === 0) {
        potentialRoutingIssues.push(`Router ${router.name} has no routes configured`);
      }
      
      const hasDefaultRoute = routingTable.some(route => 
        route.destinationNetwork.address === '0.0.0.0' && route.subnetMask === '0.0.0.0'
      );
      
      if (!hasDefaultRoute && routers.length > 1) {
        potentialRoutingIssues.push(`Router ${router.name} may need a default route for multi-router connectivity`);
      }
    });

    // Check for host gateway configurations
    hosts.forEach(host => {
      if (!host.defaultGateway && routers.length > 0) {
        potentialRoutingIssues.push(`Host ${host.name} should have a default gateway configured`);
      }
    });

    return {
      routerCount: routers.length,
      hostCount: hosts.length,
      switchCount: switches.length,
      routingTableSizes,
      networkSegments,
      potentialRoutingIssues
    };
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
      if (Math.abs(timestampDiff) > 0.1) { // If timestamps differ by more than 0.1ms
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

  // ============================
  // COMPREHENSIVE TOPOLOGY SUPPORT
  // ============================

  /**
   * Validates the entire network topology for common issues
   */
  validateTopology(): { isValid: boolean; issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    console.log('🔍 Validating network topology...');

    // Check for isolated devices
    const isolatedDevices = this.findIsolatedDevices();
    if (isolatedDevices.length > 0) {
      issues.push(`Found ${isolatedDevices.length} isolated devices: ${isolatedDevices.map(d => d.name).join(', ')}`);
      suggestions.push('Connect isolated devices to the network using physical links');
    }

    // Check for hosts without IP addresses
    const hostsWithoutIP = this.findHostsWithoutIP();
    if (hostsWithoutIP.length > 0) {
      issues.push(`Found ${hostsWithoutIP.length} hosts without IP addresses: ${hostsWithoutIP.map(h => h.name).join(', ')}`);
      suggestions.push('Configure IP addresses on hosts using: ip eth0 192.168.1.10 255.255.255.0');
    }

    // Check for missing default gateways
    const hostsWithoutGateway = this.findHostsWithoutGateway();
    if (hostsWithoutGateway.length > 0) {
      issues.push(`Found ${hostsWithoutGateway.length} hosts without default gateway: ${hostsWithoutGateway.map(h => h.name).join(', ')}`);
      suggestions.push('Configure default gateways on hosts using: gateway 192.168.1.1');
    }

    // Check for routing loops
    const routingIssues = this.detectRoutingIssues();
    issues.push(...routingIssues);

    console.log(`✅ Topology validation complete: ${issues.length} issues found`);
    
    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  private findIsolatedDevices(): any[] {
    const isolatedDevices: any[] = [];
    
    for (const device of this.devices.values()) {
      const hasConnections = device.interfaces.some(iface => iface.connectedTo);
      if (!hasConnections) {
        isolatedDevices.push(device);
      }
    }

    return isolatedDevices;
  }

  private findHostsWithoutIP(): Host[] {
    const hostsWithoutIP: Host[] = [];
    
    for (const device of this.devices.values()) {
      if (device.type === 'host') {
        const host = device as Host;
        const hasConfiguredIP = host.interfaces.some(iface => iface.ipAddress);
        if (!hasConfiguredIP) {
          hostsWithoutIP.push(host);
        }
      }
    }

    return hostsWithoutIP;
  }

  private findHostsWithoutGateway(): Host[] {
    const hostsWithoutGateway: Host[] = [];
    
    for (const device of this.devices.values()) {
      if (device.type === 'host') {
        const host = device as Host;
        // This would need to be implemented in Host class
        // For now, we'll assume hosts without proper routing setup
      }
    }

    return hostsWithoutGateway;
  }

  private detectRoutingIssues(): string[] {
    const issues: string[] = [];
    
    // Check each router for basic routing configuration
    for (const device of this.devices.values()) {
      if (device.type === 'router') {
        const router = device as Router;
        
        // Check if router interfaces are properly configured
        const unconfiguredInterfaces = router.interfaces.filter(iface => !iface.ipAddress);
        if (unconfiguredInterfaces.length > 0) {
          issues.push(`Router ${router.name} has unconfigured interfaces: ${unconfiguredInterfaces.map(i => i.name).join(', ')}`);
        }

        // Check for routing table completeness
        const routingTableSize = router.routingTable.length;
        const interfaceCount = router.interfaces.filter(i => i.ipAddress).length;
        
        if (routingTableSize < interfaceCount) {
          issues.push(`Router ${router.name} may need additional static routes for full connectivity`);
        }
      }
    }

    return issues;
  }

  /**
   * Automatically configure common network topologies
   */
  setupTopology(topologyType: 'simple-lan' | 'routed-network' | 'multi-hop', config: any): void {
    console.log(`🛠️ Setting up ${topologyType} topology...`);

    switch (topologyType) {
      case 'simple-lan':
        this.setupSimpleLAN(config);
        break;
      case 'routed-network':
        this.setupRoutedNetwork(config);
        break;
      case 'multi-hop':
        this.setupMultiHopNetwork(config);
        break;
      default:
        throw new Error(`Unknown topology type: ${topologyType}`);
    }

    console.log(`✅ ${topologyType} topology setup complete`);
  }

  private setupSimpleLAN(config: { hostCount: number; switchPorts: number; subnet: string }): void {
    // Create switch
    const switchId = this.addSwitch('switch1', 'LAN-Switch', config.switchPorts, { x: 300, y: 200 });
    
    // Create hosts and connect to switch
    for (let i = 1; i <= config.hostCount; i++) {
      const hostId = this.addHost(`host${i}`, `PC-${i}`, { x: 100 + i * 100, y: 300 });
      
      // Connect host to switch
      this.createLink(hostId.id, 'eth0', switchId.id, `Fa0/${i}`);
      
      // Configure IP address
      const ipAddress = config.subnet.replace('0', i.toString());
      this.configureHostIP(hostId.id, 'eth0', ipAddress, '255.255.255.0');
    }
  }

  private setupRoutedNetwork(config: { subnets: string[]; routerCount: number }): void {
    // Create routers
    const routers = [];
    for (let i = 1; i <= config.routerCount; i++) {
      const routerId = this.addRouter(`router${i}`, `Router-${i}`, { x: 200 + i * 200, y: 200 });
      routers.push(routerId.id);
    }

    // Connect routers in sequence and create subnets
    for (let i = 0; i < routers.length; i++) {
      const routerId = routers[i];
      const subnet = config.subnets[i] || '192.168.' + (i + 1) + '.0';

      // Configure router interface for subnet
      this.configureRouterIP(routerId, 'Fa0/0', subnet.replace('0', '1'), '255.255.255.0');
      
      // Create switch and hosts for this subnet
      const switchId = this.addSwitch(`switch${i + 1}`, `Switch-${i + 1}`, 8, { x: 200 + i * 200, y: 350 });
      this.createLink(routerId, 'Fa0/0', switchId.id, 'Fa0/1');
      
      // Connect routers
      if (i < routers.length - 1) {
        const nextRouter = routers[i + 1];
        const interconnectSubnet = `10.0.${i + 1}.0`;
        
        // Configure inter-router link
        this.configureRouterIP(routerId, 'Fa0/1', interconnectSubnet.replace('0', '1'), '255.255.255.0');
        this.configureRouterIP(nextRouter, 'Fa0/1', interconnectSubnet.replace('0', '2'), '255.255.255.0');
        this.createLink(routerId, 'Fa0/1', nextRouter, 'Fa0/1');
        
        // Add static routes
        this.addStaticRoute(routerId, config.subnets[i + 1] || '192.168.' + (i + 2) + '.0', '255.255.255.0', interconnectSubnet.replace('0', '2'), 'Fa0/1');
        this.addStaticRoute(nextRouter, subnet, '255.255.255.0', interconnectSubnet.replace('0', '1'), 'Fa0/1');
      }
    }
  }

  private setupMultiHopNetwork(config: { hops: number; hostsPerSegment: number }): void {
    // Create a chain of router-switch-router segments
    for (let hop = 0; hop < config.hops; hop++) {
      const routerId = this.addRouter(`router${hop + 1}`, `R${hop + 1}`, { x: hop * 300, y: 200 });
      const switchId = this.addSwitch(`switch${hop + 1}`, `SW${hop + 1}`, 8, { x: hop * 300, y: 350 });
      
      // Connect router to switch
      this.createLink(routerId.id, 'Fa0/0', switchId.id, 'Fa0/1');
      this.configureRouterIP(routerId.id, 'Fa0/0', `192.168.${hop + 1}.1`, '255.255.255.0');
      
      // Add hosts to this segment
      for (let h = 1; h <= config.hostsPerSegment; h++) {
        const hostId = this.addHost(`host${hop + 1}_${h}`, `PC${hop + 1}-${h}`, { x: hop * 300 + h * 50, y: 450 });
        this.createLink(hostId.id, 'eth0', switchId.id, `Fa0/${h + 1}`);
        this.configureHostIP(hostId.id, 'eth0', `192.168.${hop + 1}.${h + 10}`, '255.255.255.0');
      }
      
      // Connect to next hop router
      if (hop < config.hops - 1) {
        const nextRouterId = `router${hop + 2}`;
        // This will be connected when the next router is created
      }
    }
  }

  /**
   * Provides topology analysis and recommendations
   */
  analyzeTopology(): { analysis: string[]; recommendations: string[] } {
    const analysis: string[] = [];
    const recommendations: string[] = [];

    const deviceCount = this.devices.size;
    const linkCount = this.links.size;
    const hostCount = Array.from(this.devices.values()).filter(d => d.type === 'host').length;
    const switchCount = Array.from(this.devices.values()).filter(d => d.type === 'switch').length;
    const routerCount = Array.from(this.devices.values()).filter(d => d.type === 'router').length;

    analysis.push(`Network contains: ${hostCount} hosts, ${switchCount} switches, ${routerCount} routers`);
    analysis.push(`Total devices: ${deviceCount}, Total links: ${linkCount}`);
    
    // Analyze connectivity
    const connectivityRatio = linkCount / Math.max(deviceCount - 1, 1);
    if (connectivityRatio < 1) {
      analysis.push('Network has minimal connectivity (tree topology)');
      recommendations.push('Consider adding redundant links for fault tolerance');
    } else if (connectivityRatio > 1.5) {
      analysis.push('Network has high connectivity with redundant paths');
      recommendations.push('Ensure spanning tree protocol is enabled on switches');
    }

    // Analyze segmentation
    if (routerCount === 0 && hostCount > 3) {
      analysis.push('Single broadcast domain - all hosts share collision/broadcast domain');
      recommendations.push('Consider adding routers for network segmentation and better performance');
    } else if (routerCount > 0) {
      analysis.push(`Network is segmented into ${routerCount + 1} subnets`);
      recommendations.push('Ensure proper routing configuration for inter-subnet communication');
    }

    return { analysis, recommendations };
  }
}