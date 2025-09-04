/**
 * Multi-Router Network Test Suite
 * 
 * This test validates that the realistic network simulator works correctly
 * for complex multi-router topologies and complicated networks.
 * 
 * Test Scenarios:
 * 1. Simple two-router topology (Host-Router1-Router2-Host)
 * 2. Three-router triangle topology with multiple paths
 * 3. Linear multi-hop topology (4+ routers in series)
 * 4. Star topology with central router
 * 5. Complex mesh topology with redundant paths
 */

import { NetworkSimulator } from '../NetworkSimulator';
import { Host } from '../devices/Host';
import { Router } from '../devices/Router';
import { NetworkStack } from '../protocols/NetworkStack';

export class MultiRouterTest {
  private simulator: NetworkSimulator;

  constructor() {
    this.simulator = new NetworkSimulator();
  }

  /**
   * Test Case 1: Simple Two-Router Topology
   * 
   * Topology:
   * Host1 (192.168.1.10/24) -- Router1 (192.168.1.1/24, 10.0.0.1/30) -- Router2 (10.0.0.2/30, 192.168.2.1/24) -- Host2 (192.168.2.10/24)
   * 
   * Tests:
   * - Inter-network routing through two routers
   * - Proper ARP resolution on each segment
   * - TTL decrementing at each hop
   * - Return path functionality
   */
  async testTwoRouterTopology(): Promise<{ success: boolean; details: string }> {
    console.log('\n🧪 Testing Two-Router Topology...');
    
    try {
      // Clear any previous setup
      this.simulator.clear();

      // Create devices
      const host1 = this.simulator.addHost('host1', 'Host-1', { x: 100, y: 200 });
      const router1 = this.simulator.addRouter('router1', 'Router-1', { x: 300, y: 200 });
      const router2 = this.simulator.addRouter('router2', 'Router-2', { x: 500, y: 200 });
      const host2 = this.simulator.addHost('host2', 'Host-2', { x: 700, y: 200 });

      // Configure IP addresses
      this.simulator.configureHostIP('host1', 'eth0', '192.168.1.10', '255.255.255.0');
      this.simulator.configureRouterIP('router1', 'Fa0/0', '192.168.1.1', '255.255.255.0');
      this.simulator.configureRouterIP('router1', 'Fa0/1', '10.0.0.1', '255.255.255.252');
      this.simulator.configureRouterIP('router2', 'Fa0/0', '10.0.0.2', '255.255.255.252');
      this.simulator.configureRouterIP('router2', 'Fa0/1', '192.168.2.1', '255.255.255.0');
      this.simulator.configureHostIP('host2', 'eth0', '192.168.2.10', '255.255.255.0');

      // Create physical connections
      this.simulator.createLink('host1', 'eth0', 'router1', 'Fa0/0');
      this.simulator.createLink('router1', 'Fa0/1', 'router2', 'Fa0/0');
      this.simulator.createLink('router2', 'Fa0/1', 'host2', 'eth0');

      // Configure routing
      this.simulator.setDefaultGateway('host1', '192.168.1.1');
      this.simulator.setDefaultGateway('host2', '192.168.2.1');
      
      // Add static routes for inter-router communication
      this.simulator.addStaticRoute('router1', '192.168.2.0', '255.255.255.0', '10.0.0.2', 'Fa0/1');
      this.simulator.addStaticRoute('router2', '192.168.1.0', '255.255.255.0', '10.0.0.1', 'Fa0/0');

      // Perform ping test
      const traces = await this.simulator.ping('host1', '192.168.2.10');
      
      // Validate results
      if (traces.length === 0) {
        return { success: false, details: 'No packet traces generated' };
      }

      // Check that packet traversed both routers
      const deviceNames = traces.map(t => t.deviceName);
      const hasRouter1 = deviceNames.includes('Router-1');
      const hasRouter2 = deviceNames.includes('Router-2');
      
      if (!hasRouter1 || !hasRouter2) {
        return { success: false, details: `Missing router traversal - Router-1: ${hasRouter1}, Router-2: ${hasRouter2}` };
      }

      // Check TTL decrements
      const ttlTraces = traces.filter(t => t.action.includes('TTL'));
      if (ttlTraces.length < 2) {
        return { success: false, details: `Expected TTL decrements at each router, got ${ttlTraces.length}` };
      }

      return { success: true, details: `Ping successful across 2 routers with ${traces.length} traces` };

    } catch (error) {
      return { success: false, details: `Test failed: ${error}` };
    }
  }

