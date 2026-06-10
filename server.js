const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory fallback if MongoDB isn't installed locally
let isMongoConnected = false;
let inMemoryPackets = [];

const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  console.error('❌ FATAL ERROR: MONGODB_URI is not defined in .env file.');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => {
    console.log('MongoDB connected successfully');
    isMongoConnected = true;
  })
  .catch(err => {
    console.warn('⚠️ MongoDB connection error. Falling back to in-memory temporary storage since MongoDB Community Server is not installed or running.', err.message);
    isMongoConnected = false;
  });

// Sensor Data Model inside the same file for portability, or require it
const SensorData = require('./models/SensorData');

// Routes
app.get('/', (req, res) => {
  res.send('<h1>BleSense API is running</h1><p>Check <a href="/api/health">/api/health</a> or <a href="/api/packets">/api/packets</a></p>');
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend is running' });
});

// GET all sensor data packets (for the dashboard)
// We might want to limit this or add pagination later to avoid overwhelming the frontend
app.get('/api/packets', async (req, res) => {
  try {
    if (isMongoConnected) {
      const packets = await SensorData.find().sort({ timestamp: -1 }).limit(100);
      res.status(200).json(packets);
    } else {
      res.status(200).json(inMemoryPackets.slice(-100).reverse());
    }
  } catch (error) {
    console.error('Error fetching packets:', error);
    res.status(500).json({ error: 'Failed to fetch packets' });
  }
});

// POST new sensor data packet (from the Android App)
app.post('/api/packets', async (req, res) => {
  try {
    const body = req.body;
    const packetsToSave = Array.isArray(body) ? body : [body];

    if (packetsToSave.length === 0) {
      return res.status(400).json({ error: 'No packets provided' });
    }

    const processedPackets = packetsToSave.map(p => {
      const innerData = p.data || {};
      return {
        appId: innerData.appId || 'Unknown',
        data: p.data || p,
        timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
      };
    });

    if (isMongoConnected) {
      // Use insertMany for bulk insert which is much faster
      const result = await SensorData.insertMany(processedPackets);
      res.status(201).json({
        message: `${processedPackets.length} packets received and saved`,
        count: result.length
      });
    } else {
      processedPackets.forEach(p => {
        const newPacket = {
          _id: (Date.now() + Math.random()).toString(),
          appId: p.appId,
          data: p.data,
          timestamp: p.timestamp
        };
        inMemoryPackets.push(newPacket);
      });

      // Keep only last 200 packets to prevent memory leak
      if (inMemoryPackets.length > 200) {
        inMemoryPackets = inMemoryPackets.slice(-200);
      }
      res.status(201).json({
        message: `${processedPackets.length} packets received and saved (In-Memory)`
      });
    }
  } catch (error) {
    console.error('Error saving packet(s):', error);
    res.status(500).json({ error: 'Failed to save packet(s)' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
