import asyncio
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.database import SessionLocal
from app.models.datalogger import RawPacket, DataLoggerHeader, DataLoggerPoint

# Global asynchronous in-memory queue
packet_queue = asyncio.Queue()

async def packet_worker():
    """
    Background worker that continuously processes raw packets from the queue.
    Ingests dynamic DataLogger points and saves them to PostgreSQL structured tables.
    """
    print("🚀 Background worker started. Waiting for DataLogger packets...")
    while True:
        try:
            # Wait for next raw packet ID from the queue
            packet_id = await packet_queue.get()
            
            # Open db session
            db: Session = SessionLocal()
            try:
                # Fetch raw packet record
                raw_packet = db.query(RawPacket).filter(RawPacket.id == packet_id).first()
                if not raw_packet or raw_packet.status != "pending":
                    packet_queue.task_done()
                    db.close()
                    continue
                
                payload = raw_packet.payload
                
                # Standardize single dictionary payload into a list
                packets_list = payload if isinstance(payload, list) else [payload]
                
                for pkt in packets_list:
                    # In tmpdata.txt: { "data": { "data": { "appId": ..., "points": [...] } } }
                    data_wrapper = pkt.get("data", pkt) if isinstance(pkt, dict) else {}
                    inner_data = data_wrapper.get("data", data_wrapper) if isinstance(data_wrapper, dict) else {}
                    
                    if not isinstance(inner_data, dict):
                        inner_data = pkt if isinstance(pkt, dict) else {}
                        data_wrapper = pkt if isinstance(pkt, dict) else {}
                    
                    # Extract variables
                    app_id = inner_data.get("appId", "Unknown")
                    device_id = str(inner_data.get("deviceId", "Unknown"))
                    packet_id_num = inner_data.get("packetId", 0)
                    total_packets = inner_data.get("totalPackets", 0)
                    raw_data = inner_data.get("rawData", "")
                    
                    # Resolve timestamp
                    timestamp_raw = data_wrapper.get("timestamp") or pkt.get("timestamp") if isinstance(pkt, dict) else None
                    packet_timestamp = datetime.now(timezone.utc)
                    if timestamp_raw:
                        try:
                            if isinstance(timestamp_raw, (int, float)):
                                packet_timestamp = datetime.fromtimestamp(timestamp_raw / 1000.0, tz=timezone.utc)
                            else:
                                packet_timestamp = datetime.fromisoformat(str(timestamp_raw).replace("Z", "+00:00"))
                        except Exception:
                            packet_timestamp = datetime.now(timezone.utc)
                    
                    # Create header row
                    header = DataLoggerHeader(
                        raw_packet_id=raw_packet.id,
                        app_id=app_id,
                        device_id=device_id,
                        packet_id_num=packet_id_num,
                        total_packets=total_packets,
                        raw_data=raw_data,
                        timestamp=packet_timestamp
                    )
                    db.add(header)
                    db.flush()  # Acquire header.id
                    
                    # Process points array
                    points_list = inner_data.get("points", [])
                    if isinstance(points_list, list):
                        db_points = []
                        for idx, pt in enumerate(points_list):
                            if isinstance(pt, dict):
                                db_point = DataLoggerPoint(
                                    header_id=header.id,
                                    point_index=idx,
                                    x=pt.get("x"),
                                    y=pt.get("y"),
                                    z=pt.get("z")
                                )
                                db_points.append(db_point)
                        if db_points:
                            db.add_all(db_points)
                
                # Mark raw packet as processed
                raw_packet.status = "processed"
                raw_packet.processed_at = func.now()
                db.commit()
                print(f"✓ Background Worker: Processed Raw Packet ID {packet_id} successfully.")
                
            except Exception as e:
                db.rollback()
                print(f"❌ Background Worker: Error processing Raw Packet ID {packet_id}: {e}")
                try:
                    # Update status to failed
                    err_packet = db.query(RawPacket).filter(RawPacket.id == packet_id).first()
                    if err_packet:
                        err_packet.status = "failed"
                        db.commit()
                except Exception:
                    pass
            finally:
                db.close()
                packet_queue.task_done()
        except asyncio.CancelledError:
            print("Background worker task cancelled.")
            break
        except Exception as e:
            print(f"Background worker loop error: {e}")
            await asyncio.sleep(1)
