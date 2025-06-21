// lib/api.ts
import axios from 'axios';

export const BASE_URL = 'http://localhost:4000/api'; // Change if running on VPS/domain

export const createContainer = async () => {
  const res = await axios.  post(`${BASE_URL}/containers`);
  return res.data;
};

export const createNetwork = async () => {
  const res = await axios.post(`${BASE_URL}/networks`);
  return res.data;
};

export const connectToNetwork = async (containerId: string, networkId: string) => {
  const res = await axios.post(`${BASE_URL}/networks/connect`, {
    containerId,
    networkId,
  });
  return res.data;
};

export const pingContainer = async (sourceId: string, targetId: string) => {

  const res = await axios.post(`${BASE_URL}/ping`, {
    sourceId,
    targetId,
  });
  return res.data;
};

export const createBridgeRouter= async (network1: string, network2: string) => {
  const res = await axios.post(`${BASE_URL}/networks/bridge`, {
    network1,
    network2,
  });
  return res.data;
}
