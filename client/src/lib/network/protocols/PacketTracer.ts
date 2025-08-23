import { PacketTrace } from '../types';

export class PacketTracer {
  private traces: PacketTrace[] = [];
  private currentStepNumber: number = 0;

  addTrace(trace: PacketTrace): void {
    this.traces.push(trace);
    console.log(`[TRACE ${trace.stepNumber}] ${trace.deviceName} (${trace.deviceType}): ${trace.action} - ${trace.decision}`);
  }

  getTraces(): PacketTrace[] {
    return [...this.traces];
  }

  clearTraces(): void {
    this.traces = [];
    this.currentStepNumber = 0;
  }

  getNextStepNumber(): number {
    return ++this.currentStepNumber;
  }

  getLastTrace(): PacketTrace | null {
    return this.traces.length > 0 ? this.traces[this.traces.length - 1] : null;
  }

  getTracesByDevice(deviceId: string): PacketTrace[] {
    return this.traces.filter(trace => trace.deviceId === deviceId);
  }

  getTracesByPacket(packetId: string): PacketTrace[] {
    return this.traces.filter(trace => trace.packet.id === packetId);
  }

  exportTraces(): string {
    let output = 'Packet Trace Analysis\n';
    output += '====================\n\n';

    this.traces.forEach((trace, index) => {
      output += `Step ${trace.stepNumber}: ${trace.deviceName} (${trace.deviceType})\n`;
      output += `  Action: ${trace.action}\n`;
      output += `  Time: ${new Date(trace.timestamp).toISOString()}\n`;
      output += `  Decision: ${trace.decision}\n`;
      
      if (trace.incomingInterface) {
        output += `  Incoming Interface: ${trace.incomingInterface}\n`;
      }
      
      if (trace.outgoingInterface) {
        output += `  Outgoing Interface: ${trace.outgoingInterface}\n`;
      }

      if (trace.routingTableUsed) {
        output += `  Route Used: ${trace.routingTableUsed.destinationNetwork.address}/${trace.routingTableUsed.subnetMask} via ${trace.routingTableUsed.nextHop.address}\n`;
      }

      if (trace.arpTableUsed) {
        output += `  ARP Entry Used: ${trace.arpTableUsed.ipAddress.address} -> ${trace.arpTableUsed.macAddress.address}\n`;
      }

      output += `  Packet: ${trace.packet.sourceMac.address} -> ${trace.packet.destinationMac.address}\n`;
      output += '\n';
    });

    return output;
  }
}