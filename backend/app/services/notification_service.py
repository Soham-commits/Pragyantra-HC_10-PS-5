from datetime import datetime
from uuid import uuid4
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorCollection

from app.schemas.notification import NotificationCreate, NotificationType, NotificationResponse


async def create_notification(
    collection: AsyncIOMotorCollection,
    patient_id: str,
    type: NotificationType,
    message: str,
    referral_id: Optional[str] = None
) -> str:
    """Create a new notification for a patient."""
    notification_id = str(uuid4())
    doc = {
        "notification_id": notification_id,
        "patient_id": patient_id,
        "type": type.value,
        "message": message,
        "referral_id": referral_id,
        "is_read": False,
        "created_at": datetime.utcnow()
    }
    await collection.insert_one(doc)
    return notification_id


async def get_patient_notifications(
    collection: AsyncIOMotorCollection,
    patient_id: str,
    limit: int = 50
) -> tuple[list[dict], int]:
    """Fetch notifications for a patient and count unread."""
    cursor = collection.find(
        {"patient_id": patient_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    
    notifications = await cursor.to_list(length=limit)
    unread_count = await collection.count_documents({
        "patient_id": patient_id,
        "is_read": False
    })
    
    return notifications, unread_count


async def mark_notification_read(
    collection: AsyncIOMotorCollection,
    notification_id: str
) -> bool:
    """Mark a notification as read. Returns True if successful."""
    result = await collection.update_one(
        {"notification_id": notification_id},
        {"$set": {"is_read": True}}
    )
    return result.modified_count > 0


async def mark_all_notifications_read(
    collection: AsyncIOMotorCollection,
    patient_id: str
) -> int:
    """Mark all notifications for a patient as read. Returns count modified."""
    result = await collection.update_many(
        {"patient_id": patient_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return result.modified_count
