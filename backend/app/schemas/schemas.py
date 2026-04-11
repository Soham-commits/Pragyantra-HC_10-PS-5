from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class BloodGroup(str, Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


class UserRole(str, Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"


# Registration/Login Schemas
class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    aadhaar_number: str = Field(..., pattern=r"^\d{12}$")
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone: str = Field(..., pattern=r"^\+?1?\d{9,15}$")
    date_of_birth: str  # YYYY-MM-DD
    gender: Gender
    height: float = Field(..., gt=0, description="Height in cm")
    weight: float = Field(..., gt=0, description="Weight in kg")
    blood_group: BloodGroup
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class UserLogin(BaseModel):
    aadhaar_number: str = Field(..., pattern=r"^\d{12}$")
    password: str


class DoctorRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    aadhaar_number: str = Field(..., pattern=r"^\d{12}$")
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone: str = Field(..., pattern=r"^\+?1?\d{9,15}$")
    medical_license: str
    specialization: str
    qualification: str
    experience_years: int = Field(..., ge=0)
    hospital_affiliation: Optional[str] = None
    consultation_fee: Optional[float] = Field(None, ge=0)


# Response Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    role: UserRole
    health_id: Optional[str] = None
    doctor_id: Optional[str] = None
    full_name: Optional[str] = None
    onboarded: Optional[bool] = False
    wallet_address: Optional[str] = None
    private_key: Optional[str] = None


class UserProfile(BaseModel):
    health_id: str
    full_name: str
    email: EmailStr
    phone: str
    date_of_birth: str
    age: int
    gender: Gender
    height: float
    weight: float
    blood_group: BloodGroup
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DoctorProfile(BaseModel):
    doctor_id: str
    full_name: str
    email: EmailStr
    phone: str
    medical_license: str
    specialization: str
    qualification: str
    experience_years: int
    hospital_affiliation: Optional[str] = None
    consultation_fee: Optional[float] = None
    rating: Optional[float] = None
    total_consultations: int = 0
    created_at: datetime
    
    class Config:
        from_attributes = True


# Medical History Schemas
class Diagnosis(BaseModel):
    condition: str
    severity: Optional[str] = None
    notes: Optional[str] = None


class Medication(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str
    notes: Optional[str] = None


class DoctorVisit(BaseModel):
    visit_id: str
    health_id: str
    doctor_id: str
    doctor_name: str
    date: datetime
    diagnosis: List[Diagnosis]
    medications: List[Medication]
    lab_tests_recommended: Optional[List[str]] = None
    follow_up_date: Optional[str] = None
    visit_notes: Optional[str] = None


class AddDoctorVisit(BaseModel):
    health_id: str
    diagnosis: List[Diagnosis]
    medications: List[Medication]
    lab_tests_recommended: Optional[List[str]] = None
    follow_up_date: Optional[str] = None
    visit_notes: Optional[str] = None


# Appointment Schemas
class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class AppointmentCreate(BaseModel):
    health_id: str
    appointment_date: str  # ISO format
    reason: str
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    appointment_id: str
    health_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    appointment_date: datetime
    reason: str
    status: AppointmentStatus
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AppointmentUpdate(BaseModel):
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None


class AppointmentNotesCreate(BaseModel):
    appointment_id: str
    care_details: str
    prescription_notes: Optional[str] = None
    prescription_image_url: Optional[str] = None
    follow_up_required: Optional[bool] = False
    follow_up_date: Optional[str] = None
    additional_notes: Optional[str] = None


class AppointmentNotesResponse(BaseModel):
    notes_id: str
    appointment_id: str
    health_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    care_details: str
    prescription_notes: Optional[str] = None
    prescription_image_url: Optional[str] = None
    follow_up_required: bool = False
    follow_up_date: Optional[datetime] = None
    additional_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PatientSummary(BaseModel):
    health_id: str
    full_name: str
    age: int
    gender: Gender
    blood_group: BloodGroup
    last_visit_date: Optional[datetime] = None
    total_scans: int = 0
    total_appointments: int = 0
    pending_appointments: int = 0


class PatientRemarkCreate(BaseModel):
    health_id: str
    remark: str
    category: Optional[str] = None  # e.g., "general", "observation", "warning"


class PatientRemarkResponse(BaseModel):
    remark_id: str
    health_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    remark: str
    category: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# Chat Schemas
class LocationData(BaseModel):
    latitude: float
    longitude: float


class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None  # Existing session or None for new
    language: Optional[str] = "en"  # ISO language code
    location: Optional[LocationData] = None  # User location for hospital recommendations
    include_profile_context: Optional[bool] = True
    include_rag: Optional[bool] = False


class HospitalSearchRequest(BaseModel):
    latitude: float
    longitude: float
    symptoms: Optional[List[str]] = []
    severity_level: Optional[str] = "moderate"


class HospitalRecommendation(BaseModel):
    hospital_id: str
    name: str
    distance_km: float
    address: str
    phone: str
    specializations: List[str]
    has_required_specialization: bool
    emergency_available: bool
    rating: float
    estimated_travel_time: str
    google_maps_url: str


class ChatResponse(BaseModel):
    response: str
    language: str
    timestamp: datetime
    session_id: str
    
    # AI analysis fields
    detected_symptoms: Optional[List[str]] = None
    severity_level: Optional[str] = None  # low, moderate, high
    recommendations: Optional[List[str]] = None
    model: Optional[str] = None  # AI model used
    
    # Hospital recommendations (if location provided and needed)
    hospitals: Optional[List[HospitalRecommendation]] = None
    should_offer_hospitals: Optional[bool] = False  # Should ask user if they want to see hospitals
    hospital_recommendation_reason: Optional[str] = None
    
    # Report generation recommendation (user needs to confirm)
    should_offer_report: bool = False
    report_object: Optional[Dict[str, Any]] = None
    
    
class ChatSessionSummary(BaseModel):
    session_id: str
    started_at: datetime
    last_message_at: datetime
    message_count: int
    preview: str  # First message preview
    symptoms: List[str]


class ChatHistoryMessage(BaseModel):
    user_message: str
    ai_response: str
    detected_symptoms: List[str]
    severity_level: Optional[str]
    recommendations: List[str]
    report_object: Optional[Dict[str, Any]] = None
    timestamp: datetime
    language: str


class ChatSessionResponse(BaseModel):
    session_id: str
    messages: List[ChatHistoryMessage]
    total_messages: int


# Scan Schemas
class ScanType(str, Enum):
    XRAY = "x-ray"
    MRI = "mri"
    CT_SCAN = "ct-scan"
    SKIN = "skin"
    OTHER = "other"


class ScanReviewStatus(str, Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"


class ScanResponse(BaseModel):
    scan_id: str
    health_id: str
    scan_type: ScanType
    image_url: str
    gradcam_url: Optional[str] = None
    heatmap_url: Optional[str] = None
    heatmap_generated: Optional[bool] = False
    upload_date: datetime
    
    # AI prediction fields
    prediction: Optional[str] = None
    probability: Optional[float] = None
    confidence: Optional[float] = None
    findings: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None
    
    # Scan-specific fields
    model_result: Optional[str] = None  # "normal" or "abnormal" for lung, "benign" or "malignant" for skin
    abnormal_probability: Optional[float] = None  # 0-100 (for lung scans)
    malignant_probability: Optional[float] = None  # 0-100 (for skin scans)
    threshold_used: Optional[float] = None  # 0-1
    severity: Optional[str] = None  # "Low", "Moderate", "High"

    # Doctor review fields
    review_status: ScanReviewStatus = ScanReviewStatus.PENDING
    reviewed_by_doctor: Optional[bool] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    doctor_notes: Optional[str] = None

    # Referral fields
    referral_triggered: Optional[bool] = False
    referral_id: Optional[str] = None


class DoctorScanResponse(BaseModel):
    scan_id: str
    health_id: str
    patient_name: str
    scan_type: ScanType
    image_url: str
    gradcam_url: Optional[str] = None
    heatmap_url: Optional[str] = None
    heatmap_generated: Optional[bool] = False
    upload_date: datetime
    prediction: Optional[str] = None
    confidence: Optional[float] = None
    model_result: Optional[str] = None
    abnormal_probability: Optional[float] = None
    malignant_probability: Optional[float] = None
    severity: Optional[str] = None
    review_status: ScanReviewStatus = ScanReviewStatus.PENDING
    reviewed_by_doctor: Optional[bool] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    doctor_notes: Optional[str] = None
    flagged_followup: Optional[bool] = None


class DoctorScanRemarksUpdate(BaseModel):
    notes: str


class DoctorScanReviewUpdate(BaseModel):
    doctor_notes: Optional[str] = None
    reviewed_by_doctor: Optional[str] = None
    status: ScanReviewStatus


class DoctorScanStatusUpdate(BaseModel):
    status: ScanReviewStatus
    flagged_followup: Optional[bool] = None


# Medical Report Schemas
class VitalSigns(BaseModel):
    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[float] = None


class MedicalReportCreate(BaseModel):
    health_id: str
    report_type: str
    chief_complaint: Optional[str] = None
    vital_signs: Optional[VitalSigns] = None
    diagnosis: List[Diagnosis]
    medications: List[Medication]
    lab_results: Optional[dict] = None
    doctor_notes: Optional[str] = None


class MedicalReportResponse(BaseModel):
    report_id: str
    health_id: str
    patient_name: str
    report_type: str
    generated_date: datetime
    chief_complaint: Optional[str] = None
    vital_signs: Optional[VitalSigns] = None
    diagnosis: List[Diagnosis]
    medications: List[Medication]
    lab_results: Optional[dict] = None
    doctor_notes: Optional[str] = None
    generated_by: Optional[str] = None  # doctor_id
    
    class Config:
        from_attributes = True


# Health History Schema
class HealthHistory(BaseModel):
    health_id: str
    patient_name: str
    age: int
    gender: Gender
    blood_group: BloodGroup
    recent_visits: List[DoctorVisit]
    recent_scans: List[ScanResponse]
    recent_reports: List[MedicalReportResponse]
    upcoming_appointments: List[AppointmentResponse]
    total_visits: int
    total_scans: int
    total_reports: int
