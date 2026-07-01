import { useState, useEffect } from 'react';
import axios from 'axios';

// Reusable Components
import SensorDetails from './components/SensorDetails';
import Notification from './components/Notification';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Authentication Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Application Pages
import Overview from './pages/Overview';
import Analytics from './pages/Analytics';
import QueueMonitor from './pages/QueueMonitor';
import DataLoggerViewer from './pages/DataLoggerViewer';
import AdminPanel from './pages/AdminPanel';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

import './App.css';

function App() {
  // Authentication & Session State
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Dashboard & Navigation State
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'graph', 'queue', 'datalogger', 'admin', 'settings'
  const [authView, setAuthView] = useState('login'); // 'login', 'register', 'forgot-password', 'reset-password'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [apiUrl, setApiUrl] = useState('https://ble-sensor.onrender.com');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(localStorage.getItem('sidebar_collapsed') === 'true');

  const toggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem('sidebar_collapsed', String(nextState));
  };
  
  // Telemetry Data State
  const [packets, setPackets] = useState([]);
  const [loadingPackets, setLoadingPackets] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedAppId, setSelectedAppId] = useState('All');
  const [selectedDlPacket, setSelectedDlPacket] = useState(null);
  
  // DataLogger Raw Ingestion Queue State
  const [rawPackets, setRawPackets] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  
  // Notification Toast Banner State
  const [notification, setNotification] = useState(null);

  // Password Reset Token State
  const [resetTokenVal, setResetTokenVal] = useState('');

  // Check URL query parameters for reset token or verify callback on initial mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    // Check if we are on a reset-password flow
    if (window.location.pathname.includes('reset-password') || tokenParam) {
      if (tokenParam) {
        setToken(''); // Ensure auth views trigger
        setResetTokenVal(tokenParam);
        window.location.hash = '#overview';
        setAuthView('reset-password');
      }
    }
  }, []);

  // Hash-based router listener for SPA state synchronization
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#overview';
      
      if (hash === '#overview') {
        setViewMode('overview');
      } else if (hash === '#graph' || hash === '#analytics') {
        setViewMode('graph');
      } else if (hash === '#queue') {
        setViewMode('queue');
      } else if (hash === '#datalogger' || hash === '#inspector') {
        setViewMode('datalogger');
      } else if (hash === '#admin') {
        if (user && !user.is_superuser) {
          setViewMode('not-found');
        } else {
          setViewMode('admin');
        }
      } else if (hash === '#settings') {
        setViewMode('settings');
      } else {
        setViewMode('not-found');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  const navigateTo = (mode) => {
    let mappedHash = mode;
    if (mode === 'graph') mappedHash = 'analytics';
    if (mode === 'datalogger') mappedHash = 'inspector';
    window.location.hash = '#' + mappedHash;
  };

  // Set Theme Class on Body
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);



  // Helper for displaying notifications
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch logged-in user profile
  const fetchUserProfile = async (authToken) => {
    try {
      setAuthLoading(true);
      const response = await axios.get(`${apiUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error("Session verification failed:", error);
      handleLogout();
    } finally {
      setAuthLoading(false);
    }
  };

  // Verify token on mount or token change
  useEffect(() => {
    if (token) {
      fetchUserProfile(token);
    } else {
      setAuthLoading(false);
    }
  }, [token, apiUrl]);

  // Fetch BLE Packets from the backend
  const fetchPackets = async () => {
    if (!token) return;
    try {
      const [response, dlResponse] = await Promise.all([
        axios.get(`${apiUrl}/api/packets`),
        axios.get(`${apiUrl}/api/packets/datalogger/processed?include_points=true`)
      ]);
      
      const generalPackets = response.data.map(pkt => {
        let sensorType = 'Unknown';
        const payload = pkt.data;
        const innerData = payload.data || {};

        if (innerData.points) sensorType = 'DataLogger';
        else if (innerData.temperature && innerData.humidity) sensorType = 'SHT40';
        else if (innerData.nitrogen || innerData.phosphorus) sensorType = 'Soil Sensor';
        else if (innerData.co2 || innerData.pm25) sensorType = 'sen66';
        else if (innerData.lux) sensorType = 'Lux Sensor';
        else if (innerData.ammonia) sensorType = 'Ammonia Sensor';

        return {
          ...pkt,
          appId: pkt.appId || innerData.appId || 'Unknown',
          type: sensorType,
          displayData: innerData,
          timestamp: pkt.timestamp || payload.timestamp
        };
      });

      // Transform relational DataLogger records into same unified shape for Overview
      const dlPackets = dlResponse.data.map(pkt => {
        const pointsMapped = pkt.points ? pkt.points.map(pt => ({
          x: pt.x,
          y: pt.y,
          z: pt.z
        })) : [];

        return {
          id: `dl-${pkt.id}`,
          appId: pkt.app_id || pkt.appId || 'Unknown',
          type: 'DataLogger',
          displayData: {
            appId: pkt.app_id || pkt.appId,
            deviceId: pkt.device_id,
            packetId: pkt.packet_id_num,
            totalPackets: pkt.total_packets,
            rawData: pkt.raw_data,
            points: pointsMapped,
            rawPacket: pkt.raw_packet
          },
          timestamp: pkt.timestamp,
          rawPacket: pkt.raw_packet
        };
      });

      // Combine and sort by timestamp descending
      const combinedPackets = [...generalPackets, ...dlPackets].sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setPackets(combinedPackets);
    } catch (error) {
      console.error("Error fetching telemetry packets:", error);
    } finally {
      setLoadingPackets(false);
    }
  };

  const fetchRawPackets = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${apiUrl}/api/packets/datalogger/raw`);
      setRawPackets(response.data);
    } catch (error) {
      console.error("Error fetching raw packets:", error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPackets();
      fetchRawPackets();
      const interval = setInterval(() => {
        fetchPackets();
        fetchRawPackets();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [token, apiUrl]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setPackets([]);
    setViewMode('overview');
  };

  // RENDER SECURITY / AUTHENTICATION INTERFACES
  if (!token || authLoading) {
    return (
      <div className={`auth-container ${theme === 'light' ? 'light-theme' : ''}`}>
        <Notification notification={notification} />
        
        {authLoading ? (
          <div className="auth-card glassmorphism loading-auth">
            <div className="loader"></div>
            <h3>Verifying session...</h3>
          </div>
        ) : (
          <div className="auth-card glassmorphism">
            <div className="auth-logo">
              <div className="logo-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M6 3h12M18 3v3c0 2.2-1.8 4-4 4h-4c-2.2 0-4-1.8-4-4V3M5.5 21h13M8.5 10.5L3 21h18l-5.5-10.5" />
                </svg>
              </div>
              <h2>BLE Sensor Research Portal</h2>
            </div>
            
            {authView === 'login' && (
              <Login 
                apiUrl={apiUrl} 
                onLoginSuccess={(t) => {
                  localStorage.setItem('token', t);
                  setToken(t);
                }} 
                setAuthView={setAuthView} 
                showNotification={showNotification} 
              />
            )}

            {authView === 'register' && (
              <Register 
                apiUrl={apiUrl} 
                setAuthView={setAuthView} 
                showNotification={showNotification} 
              />
            )}

            {authView === 'forgot-password' && (
              <ForgotPassword 
                apiUrl={apiUrl} 
                setAuthView={setAuthView} 
                showNotification={showNotification} 
              />
            )}

            {authView === 'reset-password' && (
              <ResetPassword 
                apiUrl={apiUrl} 
                resetTokenVal={resetTokenVal}
                setResetTokenVal={setResetTokenVal} 
                setAuthView={setAuthView} 
                showNotification={showNotification} 
              />
            )}
            

          </div>
        )}
      </div>
    );
  }

  // RENDER AUTHENTICATED DASHBOARD
  const uniqueAppIds = ['All', ...new Set(packets.map(p => p.appId).filter(id => id && id !== 'Unknown'))];

  return (
    <div className={`dashboard-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${theme === 'light' ? 'light-theme' : ''}`}>
      <Notification notification={notification} />


        {/* Sidebar Nav */}
        <Sidebar 
          viewMode={viewMode} 
          setViewMode={navigateTo} 
          user={user} 
          onLogout={handleLogout} 
          isCollapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />

        {/* Main Content Area */}
        <main className="main-content">
          <Header 
            viewMode={viewMode}
            packets={packets}
            rawPackets={rawPackets}
            theme={theme}
            setTheme={setTheme}
            selectedAppId={selectedAppId}
            setSelectedAppId={setSelectedAppId}
            uniqueAppIds={uniqueAppIds}
          />

          {/* Conditional Page View Router */}
          {viewMode === 'overview' && (
            <Overview 
              packets={packets}
              loadingPackets={loadingPackets}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              selectedAppId={selectedAppId}
              setSelectedSensor={setSelectedSensor}
            />
          )}

          {viewMode === 'graph' && (
            <Analytics 
              packets={packets}
              loadingPackets={loadingPackets}
              selectedAppId={selectedAppId}
            />
          )}

          {viewMode === 'queue' && (
            <QueueMonitor 
              apiUrl={apiUrl}
              token={token}
              rawPackets={rawPackets}
              fetchRawPackets={fetchRawPackets}
              queueLoading={queueLoading}
              setQueueLoading={setQueueLoading}
              showNotification={showNotification}
            />
          )}

          {viewMode === 'datalogger' && (
            <DataLoggerViewer 
              packets={packets}
              selectedDlPacket={selectedDlPacket}
              setSelectedDlPacket={setSelectedDlPacket}
              showNotification={showNotification}
            />
          )}

          {viewMode === 'admin' && (
            <AdminPanel 
              apiUrl={apiUrl}
              token={token}
              user={user}
              showNotification={showNotification}
            />
          )}

          {viewMode === 'settings' && (
            <Settings 
              apiUrl={apiUrl}
              token={token}
              showNotification={showNotification}
            />
          )}

          {viewMode === 'not-found' && (
            <NotFound />
          )}
        </main>


      {/* Sensor Modal Overlay Details */}
      {selectedSensor && (
        <SensorDetails
          sensor={selectedSensor}
          onClose={() => setSelectedSensor(null)}
        />
      )}
    </div>
  );
}

export default App;
