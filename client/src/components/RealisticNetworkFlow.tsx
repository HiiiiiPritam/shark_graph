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
import EducationalTutorials from './EducationalTutorials';
import NetworkAnalyzer from './NetworkAnalyzer';

let nodeId = 1;
const getNodeId = () => `device-${nodeId++}`;

// Custom node components
const HostNode = ({ data }: any) => {
  const device = data.device;
  const primaryInterface = device?.interfaces?.[0];
  const ipAddress = primaryInterface?.ipAddress?.address;
  const subnet = primaryInterface?.ipAddress?.subnet;
  
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-blue-100 border-2 border-blue-500 min-w-32 text-center relative">
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
        <div className="font-bold text-blue-800">{data.label}</div>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        {ipAddress ? `${ipAddress}` : 'No IP configured'}
      </div>
      {subnet && (
        <div className="text-xs text-gray-500">
          {subnet}
        </div>
      )}
    </div>
  );
};

const SwitchNode = ({ data }: any) => (
  <div className="px-4 py-2 shadow-lg rounded-lg bg-green-100 border-2 border-green-500 min-w-24 text-center relative">
    <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-green-600 border-2 border-white" />
    <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-green-600 border-2 border-white" />
    <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-green-600 border-2 border-white" />
    <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-green-600 border-2 border-white" />
    
    <div className="flex items-center justify-center gap-2">
      <FaNetworkWired className="text-green-600" />
      <div className="font-bold text-green-800">{data.label}</div>
    </div>
    <div className="text-xs text-gray-600 mt-1">
      {data.device?.interfaces?.length || 0} ports
    </div>
  </div>
);

