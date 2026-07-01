import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const DataLoggerViewer = ({
  packets,
  selectedDlPacket,
  setSelectedDlPacket,
  showNotification
}) => {
  const [deviceIdFilter, setDeviceIdFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc', 'asc'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const dataloggerPackets = useMemo(() => {
    let result = packets.filter(p => p.type === 'DataLogger');

    // Filter by Device ID
    if (deviceIdFilter.trim()) {
      const query = deviceIdFilter.trim().toLowerCase();
      result = result.filter(p => {
        const devId = String(p.displayData?.deviceId || '').toLowerCase();
        return devId.includes(query);
      });
    }

    // Sort by timestamp
    result.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [packets, deviceIdFilter, sortOrder]);

  const activeDlPacket = dataloggerPackets.find(p => p.id === selectedDlPacket?.id) || dataloggerPackets[0] || null;

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deviceIdFilter]);

  const paginatedPackets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return dataloggerPackets.slice(startIndex, startIndex + itemsPerPage);
  }, [dataloggerPackets, currentPage]);

  const totalPages = Math.ceil(dataloggerPackets.length / itemsPerPage) || 1;

  if (packets.filter(p => p.type === 'DataLogger').length === 0) {
    return (
      <div className="empty-state glassmorphism" style={{ padding: '6rem 2rem' }}>
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </div>
        <h3>No Processed DataLogger Logs</h3>
        <p>Parsed spatial logs will appear here upon raw telemetry ingestion and async processing.</p>
      </div>
    );
  }

  // Pre-calculate scientific metrics if active packet exists
  let chartData = [];
  let avgMagnitude = 0;
  let peakMagnitude = 0;
  let dominantAxis = 'None';
  let predictedState = 'Low Activity / Rest';
  let stateColor = 'var(--accent-teal)';

  if (activeDlPacket && activeDlPacket.displayData?.points) {
    const points = activeDlPacket.displayData.points;
    chartData = points.map((pt, index) => {
      const x = parseFloat(pt.x) || 0;
      const y = parseFloat(pt.y) || 0;
      const z = parseFloat(pt.z) || 0;
      const mag = Math.sqrt(x * x + y * y + z * z);
      return {
        sample: index + 1,
        x,
        y,
        z,
        magnitude: parseFloat(mag.toFixed(2))
      };
    });

    if (chartData.length > 0) {
      const sumMag = chartData.reduce((acc, d) => acc + d.magnitude, 0);
      avgMagnitude = parseFloat((sumMag / chartData.length).toFixed(2));
      peakMagnitude = parseFloat(Math.max(...chartData.map(d => d.magnitude)).toFixed(2));

      const sumX = points.reduce((acc, d) => acc + Math.abs(parseFloat(d.x) || 0), 0);
      const sumY = points.reduce((acc, d) => acc + Math.abs(parseFloat(d.y) || 0), 0);
      const sumZ = points.reduce((acc, d) => acc + Math.abs(parseFloat(d.z) || 0), 0);

      if (sumX > sumY && sumX > sumZ) dominantAxis = 'X-Axis';
      else if (sumY > sumX && sumY > sumZ) dominantAxis = 'Y-Axis';
      else if (sumZ > sumX && sumZ > sumY) dominantAxis = 'Z-Axis';

      if (avgMagnitude >= 24) {
        predictedState = 'High Activity / Walk';
        stateColor = '#FF6B6B';
      } else if (avgMagnitude >= 12) {
        predictedState = 'Mod Activity / Forage';
        stateColor = '#ffc658';
      }
    }
  }

  const resolveBovineTag = (deviceId) => {
    try {
      const saved = localStorage.getItem('bovine_tags');
      const tags = saved ? JSON.parse(saved) : {
        "11": { name: "Bovine #11", breed: "Murrah Buffalo", location: "Barn Sector A", weight: "480 kg", notes: "Lactation study subject A" },
        "42": { name: "Bovine #42", breed: "Holstein Cow", location: "Barn Sector B", weight: "620 kg", notes: "Milk yield telemetry group 1" },
        "89": { name: "Bovine #89", breed: "Jersey Cow", location: "Barn Sector B", weight: "510 kg", notes: "High fat content test cow" },
        "93": { name: "Bovine #93", breed: "Sahiwal Cow", location: "Barn Sector A", weight: "430 kg", notes: "Native heat tolerance study" },
        "248": { name: "Bovine #248", breed: "Nili-Ravi Buffalo", location: "Pasture Sector C", weight: "550 kg", notes: "Grazing behavior tracking collar" }
      };
      return tags[deviceId] || { name: `Tag #${deviceId}`, breed: "Unknown Subject", location: "Unknown Location", weight: "--", notes: "No registration" };
    } catch (e) {
      return { name: `Tag #${deviceId}`, breed: "Unknown Subject", location: "Unknown Location", weight: "--", notes: "" };
    }
  };

  const activeBovine = activeDlPacket ? resolveBovineTag(activeDlPacket.displayData?.deviceId) : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'stretch' }}>
      {/* Left Column: Master List of Log Entries */}
      <div className="glassmorphism" style={{ padding: '1.5rem', maxHeight: '78vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <h4 style={{ marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
            DataLogger Logs ({dataloggerPackets.length})
          </h4>
          
          {/* Device ID Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
            <input 
              type="text" 
              placeholder="Filter by Device ID..." 
              value={deviceIdFilter}
              onChange={(e) => setDeviceIdFilter(e.target.value)}
              style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', width: '100%' }}
            />
          </div>

          {/* Sort Order Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sort Time:</span>
            <button 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              {sortOrder === 'desc' ? '▼ Newest' : '▲ Oldest'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          {paginatedPackets.map(p => {
            const bovine = resolveBovineTag(p.displayData?.deviceId);
            return (
              <div
                key={p.id}
                onClick={() => setSelectedDlPacket(p)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: activeDlPacket?.id === p.id ? 'var(--accent-teal)' : 'var(--card-border)',
                  background: activeDlPacket?.id === p.id ? 'rgba(60, 213, 204, 0.05)' : 'var(--input-bg)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
                className="table-row-hover"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span>{bovine.name} ({bovine.breed})</span>
                  <span style={{ color: 'var(--accent-teal)' }}>Index #{p.displayData?.packetId}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{new Date(p.timestamp).toLocaleTimeString()}</span>
                  <span style={{ fontWeight: 600 }}>80 XYZ Coordinates</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--card-border)', paddingTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Page {currentPage} of {totalPages}</span>
            <span>Total: {dataloggerPackets.length}</span>
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              style={{
                flex: 1,
                background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                color: currentPage === 1 ? 'rgba(255,255,255,0.2)' : 'white',
                border: '1px solid var(--card-border)',
                padding: '6px',
                borderRadius: '6px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              Prev
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              style={{
                flex: 1,
                background: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                color: currentPage === totalPages ? 'rgba(255,255,255,0.2)' : 'white',
                border: '1px solid var(--card-border)',
                padding: '6px',
                borderRadius: '6px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Detail Inspector Panel */}
      <div className="glassmorphism" style={{ padding: '2.25rem', maxHeight: '78vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {activeDlPacket ? (
          <div>
            {/* Header Details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--card-border)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>
                  {activeBovine.name} ({activeBovine.breed})
                </h3>
                <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Location: <strong>{activeBovine.location}</strong> | Weight: <strong>{activeBovine.weight}</strong>
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Notes: {activeBovine.notes}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace', opacity: 0.7 }}>
                  Session ID: {activeDlPacket.appId}
                </p>
              </div>
              <div className="status-badge live">
                <div className="pulse"></div>
                INDEXED
              </div>
            </div>

            {/* Ingestion Metadata Info */}
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Metadata</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '1.75rem' }}>
              <div className="sensor-card" style={{ border: 'none', background: 'rgba(255,255,255,0.015)', padding: '1.25rem' }}>
                <div className="sensor-label">Batch ID</div>
                <div className="sensor-value" style={{ fontSize: '1.5rem', color: 'var(--accent-teal)', fontWeight: 800 }}>
                  #{activeDlPacket.displayData?.packetId}
                </div>
              </div>
              <div className="sensor-card" style={{ border: 'none', background: 'rgba(255,255,255,0.015)', padding: '1.25rem' }}>
                <div className="sensor-label">Record Time</div>
                <div className="sensor-value" style={{ fontSize: '1.05rem', fontWeight: 700, padding: '4px 0' }}>
                  {new Date(activeDlPacket.timestamp).toLocaleString()}
                </div>
              </div>
              <div className="sensor-card" style={{ border: 'none', background: 'rgba(255,255,255,0.015)', padding: '1.25rem' }}>
                <div className="sensor-label">Ingested</div>
                <div className="sensor-value" style={{ fontSize: '1.05rem', fontWeight: 700, padding: '4px 0' }}>
                  {activeDlPacket.rawPacket?.created_at ? new Date(activeDlPacket.rawPacket.created_at).toLocaleString() : '--'}
                </div>
              </div>
              <div className="sensor-card" style={{ border: 'none', background: 'rgba(255,255,255,0.015)', padding: '1.25rem' }}>
                <div className="sensor-label">Indexed</div>
                <div className="sensor-value" style={{ fontSize: '1.05rem', fontWeight: 700, padding: '4px 0' }}>
                  {activeDlPacket.rawPacket?.processed_at ? new Date(activeDlPacket.rawPacket.processed_at).toLocaleString() : '--'}
                </div>
              </div>
            </div>



            {/* Acceleration Waveforms Chart */}
            <div style={{ height: '320px', width: '100%', marginBottom: '1.75rem', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--card-border)', borderRadius: '14px', padding: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Acceleration Waves</h4>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="sample" stroke="var(--text-secondary)" fontSize={10} />
                  <YAxis stroke="var(--text-secondary)" fontSize={10} />
                  <Tooltip contentStyle={{ background: 'var(--bg-sidebar)', borderColor: 'var(--card-border)', color: 'var(--text-main)', borderRadius: '8px' }} itemStyle={{ color: 'var(--text-main)' }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="x" stroke="#FF6B6B" dot={false} strokeWidth={1.5} name="X Axis" />
                  <Line type="monotone" dataKey="y" stroke="#4ECDC4" dot={false} strokeWidth={1.5} name="Y Axis" />
                  <Line type="monotone" dataKey="z" stroke="#95E1D3" dot={false} strokeWidth={1.5} name="Z Axis" />
                  <Line type="monotone" dataKey="magnitude" stroke="#FFAE57" dot={false} strokeWidth={1} strokeDasharray="3 3" name="SVM Magnitude" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Parsed Points Grid */}
            <div className="points-grid">
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', background: 'var(--input-bg)', borderBottom: '1px solid var(--card-border)' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>XYZ Coordinates</span>
                <span className="info-badge">80 Samples</span>
              </div>
              
              <div className="grid-header" style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr', padding: '10px 18px', borderBottom: '1px solid var(--card-border)' }}>
                <span>Sample</span>
                <span style={{ color: '#FF6B6B' }}>X Axis</span>
                <span style={{ color: '#4ECDC4' }}>Y Axis</span>
                <span style={{ color: '#95E1D3', textAlign: 'right' }}>Z Axis</span>
              </div>

              <div className="grid-scroll" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {activeDlPacket.displayData?.points && activeDlPacket.displayData.points.map((pt, i) => (
                  <div 
                    key={i} 
                    className="grid-row" 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '70px 1fr 1fr 1fr', 
                      padding: '8px 18px', 
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      fontSize: '0.85rem' 
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', color: '#555' }}>#{String(i + 1).padStart(3, '0')}</span>
                    <span style={{ fontFamily: 'monospace', color: '#FF6B6B', fontWeight: 700 }}>{pt.x}</span>
                    <span style={{ fontFamily: 'monospace', color: '#4ECDC4', fontWeight: 700 }}>{pt.y}</span>
                    <span style={{ fontFamily: 'monospace', color: '#95E1D3', fontWeight: 700, textAlign: 'right' }}>{pt.z}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RawHex Display */}
            {activeDlPacket.displayData?.rawData && (
              <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.15)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>RAW BINARY FRAME (246 BYTES)</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(activeDlPacket.displayData.rawData);
                      showNotification('success', 'Copied raw hex frame to clipboard.');
                    }} 
                    className="btn-detail-link" 
                    style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                  >
                    Copy Hex Frame
                  </button>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--accent-teal)', wordBreak: 'break-all', maxHeight: '60px', overflowY: 'auto' }}>
                  {activeDlPacket.displayData.rawData}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '4rem 0' }}>
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h3>No Record Selected</h3>
            <p>Select a telemetry log entry to inspect decoded coordinates.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataLoggerViewer;
