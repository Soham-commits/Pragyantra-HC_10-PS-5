from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.schemas.onboarding import SimpleUserSignup, SimpleDoctorSignup, UserOnboarding, OnboardingResponse
from app.schemas.schemas import Token, UserLogin
from app.utils.security import (
    hash_password, verify_password, hash_aadhaar, 
    create_access_token, decode_access_token
)
from app.utils.health_id import generate_health_id, generate_doctor_id, calculate_age
from app.utils.health_chain_utils import generate_rsa_key_pair, generate_wallet_address
from app.services.health_chain_service import ensure_registration_chain_entry
from app.database import get_users_collection, get_doctors_collection, get_health_profiles_collection
from datetime import datetime
import logging

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer()
logger = logging.getLogger(__name__)


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(user_data: SimpleUserSignup):
    """
    Simplified signup - Step 1
    Creates user account and generates Health ID.
    User still needs to complete onboarding with health details.
    """
    users_collection = get_users_collection()
    
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
    
    # Generate unique Health ID (using current date as placeholder for DOB)
    temp_dob = datetime.utcnow().strftime("%Y-%m-%d")
    health_id = generate_health_id(user_data.aadhaar_number, temp_dob)
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Determine role
    role = "patient" if user_data.role == "user" else "doctor"

    private_key = None
    public_key = None
    wallet_address = None
    if role == "patient":
        private_key, public_key = generate_rsa_key_pair()
        wallet_address = generate_wallet_address(public_key)
    
    # Create user document
    user_doc = {
        "health_id": health_id,
        "aadhaar_hash": aadhaar_hash,
        "email": user_data.email,
        "password": hashed_password,
        "full_name": user_data.full_name,
        "phone": user_data.phone or "",
        "role": role,
        "onboarded": False,  # Not yet onboarded
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True
    }

    if role == "patient":
        user_doc["public_key"] = public_key
        user_doc["wallet_address"] = wallet_address
    
    # Insert into database
    await users_collection.insert_one(user_doc)

    if role == "patient":
        try:
            await ensure_registration_chain_entry(health_id)
        except Exception as exc:
            logger.warning("Failed to append registration chain block for %s: %s", health_id, exc)
    
    # Generate JWT token
    access_token = create_access_token(
        data={"sub": health_id, "role": role}
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=role,
        health_id=health_id,
        wallet_address=wallet_address,
        private_key=private_key,
    )


@router.post("/onboarding", response_model=OnboardingResponse)
async def complete_onboarding(
    onboarding_data: UserOnboarding,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Complete user onboarding - Step 2
    Add health profile details after signup.
    """
    # Verify JWT token
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    health_id = payload.get("sub")
    role = payload.get("role")
    
    if not health_id or role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can complete onboarding"
        )
    
    users_collection = get_users_collection()
    health_profiles_collection = get_health_profiles_collection()
    
    # Get user
    user = await users_collection.find_one({"health_id": health_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already onboarded
    if user.get("onboarded"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already onboarded"
        )
    
    # Calculate age
    age = calculate_age(onboarding_data.date_of_birth)
    
    # Create health profile
    health_profile = {
        "health_id": health_id,
        "full_name": user["full_name"],
        "phone": user.get("phone", ""),
        "date_of_birth": onboarding_data.date_of_birth,
        "age": age,
        "gender": onboarding_data.gender,
        "height": onboarding_data.height,
        "weight": onboarding_data.weight,
        "blood_group": onboarding_data.blood_group,
        "allergies": onboarding_data.allergies,
        "chronic_conditions": onboarding_data.chronic_conditions,
        "current_medications": onboarding_data.current_medications,
        "emergency_contact_name": onboarding_data.emergency_contact_name,
        "emergency_contact_phone": onboarding_data.emergency_contact_phone,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert health profile
    await health_profiles_collection.insert_one(health_profile)
    
    # Update user onboarding status
    await users_collection.update_one(
        {"health_id": health_id},
        {"$set": {"onboarded": True, "updated_at": datetime.utcnow()}}
    )
    
    return OnboardingResponse(
        message="Onboarding completed successfully",
        health_id=health_id,
        onboarded=True
    )


@router.get("/profile")
async def get_user_profile(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get current user's profile including health information.
    Requires JWT token in Authorization header.
    Supports both patients and doctors.
    """
    try:
        # Decode token
        token_data = decode_access_token(credentials.credentials)
        user_id = token_data.get("sub")
        role = token_data.get("role")

        # Backward-compat: old tokens may carry "specialist"; treat as doctor.
        if role == "specialist":
            role = "doctor"
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Get user from appropriate collection based on role
        if role == "doctor":
            doctors_collection = get_doctors_collection()
            user = await doctors_collection.find_one({"doctor_id": user_id})
            if not user:
                # Fallback for older seeded accounts stored in users collection.
                users_collection = get_users_collection()
                user = await users_collection.find_one({"doctor_id": user_id}) or await users_collection.find_one({"specialist_id": user_id})
        else:
            users_collection = get_users_collection()
            user = await users_collection.find_one({"health_id": user_id})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get health profile if onboarded (patients only)
        health_profile = None
        if role == "patient" and user.get("onboarded", False):
            health_profiles_collection = get_health_profiles_collection()
            health_profile = await health_profiles_collection.find_one({"health_id": user_id})
        
        # Build response based on role
        if role == "doctor":
            profile_data = {
                "doctor_id": user_id,
                "full_name": user.get("full_name", ""),
                "email": user.get("email", ""),
                "phone": user.get("phone"),
                "role": "doctor",
                "onboarded": True,  # Doctors are always onboarded
                "specialization": user.get("specialization"),
                "qualification": user.get("qualification"),
                "experience_years": user.get("experience_years"),
                "hospital_affiliation": user.get("hospital_affiliation"),
                "consultation_fee": user.get("consultation_fee"),
                "created_at": user.get("created_at"),
            }
        else:
            # For patients, get full_name from health_profile first, fallback to users collection
            full_name = ""
            if health_profile:
                full_name = health_profile.get("full_name", "")
            if not full_name:
                full_name = user.get("full_name", "")
            
            profile_data = {
                "health_id": user_id,
                "full_name": full_name,
                "email": user.get("email", ""),
                "onboarded": user.get("onboarded", False),
                "created_at": user.get("created_at"),
                "wallet_address": user.get("wallet_address"),
                "public_key": user.get("public_key"),
            }
        
            # Add health profile data if available (for patients only)
            if health_profile:
                profile_data.update({
                    "phone": health_profile.get("phone"),
                    "date_of_birth": health_profile.get("date_of_birth"),
                    "age": health_profile.get("age"),
                    "gender": health_profile.get("gender"),
                    "height": health_profile.get("height"),
                    "weight": health_profile.get("weight"),
                    "blood_group": health_profile.get("blood_group"),
                    "allergies": health_profile.get("allergies"),
                    "chronic_conditions": health_profile.get("chronic_conditions"),
                    "current_medications": health_profile.get("current_medications"),
                    "emergency_contacts": health_profile.get("emergency_contacts"),
                })
        
        return profile_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}"
        )