const RouterNode = ({ data }: any) => (
  <div className="px-4 py-2 shadow-lg rounded-lg bg-orange-100 border-2 border-orange-500 min-w-24 text-center relative">
    <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-orange-600 border-2 border-white" />
    <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-orange-600 border-2 border-white" />
    <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-orange-600 border-2 border-white" />
    <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-orange-600 border-2 border-white" />
    
    <div className="flex items-center justify-center gap-2">
      <FaRoute className="text-orange-600" />
      <div className="font-bold text-orange-800">{data.label}</div>
    </div>
    <div className="text-xs text-gray-600 mt-1">
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
  const [showEducationalTutorials, setShowEducationalTutorials] = useState(false);
  const [showNetworkAnalyzer, setShowNetworkAnalyzer] = useState(false);
  const [isPingMode, setIsPingMode] = useState(false);

  useEffect(() => {
    simulator.start();
    
    // Create a simple demo network
    createDemoNetwork();
    
    return () => {
      simulator.stop();
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
        const traces = await simulator.ping(sourceId, targetIP);
        setPacketTraces(prev => [...prev, ...traces]);
        
        if (traces.length > 0) {
          alert(`✅ Ping successful from ${sourceHost.name} (${sourceIP}) to ${targetHost.name} (${targetIP})`);
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
    // Simple path checking - ensure both hosts have at least one connected interface
    const sourceConnected = sourceHost.interfaces.some(iface => iface.connectedTo);
    const targetConnected = targetHost.interfaces.some(iface => iface.connectedTo);
    
    if (!sourceConnected || !targetConnected) {
      return false;
    }
    
    // For more sophisticated path checking, we could implement a graph traversal
    // For now, we'll let the actual ping simulation handle the detailed path validation
    return true;
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
        <div className="bg-white rounded-lg p-6 max-w-4xl max-h-4/5 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4">Network Simulation Tutorial</h2>
          
          <div className="space-y-6">
            <section>
              <h3 className="text-xl font-semibold mb-2">Getting Started</h3>
              <p className="text-gray-700">
                This is a realistic network simulator that mimics how real networks operate.
                Unlike the Docker version, this simulation implements actual networking protocols
                and packet forwarding mechanisms.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2">Device Types</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border p-3 rounded">
                  <h4 className="font-semibold text-blue-600">🖥️ Hosts</h4>
                  <p className="text-sm">End devices like computers. They have IP addresses and can send/receive data.</p>
                </div>
                <div className="border p-3 rounded">
                  <h4 className="font-semibold text-green-600">🔌 Switches</h4>
                  <p className="text-sm">Layer 2 devices that learn MAC addresses and forward frames within a network segment.</p>
                </div>
                <div className="border p-3 rounded">
                  <h4 className="font-semibold text-orange-600">🛤️ Routers</h4>
                  <p className="text-sm">Layer 3 devices that route packets between different networks using IP addresses.</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2">How to Use</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li><strong>Add devices:</strong> Click the device buttons to add hosts, switches, or routers</li>
                <li><strong>Connect devices:</strong> Drag from one device to another to create a link</li>
                <li><strong>Configure devices:</strong> Double-click any device to open its configuration panel</li>
                <li><strong>Test connectivity:</strong> Single-click two hosts to ping between them</li>
                <li><strong>Analyze traffic:</strong> Use the packet analyzer to see how data flows through your network</li>
              </ol>
            </section>

            <section>
              <h3 className="text-xl font-semibold mb-2">Network Protocols Implemented</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold">Layer 2 (Data Link)</h4>
                  <ul className="text-sm text-gray-600">
                    <li>• Ethernet frames</li>
                    <li>• MAC address learning</li>
                    <li>• Frame forwarding/flooding</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold">Layer 3 (Network)</h4>
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
              <h3 className="text-xl font-semibold mb-2">Clean Testing Environment!</h3>
              <p className="text-gray-700 mb-2">
                Sample devices are provided but NOT connected. You must build your network from scratch:
              </p>
              <div className="bg-gray-100 p-4 rounded text-sm">
                <div className="mb-2"><strong>Available Devices:</strong></div>
                <div>• PC-1, PC-2, PC-3 (hosts - need IP configuration)</div>
                <div>• Switch-1 (8 ports - ready for connections)</div>
                <div>• Router-1 (multiple interfaces - needs IP configuration)</div>
                
                <div className="mt-3 mb-2"><strong>Step-by-step setup:</strong></div>
                <div>1. <strong>Connect:</strong> Drag from PC-1 to Switch-1</div>
                <div>2. <strong>Connect:</strong> Drag from PC-2 to Switch-1</div>
                <div>3. <strong>Configure:</strong> Double-click PC-1 → CLI → "ip eth0 192.168.1.10 255.255.255.0"</div>
                <div>4. <strong>Configure:</strong> Double-click PC-2 → CLI → "ip eth0 192.168.1.11 255.255.255.0"</div>
                <div>5. <strong>Test:</strong> Start Ping Mode → Click PC-1 → Click PC-2</div>
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
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-white text-xl font-bold">Realistic Network Simulator</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={addHost}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <FaDesktop /> Add Host
            </button>
            <button
              onClick={addSwitch}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <FaNetworkWired /> Add Switch
            </button>
            <button
              onClick={addRouter}
              className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
            >
              <FaRoute /> Add Router
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsPingMode(!isPingMode);
              setPingSource(null); // Clear any existing ping source
            }}
            className={`px-3 py-2 ${isPingMode ? 'bg-yellow-600' : 'bg-gray-600'} text-white rounded-lg hover:${isPingMode ? 'bg-yellow-700' : 'bg-gray-700'} flex items-center gap-2`}
          >
            <FaPlay /> {isPingMode ? 'Exit Ping Mode' : 'Start Ping Mode'}
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <FaBook /> Quick Guide
          </button>
          <button
            onClick={() => setShowEducationalTutorials(true)}
            className="px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center gap-2"
          >
            <FaGraduationCap /> Learn
          </button>
          <button
            onClick={() => setShowNetworkAnalyzer(true)}
            className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
          >
            <FaSearch /> Analyze
          </button>
          <button
            onClick={() => setShowPacketAnalyzer(!showPacketAnalyzer)}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <FaEye /> Packet Analyzer
          </button>
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-gray-700 p-2 text-white text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!pingSource ? (
              <>
                <span>🔗 NO CONNECTIONS: Drag from device to device to create links</span>
                <span>⚙️ NO IPs: Double-click device → CLI → "ip eth0 192.168.1.10 255.255.255.0"</span>
                {isPingMode ? (
                  <span className="text-yellow-300">📡 PING MODE: Click source host, then target host</span>
                ) : (
                  <span>🎯 After connecting & configuring, use "Start Ping Mode"</span>
                )}
              </>
            ) : (
              <span className="text-yellow-300 font-medium">🎯 Click target host to ping from {simulator.getDevice(pingSource)?.name}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>Devices: {nodes.length}</span>
            <span>Links: {edges.length}</span>
            {pingSource && (
              <button 
                onClick={() => {
                  setPingSource(null);
                  setIsPingMode(false);
                }}
                className="text-red-300 hover:text-red-100"
              >
                ❌ Cancel Ping
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Network Diagram */}
        <div className={`${showPacketAnalyzer ? 'w-2/3' : 'w-full'} h-full`}>
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
          <div className="w-1/3 h-full border-l border-gray-300">
            <PacketAnalyzer
              traces={packetTraces}
              onStartCapture={startPacketCapture}
              onStopCapture={stopPacketCapture}
              isCapturing={isCapturing}
            />
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
      {showEducationalTutorials && (
        <EducationalTutorials onClose={() => setShowEducationalTutorials(false)} />
      )}

      {/* Network Analyzer */}
      {showNetworkAnalyzer && (
        <NetworkAnalyzer 
          simulator={simulator} 
          onClose={() => setShowNetworkAnalyzer(false)} 
        />
      )}
    </div>
  );
}