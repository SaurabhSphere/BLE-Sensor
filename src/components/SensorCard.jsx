import React from 'react';

const SensorCard = ({ type, data, lastUpdate, rssi, onClick }) => {
  const getSensorIcon = (sensorType) => {
    switch (sensorType) {
      case 'SHT40': return '🌡️';
      case 'LIS3DH': return '🏎️';
      case 'Lux Sensor': return '☀️';
      case 'Soil Sensor': return '🌱';
      case 'DataLogger': return '📊';
      case 'sen66': return '💨';
      case 'SPEED_DISTANCE': return '🚴';
      case 'Ammonia Sensor': return '🧪';
      case 'TempLogger': return '❄️';
      default: return '📡';
    }
  };

  const getPrimaryValue = () => {
    if (!data) return '--';
    switch (type) {
      case 'SHT40': return `${data.temperature}°C`;
      case 'Lux Sensor': return `${data.lux} lx`;
      case 'Soil Sensor': return `${data.moisture}%`;
      case 'DataLogger': return `#${data.packetId}`;
      case 'sen66': return `${data.pm25} μg`;
      case 'Ammonia Sensor': return `${data.ammonia}`;
      default: return 'Active';
    }
  };

  const getSecondaryValue = () => {
    if (!data) return null;
    switch (type) {
      case 'SHT40': return `Humidity: ${data.humidity}%`;
      case 'Soil Sensor': return `Temp: ${data.temperature}°C`;
      case 'sen66': return `CO2: ${data.co2} ppm`;
      case 'DataLogger': return `Accel Data`;
      default: return null;
    }
  };

  return (
    <div className="sensor-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-header">
        <div className="sensor-icon">{getSensorIcon(type)}</div>
        <div className="status-badge" style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
          <div className="pulse" style={{ width: 6, height: 6 }}></div>
          LIVE
        </div>
      </div>
      <div>
        <div className="sensor-label">{type}</div>
        <div className="sensor-value">
          {getPrimaryValue()}
          {type === 'SHT40' && <span className="sensor-unit" style={{ marginLeft: '4px' }}></span>}
        </div>
        <div className="sensor-footer" style={{ border: 'none', padding: 0 }}>
          <span>{getSecondaryValue()}</span>
        </div>
      </div>
      <div className="sensor-footer">
        <span>Signal: {rssi || '-65'} dBm</span>
        <span>{new Date(lastUpdate).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default SensorCard;
