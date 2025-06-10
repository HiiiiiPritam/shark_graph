// server/routes/networks.js
import express from 'express';
import docker from '../docker.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const networks = await docker.listNetworks();
    res.json(networks);
  } catch (err) {
    console.error('Error listing networks:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const network = await docker.createNetwork({
      Name: `net_${Date.now()}`,
      Driver: 'bridge',
      IPAM: {
        Config: [{ Subnet: '192.168.' + Math.floor(Math.random() * 255) + '.0/24' }],
      },
    });

    res.json({ id: network.id, name: network.name });
  } catch (err) {
    console.error('Error creating network:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/connect', async (req, res) => {
  const { containerId, networkId } = req.body;

  try {
    const network = docker.getNetwork(networkId);
    await network.connect({ Container: containerId });

    res.json({ message: 'Container connected to network' });
  } catch (err) {
    console.error('Error connecting container to network:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;