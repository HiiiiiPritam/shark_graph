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

// server/routes/networks.js
router.post('/disconnect', async (req, res) => {
  const { containerId, networkId } = req.body;

  try {
    const network = docker.getNetwork(networkId);
    const data = await network.inspect();

    console.log("Network containers:", data.Containers);
    console.log("Requested to disconnect container:", containerId);
    await new Promise(r => setTimeout(r, 100));
    if (!data.Containers || !data.Containers[containerId]) {
      return res.status(200).json({ message: 'Already disconnected or not part of network' });
    }
    await network.disconnect({ Container: containerId, Force: true });
    res.json({ message: 'Disconnected successfully' });
  } catch (err) {
    if (err.message.includes("is not connected to network")) {
    console.warn(`Container ${containerId} already disconnected from network ${networkId}`);
  } else {
    throw err;
  }
  }
});


// DELETE /networks/:id
router.delete('/:id', async (req, res) => {
  const networkId = req.params.id;

  try {
    const network = docker.getNetwork(networkId);

    // Step 1: Inspect network to find connected containers
    // const data = await network.inspect();
    // const connectedContainers = data.Containers;
    // console.log(connectedContainers);
    
    // if (connectedContainers) {
    //   // Step 2: Disconnect all containers from the network
    //   for (const containerId of Object.keys(connectedContainers)) {
    //     //check if the conatiner is not connected then dont disconnect
    //     if (!connectedContainers[containerId]) {
    //       continue;
    //     }
    //     await network.disconnect({ Container: containerId, Force: true });
    //   }
    // }

    // Step 3: Remove the network
    await network.remove();
    res.json({ message: 'Network deleted successfully' });

  } catch (err) {
    console.error('Error deleting network:', err);
    res.status(500).json({ error: 'Failed to delete network' });
  }
});


export default router;