import json
import time
import random
import uuid
import requests
from datetime import datetime, timezone

# Target API URL
API_URL = "http://localhost:8000/api/packets/datalogger"

def run_simulation():
    print("==========================================================")
    print("   BLE Sense - DataLogger Device Simulation Engine       ")
    print("==========================================================")
    
    # Load raw data template from tmpdata.txt
    try:
        with open("tmpdata.txt", "r") as f:
            template = json.load(f)
        print("✓ Successfully loaded template from tmpdata.txt")
    except Exception as e:
        print(f"❌ Failed to load tmpdata.txt: {e}")
        return

    packet_counter = 0
    app_id = str(uuid.uuid4())
    
    # Pre-calculate active device IDs to simulate a set of concurrent devices
    device_pool = [str(random.randint(100, 999)) for _ in range(3)]
    print(f"📡 Simulating {len(device_pool)} devices: {device_pool}")
    print(f"📱 Using App ID session: {app_id}")
    
    while True:
        try:
            # Clone template
            payload = json.loads(json.dumps(template))
            packet = payload[0]
            
            # Select a random device from our pool
            simulated_device = random.choice(device_pool)
            
            # Update packet identifiers & metadata to simulate fresh data
            now_ms = int(time.time() * 1000)
            now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            
            packet["_id"] = str(now_ms + random.randint(1, 100))
            packet["timestamp"] = now_iso
            packet["data"]["timestamp"] = now_ms
            
            inner_data = packet["data"]["data"]
            inner_data["appId"] = app_id
            inner_data["deviceId"] = simulated_device
            inner_data["packetId"] = packet_counter
            
            # Add a slight jitter/random variation to some coordinates to make live plots active
            points = inner_data.get("points", [])
            for pt in points:
                # Add tiny random adjustments (-2, 0, or 2) to x/y/z coordinates
                pt["x"] += random.choice([-2, 0, 2])
                pt["y"] += random.choice([-2, 0, 2])
                pt["z"] += random.choice([-2, 0, 2])
            
            # Post to FastAPI Backend
            headers = {"Content-Type": "application/json"}
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 📤 Sending packet #{packet_counter} for Device {simulated_device}...")
            
            response = requests.post(API_URL, json=payload, headers=headers)
            
            if response.status_code == 202:
                res_data = response.json()
                print(f"   ✓ Success (202 Accepted) | Raw Packet ID: {res_data.get('raw_packet_id')}")
            else:
                print(f"   ❌ Failed with status code: {response.status_code} | Details: {response.text}")
                
            packet_counter += 1
            
        except Exception as e:
            print(f"   ❌ Network/Exception Error occurred: {e}")
            
        # Wait for a random interval between 30 and 50 seconds before sending the next telemetry packet
        sleep_duration = random.randint(30, 50)
        print(f"😴 Waiting {sleep_duration} seconds before next transmission...")
        time.sleep(sleep_duration)

if __name__ == "__main__":
    run_simulation()
