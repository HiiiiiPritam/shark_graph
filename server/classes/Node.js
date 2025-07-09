class NetworkNode {
  constructor(name, ip) {
    this.name = name;
    this.ip = ip;
    this.links = [];
  }

  connect(link) {
    this.links.push(link);
  }

  receivePacket(packet) {
    console.log(`${this.name} received packet:`, packet);
  }
}

export default NetworkNode;
