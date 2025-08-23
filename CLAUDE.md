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

### Realistic Network Lab
- **Devices**: Hosts, Switches, Routers with full protocol stacks
- **Protocols**: Ethernet, IP, ARP, ICMP, static routing
- **Features**: 
  - Real packet forwarding and routing
  - MAC address learning (switches)
  - ARP resolution
  - Ping with actual ICMP packets
  - Packet tracing and analysis
  - Device configuration (CLI-like interface)
  - Wireshark-style packet analyzer

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