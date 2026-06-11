from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func
from typing import List, Optional
from app.database import get_db
from app.models.datalogger import RawPacket, DataLoggerHeader
from app.schemas.datalogger import RawPacketOut, DataLoggerHeaderOut
from app.services.queue import packet_queue

router = APIRouter(prefix="/packets/datalogger", tags=["DataLogger Pipeline"])

@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def ingest_datalogger_packet(request: Request, db: Session = Depends(get_db)):
    """
    Ingest raw DataLogger sensor packets asynchronously.
    Saves payload directly in raw format and pushes to asyncio.Queue for processing.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON body"
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
        "message": "Packet received and enqueued for background processing",
        "raw_packet_id": raw_packet.id,
        "status": "pending"
    }


@router.get("/raw", response_model=List[RawPacketOut])
def get_raw_packets(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    """Retrieve the latest 50 raw enqueued packets, filtered by status."""
    query = db.query(RawPacket)
    if status_filter:
        query = query.filter(RawPacket.status == status_filter)
    
    return query.order_by(RawPacket.created_at.desc()).limit(50).all()


@router.get("/processed", response_model=List[DataLoggerHeaderOut])
def get_processed_headers(
    include_points: bool = Query(False, description="Include the parsed XYZ samples"),
    db: Session = Depends(get_db)
):
    """Retrieve the latest 50 processed DataLogger headers (and optionally their points)."""
    headers = db.query(DataLoggerHeader).options(joinedload(DataLoggerHeader.raw_packet)).order_by(DataLoggerHeader.timestamp.desc()).limit(50).all()
    
    if not include_points:
        # Avoid loading points relationship to keep response lightweight
        for h in headers:
            h.points = None
            
    return headers


@router.post("/{packet_id}/reprocess")
async def reprocess_raw_packet(packet_id: int, db: Session = Depends(get_db)):
    """
    Re-enqueue an existing raw packet for processing.
    Updates status to 'pending' and adds to the queue.
    """
    raw_packet = db.query(RawPacket).filter(RawPacket.id == packet_id).first()
    if not raw_packet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Raw packet not found"
        )
        
    raw_packet.status = "pending"
    raw_packet.processed_at = None
    db.commit()
    
    # Enqueue packet ID
    await packet_queue.put(raw_packet.id)
    
    return {"message": f"Packet #{packet_id} successfully re-enqueued for processing"}

