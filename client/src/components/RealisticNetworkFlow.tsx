'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { NetworkSimulator } from '@/lib/network/NetworkSimulator';
import { Host } from '@/lib/network/devices/Host';
import { Switch } from '@/lib/network/devices/Switch';
import { Router } from '@/lib/network/devices/Router';
import { PacketTrace } from '@/lib/network/types';
import DeviceConfig from './DeviceConfig';
import PacketAnalyzer from './PacketAnalyzer';
import { FaDesktop, FaNetworkWired, FaRoute, FaCog, FaPlay, FaBook, FaEye, FaGraduationCap, FaSearch } from 'react-icons/fa';
// import EducationalTutorials from './EducationalTutorials';

let nodeId = 1;
const getNodeId = () => `device-${nodeId++}`;

// Custom node components
const HostNode = ({ data }: any) => {
  const device = data.device;
  const primaryInterface = device?.interfaces?.[0];
  const ipAddress = primaryInterface?.ipAddress?.address;
  const subnet = primaryInterface?.ipAddress?.subnet;
  
  return (
    <div className="px-2 sm:px-4 py-1 sm:py-2 shadow-lg rounded-lg bg-blue-100 border-2 border-blue-500 min-w-24 sm:min-w-32 text-center relative">
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top" 
        className="w-3 h-3 bg-blue-600 border-2 border-white" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom" 
        className="w-3 h-3 bg-blue-600 border-2 border-white" 
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left" 
        className="w-3 h-3 bg-blue-600 border-2 border-white" 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right" 
        className="w-3 h-3 bg-blue-600 border-2 border-white" 
      />
      
      <div className="flex items-center justify-center gap-2">
        <FaDesktop className="text-blue-600" />
        <div className="font-bold text-blue-900">{data.label}</div>
      </div>
      <div className="text-xs text-gray-700 mt-1 font-medium">
        {ipAddress ? `${ipAddress}` : 'No IP'}
      </div>
      {subnet && (
        <div className="text-xs text-gray-600 font-medium">
          {subnet}
        </div>
      )}
    </div>
  );
};

const SwitchNode = ({ data }: any) => (
  <div className="px-2 sm:px-4 py-1 sm:py-2 shadow-lg rounded-lg bg-green-100 border-2 border-green-500 min-w-20 sm:min-w-24 text-center relative">
    <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-green-600 border-2 border-white" />
    <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-green-600 border-2 border-white" />
    <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-green-600 border-2 border-white" />
    <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-green-600 border-2 border-white" />
    
    <div className="flex items-center justify-center gap-2">
      <FaNetworkWired className="text-green-600" />
      <div className="font-bold text-green-900">{data.label}</div>
    </div>
    <div className="text-xs text-gray-700 mt-1 font-medium">
      {data.device?.interfaces?.length || 0} ports
    </div>
  </div>
);

const RouterNode = ({ data }: any) => (
  <div className="px-2 sm:px-4 py-1 sm:py-2 shadow-lg rounded-lg bg-orange-100 border-2 border-orange-500 min-w-20 sm:min-w-24 text-center relative">
    <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-orange-600 border-2 border-white" />
    <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-orange-600 border-2 border-white" />
    <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-orange-600 border-2 border-white" />
    <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-orange-600 border-2 border-white" />
    
    <div className="flex items-center justify-center gap-2">
      <FaRoute className="text-orange-600" />
      <div className="font-bold text-orange-900">{data.label}</div>
    </div>
    <div className="text-xs text-gray-700 mt-1 font-medium">
      {data.device?.routingTable?.length || 0} routes
    </div>
  </div>
);

const nodeTypes: NodeTypes = {
  host: HostNode,
  switch: SwitchNode,
  router: RouterNode,
};

