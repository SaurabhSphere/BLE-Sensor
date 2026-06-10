import React, { useState, useMemo } from 'react';

const parseRawDataToChunks = (rawData) => {
  if (!rawData || typeof rawData !== 'string') return [];
  const hexParts = rawData.trim().split(/\s+/).filter(h => h.length > 0);
  const bytes = hexParts.map(hex => parseInt(hex, 16));

  const chunkSize = 246;
  const numChunks = Math.floor(bytes.length / chunkSize);
  if (numChunks === 0) return [];

  const chunks = [];
  for (let i = 0; i < numChunks; i++) {
    const offset = i * chunkSize;
    const chunkBytes = bytes.slice(offset, offset + chunkSize);

    // Byte 0 → device ID
    const deviceId = chunkBytes[0] & 0xFF;

    // Bytes 1..240 → 80 XYZ points (3 bytes each)
    const points = [];
    for (let p = 1; p <= 238; p += 3) {
      let x = chunkBytes[p] & 0xFF;
      let y = chunkBytes[p + 1] & 0xFF;
      let z = chunkBytes[p + 2] & 0xFF;

      const isNA = (x === 255 && y === 255 && z === 255);
      points.push({
        x: isNA ? '--' : (new Int8Array([x])[0]).toString(),
        y: isNA ? '--' : (new Int8Array([y])[0]).toString(),
        z: isNA ? '--' : (new Int8Array([z])[0]).toString()
      });
    }

    // Bytes 241..242 → packetId (little-endian)
    const packetId = (chunkBytes[241] & 0xFF) | ((chunkBytes[242] & 0xFF) << 8);

    // Bytes 243..244 → lastSavedPacketId (little-endian)
    const lastSavedPacketId = (chunkBytes[243] & 0xFF) | ((chunkBytes[244] & 0xFF) << 8);

    // Byte 245 → footer
    const footer = chunkBytes[245] & 0xFF;

    // Raw hex of this chunk
    const rawHex = chunkBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    chunks.push({
      chunkIndex: i,
      deviceId,
      packetId,
      lastSavedPacketId,
      footer,
      points,
      rawHex
    });
  }
  return chunks;
};