@router.put("/profile")
async def update_user_profile(
    profile_update: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Update current user's profile information.
    Requires JWT token in Authorization header.
    Only updates health profile data for patients.
    """
    try:
        # Decode token
        token_data = decode_access_token(credentials.credentials)
        user_id = token_data.get("sub")
        role = token_data.get("role")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Only allow patients to update profile
        if role != "patient":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Profile updates are only available for patients"
            )
        
        users_collection = get_users_collection()
        health_profiles_collection = get_health_profiles_collection()
        
        # Check if user exists
        user = await users_collection.find_one({"health_id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Prepare update data - only allow certain fields to be updated
        allowed_fields = [
            "full_name", "phone", "date_of_birth", "age", "gender",
            "height", "weight", "blood_group", "allergies",
            "chronic_conditions", "current_medications", "emergency_contacts"
        ]
        
        update_data = {
            k: v for k, v in profile_update.items() 
            if k in allowed_fields and v is not None
        }
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields to update"
            )
        
        update_data["updated_at"] = datetime.utcnow()
        
        # Update full_name in users collection if provided
        if "full_name" in update_data:
            await users_collection.update_one(
                {"health_id": user_id},
                {"$set": {"full_name": update_data["full_name"], "updated_at": datetime.utcnow()}}
            )
        
        # Update or create health profile
        result = await health_profiles_collection.update_one(
            {"health_id": user_id},
            {"$set": update_data},
            upsert=True
        )
        
        # Fetch updated profile
        updated_user = await users_collection.find_one({"health_id": user_id})
        health_profile = await health_profiles_collection.find_one({"health_id": user_id})
        
        profile_data = {
            "health_id": user_id,
            "full_name": updated_user.get("full_name"),
            "email": updated_user.get("email"),
            "onboarded": updated_user.get("onboarded", False),
            "wallet_address": updated_user.get("wallet_address"),
            "public_key": updated_user.get("public_key"),
        }
        
        if health_profile:
            profile_data.update({
                "phone": health_profile.get("phone"),
                "date_of_birth": health_profile.get("date_of_birth"),
                "age": health_profile.get("age"),
                "gender": health_profile.get("gender"),
                "height": health_profile.get("height"),
                "weight": health_profile.get("weight"),
                "blood_group": health_profile.get("blood_group"),
                "allergies": health_profile.get("allergies"),
                "chronic_conditions": health_profile.get("chronic_conditions"),
                "current_medications": health_profile.get("current_medications"),
                "emergency_contacts": health_profile.get("emergency_contacts"),
            })
        
        return profile_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}"
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
        
        # Only patient + doctor roles exist in JWTs.
        user_role = user.get("role", "patient")
        if user_role == "specialist":
            user_role = "doctor"

        if user_role == "doctor":
            user_sub = user.get("doctor_id") or user.get("specialist_id") or user.get("health_id")
        else:
            user_sub = user["health_id"]
        
        access_token = create_access_token(
            data={"sub": user_sub, "role": user_role}
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            role=user_role,
            health_id=user.get("health_id"),
            doctor_id=user_sub if user_role == "doctor" else None,
            onboarded=user.get("onboarded", False)
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
            doctor_id=doctor["doctor_id"]
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


# --- Referral Module role guards ---

async def require_doctor_or_patient(
    current_user: dict = Depends(get_current_user),
):
    """
    Dependency for endpoints accessible to doctor and patient.
    Used by: GET /referrals/patient/{id}
    """
    if current_user["role"] not in ("doctor", "patient"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted"
        )
    return current_user
