from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Union, Dict, Any
from datetime import datetime, timezone
from app.database import get_db
from app.models.packet import SensorPacket
from app.schemas.packet import PacketOut
from app.models.datalogger import RawPacket
from app.services.queue import packet_queue

router = APIRouter(prefix="/packets", tags=["Sensor Packets"])

@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_sensor_packets(request: Request, db: Session = Depends(get_db)):
    """
    Ingest BLE sensor packets asynchronously.
    Saves payload directly in raw format to raw_packets and pushes to packet_queue for background processing.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    # Create raw packet entry in pending status
    raw_packet = RawPacket(
        payload=body,
        status="pending",
        created_at=func.now()
    )
    db.add(raw_packet)
    db.commit()
    db.refresh(raw_packet)
    
    # Enqueue raw packet ID for background processing
    await packet_queue.put(raw_packet.id)
    
    return {
        "message": "Packets received and enqueued for background processing",
        "raw_packet_id": raw_packet.id,
        "status": "pending"
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
