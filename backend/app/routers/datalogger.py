from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import Text, cast
from sqlalchemy.orm import Session, joinedload, load_only
from sqlalchemy.sql import func
from typing import List, Optional
from app.database import get_db
from app.models.datalogger import RawPacket, DataLoggerHeader
from app.schemas.datalogger import RawPacketOut, DataLoggerHeaderOut, PaginatedRawPackets, PaginatedDataLoggerHeaders
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


@router.get("/raw", response_model=PaginatedRawPackets)
def get_raw_packets(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    sort_order: str = Query("desc", alias="sortOrder"),
    db: Session = Depends(get_db)
):
    """Retrieve raw enqueued packets with pagination, filtering, and sorting."""
    query = db.query(RawPacket)
    if status_filter and status_filter != 'All':
        query = query.filter(RawPacket.status == status_filter)
        
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            func.lower(cast(RawPacket.payload, Text)).like(search_term)
        )
        
    if sort_order == 'asc':
        query = query.order_by(RawPacket.created_at.asc())
    else:
        query = query.order_by(RawPacket.created_at.desc())
        
    total = query.count()
    skip = (page - 1) * limit
    records = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "records": records
    }


@router.get("/processed", response_model=PaginatedDataLoggerHeaders)
def get_processed_headers(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    device_id: Optional[str] = Query(None, alias="deviceId"),
    start_time: Optional[datetime] = Query(None, alias="startTime"),
    end_time: Optional[datetime] = Query(None, alias="endTime"),
    sort_order: str = Query("desc", alias="sortOrder"),
    include_points: bool = Query(False, description="Include the parsed XYZ samples"),
    db: Session = Depends(get_db)
):
    """Retrieve processed DataLogger headers with pagination, filtering, and sorting."""
    query = db.query(DataLoggerHeader)
    
    if device_id and device_id != 'All':
        query = query.filter(DataLoggerHeader.device_id == device_id)
        
    if start_time:
        query = query.filter(DataLoggerHeader.timestamp >= start_time)
    if end_time:
        query = query.filter(DataLoggerHeader.timestamp <= end_time)
        
    if sort_order == 'asc':
        query = query.order_by(DataLoggerHeader.timestamp.asc())
    else:
        query = query.order_by(DataLoggerHeader.timestamp.desc())
        
    total = query.count()
    skip = (page - 1) * limit
    
    headers = query.options(
        joinedload(DataLoggerHeader.raw_packet).load_only(
            RawPacket.id,
            RawPacket.status,
            RawPacket.created_at,
            RawPacket.processed_at
        )
    ).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "records": [
            {
                "id": h.id,
                "raw_packet_id": h.raw_packet_id,
                "app_id": h.app_id,
                "device_id": h.device_id,
                "packet_id_num": h.packet_id_num,
                "total_packets": h.total_packets,
                "raw_data": h.raw_data,
                "timestamp": h.timestamp,
                "created_at": h.created_at,
                "raw_packet": h.raw_packet,
                "points": h.points if include_points else None
            } for h in headers
        ]
    }


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


@router.get("/processed/{header_id}", response_model=DataLoggerHeaderOut)
def get_processed_header(header_id: int, db: Session = Depends(get_db)):
    """Retrieve a single processed DataLogger header with its XYZ samples."""
    header = db.query(DataLoggerHeader).filter(DataLoggerHeader.id == header_id).first()
    if not header:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processed header not found"
        )
    return header

