// server/index.js
import express from 'express';
import cors from 'cors';

import containers from './routes/containers.js';
import networks from './routes/networks.js';
import ping from './routes/ping.js';
import virtual from './routes/virtual/routes.js';


import NetworkNode from './classes/Node.js';
import Router from './classes/Router.js';
import Link from './classes/Link.js';
import Packet from './classes/Packet.js';

const app = express();
app.use(cors());
app.use(express.json());

const nodes = {};
const links = [];
export { nodes, links };

app.get('/', (req, res) => {
  res.send('Hello from the server!');
});

app.use('/api/containers', containers);
app.use('/api/networks', networks);
app.use('/api/ping', ping);
app.use('/api/virtual', virtual);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
