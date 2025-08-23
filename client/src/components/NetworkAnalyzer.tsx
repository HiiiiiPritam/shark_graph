'use client';

import { useState } from 'react';
import { NetworkSimulator } from '@/lib/network/NetworkSimulator';
import { Host } from '@/lib/network/devices/Host';
import { Switch } from '@/lib/network/devices/Switch';
import { Router } from '@/lib/network/devices/Router';
import { NetworkStack } from '@/lib/network/protocols/NetworkStack';
import { 
  FaSearch, 
  FaNetworkWired, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaInfoCircle,
  FaChartBar,
  FaRoute,
  FaTable
} from 'react-icons/fa';

interface NetworkAnalyzerProps {
  simulator: NetworkSimulator;
  onClose: () => void;
}

interface NetworkIssue {
  severity: 'error' | 'warning' | 'info';
  type: string;
  device: string;
  description: string;
  suggestion: string;
}

export default function NetworkAnalyzer({ simulator, onClose }: NetworkAnalyzerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'routing' | 'performance'>('overview');
  const [analysisResults, setAnalysisResults] = useState<{
    overview: any;
    issues: NetworkIssue[];
    routing: any;
    performance: any;
  } | null>(null);

  const runAnalysis = () => {
    const devices = simulator.getAllDevices();
    const links = simulator.getAllLinks();
    
    const overview = analyzeOverview(devices, links);
    const issues = findNetworkIssues(devices, links);
    const routing = analyzeRouting(devices);
    const performance = analyzePerformance(devices, links);

    setAnalysisResults({
      overview,
      issues,
      routing,
      performance
    });
  };

  const analyzeOverview = (devices: any[], links: any[]) => {
    const deviceTypes = {
      hosts: devices.filter(d => d.type === 'host').length,
      switches: devices.filter(d => d.type === 'switch').length,
      routers: devices.filter(d => d.type === 'router').length
    };

    const networks = new Set<string>();
    devices.forEach(device => {
      if (device.type === 'host' || device.type === 'router') {
        device.interfaces.forEach((iface: any) => {
          if (iface.ipAddress) {
            const network = NetworkStack.calculateNetworkAddress(
              iface.ipAddress.address,
              iface.ipAddress.subnet
            );
            networks.add(`${network}/${NetworkStack.getPrefixLength(iface.ipAddress.subnet)}`);
          }
        });
      }
    });

    return {
      totalDevices: devices.length,
      deviceTypes,
      totalLinks: links.length,
      activeLinks: links.filter(l => l.isUp).length,
      networks: Array.from(networks),
      networkSegments: networks.size
    };
  };

  const findNetworkIssues = (devices: any[], links: any[]): NetworkIssue[] => {
    const issues: NetworkIssue[] = [];

    // Check for unconnected devices
    devices.forEach(device => {
      const connectedInterfaces = device.interfaces.filter((iface: any) => iface.connectedTo);
      if (connectedInterfaces.length === 0) {
        issues.push({
          severity: 'warning',
          type: 'Connectivity',
          device: device.name,
          description: 'Device has no network connections',
          suggestion: 'Connect this device to the network using cables'
        });
      }
    });

    // Check for misconfigured IP addresses
    devices.forEach(device => {
      if (device.type === 'host' || device.type === 'router') {
        device.interfaces.forEach((iface: any) => {
          if (!iface.ipAddress && iface.connectedTo) {
            issues.push({
              severity: 'error',
              type: 'Configuration',
              device: device.name,
              description: `Interface ${iface.name} is connected but has no IP address`,
              suggestion: 'Configure an IP address for this interface'
            });
          }
        });
      }
    });

    // Check for IP conflicts
    const ipAddresses = new Map<string, string[]>();
    devices.forEach(device => {
      if (device.type === 'host' || device.type === 'router') {
        device.interfaces.forEach((iface: any) => {
          if (iface.ipAddress) {
            const ip = iface.ipAddress.address;
            if (!ipAddresses.has(ip)) {
              ipAddresses.set(ip, []);
            }
            ipAddresses.get(ip)!.push(device.name);
          }
        });
      }
    });

    ipAddresses.forEach((deviceList, ip) => {
      if (deviceList.length > 1) {
        issues.push({
          severity: 'error',
          type: 'IP Conflict',
          device: deviceList.join(', '),
          description: `Multiple devices using IP address ${ip}`,
          suggestion: 'Assign unique IP addresses to each device'
        });
      }
    });

    // Check for hosts without default gateway
    devices.filter(d => d.type === 'host').forEach(host => {
      const hasGateway = (host as Host).defaultGateway;
      if (!hasGateway) {
        issues.push({
          severity: 'warning',
          type: 'Routing',
          device: host.name,
          description: 'Host has no default gateway configured',
          suggestion: 'Configure a default gateway to enable communication with other networks'
        });
      }
    });

    // Check for broken links
    links.forEach(link => {
      if (!link.isUp) {
        issues.push({
          severity: 'error',
          type: 'Link Down',
          device: `${link.deviceA} ↔ ${link.deviceB}`,
          description: `Network link is down`,
          suggestion: 'Check cable connections and interface status'
        });
      }
    });

    // Check for single points of failure
    const criticalDevices = devices.filter(device => {
      const connectedLinks = links.filter(link => 
        link.deviceA === device.id || link.deviceB === device.id
      );
      return connectedLinks.length > 2; // Device connects multiple segments
    });

    criticalDevices.forEach(device => {
      issues.push({
        severity: 'info',
        type: 'Redundancy',
        device: device.name,
        description: 'Device may be a single point of failure',
        suggestion: 'Consider adding redundant connections or backup devices'
      });
    });

    return issues;
  };

  const analyzeRouting = (devices: any[]) => {
    const routers = devices.filter(d => d.type === 'router') as Router[];
    const routingAnalysis = {
      totalRoutes: 0,
      routesByProtocol: { static: 0, connected: 0, rip: 0, ospf: 0 },
      routingIssues: [] as string[]
    };

    routers.forEach(router => {
      const routes = router.showRoutingTable();
      routingAnalysis.totalRoutes += routes.length;
      
      routes.forEach(route => {
        routingAnalysis.routesByProtocol[route.protocol]++;
      });

      // Check for missing routes
      const connectedNetworks = new Set<string>();
      router.interfaces.forEach(iface => {
        if (iface.ipAddress) {
          const network = NetworkStack.calculateNetworkAddress(
            iface.ipAddress.address,
            iface.ipAddress.subnet
          );
          connectedNetworks.add(network);
        }
      });

      // Check if router has a default route
      const hasDefaultRoute = routes.some(route => route.destinationNetwork.address === '0.0.0.0');
      if (!hasDefaultRoute && routes.length < 3) {
        routingAnalysis.routingIssues.push(
          `${router.name}: No default route configured - may not be able to reach remote networks`
        );
      }
    });

    return routingAnalysis;
  };

  const analyzePerformance = (devices: any[], links: any[]) => {
    const performance = {
      averageBandwidth: 0,
      totalBandwidth: 0,
      linkUtilization: 0,
      potentialBottlenecks: [] as string[]
    };

    if (links.length > 0) {
      performance.totalBandwidth = links.reduce((sum, link) => sum + link.bandwidth, 0);
      performance.averageBandwidth = performance.totalBandwidth / links.length;
      performance.linkUtilization = links.reduce((sum, link) => sum + link.utilization, 0) / links.length;
    }

    // Find potential bottlenecks
    links.forEach(link => {
      if (link.bandwidth < 100) {
        performance.potentialBottlenecks.push(
          `${link.deviceA} ↔ ${link.deviceB}: Low bandwidth (${link.bandwidth} Mbps)`
        );
      }
      if (link.utilization > 80) {
        performance.potentialBottlenecks.push(
          `${link.deviceA} ↔ ${link.deviceB}: High utilization (${link.utilization}%)`
        );
      }
    });

    return performance;
  };

  const renderOverview = () => {
    if (!analysisResults) return null;
    const { overview } = analysisResults;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-100 p-4 rounded-lg text-center">
            <FaNetworkWired className="text-2xl text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-800">{overview.totalDevices}</div>
            <div className="text-sm text-blue-600">Total Devices</div>
          </div>
          <div className="bg-green-100 p-4 rounded-lg text-center">
            <FaRoute className="text-2xl text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-800">{overview.activeLinks}</div>
            <div className="text-sm text-green-600">Active Links</div>
          </div>
          <div className="bg-purple-100 p-4 rounded-lg text-center">
            <FaChartBar className="text-2xl text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-800">{overview.networkSegments}</div>
            <div className="text-sm text-purple-600">Network Segments</div>
          </div>
          <div className="bg-orange-100 p-4 rounded-lg text-center">
            <FaTable className="text-2xl text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-orange-800">{analysisResults.issues.length}</div>
            <div className="text-sm text-orange-600">Issues Found</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Device Distribution</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Hosts:</span>
                <span className="font-medium">{overview.deviceTypes.hosts}</span>
              </div>
              <div className="flex justify-between">
                <span>Switches:</span>
                <span className="font-medium">{overview.deviceTypes.switches}</span>
              </div>
              <div className="flex justify-between">
                <span>Routers:</span>
                <span className="font-medium">{overview.deviceTypes.routers}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Network Segments</h3>
            <div className="space-y-1">
              {overview.networks.map((network: string, index: number) => (
                <div key={index} className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  {network}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderIssues = () => {
    if (!analysisResults) return null;
    const { issues } = analysisResults;

    if (issues.length === 0) {
      return (
        <div className="text-center py-12">
          <FaCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-green-600 mb-2">No Issues Found</h3>
          <p className="text-gray-600">Your network configuration looks good!</p>
        </div>
      );
    }

    const groupedIssues = {
      error: issues.filter(i => i.severity === 'error'),
      warning: issues.filter(i => i.severity === 'warning'),
      info: issues.filter(i => i.severity === 'info')
    };

    return (
      <div className="space-y-6">
        {Object.entries(groupedIssues).map(([severity, issueList]) => {
          if (issueList.length === 0) return null;
          
          const config = {
            error: { icon: FaExclamationTriangle, color: 'red', bg: 'red-50', border: 'red-200' },
            warning: { icon: FaExclamationTriangle, color: 'yellow', bg: 'yellow-50', border: 'yellow-200' },
            info: { icon: FaInfoCircle, color: 'blue', bg: 'blue-50', border: 'blue-200' }
          }[severity as keyof typeof groupedIssues];

          return (
            <div key={severity}>
              <h3 className="text-lg font-semibold mb-3 capitalize flex items-center gap-2">
                <config.icon className={`text-${config.color}-600`} />
                {severity} Issues ({issueList.length})
              </h3>
              <div className="space-y-3">
                {issueList.map((issue, index) => (
                  <div key={index} className={`bg-${config.bg} border border-${config.border} rounded-lg p-4`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className={`text-${config.color}-800 font-medium`}>{issue.type}</span>
                        <span className="text-gray-600 ml-2">({issue.device})</span>
                      </div>
                    </div>
                    <p className={`text-${config.color}-700 mb-2`}>{issue.description}</p>
                    <p className="text-sm text-gray-600">💡 {issue.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRouting = () => {
    if (!analysisResults) return null;
    const { routing } = analysisResults;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-800">{routing.totalRoutes}</div>
            <div className="text-sm text-blue-600">Total Routes</div>
          </div>
          <div className="bg-green-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-800">{routing.routesByProtocol.static}</div>
            <div className="text-sm text-green-600">Static Routes</div>
          </div>
          <div className="bg-purple-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-800">{routing.routesByProtocol.connected}</div>
            <div className="text-sm text-purple-600">Connected Routes</div>
          </div>
          <div className="bg-orange-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-800">{routing.routesByProtocol.rip + routing.routesByProtocol.ospf}</div>
            <div className="text-sm text-orange-600">Dynamic Routes</div>
          </div>
        </div>

        {routing.routingIssues.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-3">Routing Issues</h3>
            <div className="space-y-2">
              {routing.routingIssues.map((issue: string, index: number) => (
                <div key={index} className="text-yellow-700">{issue}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPerformance = () => {
    if (!analysisResults) return null;
    const { performance } = analysisResults;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-blue-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-800">{performance.totalBandwidth}</div>
            <div className="text-sm text-blue-600">Total Bandwidth (Mbps)</div>
          </div>
          <div className="bg-green-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-800">{performance.averageBandwidth.toFixed(0)}</div>
            <div className="text-sm text-green-600">Average Bandwidth (Mbps)</div>
          </div>
          <div className="bg-purple-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-800">{performance.linkUtilization.toFixed(1)}%</div>
            <div className="text-sm text-purple-600">Average Utilization</div>
          </div>
        </div>

        {performance.potentialBottlenecks.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-800 mb-3">Potential Bottlenecks</h3>
            <div className="space-y-2">
              {performance.potentialBottlenecks.map((bottleneck: string, index: number) => (
                <div key={index} className="text-red-700">{bottleneck}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-5/6 h-5/6 max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-300">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FaSearch className="text-blue-600" />
            Network Analyzer
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={runAnalysis}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <FaSearch /> Analyze Network
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-300">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'issues', label: 'Issues' },
            { id: 'routing', label: 'Routing' },
            { id: 'performance', label: 'Performance' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-medium ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {!analysisResults ? (
            <div className="text-center py-12">
              <FaSearch className="text-6xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Network Analysis</h3>
              <p className="text-gray-500 mb-4">Click "Analyze Network" to scan your network for issues and performance metrics.</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'issues' && renderIssues()}
              {activeTab === 'routing' && renderRouting()}
              {activeTab === 'performance' && renderPerformance()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}