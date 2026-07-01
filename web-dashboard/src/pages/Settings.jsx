import React, { useState } from 'react';
import axios from 'axios';

const Settings = ({ apiUrl, updateApiUrl, token, showNotification }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsApiUrl, setSettingsApiUrl] = useState(apiUrl);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${apiUrl}/api/users/change-password`, 
        { old_password: oldPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification('success', 'User password updated successfully.');
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'Failed to update user password.';
      showNotification('error', errorDetail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-view-grid">
      {/* Account Settings */}
      <div className="settings-card glassmorphism">
        <h3>Update User Password</h3>
        <form onSubmit={handleChangePassword} className="settings-form">
          <div className="form-group">
            <label>Current Account Password</label>
            <input 
              type="password" 
              required 
              placeholder="••••••••" 
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>New Account Password</label>
            <input 
              type="password" 
              required 
              placeholder="Minimum 8 characters" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn-settings-save" disabled={loading}>
            {loading ? 'Updating...' : 'Save Password'}
          </button>
        </form>
      </div>

      {/* Environment settings */}
      <div className="settings-card glassmorphism">
        <h3>API Network Configuration</h3>
        <div className="settings-form">
          <div className="form-group">
            <label>API Host Gateway URL</label>
            <input 
              type="text" 
              required 
              placeholder="http://localhost:8000" 
              value={settingsApiUrl}
              onChange={(e) => setSettingsApiUrl(e.target.value)}
            />
          </div>
          <button 
            type="button" 
            onClick={() => updateApiUrl(settingsApiUrl)} 
            className="btn-settings-save"
          >
            Save Connection URL
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
