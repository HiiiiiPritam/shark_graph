// server/routes/containers.js
import express from 'express';
import docker from '../docker.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: false });
    res.json(containers);
  } catch (err) {
    console.error('Error listing containers:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const container = await docker.createContainer({
      Image: 'alpine',
      Cmd: ['/bin/sh'],
      Tty: true,
      HostConfig: {
        
      },
    });

    await container.start();
    // Immediately disconnect from default "bridge"
    const bridgeNetwork = docker.getNetwork('bridge');
    await bridgeNetwork.disconnect({ Container: container.id, Force: true });

    res.json({ id: container.id, name: container.id });
  } catch (err) {
    console.error('Error creating container:', err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const container = docker.getContainer(id);
const data = await container.inspect();

const networks = data.NetworkSettings.Networks;

// Assuming you want the first attached network:
const networkName = Object.keys(networks)[0];
const ip = networks[networkName].IPAddress;

  res.json({ IPAddress: ip });
});

export default router;
