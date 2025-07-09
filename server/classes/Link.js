class Link {
  constructor(nodeA, nodeB, delay = 500) {
    this.nodeA = nodeA;
    this.nodeB = nodeB;
    this.delay = delay;

    nodeA.connect(this);
    nodeB.connect(this);
  }

  connectsTo(nodeName) {
    return this.nodeA.name === nodeName || this.nodeB.name === nodeName;
  }

  transmit(sender, packet) {
    const receiver = sender === this.nodeA ? this.nodeB : this.nodeA;
    setTimeout(() => {
      console.log(`Packet transmitted from ${sender.name} to ${receiver.name}`);
      receiver.receivePacket(packet);
    }, this.delay);
  }
}

export default Link;
