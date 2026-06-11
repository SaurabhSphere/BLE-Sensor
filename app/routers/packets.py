from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Union, Dict, Any
from datetime import datetime, timezone
from app.database import get_db
from app.models.packet import SensorPacket
from app.schemas.packet import PacketOut

router = APIRouter(prefix="/packets", tags=["Sensor Packets"])

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_sensor_packets(request: Request, db: Session = Depends(get_db)):
    """
    Ingest BLE sensor packets.
    Accepts a single packet object or an array of packet objects.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    # Standardize single packet into a list of packets
    packets_to_save = body if isinstance(body, list) else [body]
    
    if not packets_to_save:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty packet list provided"
        )
        
    created_packets = []
    for p in packets_to_save:
        # Extract data dictionary
        # The Android app typically sends: { "timestamp": ..., "data": { "appId": ..., ... } }
        inner_data = p.get("data", p)
        
        # Extract App ID from multiple possible locations in the payload
        app_id = "Unknown"
        if isinstance(inner_data, dict):
            app_id = inner_data.get("appId", p.get("appId", "Unknown"))
            # Sometimes appId is nested deeper inside the data payload
            if app_id == "Unknown" and "data" in inner_data:
                nested_data = inner_data["data"]
                if isinstance(nested_data, dict):
                    app_id = nested_data.get("appId", "Unknown")
        
        # Parse timestamp
        timestamp_raw = p.get("timestamp") or inner_data.get("timestamp") if isinstance(inner_data, dict) else None
        packet_timestamp = datetime.now(timezone.utc)
        if timestamp_raw:
            try:
                if isinstance(timestamp_raw, (int, float)):
                    # Handle Unix timestamp in milliseconds
                    packet_timestamp = datetime.fromtimestamp(timestamp_raw / 1000.0, tz=timezone.utc)
                else:
                    # Handle ISO string timestamp
                    packet_timestamp = datetime.fromisoformat(str(timestamp_raw).replace("Z", "+00:00"))
            except Exception:
                packet_timestamp = datetime.now(timezone.utc)
        
        db_packet = SensorPacket(
            app_id=app_id,
            data=p.get("data") if "data" in p else p,
            timestamp=packet_timestamp
        )
        db.add(db_packet)
        created_packets.append(db_packet)
        
    db.commit()
    
    return {
        "message": f"Successfully ingested {len(created_packets)} sensor packet(s)",
        "count": len(created_packets)
    }


@router.get("", response_model=List[PacketOut])
def get_sensor_packets(db: Session = Depends(get_db)):
    """
    Fetch the latest 100 sensor packets, sorted by newest first.
    """
    packets = db.query(SensorPacket).order_by(SensorPacket.timestamp.desc()).limit(100).all()
    
    # Map model fields to schema fields (specifically app_id -> appId)
    return [
        PacketOut(
            id=p.id,
            appId=p.app_id,
            data=p.data,
            timestamp=p.timestamp
        ) for p in packets
    ]
