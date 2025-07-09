class Packet {
  constructor(srcIP, destIP, payload = '') {
    this.srcIP = srcIP;
    this.destIP = destIP;
    this.payload = payload;
    this.ttl = 8;
  }
}

export default Packet;