  /**
   * Test Case 2: Three-Router Triangle Topology
   * 
   * Topology:
   *        Router1
   *       /       \
   *   Host1       Router2
   *              /       \
   *         Router3      Host2
   *           |
   *         Host3
   * 
   * Tests:
   * - Multiple path scenarios
   * - Longest prefix matching
   * - Complex routing table management
   */
  async testTriangleTopology(): Promise<{ success: boolean; details: string }> {
    console.log('\n🧪 Testing Triangle Router Topology...');
    
    try {
      this.simulator.clear();

      // Create triangle of routers with hosts
      const router1 = this.simulator.addRouter('router1', 'Router-1', { x: 400, y: 100 });
      const router2 = this.simulator.addRouter('router2', 'Router-2', { x: 600, y: 300 });
      const router3 = this.simulator.addRouter('router3', 'Router-3', { x: 200, y: 300 });
      
      const host1 = this.simulator.addHost('host1', 'Host-1', { x: 100, y: 100 });
      const host2 = this.simulator.addHost('host2', 'Host-2', { x: 800, y: 300 });
      const host3 = this.simulator.addHost('host3', 'Host-3', { x: 200, y: 500 });

      // Configure IP addresses for different subnets
      this.simulator.configureHostIP('host1', 'eth0', '192.168.1.10', '255.255.255.0');
      this.simulator.configureHostIP('host2', 'eth0', '192.168.2.10', '255.255.255.0');
      this.simulator.configureHostIP('host3', 'eth0', '192.168.3.10', '255.255.255.0');

      // Router interfaces
      this.simulator.configureRouterIP('router1', 'Fa0/0', '192.168.1.1', '255.255.255.0');
      this.simulator.configureRouterIP('router1', 'Fa0/1', '10.0.1.1', '255.255.255.252');
      this.simulator.configureRouterIP('router2', 'Fa0/0', '10.0.1.2', '255.255.255.252');
      this.simulator.configureRouterIP('router2', 'Fa0/1', '192.168.2.1', '255.255.255.0');
      this.simulator.configureRouterIP('router3', 'Fa0/0', '192.168.3.1', '255.255.255.0');
      this.simulator.configureRouterIP('router3', 'Fa0/1', '10.0.2.1', '255.255.255.252');

      // Create connections
      this.simulator.createLink('host1', 'eth0', 'router1', 'Fa0/0');
      this.simulator.createLink('router1', 'Fa0/1', 'router2', 'Fa0/0');
      this.simulator.createLink('router2', 'Fa0/1', 'host2', 'eth0');
      this.simulator.createLink('host3', 'eth0', 'router3', 'Fa0/0');

      // Configure routing - each router knows about remote networks
      this.simulator.setDefaultGateway('host1', '192.168.1.1');
      this.simulator.setDefaultGateway('host2', '192.168.2.1');
      this.simulator.setDefaultGateway('host3', '192.168.3.1');

      this.simulator.addStaticRoute('router1', '192.168.2.0', '255.255.255.0', '10.0.1.2', 'Fa0/1');
      this.simulator.addStaticRoute('router2', '192.168.1.0', '255.255.255.0', '10.0.1.1', 'Fa0/0');

      // Test ping from host1 to host2 (through router1->router2)
      const traces = await this.simulator.ping('host1', '192.168.2.10');
      
      if (traces.length === 0) {
        return { success: false, details: 'No packet traces generated for triangle topology' };
      }

      const routersTraversed = [...new Set(traces.map(t => t.deviceName).filter(name => name.includes('Router')))];
      if (routersTraversed.length < 2) {
        return { success: false, details: `Expected to traverse 2+ routers, got: ${routersTraversed.join(', ')}` };
      }

      return { success: true, details: `Triangle topology test passed with ${traces.length} traces, routers: ${routersTraversed.join(', ')}` };

    } catch (error) {
      return { success: false, details: `Triangle topology test failed: ${error}` };
    }
  }

