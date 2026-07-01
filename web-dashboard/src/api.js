import axios from 'axios';

const api = axios.create({
  baseURL: 'https://ble-sensor.onrender.com',//'http://localhost:8000',//
  timeout: 15000,
});

// Request Interceptor: Automatically inject Authorization token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
