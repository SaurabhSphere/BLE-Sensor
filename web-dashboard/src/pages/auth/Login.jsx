import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ apiUrl, onLoginSuccess, setAuthView, showNotification }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await axios.post(`${apiUrl}/api/auth/login`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const userToken = response.data.access_token;
      onLoginSuccess(userToken);
      showNotification('success', 'Authentication successful.');
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'Authentication failed. Please verify credentials.';
      showNotification('error', errorDetail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h3>Authorized Operator Authentication</h3>
      <div className="form-group">
        <label>User Credentials (Username / Email)</label>
        <input 
          type="text" 
          required 
          placeholder="Enter username or email" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label>Account Password</label>
        <input 
          type="password" 
          required 
          placeholder="••••••••" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>
      <button type="submit" className="btn-auth-submit" disabled={loading}>
        {loading ? 'Authenticating...' : 'Authenticate'}
      </button>
      <div className="auth-links">
        <span onClick={() => setAuthView('register')}>Register Node Operator</span>
        <span onClick={() => setAuthView('forgot-password')}>Recover Access Credentials</span>
      </div>
    </form>
  );
};

export default Login;
