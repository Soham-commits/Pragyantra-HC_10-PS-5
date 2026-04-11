from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ReferralPriority(str, Enum):
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class ReferralStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    PENDING_REGISTRATION = "pending_registration"
    REROUTED = "rerouted"
    COMPLETED = "completed"
    DECLINED = "declined"


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class ExternalSpecialist(BaseModel):
    """Inline specialist details when referred doctor is not in the system."""
    name: str = Field(..., min_length=2, max_length=100)
    specialty: str = Field(..., min_length=2, max_length=100)
    contact: str = Field(..., min_length=2, max_length=200)  # email or phone


class AuditLogEntry(BaseModel):
    """Single status-change event appended to the referral audit trail."""
    status: ReferralStatus
    changed_by: str          # user_id (doctor_id or specialist_id)
    changed_by_role: str     # "doctor" | "specialist" | "hospital_admin" | "system"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Specialist Schemas
# ---------------------------------------------------------------------------

class SpecialistCreate(BaseModel):
    """Used when seeding or registering a new specialist."""
    name: str = Field(..., min_length=2, max_length=100)
    specialty: str = Field(..., min_length=2, max_length=100)
    hospital_name: str = Field(..., min_length=2, max_length=200)
    city: str = Field(..., min_length=2, max_length=100)
    country: str = Field(..., min_length=2, max_length=100)
    contact: str = Field(..., min_length=2, max_length=200)
    is_registered: bool = False
    hospital_admin_id: Optional[str] = None


class SpecialistResponse(BaseModel):
    """Returned when specialist records are fetched (e.g., search results)."""
    specialist_id: str
    name: str
    specialty: str
    hospital_name: str
    city: str
    country: str
    contact: str
    is_registered: bool
    photo_url: Optional[str] = None
    hospital_admin_id: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Referral Schemas
# ---------------------------------------------------------------------------

class ReferralCreate(BaseModel):
    """
    Payload sent by a referring doctor when they confirm a referral.
    Matches the exact payload structure defined in BRIEFING.md.
    XOR constraint: exactly one of specialist_id or external_specialist must be set.
    Enforced at parse time via model_validator → returns HTTP 422 before service layer.
    """
    patient_id: str
    source_scan_id: str
    scan_type: str                          # "chest_xray" | "skin"
    prediction: str                         # "normal" | "abnormal"
    confidence: float = Field(..., ge=0.0, le=1.0)
    gradcam_url: Optional[str] = None
    clinical_notes: str = Field(..., min_length=1)
    priority: ReferralPriority
    specialist_id: Optional[str] = None
    external_specialist: Optional[ExternalSpecialist] = None

    @model_validator(mode="after")
    def specialist_xor(self) -> "ReferralCreate":
        has_registered = bool(self.specialist_id)
        has_external = self.external_specialist is not None
        if has_registered and has_external:
            raise ValueError(
                "Provide either specialist_id or external_specialist — not both."
            )
        if not has_registered and not has_external:
            raise ValueError(
                "One of specialist_id or external_specialist is required."
            )
        return self


class ReferralStatusUpdate(BaseModel):
    """
    Payload for PATCH /referrals/{id}/status.
    Supports: accept → active, decline → declined, reroute → rerouted, complete → completed.
    """
    status: ReferralStatus
    note: Optional[str] = None              # Optional remark from specialist / doctor


class ReferralResponse(BaseModel):
    """Full referral record returned from the database."""
    referral_id: str
    patient_id: str
    patient_name: Optional[str] = None          # denormalised at creation
    source_scan_id: str
    image_url: Optional[str] = None             # original scan image
    scan_type: Optional[str] = None
    prediction: Optional[str] = None
    confidence: Optional[float] = None
    gradcam_url: Optional[str] = None
    referring_doctor_id: str
    referring_doctor_name: Optional[str] = None  # denormalised at creation
    specialist_id: Optional[str] = None
    specialist_name: Optional[str] = None        # denormalised at creation
    specialist_specialty: Optional[str] = None   # denormalised at creation
    specialist_hospital_name: Optional[str] = None
    specialist_verified: Optional[bool] = None
    external_specialist: Optional[ExternalSpecialist] = None
    clinical_notes: str
    priority: ReferralPriority
    status: ReferralStatus
    created_at: datetime
    audit_log: List[AuditLogEntry] = []

    class Config:
        from_attributes = True
