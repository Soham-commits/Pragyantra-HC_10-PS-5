from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class HistoryEntryType(str, Enum):
    """Types of medical history entries"""
    CHATBOT_SCREENING = "chatbot_screening"
    SCAN_ANALYSIS = "scan_analysis"
    MEDICAL_REPORT = "medical_report"
    DOCTOR_VISIT = "doctor_visit"


class RiskLevel(str, Enum):
    """Risk level classification"""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"
    NONE = "none"


class MedicalHistoryEntryCreate(BaseModel):
    """Schema for creating a medical history entry"""
    health_id: str = Field(..., description="Unified Health ID of the patient")
    entry_type: HistoryEntryType
    title: str = Field(..., min_length=3, max_length=200)
    summary: str = Field(..., min_length=10, max_length=1000, description="Brief summary of the entry")
    risk_level: RiskLevel = Field(default=RiskLevel.NONE)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional structured data")
    doctor_id: Optional[str] = Field(None, description="Doctor ID if entry is from a doctor visit")
    related_report_id: Optional[str] = Field(None, description="Related report ID if applicable")


class MedicalHistoryEntryResponse(BaseModel):
    """Schema for medical history entry response"""
    id: str
    health_id: str
    entry_type: HistoryEntryType
    title: str
    summary: str
    risk_level: RiskLevel
    metadata: Dict[str, Any]
    doctor_id: Optional[str]
    related_report_id: Optional[str]
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class MedicalHistoryTimelineResponse(BaseModel):
    """Schema for medical history timeline response"""
    total_entries: int
    entries: list[MedicalHistoryEntryResponse]
    health_id: str
    patient_name: Optional[str] = None
