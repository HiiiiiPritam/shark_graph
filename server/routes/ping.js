// server/routes/ping.js
import express from 'express';
import docker from '../docker.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { sourceId, targetIp } = req.body;

  try {
    const container = docker.getContainer(sourceId);

    const exec = await container.exec({
      Cmd: ['ping', '-c', '3', targetIp],
      AttachStdout: true,
      AttachStderr: true,
    });

    exec.start((err, stream) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to start ping exec' });
      }

      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('end', () => {
        res.json({ output });
      });
    });
  } catch (err) {
    console.error('Error executing ping:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;