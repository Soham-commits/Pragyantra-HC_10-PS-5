from fastapi import APIRouter, HTTPException, Depends, status
from typing import List

from app.schemas.notification import NotificationMarkRead
from app.services.notification_service import (
    get_patient_notifications,
    mark_notification_read,
    mark_all_notifications_read
)
from app.database import get_notifications_collection
from app.routes.auth import require_patient, get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/patient/{patient_id}")
async def get_notifications(
    patient_id: str,
    limit: int = 50,
    current_user: dict = Depends(require_patient)
):
    """
    Fetch all notifications for a patient.
    Patients can only view their own notifications.
    """
    # Ensure patient can only view their own notifications
    if current_user["id"] != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only view your own notifications"
        )
    
    collection = get_notifications_collection()
    
    try:
        notifications, unread_count = await get_patient_notifications(
            collection=collection,
            patient_id=patient_id,
            limit=limit
        )
        return {
            "notifications": notifications,
            "unread_count": unread_count
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch notifications: {str(e)}"
        )


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: dict = Depends(require_patient)
):
    """
    Mark a single notification as read.
    """
    collection = get_notifications_collection()
    
    try:
        # First verify the notification belongs to the current user
        from motor.motor_asyncio import AsyncIOMotorCollection
        notification = await collection.find_one({
            "notification_id": notification_id,
            "patient_id": current_user["id"]
        })
        
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found or access denied"
            )
        
        success = await mark_notification_read(collection, notification_id)
        
        return {
            "success": success,
            "notification_id": notification_id,
            "is_read": True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark notification as read: {str(e)}"
        )


@router.post("/patient/{patient_id}/mark-all-read")
async def mark_all_read(
    patient_id: str,
    current_user: dict = Depends(require_patient)
):
    """
    Mark all notifications for a patient as read.
    """
    # Ensure patient can only modify their own notifications
    if current_user["id"] != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only modify your own notifications"
        )
    
    collection = get_notifications_collection()
    
    try:
        count = await mark_all_notifications_read(collection, patient_id)
        return {
            "success": True,
            "marked_read_count": count
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark notifications as read: {str(e)}"
        )
