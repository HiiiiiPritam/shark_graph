// server/routes/ping.js
import express from 'express';
import docker from '../docker.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { sourceId, targetId } = req.body;

  try {
    // 1. Inspect both containers
    const src = docker.getContainer(sourceId);
    const tgt = docker.getContainer(targetId);
    const [ srcInfo, tgtInfo ] = await Promise.all([ src.inspect(), tgt.inspect() ]);
    // 2. Figure out which networks each sits on
    const srcNets = Object.keys(srcInfo.NetworkSettings.Networks);
    const tgtNets = Object.keys(tgtInfo.NetworkSettings.Networks);
    // 3. See if they share a network
    const common = srcNets.find((n) => tgtNets.includes(n));
    let targetIp;

    if (common) {
      // ── Same‐network case: just ping directly
      targetIp = tgtInfo.NetworkSettings.Networks[common].IPAddress;
    } else {
      // ── Cross‑network case: find the router (bridge) container dynamically

      // pick one net from each
      const [srcNet] = srcNets;
      const [tgtNet] = tgtNets;

      // get network members
      const net1 = await docker.getNetwork(srcNet).inspect();
      const net2 = await docker.getNetwork(tgtNet).inspect();

      const ids1 = Object.keys(net1.Containers || {});
      const ids2 = Object.keys(net2.Containers || {});

      // intersect → bridge container(s)
      const bridges = ids1.filter((id) => ids2.includes(id));
      if (bridges.length === 0) {
        return res.status(400).json({ error: 'No bridge router found between these networks' });
      }

      const bridgeId = bridges[0];
      const bridgeInfo = await docker.getContainer(bridgeId).inspect();

      // get gateway IP on source’s network
      const gwIp = bridgeInfo.NetworkSettings.Networks[srcNet].IPAddress;

      // target IP & subnet for route
      targetIp = tgtInfo.NetworkSettings.Networks[tgtNet].IPAddress;
      const subnet = targetIp.replace(/\.\d+$/, '.0') + '/24';

      // inject static route into source container
      const addRoute = await src.exec({
        Cmd: ['sh','-c', `ip route replace ${subnet} via ${gwIp}`],
        AttachStdout: true,
        AttachStderr: true,
      });
      await addRoute.start();
    }

    // 4. Finally run the ping
    const execPing = await src.exec({
      Cmd: ['ping','-c','3', targetIp],
      AttachStdout: true,
      AttachStderr: true,
    });

    execPing.start((err, stream) => {
      if (err) return res.status(500).json({ error: 'Ping exec failed' });
      let output = '';
      stream.on('data', (c) => (output += c.toString()));
      stream.on('end', () => res.json({ output }));
    });

  } catch (err) {
    console.error('Ping route error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