export default function RealisticNetworkFlow() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [simulator] = useState(() => new NetworkSimulator());
  const [selectedDevice, setSelectedDevice] = useState<Host | Switch | Router | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showPacketAnalyzer, setShowPacketAnalyzer] = useState(false);
  const [packetTraces, setPacketTraces] = useState<PacketTrace[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [pingSource, setPingSource] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  // const [showEducationalTutorials, 
  const [isPingMode, setIsPingMode] = useState(false);

  useEffect(() => {
    // Clear any existing devices to prevent ID conflicts
    simulator.clear();
    simulator.start();
    
    // Create a simple demo network
    // createDemoNetwork();
    
    return () => {
      simulator.stop();
      // Clear the simulator when component unmounts to prevent conflicts
      simulator.clear();
    };
  }, []);

  useEffect(() => {
    // Update nodes when ping source changes to show visual indicator
    updateNodesFromSimulator();
  }, [pingSource]);

  const createDemoNetwork = () => {
    // Create isolated devices for user to connect and configure manually
    // This provides a clean testing environment without pre-made connections
    
    // Create some sample devices at different positions
    const host1 = simulator.addHost('host1', 'PC-1', { x: 150, y: 150 });
    const host2 = simulator.addHost('host2', 'PC-2', { x: 350, y: 150 });
    const switch1 = simulator.addSwitch('switch1', 'Switch-1', 8, { x: 250, y: 300 });
    
    // Additional devices for more complex topologies (but not connected)
    const host3 = simulator.addHost('host3', 'PC-3', { x: 150, y: 450 });
    const router1 = simulator.addRouter('router1', 'Router-1', { x: 450, y: 300 });

    // NO CONNECTIONS ARE MADE - Users must create them manually
    // NO IP CONFIGURATIONS - Users must configure them manually
    
    console.log('Created clean demo devices - no connections made');
    console.log('Users must:');
    console.log('1. Drag to create connections between devices');
    console.log('2. Double-click devices to configure IP addresses');
    console.log('3. Use "Start Ping Mode" to test connectivity');

    // Update React Flow nodes
    updateNodesFromSimulator();
  };

  const updateNodesFromSimulator = () => {
    const devices = simulator.getAllDevices();
    setNodes(currentNodes => {
      const newNodes: Node[] = devices.map(device => {
        // Preserve existing position if node already exists
        const existingNode = currentNodes.find(n => n.id === device.id);
        return {
          id: device.id,
          type: device.type,
          position: existingNode?.position || device.position,
          data: { 
            label: device.name,
            device: device,
          },
          connectable: true,
          selectable: true,
          draggable: true,
          style: pingSource === device.id ? { 
            border: '3px solid #fbbf24',
            boxShadow: '0 0 10px #fbbf24'
          } : undefined,
        };
      });
      return newNodes;
    });

    // Only sync edges if there's a mismatch (e.g., after device removal)
    const links = simulator.getAllLinks();
    setEdges(currentEdges => {
      // Filter out edges for devices that no longer exist
      const validEdges = currentEdges.filter(edge => 
        simulator.getDevice(edge.source) && simulator.getDevice(edge.target)
      );
      
      // If the count doesn't match, rebuild from simulator
      if (validEdges.length !== links.length) {
        return links.map(link => ({
          id: link.id,
          source: link.deviceA,
          target: link.deviceB,
          label: `${link.interfaceA} ↔ ${link.interfaceB}`,
          style: { stroke: link.isUp ? '#10b981' : '#ef4444' },
        }));
      }
      
      return validEdges;
    });
  };

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    changes.forEach(change => {
      if (change.type === 'remove') {
        simulator.removeDevice(change.id);
        // Don't call updateNodesFromSimulator here as it will reset positions
        return;
      }
      if (change.type === 'position' && change.position) {
        // Update device position in simulator to maintain consistency
        const device = simulator.getDevice(change.id);
        if (device) {
          device.position = change.position;
        }
      }
    });
    
    setNodes(nds => applyNodeChanges(changes, nds));
  }, [simulator]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    changes.forEach(change => {
      if (change.type === 'remove') {
        simulator.removeLink(change.id);
        // Don't call updateNodesFromSimulator to avoid position reset
        return;
      }
    });
    
    setEdges(eds => applyEdgeChanges(changes, eds));
  }, [simulator]);

  const onConnect = useCallback((connection: Connection) => {
    console.log('Connection attempt:', connection);
    
    if (!connection.source || !connection.target) {
      console.log('Missing source or target');
      return;
    }

    const sourceDevice = simulator.getDevice(connection.source);
    const targetDevice = simulator.getDevice(connection.target);

    console.log('Source device:', sourceDevice?.name, 'Target device:', targetDevice?.name);

    if (sourceDevice && targetDevice) {
      // Find available interfaces
      const sourceInterface = sourceDevice.interfaces.find(i => !i.connectedTo);
      const targetInterface = targetDevice.interfaces.find(i => !i.connectedTo);

      console.log('Available interfaces:', sourceInterface?.name, targetInterface?.name);

      if (sourceInterface && targetInterface) {
        try {
          const link = simulator.createLink(
            connection.source,
            sourceInterface.name,
            connection.target,
            targetInterface.name
          );
          console.log('Link created successfully');
          
          // Add the edge to React Flow
          const newEdge = {
            id: link.id,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            label: `${sourceInterface.name} ↔ ${targetInterface.name}`,
            style: { stroke: '#10b981' },
          };
          
          setEdges(eds => addEdge(newEdge as any, eds));
          // Don't update nodes from simulator to preserve positions
        } catch (error) {
          console.error('Error creating link:', error);
        }
      } else {
        console.log('No available interfaces');
        alert('No available interfaces on one or both devices. Check if devices are already fully connected.');
      }
    }
  }, [simulator]);

  const onNodeDoubleClick = useCallback((_event: any, node: Node) => {
    const device = simulator.getDevice(node.id);
    if (device) {
      setSelectedDevice(device);
      setShowConfig(true);
    }
  }, [simulator]);

  const onNodeClick = useCallback((_event: any, node: Node) => {
    // Only handle ping when in ping mode and not in config mode
    if (showConfig || !isPingMode) return;
    
    if (pingSource === null) {
      setPingSource(node.id);
      console.log(`Selected ping source: ${node.data.label}`);
    } else {
      if (pingSource !== node.id) {
        // Execute ping
        performPing(pingSource, node.id);
      }
      setPingSource(null);
      setIsPingMode(false); // Exit ping mode after ping
    }
  }, [pingSource, showConfig, isPingMode]);

  const performPing = async (sourceId: string, targetId: string) => {
    const sourceDevice = simulator.getDevice(sourceId);
    const targetDevice = simulator.getDevice(targetId);

    if (sourceDevice?.type === 'host' && targetDevice?.type === 'host') {
      const sourceHost = sourceDevice as Host;
      const targetHost = targetDevice as Host;
      
      const sourceIP = sourceHost.interfaces[0]?.ipAddress?.address;
      const targetIP = targetHost.interfaces[0]?.ipAddress?.address;
      
      if (!sourceIP) {
        alert(`❌ ${sourceHost.name} needs an IP address! Double-click to configure: ip eth0 192.168.1.10 255.255.255.0`);
        return;
      }
      
      if (!targetIP) {
        alert(`❌ ${targetHost.name} needs an IP address! Double-click to configure: ip eth0 192.168.1.11 255.255.255.0`);
        return;
      }
      
      // Check if there's a valid path between source and target
      const hasPath = checkNetworkPath(sourceHost, targetHost);
      if (!hasPath) {
        alert(`❌ No network path exists between ${sourceHost.name} and ${targetHost.name}. Check physical connections.`);
        return;
      }
      
      try {
        console.log(`🎯 UI: Starting ping from ${sourceId} to ${targetIP}`);
        const traces = await simulator.ping(sourceId, targetIP);
        console.log(`🎯 UI: simulator.ping() returned ${traces.length} traces:`, traces);
        
        
        setPacketTraces(prev => {
          const newTraces = [...prev, ...traces];
          console.log(`🎯 UI: Setting packet traces - Previous: ${prev.length}, New: ${traces.length}, Total: ${newTraces.length}`);
          return newTraces;
        });
        
        if (traces.length > 0) {
          alert(`✅ Ping successful from ${sourceHost.name} (${sourceIP}) to ${targetHost.name} (${targetIP}) - ${traces.length} traces collected`);
        } else {
          alert(`❌ Ping failed from ${sourceHost.name} (${sourceIP}) to ${targetHost.name} (${targetIP}). Check network connectivity and routing.`);
        }
      } catch (error) {
        alert(`❌ Ping error: ${error}`);
      }
    } else {
      alert('Ping is only supported between hosts');
    }
  };

  const checkNetworkPath = (sourceHost: Host, targetHost: Host): boolean => {
    // Enhanced topology analysis for realistic path checking
    console.log(`🔍 Checking network path from ${sourceHost.name} to ${targetHost.name}`);
    
    const sourceConnected = sourceHost.interfaces.some(iface => iface.connectedTo);
    const targetConnected = targetHost.interfaces.some(iface => iface.connectedTo);
    
    if (!sourceConnected || !targetConnected) {
      console.log(`❌ Path check failed: Source connected: ${sourceConnected}, Target connected: ${targetConnected}`);
      return false;
    }
    
    // Advanced path discovery using graph traversal
    try {
      const path = findNetworkPath(sourceHost, targetHost, simulator);
      if (path.length > 0) {
        console.log(`✅ Network path found: ${path.map(p => p.name).join(' → ')}`);
        return true;
      } else {
        console.log(`❌ No network path exists between devices`);
        return false;
      }
    } catch (error) {
      console.error('Error during path analysis:', error);
      return true; // Fall back to letting ping handle validation
    }
  };

  // Advanced network topology analysis
  const findNetworkPath = (source: Host, target: Host, networkSim: NetworkSimulator): any[] => {
    console.log(`🔍 Path Finding: Starting BFS from ${source.name} to ${target.name}`);
    
    const visited = new Set<string>();
    const queue: { device: any; path: any[] }[] = [{ device: source, path: [source] }];
    
    console.log(`🔍 Path Finding: Source interfaces:`, source.interfaces.map(i => `${i.name} -> ${i.connectedTo ? 'connected' : 'not connected'}`));
    console.log(`🔍 Path Finding: Target interfaces:`, target.interfaces.map(i => `${i.name} -> ${i.connectedTo ? 'connected' : 'not connected'}`));
    
    let iterations = 0;
    while (queue.length > 0 && iterations < 20) { // Prevent infinite loops
      iterations++;
      const { device, path } = queue.shift()!;
      
      console.log(`🔍 Path Finding: Visiting ${device.name} (${device.type}), path so far: ${path.map(d => d.name).join(' → ')}`);
      
      if (device.id === target.id) {
        console.log(`🔍 Path Finding: ✅ Found target! Path: ${path.map(d => d.name).join(' → ')}`);
        return path; // Found path to target
      }
      
      if (visited.has(device.id)) {
        console.log(`🔍 Path Finding: Already visited ${device.name}, skipping`);
        continue;
      }
      visited.add(device.id);
      
      // Explore connected devices
      console.log(`🔍 Path Finding: Exploring ${device.interfaces.length} interfaces of ${device.name}`);
      for (const iface of device.interfaces) {
        console.log(`🔍 Path Finding: Interface ${iface.name}: connectedTo=${iface.connectedTo ? 'yes' : 'no'}`);
        
        if (iface.connectedTo) {
          let deviceId: string;
          if (typeof iface.connectedTo === 'object' && iface.connectedTo.deviceId) {
            deviceId = iface.connectedTo.deviceId;
          } else if (typeof iface.connectedTo === 'string') {
            // Handle legacy string format: "deviceB-interfaceB"
            deviceId = iface.connectedTo.split('-')[0];
          } else {
            continue;
          }
          
          console.log(`🔍 Path Finding: Found connection to device ${deviceId}`);
          
          const connectedDevice = networkSim.getDevice(deviceId);
          if (connectedDevice) {
            console.log(`🔍 Path Finding: Connected device is ${connectedDevice.name} (${connectedDevice.type})`);
            
            if (!visited.has(connectedDevice.id)) {
              console.log(`🔍 Path Finding: Adding ${connectedDevice.name} to queue`);
              queue.push({
                device: connectedDevice,
                path: [...path, connectedDevice]
              });
            } else {
              console.log(`🔍 Path Finding: ${connectedDevice.name} already visited`);
            }
          } else {
            console.log(`🔍 Path Finding: ❌ Could not find device with ID ${deviceId}`);
          }
        }
      }
      
      console.log(`🔍 Path Finding: Queue now has ${queue.length} devices`);
    }
    
    console.log(`🔍 Path Finding: ❌ No path found after ${iterations} iterations`);
    console.log(`🔍 Path Finding: Visited devices: ${Array.from(visited).join(', ')}`);
    return []; // No path found
  };

  const addHost = () => {
    const hostId = getNodeId();
    const position = {
      x: Math.random() * 600 + 50,
      y: Math.random() * 400 + 50,
    };
    const host = simulator.addHost(hostId, `PC-${hostId.split('-')[1]}`, position);
    
    // Add node directly to preserve positions
    const newNode: Node = {
      id: hostId,
      type: 'host',
      position,
      data: { 
        label: host.name,
        device: host,
      },
      connectable: true,
      selectable: true,
      draggable: true,
    };
    setNodes(nds => [...nds, newNode]);
  };

  const addSwitch = () => {
    const switchId = getNodeId();
    const position = {
      x: Math.random() * 600 + 50,
      y: Math.random() * 400 + 50,
    };
    const switchDevice = simulator.addSwitch(switchId, `Switch-${switchId.split('-')[1]}`, 8, position);
    
    // Add node directly to preserve positions
    const newNode: Node = {
      id: switchId,
      type: 'switch',
      position,
      data: { 
        label: switchDevice.name,
        device: switchDevice,
      },
      connectable: true,
      selectable: true,
      draggable: true,
    };
    setNodes(nds => [...nds, newNode]);
  };

  const addRouter = () => {
    const routerId = getNodeId();
    const position = {
      x: Math.random() * 600 + 50,
      y: Math.random() * 400 + 50,
    };
    const router = simulator.addRouter(routerId, `Router-${routerId.split('-')[1]}`, position);
    
    // Add node directly to preserve positions
    const newNode: Node = {
      id: routerId,
      type: 'router',
      position,
      data: { 
        label: router.name,
        device: router,
      },
      connectable: true,
      selectable: true,
      draggable: true,
    };
    setNodes(nds => [...nds, newNode]);
  };

  const startPacketCapture = () => {
    setIsCapturing(true);
    setPacketTraces([]);
  };

  const stopPacketCapture = () => {
    setIsCapturing(false);
  };

  const renderTutorial = () => {
    if (!showTutorial) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white text-gray-900 rounded-lg p-6 max-w-4xl max-h-4/5 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4">Network Simulation Tutorial</h2>
          
          <div className="space-y-6">
            <section>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Getting Started</h3>
              <p className="text-gray-700">
                This is a realistic network simulator that mimics how real networks operate.
                Unlike the Docker version, this simulation implements actual networking protocols
                and packet forwarding mechanisms.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Device Types</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-300 p-3 rounded bg-white">
                  <h4 className="font-semibold text-blue-600">🖥️ Hosts</h4>
                  <p className="text-sm text-gray-700">End devices like computers. They have IP addresses and can send/receive data.</p>
                </div>
                <div className="border border-gray-300 p-3 rounded bg-white">
                  <h4 className="font-semibold text-green-600">🔌 Switches</h4>
                  <p className="text-sm text-gray-700">Layer 2 devices that learn MAC addresses and forward frames within a network segment.</p>
                </div>
                <div className="border border-gray-300 p-3 rounded bg-white">
                  <h4 className="font-semibold text-orange-600">🛤️ Routers</h4>
                  <p className="text-sm text-gray-700">Layer 3 devices that route packets between different networks using IP addresses.</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">How to Use</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li><strong>Add devices:</strong> Click the device buttons to add hosts, switches, or routers</li>
                <li><strong>Connect devices:</strong> Drag from one device to another to create a link</li>
                <li><strong>Configure devices:</strong> Double-click any device to open its configuration panel</li>
                <li><strong>Test connectivity:</strong> Single-click two hosts to ping between them</li>
                <li><strong>Analyze traffic:</strong> Use the packet analyzer to see how data flows through your network</li>
              </ol>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Network Protocols Implemented</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-800">Layer 2 (Data Link)</h4>
                  <ul className="text-sm text-gray-600">
                    <li>• Ethernet frames</li>
                    <li>• MAC address learning</li>
                    <li>• Frame forwarding/flooding</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">Layer 3 (Network)</h4>
                  <ul className="text-sm text-gray-600">
                    <li>• IP packet routing</li>
                    <li>• ARP resolution</li>
                    <li>• ICMP (ping)</li>
                    <li>• Static routing</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Clean Testing Environment!</h3>
              <p className="text-gray-700 mb-2">
                Sample devices are provided but NOT connected. You must build your network from scratch:
              </p>
              <div className="bg-gray-100 p-4 rounded text-sm">
                <div className="mb-2 text-gray-800"><strong>Available Devices:</strong></div>
                <div className="text-gray-700">• PC-1, PC-2, PC-3 (hosts - need IP configuration)</div>
                <div className="text-gray-700">• Switch-1 (8 ports - ready for connections)</div>
                <div className="text-gray-700">• Router-1 (multiple interfaces - needs IP configuration)</div>
                
                <div className="mt-3 mb-2 text-gray-800"><strong>Step-by-step setup:</strong></div>
                <div className="text-gray-700">1. <strong className="text-gray-900">Connect:</strong> Drag from PC-1 to Switch-1</div>
                <div className="text-gray-700">2. <strong className="text-gray-900">Connect:</strong> Drag from PC-2 to Switch-1</div>
                <div className="text-gray-700">3. <strong className="text-gray-900">Configure:</strong> Double-click PC-1 → CLI → "ip eth0 192.168.1.10 255.255.255.0"</div>
                <div className="text-gray-700">4. <strong className="text-gray-900">Configure:</strong> Double-click PC-2 → CLI → "ip eth0 192.168.1.11 255.255.255.0"</div>
                <div className="text-gray-700">5. <strong className="text-gray-900">Test:</strong> Start Ping Mode → Click PC-1 → Click PC-2</div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Result:</strong> ✅ Ping should work between connected, configured devices!
              </p>
            </section>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowTutorial(false)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Close Tutorial
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-gray-900 h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-2 sm:p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 lg:gap-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <h1 className="text-white text-lg sm:text-xl font-bold">Realistic Network Simulator</h1>
            <span className="text-green-400 text-xs sm:text-sm px-2 py-1 bg-green-900 rounded">Isolated Environment</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <button
              onClick={addHost}
              className="px-2 sm:px-3 py-1 sm:py-2 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 flex items-center gap-1 sm:gap-2"
            >
              <FaDesktop className="text-xs sm:text-sm" /> <span className="hidden sm:inline">Add</span> Host
            </button>
            <button
              onClick={addSwitch}
              className="px-2 sm:px-3 py-1 sm:py-2 bg-green-600 text-white rounded text-xs sm:text-sm hover:bg-green-700 flex items-center gap-1 sm:gap-2"
            >
              <FaNetworkWired className="text-xs sm:text-sm" /> <span className="hidden sm:inline">Add</span> Switch
            </button>
            <button
              onClick={addRouter}
              className="px-2 sm:px-3 py-1 sm:py-2 bg-orange-600 text-white rounded text-xs sm:text-sm hover:bg-orange-700 flex items-center gap-1 sm:gap-2"
            >
              <FaRoute className="text-xs sm:text-sm" /> <span className="hidden sm:inline">Add</span> Router
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:gap-2 w-full lg:w-auto justify-start lg:justify-end">
          <button
            onClick={() => {
              setIsPingMode(!isPingMode);
              setPingSource(null); // Clear any existing ping source
            }}
            className={`px-2 sm:px-3 py-1 sm:py-2 ${isPingMode ? 'bg-yellow-600' : 'bg-gray-600'} text-white rounded text-xs sm:text-sm hover:${isPingMode ? 'bg-yellow-700' : 'bg-gray-700'} flex items-center gap-1 sm:gap-2`}
          >
            <FaPlay className="text-xs sm:text-sm" /> <span className="hidden md:inline">{isPingMode ? 'Exit Ping Mode' : 'Start Ping Mode'}</span><span className="md:hidden">Ping</span>
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            className="px-2 sm:px-3 py-1 sm:py-2 bg-purple-600 text-white rounded text-xs sm:text-sm hover:bg-purple-700 flex items-center gap-1 sm:gap-2"
          >
            <FaBook className="text-xs sm:text-sm" /> <span className="hidden md:inline">Quick Guide</span><span className="md:hidden">Guide</span>
          </button>
          <button
            onClick={() => setShowPacketAnalyzer(!showPacketAnalyzer)}
            className="px-2 sm:px-3 py-1 sm:py-2 bg-indigo-600 text-white rounded text-xs sm:text-sm hover:bg-indigo-700 flex items-center gap-1 sm:gap-2"
          >
            <FaEye className="text-xs sm:text-sm" /> <span className="hidden md:inline">Packet Analyzer</span><span className="md:hidden">Packets</span>
          </button>
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-gray-700 p-2 text-xs sm:text-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            {!pingSource ? (
              <>
                <span className="text-white hidden sm:inline">🔗 NO CONNECTIONS: Drag from device to device to create links</span>
                <span className="text-white sm:hidden">🔗 Drag devices to connect</span>
                <span className="text-white hidden sm:inline">⚙️ NO IPs: Double-click device → CLI → "ip eth0 192.168.1.10 255.255.255.0"</span>
                <span className="text-white sm:hidden">⚙️ Double-click to configure</span>
                {isPingMode ? (
                  <span className="text-yellow-300">📡 PING MODE: Click source host, then target host</span>
                ) : (
                  <span className="text-white hidden sm:inline">🎯 After connecting & configuring, use "Start Ping Mode"</span>
                )}
              </>
            ) : (
              <span className="text-yellow-300 font-medium">🎯 Click target host to ping from {simulator.getDevice(pingSource)?.name}</span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-white text-xs sm:text-sm">Devices: {nodes.length}</span>
            <span className="text-white text-xs sm:text-sm">Links: {edges.length}</span>
            {pingSource && (
              <button 
                onClick={() => {
                  setPingSource(null);
                  setIsPingMode(false);
                }}
                className="text-red-300 hover:text-red-100 transition-colors"
              >
                ❌ Cancel Ping
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Network Diagram */}
        <div className={`${showPacketAnalyzer ? 'lg:w-2/3 h-1/2 lg:h-full' : 'w-full h-full'}`}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-100"
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {/* Packet Analyzer */}
        {showPacketAnalyzer && (
          <div className="lg:w-1/3 h-1/2 lg:h-full border-t lg:border-t-0 lg:border-l border-gray-300">
            <PacketAnalyzer
              traces={packetTraces}
              onStartCapture={startPacketCapture}
              onStopCapture={stopPacketCapture}
              isCapturing={isCapturing}
            />
            <div className="hidden">
              {/* Debug info */}
              {(() => {
                console.log(`🎯 UI: Rendering PacketAnalyzer with ${packetTraces.length} traces`);
                return null;
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Device Configuration Modal */}
      {showConfig && selectedDevice && (
        <DeviceConfig
          device={selectedDevice}
          onClose={() => setShowConfig(false)}
          onConfigChange={() => {
            // Force re-render of nodes to update displayed IP addresses
            setNodes(nds => [...nds]);
          }}
        />
      )}

      {/* Tutorial Modal */}
      {renderTutorial()}

      {/* Educational Tutorials */}
      {/* {showEducationalTutorials && (
        <EducationalTutorials onClose={() => setShowEducationalTutorials(false)} />
      )} */}

    </div>
  );
}