const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  appId: {
    type: String,
    index: true // Indexing by appId for faster filtering by device
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
});

module.exports = mongoose.model('SensorData', sensorDataSchema);
