import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getCoins = async () => {
  const response = await api.get('/api/coins');
  return response.data;
};

export const getCoinDetails = async (id) => {
  const response = await api.get(`/api/coins/${id}`);
  return response.data;
};

export const getCoinHistory = async (id, range = '7d') => {
  const response = await api.get(`/api/coins/${id}/history`, {
    params: { range },
  });
  return response.data;
};

export const getWatchlist = async () => {
  const response = await api.get('/api/watchlist');
  return response.data;
};

export const addToWatchlist = async (coinId) => {
  const response = await api.post('/api/watchlist', { coin_id: coinId });
  return response.data;
};

export const removeFromWatchlist = async (coinId) => {
  const response = await api.delete(`/api/watchlist/${coinId}`);
  return response.data;
};

export default api;
