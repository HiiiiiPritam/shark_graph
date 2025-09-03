'use client';

import { useState, useEffect } from 'react';
import { Host } from '@/lib/network/devices/Host';
import { Switch } from '@/lib/network/devices/Switch';
import { Router } from '@/lib/network/devices/Router';
import { NetworkInterface, RouteEntry, ARPEntry, MACTableEntry } from '@/lib/network/types';
import { FaTerminal, FaCog, FaNetworkWired, FaTimes, FaPlus, FaTrash, FaInfo } from 'react-icons/fa';

interface DeviceConfigProps {
  device: Host | Switch | Router | null;
  onClose: () => void;
  onConfigChange: () => void;
}

export default function DeviceConfig({ device, onClose, onConfigChange }: DeviceConfigProps) {
  const [activeTab, setActiveTab] = useState<'interfaces' | 'routing' | 'arp' | 'mac' | 'cli'>('interfaces');
  const [cliInput, setCLIInput] = useState('');
  const [cliOutput, setCLIOutput] = useState<string[]>([]);
  const [newRouteForm, setNewRouteForm] = useState({
    destination: '',
    subnetMask: '',
    nextHop: '',
    interface: '',
    metric: 1,
  });

  useEffect(() => {
    if (device) {
      setCLIOutput([
        `Connected to ${device.name} (${device.type})`,
        `Type 'help' for available commands`,
        '',
      ]);
    }
  }, [device]);

  if (!device) return null;

  const handleCLISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    const command = cliInput.trim();
    setCLIOutput(prev => [...prev, `${device.name}# ${command}`]);
    
    const output = processCommand(command);
    setCLIOutput(prev => [...prev, ...output, '']);
    
    setCLIInput('');
  };

  const processCommand = (command: string): string[] => {
    const originalParts = command.split(' ');
    const parts = command.toLowerCase().split(' ');
    const cmd = parts[0];

    try {
      switch (cmd) {
        case 'help':
          return [
            'Available commands:',
            '  show interfaces - Display interface status',
            '  show ip route - Display routing table (routers only)',
            '  show arp - Display ARP table',
            '  show mac-address-table - Display MAC table (switches only)',
            '  show status - Display device status',
            '  ip <interface> <ip-address> <subnet-mask> - Configure IP address',
            '  gateway <ip-address> - Set default gateway (hosts only)',
            '  route add <destination> <mask> <next-hop> <interface> - Add static route (routers only)',
            '  ping <ip> - Ping an IP address (hosts/routers only)',
            '  clear arp - Clear ARP table',
            '  clear mac-address-table - Clear MAC table (switches only)',
            '  shutdown - Shutdown device',
            '  no shutdown - Start device',
            '',
            'Examples:',
            '  ip eth0 192.168.1.10 255.255.255.0   (for hosts)',
            '  ip Fa0/0 192.168.1.1 255.255.255.0   (for routers)',
            '  gateway 192.168.1.1',
            '  route add 192.168.2.0 255.255.255.0 192.168.1.2 Fa0/0',
            '  ping 192.168.2.10',
          ];

        case 'show':
          return handleShowCommand(parts.slice(1));

        case 'ip':
          return handleIPCommand(originalParts.slice(1));

        case 'gateway':
          return handleGatewayCommand(parts[1]);

        case 'route':
          return handleRouteCommand(originalParts.slice(1));

        case 'ping':
          return handlePingCommand(parts[1]);

        case 'clear':
          return handleClearCommand(parts[1]);

        case 'shutdown':
          device.shutdown();
          onConfigChange();
          return [`${device.name} shutdown`];

        case 'no':
          if (parts[1] === 'shutdown') {
            device.startup();
            onConfigChange();
            return [`${device.name} started`];
          }
          return ['Invalid command'];

        default:
          return [`Unknown command: ${command}. Type 'help' for available commands.`];
      }
    } catch (error) {
      console.error('Command processing error:', error);
      return [`Error executing command: ${error}. Please check the console for details.`];
    }
  };

  const handleShowCommand = (args: string[]): string[] => {
    const subcommand = args.join(' ');

    switch (subcommand) {
      case 'interfaces':
        return showInterfaces();
      
      case 'ip route':
        if (device.type === 'router') {
          return showRoutingTable();
        }
        return ['This command is only available on routers'];

      case 'arp':
        return showARPTable();

      case 'mac-address-table':
        if (device.type === 'switch') {
          return showMACTable();
        }
        return ['This command is only available on switches'];

      case 'status':
        return [device.getStatus()];

      default:
        return [`Unknown show command: ${subcommand}`];
    }
  };

  const handlePingCommand = (target?: string): string[] => {
    if (!target) {
      return ['Usage: ping <ip-address>'];
    }

    if (device.type === 'host') {
      // Simulate ping - in real implementation, would use the simulator
      return [
        `PING ${target} (${target}): 56 data bytes`,
        `64 bytes from ${target}: icmp_seq=1 time=1.234 ms`,
        `64 bytes from ${target}: icmp_seq=2 time=1.456 ms`,
        `64 bytes from ${target}: icmp_seq=3 time=1.123 ms`,
        '',
        `--- ${target} ping statistics ---`,
        '3 packets transmitted, 3 received, 0% packet loss',
        'round-trip min/avg/max/stddev = 1.123/1.271/1.456/0.135 ms',
      ];
    }

    return ['Ping is only available on hosts and routers'];
  };

  const handleIPCommand = (args: string[]): string[] => {
    if (args.length < 3) {
      return ['Usage: ip <interface> <ip-address> <subnet-mask>'];
    }

    const [interfaceName, ipAddress, subnetMask] = args;
    console.log(`Configuring interface: ${interfaceName} with IP: ${ipAddress}`);

    try {
      if (device.type === 'host') {
        const host = device as Host;
        host.configureInterface(interfaceName, { address: ipAddress, subnet: subnetMask });
        onConfigChange();
        return [`Interface ${interfaceName} configured with IP ${ipAddress}/${subnetMask}`];
      } else if (device.type === 'router') {
        const router = device as Router;
        router.configureInterface(interfaceName, { address: ipAddress, subnet: subnetMask });
        onConfigChange();
        return [`Interface ${interfaceName} configured with IP ${ipAddress}/${subnetMask}`];
      } else {
        return ['IP configuration not available on switches'];
      }
    } catch (error) {
      return [`Error configuring interface: ${error}`];
    }
  };

  const handleGatewayCommand = (gatewayIP?: string): string[] => {
    if (!gatewayIP) {
      return ['Usage: gateway <ip-address>'];
    }

    try {
      if (device.type === 'host') {
        const host = device as Host;
        host.setDefaultGateway({ address: gatewayIP, subnet: '' });
        onConfigChange();
        return [`Default gateway set to ${gatewayIP}`];
      } else {
        return ['Gateway command is only available on hosts'];
      }
    } catch (error) {
      return [`Error setting gateway: ${error}`];
    }
  };

  const handleRouteCommand = (args: string[]): string[] => {
    if (args.length < 5 || args[0] !== 'add') {
      return ['Usage: route add <destination> <mask> <next-hop> <interface>'];
    }

    const [, destination, subnetMask, nextHop, interfaceName] = args;

    try {
      if (device.type === 'router') {
        const router = device as Router;
        router.addRoute(
          { address: destination, subnet: subnetMask },
          subnetMask,
          { address: nextHop, subnet: '' },
          interfaceName,
          1,
          'static'
        );
        onConfigChange();
        return [`Static route added: ${destination}/${subnetMask} via ${nextHop} on ${interfaceName}`];
      } else {
        return ['Route command is only available on routers'];
      }
    } catch (error) {
      return [`Error adding route: ${error}`];
    }
  };

  const handleClearCommand = (target?: string): string[] => {
    switch (target) {
      case 'arp':
        if (device.type === 'host' || device.type === 'router') {
          // Clear ARP table
          return ['ARP table cleared'];
        }
        return ['ARP table not available on this device type'];

      case 'mac-address-table':
        if (device.type === 'switch') {
          (device as Switch).clearMACTable();
          onConfigChange();
          return ['MAC address table cleared'];
        }
        return ['MAC address table not available on this device type'];

      default:
        return [`Unknown clear command: ${target}`];
    }
  };

  const showInterfaces = (): string[] => {
    const output = ['Interface Status:'];
    output.push('Interface   IP Address      Status   Protocol   MAC Address');
    output.push('------------------------------------------------------------------------');
    
    device.interfaces.forEach(iface => {
      const ip = iface.ipAddress?.address || 'unassigned';
      const status = iface.isUp ? 'up' : 'down';
      const protocol = iface.isUp ? 'up' : 'down';
      const mac = iface.macAddress.address;
      
      output.push(`${iface.name.padEnd(12)} ${ip.padEnd(16)} ${status.padEnd(8)} ${protocol.padEnd(10)} ${mac}`);
    });
    
    return output;
  };

  const showRoutingTable = (): string[] => {
    if (device.type !== 'router') return ['Not a router'];
    
    const router = device as Router;
    const routes = router.showRoutingTable();
    
    const output = ['Routing Table:'];
    output.push('Destination     Gateway         Interface   Metric   Protocol');
    output.push('------------------------------------------------------------');
    
    routes.forEach(route => {
      const dest = `${route.destinationNetwork.address}/${route.subnetMask}`;
      const gateway = route.nextHop.address === '0.0.0.0' ? 'directly connected' : route.nextHop.address;
      
      output.push(`${dest.padEnd(16)} ${gateway.padEnd(16)} ${route.interface.padEnd(11)} ${route.metric.toString().padEnd(8)} ${route.protocol}`);
    });
    
    return output;
  };

  const showARPTable = (): string[] => {
    if (device.type === 'switch') {
      return ['ARP table not available on switches'];
    }
    
    try {
      const arpTable = device.type === 'host' ? 
        (device as Host).arpTable : 
        (device as Router).showARPTable();
      
      const output = ['ARP Table:'];
      output.push('IP Address      MAC Address       Interface   Type     Age');
      output.push('---------------------------------------------------------');
      
      if (!arpTable || arpTable.length === 0) {
        output.push('No ARP entries found. Perform a ping to populate the ARP table.');
        return output;
      }
      
      arpTable.forEach(entry => {
        try {
          // Handle both old and new ARP entry formats
          const entryType = entry.type || (entry.isStatic ? 'static' : 'dynamic');
          const entryAge = entry.age !== undefined ? entry.age : 
            (entry.expirationTime ? Math.floor((Date.now() - (entry.expirationTime - 300000)) / 1000) : 0);
          
          const ipAddr = entry.ipAddress?.address || 'N/A';
          const macAddr = entry.macAddress?.address || 'N/A';
          const iface = entry.interface || 'N/A';
          
          output.push(`${ipAddr.padEnd(16)} ${macAddr.padEnd(18)} ${iface.padEnd(11)} ${entryType.padEnd(8)} ${entryAge}s`);
        } catch (entryError) {
          console.error('Error processing ARP entry:', entryError);
          output.push('Error processing ARP entry - check console for details');
        }
      });
      
      return output;
    } catch (error) {
      console.error('Error accessing ARP table:', error);
      return ['Error accessing ARP table - check console for details'];
    }
  };

  const showMACTable = (): string[] => {
    if (device.type !== 'switch') return ['Not a switch'];
    
    const switchDevice = device as Switch;
    const macTable = switchDevice.showMACTable();
    
    const output = ['MAC Address Table:'];
    output.push('MAC Address       Interface   Type     Age');
    output.push('------------------------------------------');
    
    macTable.forEach(entry => {
      output.push(`${entry.macAddress.address.padEnd(18)} ${entry.port.padEnd(11)} ${entry.type.padEnd(8)} ${entry.age}s`);
    });
    
    return output;
  };

  const addStaticRoute = () => {
    if (device.type !== 'router') return;
    
    const router = device as Router;
    router.addRoute(
      { address: newRouteForm.destination, subnet: newRouteForm.subnetMask },
      newRouteForm.subnetMask,
      { address: newRouteForm.nextHop, subnet: '' },
      newRouteForm.interface,
      newRouteForm.metric,
      'static'
    );
    
    setNewRouteForm({
      destination: '',
      subnetMask: '',
      nextHop: '',
      interface: '',
      metric: 1,
    });
    
    onConfigChange();
  };

  const renderTabs = () => {
    const tabs = ['interfaces'];
    
    if (device.type === 'router') {
      tabs.push('routing', 'arp');
    } else if (device.type === 'host') {
      tabs.push('arp');
    } else if (device.type === 'switch') {
      tabs.push('mac');
    }
    
    tabs.push('cli');

    return (
      <div className="flex border-b border-gray-300 mb-4">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 capitalize ${
              activeTab === tab
                ? 'bg-blue-500 text-white border-b-2 border-blue-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab === 'mac' ? 'MAC Table' : tab}
          </button>
        ))}
      </div>
    );
  };

  const renderInterfaces = () => (
    <div className="text-gray-900">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
        <FaNetworkWired /> Interface Configuration
      </h3>
      <div className="space-y-4">
        {device.interfaces.map(iface => (
          <div key={iface.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-gray-800">{iface.name}</h4>
              <span className={`px-2 py-1 rounded text-sm ${
                iface.isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {iface.isUp ? 'UP' : 'DOWN'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <span className="font-medium text-gray-800">MAC Address:</span> {iface.macAddress.address}
              </div>
              <div>
                <span className="font-medium text-gray-800">Speed:</span> {iface.speed} Mbps
              </div>
              <div>
                <span className="font-medium text-gray-800">IP Address:</span> {
                  iface.ipAddress ? `${iface.ipAddress.address}/${iface.ipAddress.subnet}` : 'Not configured'
                }
              </div>
              <div>
                <span className="font-medium text-gray-800">Connected To:</span> {
                  iface.connectedTo 
                    ? (typeof iface.connectedTo === 'object' 
                       ? `${iface.connectedTo.deviceId}:${iface.connectedTo.interfaceName}` 
                       : iface.connectedTo)
                    : 'Not connected'
                }
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRoutingTable = () => {
    if (device.type !== 'router') return null;
    
    const router = device as Router;
    const routes = router.showRoutingTable();

    return (
      <div className="text-gray-900">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
            <FaCog /> Routing Table
          </h3>
          <button
            onClick={() => setActiveTab('cli')}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Add Route via CLI
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-gray-800">Destination</th>
                <th className="px-4 py-2 text-left text-gray-800">Gateway</th>
                <th className="px-4 py-2 text-left text-gray-800">Interface</th>
                <th className="px-4 py-2 text-left text-gray-800">Metric</th>
                <th className="px-4 py-2 text-left text-gray-800">Protocol</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-4 py-2 text-gray-700">{route.destinationNetwork.address}/{route.subnetMask}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {route.nextHop.address === '0.0.0.0' ? 'Connected' : route.nextHop.address}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{route.interface}</td>
                  <td className="px-4 py-2 text-gray-700">{route.metric}</td>
                  <td className="px-4 py-2 text-gray-700">
                    <span className={`px-2 py-1 rounded text-xs ${
                      route.protocol === 'connected' ? 'bg-blue-100 text-blue-800' :
                      route.protocol === 'static' ? 'bg-green-100 text-green-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {route.protocol.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderARPTable = () => {
    if (device.type === 'switch') return null;
    
    try {
      const arpTable = device.type === 'host' ? 
        (device as Host).arpTable : 
        (device as Router).showARPTable();

      return (
        <div className="text-gray-900">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
            <FaInfo /> ARP Table
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-800">IP Address</th>
                  <th className="px-4 py-2 text-left text-gray-800">MAC Address</th>
                  <th className="px-4 py-2 text-left text-gray-800">Interface</th>
                  <th className="px-4 py-2 text-left text-gray-800">Type</th>
                  <th className="px-4 py-2 text-left text-gray-800">Age</th>
                </tr>
              </thead>
              <tbody>
                {arpTable && arpTable.map((entry, idx) => {
                  // Handle both old and new ARP entry formats
                  const entryType = entry.type || (entry.isStatic ? 'static' : 'dynamic');
                  const entryAge = entry.age !== undefined ? entry.age : 
                    (entry.expirationTime ? Math.floor((Date.now() - (entry.expirationTime - 300000)) / 1000) : 0);
                  
                  return (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-2 text-gray-700">{entry.ipAddress?.address || 'N/A'}</td>
                      <td className="px-4 py-2 font-mono text-gray-700">{entry.macAddress?.address || 'N/A'}</td>
                      <td className="px-4 py-2 text-gray-700">{entry.interface || 'N/A'}</td>
                      <td className="px-4 py-2 text-gray-700">
                        <span className={`px-2 py-1 rounded text-xs ${
                          entryType === 'static' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {entryType.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{entryAge}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!arpTable || arpTable.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No ARP entries found. Perform a ping to populate the ARP table.
              </div>
            )}
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error rendering ARP table:', error);
      return (
        <div className="text-gray-900">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
            <FaInfo /> ARP Table
          </h3>
          <div className="text-center py-8 text-red-500 bg-red-50 border border-red-200 rounded">
            Error displaying ARP table. Please check the console for details.
          </div>
        </div>
      );
    }
  };

  const renderMACTable = () => {
    if (device.type !== 'switch') return null;
    
    const switchDevice = device as Switch;
    const macTable = switchDevice.showMACTable();

    return (
      <div className="text-gray-900">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
          <FaInfo /> MAC Address Table
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-gray-800">MAC Address</th>
                <th className="px-4 py-2 text-left text-gray-800">Port</th>
                <th className="px-4 py-2 text-left text-gray-800">Type</th>
                <th className="px-4 py-2 text-left text-gray-800">Age</th>
              </tr>
            </thead>
            <tbody>
              {macTable.map((entry, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-4 py-2 font-mono text-gray-700">{entry.macAddress.address}</td>
                  <td className="px-4 py-2 text-gray-700">{entry.port}</td>
                  <td className="px-4 py-2 text-gray-700">
                    <span className={`px-2 py-1 rounded text-xs ${
                      entry.type === 'static' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {entry.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{entry.age}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCLI = () => (
    <div className="text-gray-900">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
        <FaTerminal /> Command Line Interface
      </h3>
      
      <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg h-96 overflow-y-auto mb-4">
        {cliOutput.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap">{line}</div>
        ))}
      </div>
      
      <form onSubmit={handleCLISubmit} className="flex gap-2">
        <div className="flex-1 flex">
          <span className="bg-gray-100 px-3 py-2 border border-r-0 border-gray-300 rounded-l font-mono text-sm text-gray-800">
            {device.name}#
          </span>
          <input
            type="text"
            value={cliInput}
            onChange={(e) => setCLIInput(e.target.value)}
            className="flex-1 px-3 py-2 border border-l-0 border-gray-300 rounded-r focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-900"
            placeholder="Enter command..."
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Execute
        </button>
      </form>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-4/5 h-4/5 max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-300">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FaCog />
            {device.name} Configuration
            <span className="text-sm font-normal text-gray-500">({device.type})</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          {renderTabs()}
          
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'interfaces' && renderInterfaces()}
            {activeTab === 'routing' && renderRoutingTable()}
            {activeTab === 'arp' && renderARPTable()}
            {activeTab === 'mac' && renderMACTable()}
            {activeTab === 'cli' && renderCLI()}
          </div>
        </div>
      </div>
    </div>
  );
}