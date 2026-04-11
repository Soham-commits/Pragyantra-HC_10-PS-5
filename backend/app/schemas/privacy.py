from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class GrievanceType(str, Enum):
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    INCORRECT_RECORD = "incorrect_record"
    CONSENT_VIOLATION = "consent_violation"
    DATA_BREACH = "data_breach"
    OTHER = "other"


class GrievanceStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    CLOSED = "closed"


class GrievanceCreate(BaseModel):
    grievance_type: GrievanceType
    description: str = Field(..., min_length=10, max_length=2000)
    patient_id: Optional[str] = None


class GrievanceResponse(BaseModel):
    grievance_id: str
    patient_id: Optional[str]
    grievance_type: GrievanceType
    description: str
    status: GrievanceStatus
    submitted_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    reference_id: str


class GrievanceListResponse(BaseModel):
    grievances: List[GrievanceResponse]


class DataExportRequest(BaseModel):
    patient_id: str
    include_scans: bool = True
    include_consultations: bool = True
    include_referrals: bool = True


class DataExportResponse(BaseModel):
    export_id: str
    patient_id: str
    status: str  # "processing", "ready", "expired"
    requested_at: datetime
    download_url: Optional[str] = None
    expires_at: Optional[datetime] = None


class DataRetentionSettings(BaseModel):
    patient_id: str
    retention_years: int = Field(..., ge=1, le=7)
    auto_delete_after_retention: bool = False


class AccountDeletionRequest(BaseModel):
    patient_id: str
    confirmation_text: str = Field(..., pattern="^DELETE MY ACCOUNT$")
    reason: Optional[str] = None


class PrivacySettingsResponse(BaseModel):
    patient_id: str
    data_retention_years: int
    auto_delete_enabled: bool
    last_export_request: Optional[datetime] = None
    account_deletion_scheduled: bool = False
    deletion_scheduled_date: Optional[datetime] = None
