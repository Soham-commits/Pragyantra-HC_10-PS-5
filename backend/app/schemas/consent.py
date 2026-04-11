from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ConsentType(str, Enum):
    REGISTRATION = "registration"
    SCAN_UPLOAD = "scan_upload"
    REFERRAL_NOTIFICATION = "referral_notification"


class ConsentCreate(BaseModel):
    consent_type: ConsentType
    consented: bool = True
    consent_version: str = "1.0"
    metadata: Optional[Dict[str, Any]] = None


class ConsentRecord(ConsentCreate):
    consent_id: str
    patient_id: str
    timestamp: datetime

    class Config:
        from_attributes = True


class ConsentBulkRequest(BaseModel):
    patient_id: str
    consents: list[ConsentCreate]


class ConsentResponse(BaseModel):
    success: bool
    consent_ids: list[str]


class ConsentListResponse(BaseModel):
    consents: list[ConsentRecord]