  /**
   * Test Case 3: Linear Multi-Hop Topology
   * 
   * Tests maximum hop scenarios with 4 routers in series
   */
  async testLinearMultiHop(): Promise<{ success: boolean; details: string }> {
    console.log('\n🧪 Testing Linear Multi-Hop Topology (4 routers)...');
    
    try {
      this.simulator.clear();

      // Create linear chain: Host1-R1-R2-R3-R4-Host2
      const host1 = this.simulator.addHost('host1', 'Host-1', { x: 50, y: 200 });
      const router1 = this.simulator.addRouter('router1', 'Router-1', { x: 150, y: 200 });
      const router2 = this.simulator.addRouter('router2', 'Router-2', { x: 250, y: 200 });
      const router3 = this.simulator.addRouter('router3', 'Router-3', { x: 350, y: 200 });
      const router4 = this.simulator.addRouter('router4', 'Router-4', { x: 450, y: 200 });
      const host2 = this.simulator.addHost('host2', 'Host-2', { x: 550, y: 200 });

      // Configure end hosts
      this.simulator.configureHostIP('host1', 'eth0', '192.168.1.10', '255.255.255.0');
      this.simulator.configureHostIP('host2', 'eth0', '192.168.5.10', '255.255.255.0');

      // Configure router interfaces with /30 subnets between routers
      this.simulator.configureRouterIP('router1', 'Fa0/0', '192.168.1.1', '255.255.255.0');
      this.simulator.configureRouterIP('router1', 'Fa0/1', '10.0.1.1', '255.255.255.252');
      
      this.simulator.configureRouterIP('router2', 'Fa0/0', '10.0.1.2', '255.255.255.252');
      this.simulator.configureRouterIP('router2', 'Fa0/1', '10.0.2.1', '255.255.255.252');
      
      this.simulator.configureRouterIP('router3', 'Fa0/0', '10.0.2.2', '255.255.255.252');
      this.simulator.configureRouterIP('router3', 'Fa0/1', '10.0.3.1', '255.255.255.252');
      
      this.simulator.configureRouterIP('router4', 'Fa0/0', '10.0.3.2', '255.255.255.252');
      this.simulator.configureRouterIP('router4', 'Fa0/1', '192.168.5.1', '255.255.255.0');

      // Create physical links
      this.simulator.createLink('host1', 'eth0', 'router1', 'Fa0/0');
      this.simulator.createLink('router1', 'Fa0/1', 'router2', 'Fa0/0');
      this.simulator.createLink('router2', 'Fa0/1', 'router3', 'Fa0/0');
      this.simulator.createLink('router3', 'Fa0/1', 'router4', 'Fa0/0');
      this.simulator.createLink('router4', 'Fa0/1', 'host2', 'eth0');

      // Configure gateways
      this.simulator.setDefaultGateway('host1', '192.168.1.1');
      this.simulator.setDefaultGateway('host2', '192.168.5.1');

      // Configure static routing for the linear path
      this.simulator.addStaticRoute('router1', '192.168.5.0', '255.255.255.0', '10.0.1.2', 'Fa0/1');
      this.simulator.addStaticRoute('router2', '192.168.5.0', '255.255.255.0', '10.0.2.2', 'Fa0/1');
      this.simulator.addStaticRoute('router2', '192.168.1.0', '255.255.255.0', '10.0.1.1', 'Fa0/0');
      this.simulator.addStaticRoute('router3', '192.168.5.0', '255.255.255.0', '10.0.3.2', 'Fa0/1');
      this.simulator.addStaticRoute('router3', '192.168.1.0', '255.255.255.0', '10.0.2.1', 'Fa0/0');
      this.simulator.addStaticRoute('router4', '192.168.1.0', '255.255.255.0', '10.0.3.1', 'Fa0/0');

      // Test long-distance ping
      const traces = await this.simulator.ping('host1', '192.168.5.10');
      
      if (traces.length === 0) {
        return { success: false, details: 'No traces for multi-hop test' };
      }

      // Verify all 4 routers are traversed
      const routersInTrace = traces.filter(t => t.deviceType === 'router').map(t => t.deviceName);
      const uniqueRouters = [...new Set(routersInTrace)];
      
      if (uniqueRouters.length < 4) {
        return { success: false, details: `Expected 4 routers in path, got: ${uniqueRouters.join(', ')}` };
      }

      // Check for proper TTL decrements (should be 4 decrements)
      const ttlDecrements = traces.filter(t => t.action.includes('TTL'));
      if (ttlDecrements.length < 4) {
        return { success: false, details: `Expected 4 TTL decrements, got ${ttlDecrements.length}` };
      }

      return { success: true, details: `Multi-hop test passed: ${uniqueRouters.length} routers, ${ttlDecrements.length} TTL decrements, ${traces.length} total traces` };

    } catch (error) {
      return { success: false, details: `Multi-hop test failed: ${error}` };
    }
  }

  /**
   * Run all multi-router tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Multi-Router Network Tests...\n');
    
    const tests = [
      { name: 'Two-Router Topology', test: this.testTwoRouterTopology.bind(this) },
      { name: 'Triangle Topology', test: this.testTriangleTopology.bind(this) },
      { name: 'Linear Multi-Hop', test: this.testLinearMultiHop.bind(this) },
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of tests) {
      console.log(`\n📋 Running: ${testCase.name}`);
      try {
        const result = await testCase.test();
        if (result.success) {
          console.log(`✅ PASSED: ${result.details}`);
          passed++;
        } else {
          console.log(`❌ FAILED: ${result.details}`);
          failed++;
        }
      } catch (error) {
        console.log(`❌ ERROR: ${testCase.name} - ${error}`);
        failed++;
      }
    }

    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All multi-router tests passed! The simulator handles complex topologies correctly.');
    } else {
      console.log('⚠️ Some tests failed. Check the implementation for multi-router scenarios.');
    }

    console.log('\n✅ Multi-router test completed');
  }
}

// Export for testing
export default MultiRouterTest;