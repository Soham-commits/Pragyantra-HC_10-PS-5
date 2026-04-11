from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class NotificationType(str, Enum):
    REFERRAL_INITIATED = "referral_initiated"
    GENERAL = "general"


class NotificationCreate(BaseModel):
    patient_id: str
    type: NotificationType
    message: str
    referral_id: Optional[str] = None
    is_read: bool = False


class NotificationResponse(NotificationCreate):
    notification_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationMarkRead(BaseModel):
    is_read: bool = True


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int
