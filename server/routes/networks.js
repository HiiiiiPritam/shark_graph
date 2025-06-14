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
    let name = `net_${Date.now()}`
    const network = await docker.createNetwork({
      Name: name,
      Driver: 'bridge',
      IPAM: {
        Config: [{ Subnet: '192.168.' + Math.floor(Math.random() * 255) + '.0/24' }],
      },
    });
    //console.log("Created network:", network);
    res.json({ id: network.id, name:name });
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

router.post('/bridge', async (req, res) => {
  const { network1, network2 } = req.body;

  if (!network1 || !network2) {
    return res.status(400).json({ error: 'Both network IDs are required.' });
  }

  try {
    // Step 1: Create a router container
    const container = await docker.createContainer({
      Image: 'alpine', // Or 'ubuntu' if you prefer
      Cmd: ['sh', '-c', `
  apk add --no-cache iptables iproute2 &&
  iptables -P FORWARD ACCEPT &&
  while true; do sleep 3600; done
  `],
      name: `bridge_${network1.substring(0, 5)}_${network2.substring(0, 5)}`,
      Tty: true,
      
    });

    await container.start();

    // Step 2: Connect it to both networks
    const net1 = docker.getNetwork(network1);
    const net2 = docker.getNetwork(network2);

    await net1.connect({ Container: container.id });
    await net2.connect({ Container: container.id });
    console.log("Connected to both networks", container.id);
    res.json({
      message: 'Bridge container created and connected to both networks',
      containerId: container.id,
      name: `bridge_${network1.substring(0, 5)}_${network2.substring(0, 5)}`
    });
  } catch (error) {
    console.error('Error creating bridge router:', error);
    res.status(500).json({ error: error.message });
  }
});

// server/routes/network.js
router.post('/remove-bridge-router', async (req, res) => {
  const { network1, network2 } = req.body;

  try {
    // Logic to find and remove any router container connected to both networks
    const containers = await docker.listContainers({ all: true });
    
    
    for (const c of containers) {
      const container = docker.getContainer(c.Id);
      const info = await container.inspect();

      const connectedNets = Object.keys(info.NetworkSettings.Networks);
      //console.log("Containers:", connectedNets);
      if (
        connectedNets.includes(network1) &&
        connectedNets.includes(network2)
      ) {
        // Disconnect from both and remove container
        //console.log("Found bridge router container:", c.Id);
        
        await docker.getNetwork(network1).disconnect({ Container: c.Id, Force: true });
        await docker.getNetwork(network2).disconnect({ Container: c.Id, Force: true });

        await container.remove({ force: true });

        console.log(`Removed bridge router container: ${c.Id}`);

        return res.json({ removed: true });
      }
    }

    res.json({ removed: false, message: "No bridge container found" });
  } catch (err) {
    console.error("Error removing bridge router:", err.message);
    res.status(500).json({ error: err.message });
  }
});



export default router;