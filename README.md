# BLE Sense - Backend API Server

This branch hosts the **BLE Sense Backend API Server**, the central data ingestion and storage hub of the BLE Sense Ecosystem. Built with Node.js, Express, and MongoDB, this server receives telemetry packets from the mobile application, persists them, and serves them to the web dashboard.

---

## ⚙️ Features

- **Data Ingestion API:** Receives single packets or high-throughput bulk arrays of BLE sensor data.
- **Robust Storage System:** Uses **MongoDB** (via Mongoose) for long-term telemetry storage.
- **Graceful Fallback:** Auto-detects if MongoDB is unavailable and transparently falls back to an **in-memory database store** (perfect for quick local tests without setup).
- **CORS Enabled:** Ready to communicate with any frontend client or web dashboard.
- **Nodemon Integration:** Auto-restarting development server for rapid iteration.

---

## 🚀 Getting Started

This branch contains only the Node.js project. You can run it locally or deploy it to cloud hosting.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or newer recommended)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) (Optional - the server will fall back to in-memory storage if MongoDB is not running)

### Installation
1. Clone this branch directly:
   ```bash
   git clone -b backend https://github.com/SaurabhSphere/BLE-Sensor.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Server
* **Development Mode** (with hot-reloading):
  ```bash
  npm run dev
  ```
* **Production Mode**:
  ```bash
  node server.js
  ```

---

## 📝 Configuration (.env)

Create a `.env` file in the root of the server directory to configure your ports and database:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ble-sensor
```

---

## 📡 API Endpoints

### 1. Root / Health Status
- **`GET /`**
  - Returns a simple HTML status page.
- **`GET /api/health`**
  - Returns a JSON payload showing server health.
  - **Response:**
    ```json
    { "status": "OK", "message": "Backend is running" }
    ```

### 2. Sensor Packets Ingestion
- **`POST /api/packets`**
  - Receives telemetry data from the Mobile App. Supports single JSON packets or JSON arrays.
  - **Headers:** `Content-Type: application/json`
  - **Example Payload:**
    ```json
    {
      "timestamp": "2026-06-10T17:42:00Z",
      "data": {
        "appId": "BLE-Sense-1",
        "temperature": 24.5,
        "humidity": 48.2,
        "battery": 88
      }
    }
    ```

### 3. Fetch Packets
- **`GET /api/packets`**
  - Fetches the last 100 received sensor packets, sorted by newest first.
  - **Response:**
    ```json
    [
      {
        "_id": "648c66e2c34a1b0012abcde5",
        "appId": "BLE-Sense-1",
        "data": {
          "temperature": 24.5,
          "humidity": 48.2,
          "battery": 88
        },
        "timestamp": "2026-06-10T17:42:00.000Z"
      }
    ]
    ```

---

## 🛠️ Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database Wrapper:** Mongoose (MongoDB)
- **Utilities:** cors, dotenv, nodemon
