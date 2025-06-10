// server/index.js
import express from 'express';
import cors from 'cors';

import containers from './routes/containers.js';
import networks from './routes/networks.js';
import ping from './routes/ping.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from the server!');
});

app.use('/api/containers', containers);
app.use('/api/networks', networks);
app.use('/api/ping', ping);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
