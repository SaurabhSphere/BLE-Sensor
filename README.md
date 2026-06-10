# BLE Sense Ecosystem

Welcome to the **BLE Sense Ecosystem**! This repository hosts a complete, end-to-end IoT environment designed to discover Bluetooth Low Energy (BLE) sensors, collect their telemetry, store and serve the data via a backend API, and visualize it in real-time on a modern web dashboard.

## 📐 Architecture Overview

The ecosystem consists of three main components working in tandem:

```
┌─────────────────┐         HTTP POST        ┌─────────────────┐
│                 │  ─────────────────────>  │                 │
│   Mobile App    │                          │ Backend Server  │ <───> [ MongoDB ]
│   (Android)     │  <─────────────────────  │  (Express/Node) │
│                 │      JSON Response       │                 │
└─────────────────┘                          └─────────────────┘
                                                      ▲
                                                      │ HTTP GET
                                                      │ (Real-time Telemetry)
                                                      ▼
                                             ┌─────────────────┐
                                             │  Web Dashboard  │
                                             │  (React/Vite)   │
                                             └─────────────────┘
```

1. **Android Mobile Application (`mobile` branch)**:
   - Scans for nearby BLE advertising packets.
   - Extracts sensor metrics (temperature, humidity, accelerometer, battery levels, etc.).
   - Buffers and transmits telemetry payloads to the backend API.
2. **Backend API Server (`backend` branch)**:
   - Built on Node.js and Express.
   - Saves incoming telemetry to a MongoDB database (with an automatic in-memory fallback).
   - Serves REST endpoints to query historical and real-time packets.
3. **Web Visualization Dashboard (`dashboard` branch)**:
   - Built with React, Vite, and Tailwind CSS.
   - Connects to the backend API to fetch and render real-time charts, telemetry grids, and system health status.

---

## 🌿 Repository Branching Structure

To make deployment and development as clean as possible, this repository is organized using a **split-branch structure**:

* **`main`**: The primary branch containing the entire monorepo structure (all three projects inside their respective folders).
* **`mobile`**: Contains only the Android application source code directly at the repository root. Suitable for opening directly in Android Studio.
* **`backend`**: Contains only the Node.js API server code directly at the repository root. Suitable for immediate server-side deployment (e.g., Heroku, Render).
* **`dashboard`**: Contains only the React & Vite dashboard project code directly at the repository root. Suitable for static web hosting (e.g., Vercel, Netlify).

---

## 🚀 Getting Started

To explore or run a specific component, checkout its dedicated branch or navigate into its directory on the `main` branch.

### 📱 Android Mobile App
* **Path:** `Mobile/`
* **Branch:** `mobile`
* **Prerequisites:** Android Studio (Hedgehog+), Android SDK 24+, BLE-compatible Android Device.
* **Quick Start:** Open the directory in Android Studio, sync Gradle, and run on a physical device.

### ⚙️ Node.js Backend Server
* **Path:** `backend/`
* **Branch:** `backend`
* **Prerequisites:** Node.js (v18+), MongoDB (optional, has in-memory fallback).
* **Quick Start:**
  ```bash
  cd backend
  npm install
  npm run dev
  ```

### 📊 Web Dashboard
* **Path:** `web-dashboard/`
* **Branch:** `dashboard`
* **Prerequisites:** Node.js (v18+).
* **Quick Start:**
  ```bash
  cd web-dashboard
  npm install
  npm run dev
  ```

---

## 🛠️ Technology Stack
- **Mobile:** Kotlin, Jetpack Compose, Android Bluetooth LE API, Retrofit.
- **Backend:** Node.js, Express.js, MongoDB (Mongoose), dotenv.
- **Frontend Dashboard:** React.js, Vite, Chart.js / Recharts, CSS Modules.

---

## 👤 Author
**Saurabh Sphere** - [GitHub Profile](https://github.com/SaurabhSphere)
