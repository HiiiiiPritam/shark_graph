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
        CapAdd: ['NET_ADMIN'],
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

// DELETE /containers/:id
router.delete('/:id', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop().catch(() => {}); // ignore error if already stopped
    await container.remove({ force: true });

    res.json({ message: 'Container deleted successfully' });
  } catch (err) {
    console.error('Error deleting container:', err);
    res.status(500).json({ error: 'Failed to delete container' });
  }
});


export default router;
