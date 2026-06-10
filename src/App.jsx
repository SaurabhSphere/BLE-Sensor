import { useState, useEffect } from 'react';
import axios from 'axios';
import SensorChart from './components/SensorChart';
import SensorCard from './components/SensorCard';
import SensorDetails from './components/SensorDetails';
import './App.css';

const SENSOR_CATEGORIES = [
  'All', 'DataLogger', 'SHT40', 'Soil Sensor', 'sen66', 'Lux Sensor', 'TempLogger', 'Ammonia Sensor'
];

function App() {
  const [packets, setPackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState('overview'); // 'overview' or 'graph'
  const [theme, setTheme] = useState('dark');
  const [selectedAppId, setSelectedAppId] = useState('All');

  const fetchPackets = async () => {
    try {
      // Use current window hostname to ensure compatibility across networks
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'https://ble-sense.onrender.com/'}/api/packets`);

      // Transform raw packets into categorized sensor objects
      const categorizedPackets = response.data.map(pkt => {
        let sensorType = 'Unknown';
        // The Android app sends data as { timestamp: Long, data: Map }
        // The backend stores this as the 'data' field of the MongoDB document
        const payload = pkt.data;
        const innerData = payload.data || {};

        // Logic to determine sensor type based on payload keys
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
          timestamp: pkt.timestamp || payload.timestamp // Prefer MongoDB timestamp
        };
      });

      setPackets(categorizedPackets); // Backend already sorts latest first
    } catch (error) {
      console.error("Error fetching packets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackets();
    const interval = setInterval(fetchPackets, 5000);
    return () => clearInterval(interval);
  }, []);

  // Extract unique App IDs for the dropdown
  const uniqueAppIds = ['All', ...new Set(packets.map(p => p.appId).filter(id => id && id !== 'Unknown'))];

  // Filtering Logic
  const filteredByApp = selectedAppId === 'All'
    ? packets
    : packets.filter(p => p.appId === selectedAppId);

  const filteredPackets = activeCategory === 'All'
    ? filteredByApp
    : filteredByApp.filter(p => p.type === activeCategory);

  // Group latest packet for each sensor type within the filtered set
  const latestBySensorType = Array.from(new Map(
    filteredByApp.map(p => [p.type, p])
  ).values());

  const filteredLatest = activeCategory === 'All'
    ? latestBySensorType
    : latestBySensorType.filter(p => p.type === activeCategory);

  return (
    <div className={`dashboard-wrapper ${theme === 'light' ? 'light-theme' : ''}`}>
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">B</div>
          <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.5px' }}>BleSense</span>
        </div>

        <nav className="sidebar-nav">
          <div
            className={`nav-item ${viewMode === 'overview' ? 'active' : ''}`}
            onClick={() => setViewMode('overview')}
          >
            <span>🏠</span> <span>Overview</span>
          </div>
          <div
            className={`nav-item ${viewMode === 'graph' ? 'active' : ''}`}
            onClick={() => setViewMode('graph')}
          >
            <span>📈</span> <span>Analytics</span>
          </div>
          <div className="nav-item">
            <span>⚙️</span> <span>Settings</span>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-bar">
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>
              {viewMode === 'overview' ? 'Device Overview' : 'Real-time Analytics'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              {packets.length} total packets received
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="device-selector">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '8px' }}>Device:</span>
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="app-id-select"
              >
                {uniqueAppIds.map(id => (
                  <option key={id} value={id}>
                    {id === 'All' ? 'All Devices' : `App ${id.substring(0, 8)}...`}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="btn-secondary"
              style={{ padding: '6px 14px', borderRadius: '100px', fontSize: '0.85rem' }}
            >
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
            <div className="status-badge">
              <div className="pulse"></div>
              SYSTEM LIVE
            </div>
          </div>
        </header>

        {/* Category Filter Bar */}
        <div className="filter-bar">
          {SENSOR_CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`filter-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-state">Syncing with sensor network...</div>
        ) : packets.length === 0 ? (
          <div className="empty-state">
            <h3>No Devices Found</h3>
            <p>Start your Android App to begin logging sensor data.</p>
          </div>
        ) : (
          <>
            {viewMode === 'overview' ? (
              <div className="stats-grid">
                {filteredLatest.map(p => (
                  <SensorCard
                    key={p._id}
                    type={p.type}
                    data={p.displayData}
                    lastUpdate={p.timestamp}
                    onClick={() => setSelectedSensor(p)}
                  />
                ))}
              </div>
            ) : (
              <div className="chart-card">
                <h2>Sensor Stream Analysis</h2>
                <SensorChart data={filteredPackets} />
              </div>
            )}

            {/* Data Feed Table */}
            <section className="data-section">
              <div className="section-header">
                <h3 style={{ margin: 0 }}>Recent Activities</h3>
                <span className="helper-text">{filteredPackets.length} entries shown</span>
              </div>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>TIMESTAMP</th>
                      <th>SENSOR</th>
                      <th>ID</th>
                      <th>PRIMARY READING</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPackets.slice(0, 50).map(pkt => (
                      <tr key={pkt._id}>
                        <td>{new Date(pkt.timestamp).toLocaleTimeString()}</td>
                        <td>
                          <span style={{
                            background: 'rgba(255,255,255,0.05)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600
                          }}>
                            {pkt.type}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--accent-purple)' }}>
                          {pkt.displayData?.packetId || pkt.displayData?.lastPacketId || pkt.displayData?.deviceId || '-'}
                        </td>
                        <td>
                          {pkt.type === 'SHT40' ? `${pkt.displayData?.temperature}°C / ${pkt.displayData?.humidity}%` :
                            pkt.type === 'DataLogger' ? (
                              <span>
                                Packet #{pkt.displayData?.packetId || pkt.displayData?.lastPacketId}
                                {!pkt.displayData?.rawData && <span style={{ color: '#FF6B6B', fontSize: '0.75rem', marginLeft: '5px' }}>(No Hex Data)</span>}
                              </span>
                            ) :
                              pkt.type === 'sen66' ? `CO2: ${pkt.displayData?.co2}` : 'Data Received'}
                        </td>
                        <td>
                          <button
                            className="packet-id-link"
                            onClick={() => setSelectedSensor(pkt)}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Detail Modal Overlay */}
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
