/**
 * Simple trace collection test to debug ARP visibility issue
 */

import { NetworkSimulator } from '../NetworkSimulator';

export class TraceTest {
  private simulator: NetworkSimulator;

  constructor() {
    this.simulator = new NetworkSimulator();
  }

  async testBasicTraceCollection(): Promise<void> {
    console.log('\n🧪 Starting Basic Trace Collection Test...');
    
    try {
      // Clear any previous setup
      this.simulator.clear();

      // Create simple setup: Host1 - Switch - Host2
      const host1 = this.simulator.addHost('host1', 'Host-1', { x: 100, y: 200 });
      const switch1 = this.simulator.addSwitch('switch1', 'Switch-1', 24, { x: 300, y: 200 });
      const host2 = this.simulator.addHost('host2', 'Host-2', { x: 500, y: 200 });

      // Configure IP addresses on same network
      this.simulator.configureHostIP('host1', 'eth0', '192.168.1.10', '255.255.255.0');
      this.simulator.configureHostIP('host2', 'eth0', '192.168.1.20', '255.255.255.0');

      // Create physical connections
      this.simulator.createLink('host1', 'eth0', 'switch1', 'Fa0/1');
      this.simulator.createLink('host2', 'eth0', 'switch1', 'Fa0/2');

      console.log('🧪 Network setup complete, checking device traces before ping...');
      
      // Check traces before ping
      const host1BeforeTraces = host1.getTraces();
      const switch1BeforeTraces = switch1.getTraces();
      const host2BeforeTraces = host2.getTraces();
      
      console.log(`🧪 BEFORE PING: Host1=${host1BeforeTraces.length}, Switch=${switch1BeforeTraces.length}, Host2=${host2BeforeTraces.length}`);

      // Skip manual trace test for now since packetTracer is private
      console.log('🧪 Skipping manual trace test - packetTracer is private');

      // Perform ping test
      console.log('🧪 Starting ping test from host1 to host2...');
      const traces = await this.simulator.ping('host1', '192.168.1.20');
      
      console.log(`🧪 PING RESULT: Received ${traces.length} traces from ping`);
      
      // Check individual device traces after ping
      const host1AfterTraces = host1.getTraces();
      const switch1AfterTraces = switch1.getTraces();
      const host2AfterTraces = host2.getTraces();
      
      console.log(`🧪 AFTER PING: Host1=${host1AfterTraces.length}, Switch=${switch1AfterTraces.length}, Host2=${host2AfterTraces.length}`);
      
      if (host1AfterTraces.length > 0) {
        console.log('🧪 Host1 traces:', host1AfterTraces.map(t => `${t.action}: ${t.decision}`));
      }
      
      if (switch1AfterTraces.length > 0) {
        console.log('🧪 Switch1 traces:', switch1AfterTraces.map(t => `${t.action}: ${t.decision}`));
      }
      
      if (host2AfterTraces.length > 0) {
        console.log('🧪 Host2 traces:', host2AfterTraces.map(t => `${t.action}: ${t.decision}`));
      }
      
      if (traces.length === 0) {
        console.error('🧪 ❌ TEST FAILED: No traces returned from ping');
      } else {
        console.log(`🧪 ✅ TEST PASSED: ${traces.length} traces collected`);
        traces.forEach((trace, idx) => {
          console.log(`🧪   Trace ${idx + 1}: ${trace.deviceName} - ${trace.action} - ${trace.decision?.substring(0, 50)}...`);
        });
      }
      
    } catch (error) {
      console.error('🧪 ❌ TEST ERROR:', error);
    }
  }
}

// Export for use
export default TraceTest;