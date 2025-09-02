# Claude Project Context

## Project Overview
**Shark3** is a comprehensive Network Simulation and Learning Platform that provides multiple modes for understanding networking concepts:

1. **Realistic Network Lab** - Full network simulation with actual networking protocols
2. **Basic Simulation** - Simplified virtual network for learning basics  
3. **Docker Lab** - Real Docker containers as network nodes (legacy)

## Architecture
- **Frontend**: Next.js 15 + React 19 + TypeScript + TailwindCSS
- **Backend**: Express.js server (for Docker mode)
- **Simulation**: Pure TypeScript implementation of networking protocols

## Development Setup
```bash
# Client setup
cd client
npm install
npm run dev

# Server setup (for Docker mode)
cd server  
npm install
npm start
```

## Project Structure
- `/client` - Next.js frontend application
  - `/src/lib/network/` - Realistic network simulation engine
  - `/src/components/` - React components
- `/server` - Express.js backend for Docker integration

## Network Simulation Features

### Realistic Network Lab (🌟 Primary Learning Mode)
A comprehensive network simulator that implements actual networking protocols and algorithms, providing an authentic learning experience without requiring Docker or complex setup.

#### 🚀 **Quick Start Guide**
1. **Access**: Navigate to `/realistic` or click "Realistic Network Lab" on homepage
2. **Build Network**: 
   - Click "Add Host/Switch/Router" to create devices
   - Drag between devices to create physical connections
   - Double-click devices to access CLI configuration
3. **Configure Devices**:
   ```bash
   # Host configuration (in device CLI)
   ip eth0 192.168.1.10 255.255.255.0  # Set IP address
   gateway 192.168.1.1                 # Set default gateway
   
   # Router configuration  
   ip Fa0/0 192.168.1.1 255.255.255.0  # Configure interface
   route add 192.168.2.0/24 192.168.1.2 # Add static route
   ```
4. **Test Connectivity**: Use "Start Ping Mode" → Click source → Click destination

#### 🔧 **Device Types & Capabilities**
- **🖥️ Hosts**: End devices with full TCP/IP stack
  - Ethernet interfaces (eth0, eth1, etc.)
  - IP address configuration
  - ARP table management
  - ICMP ping functionality
  - Gateway configuration

- **🔌 Switches**: Layer 2 learning switches (8-24 ports)
  - MAC address learning and aging
  - Frame forwarding/flooding
  - Port-based VLAN support (planned)
  - Loop prevention mechanisms

- **🛤️ Routers**: Layer 3 routing devices
  - Multiple FastEthernet interfaces (Fa0/0, Fa0/1, etc.)
  - Static routing table configuration
  - Inter-network packet forwarding
  - ARP proxy functionality

#### 📡 **Implemented Protocols**
- **Layer 2 (Data Link)**:
  - Ethernet frame encapsulation/decapsulation
  - MAC address learning and forwarding
  - Frame flooding for unknown destinations
  
- **Layer 3 (Network)**:
  - IPv4 packet routing and forwarding
  - ARP (Address Resolution Protocol)
  - ICMP (Internet Control Message Protocol)
  - Static routing with longest prefix match
  - Subnet mask validation and network calculations

#### 🎯 **Educational Features**
- **Live Packet Analysis**: Real-time packet tracing with detailed protocol breakdown
- **CLI Configuration**: Cisco-style command interface for device configuration  
- **Network Topology Builder**: Drag-and-drop network construction
- **Step-by-Step Tutorials**: Interactive guides for common scenarios
- **Troubleshooting Tools**: Network analysis and connectivity diagnostics
- **Realistic Behavior**: Authentic protocol implementations and timing

#### 💡 **Learning Scenarios**
1. **Basic LAN Setup**: Connect hosts via switch, configure same subnet
2. **Inter-VLAN Routing**: Multiple subnets with router gateway
3. **Multi-Hop Routing**: Complex topologies with static routes
4. **Network Troubleshooting**: Identify and fix connectivity issues
5. **Protocol Analysis**: Examine packet flow and protocol operations

#### ⚡ **Advanced Features**
- **Clean Testing Environment**: No pre-configured connections - build from scratch
- **Real-time Packet Capture**: Wireshark-style analysis interface
- **Network State Inspection**: View routing tables, ARP caches, MAC tables
- **Performance Metrics**: Latency, packet loss, throughput analysis
- **Export/Import**: Save network configurations for later use

### Core Classes
- `NetworkSimulator` - Main simulation engine
- `Host` - End devices with full network stack
- `Switch` - Layer 2 devices with MAC learning
- `Router` - Layer 3 devices with routing tables
- `PacketTracer` - Packet flow analysis
- `NetworkStack` - Network utilities and protocols

## Common Tasks
- Start development: `cd client && npm run dev`
- Build client: `cd client && npm run build`
- Linting: `cd client && npm run lint`

## Network Configuration Examples
```typescript
// Add devices
const host1 = simulator.addHost('host1', 'PC-1');
const router1 = simulator.addRouter('router1', 'Router-1');

// Configure IP addresses
simulator.configureHostIP('host1', 'eth0', '192.168.1.10', '255.255.255.0');
simulator.configureRouterIP('router1', 'Fa0/0', '192.168.1.1', '255.255.255.0');

// Create links
simulator.createLink('host1', 'eth0', 'router1', 'Fa0/0');

// Test connectivity
simulator.ping('host1', '192.168.1.1');
```

## Educational Features
- Interactive tutorials
- Step-by-step packet tracing
- Device configuration interfaces
- Protocol analysis and explanation
- Network troubleshooting scenarios

## Important Notes
- The realistic simulation runs entirely in the browser (no Docker required)
- Implements actual networking protocols and algorithms
- Provides detailed packet-level analysis
- Designed for educational purposes with real-world accuracy
- All device configurations use CLI-style commands