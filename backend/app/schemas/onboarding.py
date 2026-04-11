from pydantic import BaseModel, EmailStr, Field
from typing import Optional

# Simplified Signup Schemas
class SimpleUserSignup(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = None
    aadhaar_number: str = Field(..., pattern=r"^\d{12}$")
    role: str = Field(..., pattern="^(user|doctor)$")


class SimpleDoctorSignup(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = None
    aadhaar_number: str = Field(..., pattern=r"^\d{12}$")
    role: str = Field(default="doctor")


# Onboarding Schema (health details)
class UserOnboarding(BaseModel):
    date_of_birth: str  # YYYY-MM-DD
    gender: str = Field(..., pattern="^(male|female|other)$")
    height: float = Field(..., gt=0, description="Height in cm")
    weight: float = Field(..., gt=0, description="Weight in kg")
    blood_group: str
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class OnboardingResponse(BaseModel):
    message: str
    health_id: str
    onboarded: bool
