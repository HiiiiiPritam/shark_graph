import NetworkNode from './Node.js';

class Router extends NetworkNode {
  constructor(name, ip) {
    super(name, ip);
    this.routingTable = {}; // { destIP: nextHopNodeName }
  }

  addRoute(destIP, nextHop) {
    this.routingTable[destIP] = nextHop;
  }

  receivePacket(packet) {
    const nextHop = this.routingTable[packet.destIP];
    if (nextHop) {
      const link = this.links.find(l => l.connectsTo(nextHop));
      if (link) {
        console.log(`${this.name} forwarding packet to ${nextHop}`);
        link.transmit(this, packet);
      } else {
        console.log(`${this.name}: No link to next hop ${nextHop}`);
      }
    } else {
      console.log(`${this.name}: No route to ${packet.destIP}`);
    }
  }
}

export default Router;