const SensorDetails = ({ sensor, onClose }) => {
  if (!sensor) return null;

  const data = sensor.displayData || sensor.data;
  const type = sensor.type;

  const renderSpecificDetails = () => {
    switch (type) {
      case 'DataLogger': {
        const rawData = data.rawData || '';
        const chunks = parseRawDataToChunks(rawData);
        const [selectedChunk, setSelectedChunk] = useState(0);

        const handleCopyRaw = () => {
          navigator.clipboard.writeText(rawData);
          alert('Copied all raw data to clipboard');
        };

        const handleCopyChunk = () => {
          if (chunks[selectedChunk]) {
            navigator.clipboard.writeText(chunks[selectedChunk].rawHex);
            alert('Copied chunk hex to clipboard');
          }
        };

        if (chunks.length === 0) {
          return (
            <div className="data-logger-details">
              <p>⚠ Could not parse chunks — unexpected byte count or no raw data.</p>
              <button onClick={handleCopyRaw} className="btn-secondary" style={{ marginTop: '10px' }}>Copy Raw Hex</button>
            </div>
          );
        }

        const chunk = chunks[selectedChunk];
        const pointOffset = chunk.chunkIndex * 80;

        return (
          <div className="data-logger-details" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

            {/* Chunk Tabs */}
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
              {chunks.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedChunk(i)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: selectedChunk === i ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Part {i + 1}
                </button>
              ))}
            </div>

            {/* Metadata */}
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>CHUNK {chunk.chunkIndex + 1} METADATA</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Packet ID:</strong> {chunk.packetId}</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Last Saved:</strong> {chunk.lastSavedPacketId}</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Device ID:</strong> 0x{chunk.deviceId.toString(16).padStart(2, '0').toUpperCase()}</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Footer:</strong> 0x{chunk.footer.toString(16).padStart(2, '0').toUpperCase()}</div>
              </div>
            </div>

            {/* XYZ Points Grid */}
            <div className="points-grid">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>XYZ SAMPLES</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>#{pointOffset + 1} – #{pointOffset + 80}</span>
              </div>
              <div className="grid-header" style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', gap: '10px', padding: '8px', background: 'rgba(255,255,255,0.1)' }}>
                <span>#</span>
                <span style={{ color: '#FF6B6B' }}>X</span>
                <span style={{ color: '#4ECDC4' }}>Y</span>
                <span style={{ color: '#95E1D3', textAlign: 'right' }}>Z</span>
              </div>
              <div className="grid-scroll" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {chunk.points.map((pt, i) => (
                  <div key={i} className="grid-row" style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', gap: '10px', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="pt-idx" style={{ fontFamily: 'monospace', color: '#888' }}>{String(pointOffset + i + 1).padStart(3, '0')}</span>
                    <span style={{ fontFamily: 'monospace', color: pt.x === '--' ? '#888' : '#FF6B6B' }}>{pt.x}</span>
                    <span style={{ fontFamily: 'monospace', color: pt.y === '--' ? '#888' : '#4ECDC4' }}>{pt.y}</span>
                    <span style={{ fontFamily: 'monospace', color: pt.z === '--' ? '#888' : '#95E1D3', textAlign: 'right' }}>{pt.z}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hex Viewer */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>CHUNK HEX (246 bytes)</span>
                <button onClick={handleCopyChunk} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Copy Chunk</button>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', color: '#4ECDC4', maxHeight: '100px', overflowY: 'auto' }}>
                {chunk.rawHex}
              </div>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleCopyRaw} className="btn-primary" style={{ padding: '8px 16px' }}>Copy Full Raw Data</button>
            </div>

          </div>
        );
      }
      case 'SHT40':
        return (
          <div className="sht40-details">
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="sensor-card" style={{ border: 'none' }}>
                <div className="sensor-label">Temperature</div>
                <div className="sensor-value" style={{ color: 'var(--accent-secondary)' }}>{data.temperature}°C</div>
              </div>
              <div className="sensor-card" style={{ border: 'none' }}>
                <div className="sensor-label">Humidity</div>
                <div className="sensor-value" style={{ color: 'var(--accent-primary)' }}>{data.humidity}%</div>
              </div>
            </div>
          </div>
        );
      case 'Soil Sensor':
        return (
          <div className="soil-details">
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {[
                { label: 'Nitrogen', value: data.nitrogen, unit: 'mg/kg' },
                { label: 'Phosphorus', value: data.phosphorus, unit: 'mg/kg' },
                { label: 'Potassium', value: data.potassium, unit: 'mg/kg' },
                { label: 'Moisture', value: data.moisture, unit: '%' },
                { label: 'Temperature', value: data.temperature, unit: '°C' },
                { label: 'pH', value: data.pH, unit: '' },
                { label: 'EC', value: data.ec, unit: 'us/cm' },
                { label: 'Salinity', value: data.salinity, unit: 'mg/L' }
              ].map(item => (
                <div key={item.label} className="sensor-card" style={{ border: 'none', padding: '1rem' }}>
                  <div className="sensor-label">{item.label}</div>
                  <div className="sensor-value" style={{ fontSize: '1.1rem' }}>{item.value} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{item.unit}</span></div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'sen66':
        return (
          <div className="sen66-details">
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {[
                { label: 'PM1.0', value: data.pm1, unit: 'μg/m³' },
                { label: 'PM2.5', value: data.pm25, unit: 'μg/m³' },
                { label: 'PM4.0', value: data.pm4, unit: 'μg/m³' },
                { label: 'PM10.0', value: data.pm10, unit: 'μg/m³' },
                { label: 'CO2', value: data.co2, unit: 'ppm' },
                { label: 'VOC', value: data.voc, unit: '' },
                { label: 'NOx', value: data.nox, unit: '' },
                { label: 'Temp', value: data.temperature, unit: '°C' },
                { label: 'RH', value: data.humidity, unit: '%' }
              ].map(item => (
                <div key={item.label} className="sensor-card" style={{ border: 'none', padding: '1rem' }}>
                  <div className="sensor-label">{item.label}</div>
                  <div className="sensor-value" style={{ fontSize: '1.1rem' }}>{item.value || '--'} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{item.unit}</span></div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="raw-json">
            <pre style={{ background: '#000', padding: '1rem', borderRadius: '8px', overflow: 'auto' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>{type} Details</h2>
            <p className="modal-subtitle">Device ID: {data.packetId || data.deviceId || 'Unknown'}</p>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </header>
        <div className="modal-body">
          {renderSpecificDetails()}

          <div className="action-buttons">
            <button className="btn-primary" onClick={() => alert('Command requested: Get Data')}>Get Data</button>
            <button className="btn-secondary" onClick={() => alert('Command requested: Pause')}>Pause</button>
            <button className="btn-danger" onClick={() => alert('Command requested: Reset')}>Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SensorDetails;
