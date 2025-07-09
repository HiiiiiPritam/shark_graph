import express from 'express';
import Link from '../../classes/Link.js';
import {nodes} from '../../index.js';
import {links} from '../../index.js';
import Router from '../../classes/Router.js';
import NetworkNode from '../../classes/Node.js';
import Packet from '../../classes/Packet.js';

const router = express.Router();

router.post('/create-node', (req, res) => {
  const { name, ip, type } = req.body;
  const node = type === 'router' ? new Router(name, ip) : new NetworkNode(name, ip);
  nodes[name] = node;
  res.json({ success: true });
});

// API to connect nodes
router.post('/connect', (req, res) => {
  const { nodeA, nodeB } = req.body;
  const link = new Link(nodes[nodeA], nodes[nodeB]);
  links.push(link);
  res.json({ success: true });
});

// API to send packet
router.post('/send-packet', (req, res) => {
  const { src, dest, payload } = req.body;
  const packet = new Packet(nodes[src].ip, nodes[dest].ip, payload);
  nodes[src].receivePacket(packet);
  res.json({ success: true });
});

export default router;