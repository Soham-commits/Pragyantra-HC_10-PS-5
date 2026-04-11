from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.schemas.schemas import (
    UserRegister, DoctorRegister, UserLogin, Token, 
    UserProfile, DoctorProfile
)
from app.utils.security import (
    hash_password, verify_password, hash_aadhaar, 
    create_access_token, decode_access_token
)
from app.utils.health_id import (
    generate_health_id, generate_doctor_id, calculate_age
)
from app.utils.health_chain_utils import generate_rsa_key_pair, generate_wallet_address
from app.services.health_chain_service import ensure_registration_chain_entry
from app.database import get_users_collection, get_doctors_collection, get_health_profiles_collection
from datetime import datetime, timedelta
from typing import Optional
import logging

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer()
logger = logging.getLogger(__name__)


@router.post("/register/patient", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register_patient(user_data: UserRegister):
    """
    Register a new patient.
    - Hashes Aadhaar for secure storage (never stores plain text)
    - Generates unique Health ID for lifetime medical tracking
    - Creates user and health profile
    """
    users_collection = get_users_collection()
    health_profiles_collection = get_health_profiles_collection()
    
    # Hash Aadhaar for lookup (never store plain Aadhaar)
    aadhaar_hash = hash_aadhaar(user_data.aadhaar_number)
    
    # Check if user already exists
    existing_user = await users_collection.find_one({"aadhaar_hash": aadhaar_hash})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this Aadhaar number already exists"
        )
    
    # Check email uniqueness
    existing_email = await users_collection.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Generate unique Health ID
    health_id = generate_health_id(user_data.aadhaar_number, user_data.date_of_birth)
    
    # Calculate age
    age = calculate_age(user_data.date_of_birth)
    
    # Hash password
    hashed_password = hash_password(user_data.password)

    # Generate wallet identity keys for decentralized health chain simulation.
    private_key, public_key = generate_rsa_key_pair()
    wallet_address = generate_wallet_address(public_key)
    
    # Create user document
    user_doc = {
        "health_id": health_id,
        "aadhaar_hash": aadhaar_hash,  # Hashed Aadhaar, not plain text
        "email": user_data.email,
        "password": hashed_password,
        "role": "patient",
        "public_key": public_key,
        "wallet_address": wallet_address,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True
    }
    
    # Create health profile
    health_profile = {
        "health_id": health_id,
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "date_of_birth": user_data.date_of_birth,
        "age": age,
        "gender": user_data.gender,
        "height": user_data.height,
        "weight": user_data.weight,
        "blood_group": user_data.blood_group,
        "emergency_contact_name": user_data.emergency_contact_name,
        "emergency_contact_phone": user_data.emergency_contact_phone,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert into database
    await users_collection.insert_one(user_doc)
    await health_profiles_collection.insert_one(health_profile)

    try:
        await ensure_registration_chain_entry(health_id)
    except Exception as exc:
        logger.warning("Failed to append registration chain block for %s: %s", health_id, exc)
    
    # Generate JWT token
    access_token = create_access_token(
        data={"sub": health_id, "role": "patient"}
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        role="patient",
        health_id=health_id,
        wallet_address=wallet_address,
        private_key=private_key,
    )


@router.post("/register/doctor", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register_doctor(doctor_data: DoctorRegister):
    """
    Register a new doctor.
    - Creates doctor profile with credentials and specialization
    - Generates unique Doctor ID
    """
    doctors_collection = get_doctors_collection()
    
    # Hash Aadhaar
    aadhaar_hash = hash_aadhaar(doctor_data.aadhaar_number)
    
    # Check if doctor already exists
    existing_doctor = await doctors_collection.find_one({"aadhaar_hash": aadhaar_hash})
    if existing_doctor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor with this Aadhaar number already exists"
        )
    
    # Check email uniqueness
    existing_email = await doctors_collection.find_one({"email": doctor_data.email})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check medical license uniqueness
    existing_license = await doctors_collection.find_one({"medical_license": doctor_data.medical_license})
    if existing_license:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Medical license already registered"
        )
    
    # Generate Doctor ID
    doctor_id = generate_doctor_id()
    
    # Hash password
    hashed_password = hash_password(doctor_data.password)
    
    # Create doctor document
    doctor_doc = {
        "doctor_id": doctor_id,
        "aadhaar_hash": aadhaar_hash,
        "email": doctor_data.email,
        "password": hashed_password,
        "full_name": doctor_data.full_name,
        "phone": doctor_data.phone,
        "medical_license": doctor_data.medical_license,
        "specialization": doctor_data.specialization,
        "qualification": doctor_data.qualification,
        "experience_years": doctor_data.experience_years,
        "hospital_affiliation": doctor_data.hospital_affiliation,
        "consultation_fee": doctor_data.consultation_fee,
        "rating": 0.0,
        "total_consultations": 0,
        "role": "doctor",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert into database
    await doctors_collection.insert_one(doctor_doc)
    
    # Generate JWT token
    access_token = create_access_token(
        data={"sub": doctor_id, "role": "doctor"}
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        role="doctor",
        doctor_id=doctor_id,
        full_name=doctor_data.full_name
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """
    Login for both patients and doctors using Aadhaar and password.
    Returns JWT token with role information.
    """
    users_collection = get_users_collection()
    doctors_collection = get_doctors_collection()
    
    # Hash Aadhaar for lookup
    aadhaar_hash = hash_aadhaar(credentials.aadhaar_number)
    
    # Try to find in users collection (patients)
    user = await users_collection.find_one({"aadhaar_hash": aadhaar_hash})
    
    if user:
        # Verify password
        if not verify_password(credentials.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Generate token
        access_token = create_access_token(
            data={"sub": user["health_id"], "role": "patient"}
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            role="patient",
            health_id=user["health_id"]
        )
    
    # Try to find in doctors collection
    doctor = await doctors_collection.find_one({"aadhaar_hash": aadhaar_hash})
    
    if doctor:
        # Verify password
        if not verify_password(credentials.password, doctor["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Generate token
        access_token = create_access_token(
            data={"sub": doctor["doctor_id"], "role": "doctor"}
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            role="doctor",
            doctor_id=doctor["doctor_id"],
            full_name=doctor.get("full_name")
        )
    
    # No user or doctor found
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials"
    )


# Dependency for protected routes
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency to get current authenticated user from JWT token.
    Returns dict with 'id' and 'role'.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user_id = payload.get("sub")
    role = payload.get("role")
    
    if not user_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    return {"id": user_id, "role": role}


async def require_patient(current_user: dict = Depends(get_current_user)):
    """Dependency to require patient role"""
    if current_user["role"] != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only accessible to patients"
        )
    return current_user


async def require_doctor(current_user: dict = Depends(get_current_user)):
    """Dependency to require doctor role"""
    if current_user["role"] != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only accessible to doctors"
        )
    return current_user
