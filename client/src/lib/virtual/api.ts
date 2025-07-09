import axios from 'axios';

const BASE = 'http://localhost:4000/api/virtual';

export const createNode = (name: string, ip: string, type: 'node' | 'router') =>
  axios.post(`${BASE}/create-node`, { name, ip, type });

export const connectNodes = (nodeA: string, nodeB: string) =>
  axios.post(`${BASE}/connect`, { nodeA, nodeB });

export const sendPacket = (src: string, dest: string, payload: string) =>
  axios.post(`${BASE}/send-packet`, { src, dest, payload });

export const addRoute = (router: string, destIP: string, nextHop: string) =>
  axios.post(`${BASE}/add-route`, { router, destIP, nextHop });