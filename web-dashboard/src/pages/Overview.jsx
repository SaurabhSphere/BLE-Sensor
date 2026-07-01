import React, { useState, useEffect, useMemo } from 'react';
import SensorCard from '../components/SensorCard';

const SENSOR_CATEGORIES = [
  'All', 'DataLogger'
];

const Overview = ({
  packets,
  loadingPackets,
  activeCategory,
  setActiveCategory,
  selectedAppId,
  setSelectedSensor
}) => {
  // Sort and filter states
  const [deviceIdFilter, setDeviceIdFilter] = useState('');
  const [sortField, setSortField] = useState('timestamp'); // 'timestamp', 'type', 'deviceId'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Local filtering logic
  const filteredByApp = selectedAppId === 'All'
    ? packets
    : packets.filter(p => p.appId === selectedAppId);

  const filteredPackets = useMemo(() => {
    let result = activeCategory === 'All'
      ? filteredByApp
      : filteredByApp.filter(p => p.type === activeCategory);

    // Filter by Device ID
    if (deviceIdFilter.trim()) {
      const query = deviceIdFilter.trim().toLowerCase();
      result = result.filter(p => {
        const devId = String(p.displayData?.deviceId || '').toLowerCase();
        const appIdStr = String(p.appId || '').toLowerCase();
        return devId.includes(query) || appIdStr.includes(query);
      });
    }

    // Sort result
    result.sort((a, b) => {
      let valA, valB;
      if (sortField === 'timestamp') {
        valA = new Date(a.timestamp).getTime();
        valB = new Date(b.timestamp).getTime();
      } else if (sortField === 'type') {
        valA = String(a.type || '').toLowerCase();
        valB = String(b.type || '').toLowerCase();
      } else if (sortField === 'deviceId') {
        valA = String(a.displayData?.deviceId || a.appId || '').toLowerCase();
        valB = String(b.displayData?.deviceId || b.appId || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [filteredByApp, activeCategory, deviceIdFilter, sortField, sortOrder]);

  const latestBySensorType = Array.from(new Map(
    filteredByApp.map(p => [p.type, p])
  ).values());

  const filteredLatest = activeCategory === 'All'
    ? latestBySensorType
    : latestBySensorType.filter(p => p.type === activeCategory);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, deviceIdFilter, selectedAppId]);

  // Paginated packets
  const paginatedPackets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPackets.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPackets, currentPage]);

  const totalPages = Math.ceil(filteredPackets.length / itemsPerPage) || 1;

  return (
    <>
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

      {loadingPackets ? (
        <div className="telemetry-loading">
          <div className="loader"></div>
          <p>Synchronizing sensor registry...</p>
        </div>
      ) : packets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.58 16.14a5 5 0 0 1 6.84 0M12 20h.01" />
            </svg>
          </div>
          <h3>No Telemetry Packets Detected</h3>
          <p>Initiate BLE data transmission from the sensor nodes to begin telemetry logging.</p>
        </div>
      ) : (
        <>
          {/* Metrics Cards Grid */}
          <div className="stats-grid">
            {filteredLatest.map(p => (
              <SensorCard
                key={p.id}
                type={p.type}
                data={p.displayData}
                lastUpdate={p.timestamp}
                onClick={() => setSelectedSensor(p)}
              />
            ))}
          </div>

          {/* Recents Table Feed */}
          <section className="data-section">
            <div className="section-header" style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Telemetry Feed</h3>
                  <span className="helper-text">Live logs</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sort:</span>
                  <select 
                    value={sortField} 
                    onChange={(e) => setSortField(e.target.value)}
                    style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}
                  >
                    <option value="timestamp">Timestamp</option>
                    <option value="type">Sensor Type</option>
                    <option value="deviceId">Device ID</option>
                  </select>
                  <button 
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    {sortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
                  </button>
                </div>
              </div>

              {/* Filters Area */}
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--input-bg)', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Device ID:</span>
                  <input 
                    type="text" 
                    placeholder="Search ID..." 
                    value={deviceIdFilter}
                    onChange={(e) => setDeviceIdFilter(e.target.value)}
                    style={{ flex: 1, background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Found: <strong>{filteredPackets.length}</strong>
                </div>
              </div>
            </div>
            
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>TIME</th>
                    <th>TYPE</th>
                    <th>SOURCE ID</th>
                    <th>READINGS</th>
                    <th>INSPECT</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPackets.map(pkt => (
                    <tr key={pkt.id} className="table-row-hover">
                      <td className="timestamp-cell">{new Date(pkt.timestamp).toLocaleTimeString()}</td>
                      <td>
                        <span className={`sensor-tag ${pkt.type.toLowerCase().replace(' ', '-')}`}>
                          {pkt.type}
                        </span>
                      </td>
                      <td className="app-id-cell">{pkt.appId.substring(0, 12)}...</td>
                      <td className="readings-cell">
                        {pkt.type === 'SHT40' && `Temperature: ${pkt.displayData?.temperature}°C | Humidity: ${pkt.displayData?.humidity}% | THI: ${(0.8 * (parseFloat(pkt.displayData?.temperature) || 0) + ((parseFloat(pkt.displayData?.humidity) || 0) / 100) * ((parseFloat(pkt.displayData?.temperature) || 0) - 14.4) + 46.4).toFixed(1)}`}
                        {pkt.type === 'Soil Sensor' && `Moisture: ${pkt.displayData?.moisture}% | Temperature: ${pkt.displayData?.temperature}°C`}
                        {pkt.type === 'sen66' && `CO2: ${pkt.displayData?.co2} ppm | PM2.5: ${pkt.displayData?.pm25} μg/m³`}
                        {pkt.type === 'Lux Sensor' && `Illuminance: ${pkt.displayData?.lux} lx`}
                        {pkt.type === 'Ammonia Sensor' && `Ammonia: ${pkt.displayData?.ammonia} ppm`}
                        {pkt.type === 'DataLogger' && (() => {
                          try {
                            const saved = localStorage.getItem('bovine_tags');
                            const tags = saved ? JSON.parse(saved) : {
                              "11": { name: "Bovine #11", breed: "Murrah Buffalo" },
                              "42": { name: "Bovine #42", breed: "Holstein Cow" },
                              "89": { name: "Bovine #89", breed: "Jersey Cow" },
                              "93": { name: "Bovine #93", breed: "Sahiwal Cow" },
                              "248": { name: "Bovine #248", breed: "Nili-Ravi Buffalo" }
                            };
                            const bovine = tags[pkt.displayData?.deviceId] || { name: `Tag #${pkt.displayData?.deviceId}`, breed: "Unknown" };
                            return `${bovine.name} (${bovine.breed}) | Sequence #${pkt.displayData?.packetId}`;
                          } catch (e) {
                            return `Device ID: ${pkt.displayData?.deviceId} | Sequence #${pkt.displayData?.packetId}`;
                          }
                        })()}
                        {pkt.type === 'Unknown' && `Raw Data Payload Ingested`}
                      </td>
                      <td>
                        <button
                          className="btn-detail-link"
                          onClick={() => setSelectedSensor(pkt)}
                        >
                          Inspect Telemetry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 10px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{
                    background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                    color: currentPage === 1 ? 'rgba(255,255,255,0.2)' : 'white',
                    border: '1px solid var(--card-border)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{
                    background: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                    color: currentPage === totalPages ? 'rgba(255,255,255,0.2)' : 'white',
                    border: '1px solid var(--card-border)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
};

export default Overview;
