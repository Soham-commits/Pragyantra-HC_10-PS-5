from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import List
from app.routes.simple_auth import (
    require_doctor,
    require_doctor_or_patient,
)
from app.database import get_referrals_collection
from app.schemas.referral_schemas import (
    SpecialistResponse,
    ReferralCreate,
    ReferralStatusUpdate,
    ReferralResponse,
)
from app.services import referral_service

router = APIRouter(prefix="/api/referrals", tags=["Referrals"])


# ---------------------------------------------------------------------------
# GET /referrals/search?q=
# Guard: doctor only
# ---------------------------------------------------------------------------

@router.get("/search", response_model=List[SpecialistResponse])
async def search_specialists(
    q: str = Query("", min_length=0, description="Search by name, specialty, or hospital (empty = list)"),
    current_user: dict = Depends(require_doctor),
):
    """
    Search doctors by name, specialization, or hospital affiliation.
    Returns up to 20 results. Empty list if no matches — never a 404.
    """
    results = await referral_service.search_specialists(q)
    return results


# ---------------------------------------------------------------------------
# POST /referrals/create
# Guard: doctor only
# ---------------------------------------------------------------------------

@router.post("/create", response_model=ReferralResponse, status_code=status.HTTP_201_CREATED)
async def create_referral(
    payload: ReferralCreate,
    current_user: dict = Depends(require_doctor),
):
    """
    Doctor confirms a referral for a patient scan.
    - XOR validation (specialist_id vs external_specialist) fires at schema parse time.
    - Referral record is saved with initial audit_log entry.
    - Source scan is marked referral_triggered=True inside the service layer.
    """
    referral = await referral_service.create_referral(payload, current_user["id"])
    return referral


# ---------------------------------------------------------------------------
# PATCH /referrals/{referral_id}/status
# Guard: doctor only (receiving doctor)
# ---------------------------------------------------------------------------

@router.patch("/{referral_id}/status", response_model=ReferralResponse)
async def update_referral_status(
    referral_id: str,
    update: ReferralStatusUpdate,
    current_user: dict = Depends(require_doctor),
):
    """
    Receiving doctor accepts, declines, reroutes, or completes a referral.
    Every status change is appended to audit_log — never overwritten.
    Returns 404 if referral_id is not found.
    """
    updated = await referral_service.update_referral_status(
        referral_id=referral_id,
        update=update,
        changed_by=current_user["id"],
        changed_by_role="doctor",
        require_assignee_id=current_user["id"],
    )

    if not updated:
        existing = await get_referrals_collection().find_one(
            {"referral_id": referral_id},
            {"_id": 0, "specialist_id": 1},
        )
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Referral '{referral_id}' not found",
            )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return updated


# ---------------------------------------------------------------------------
# GET /referrals/patient/{patient_id}
# Guard: doctor + patient
# ---------------------------------------------------------------------------

@router.get("/patient/{patient_id}", response_model=List[ReferralResponse])
async def get_referrals_for_patient(
    patient_id: str,
    current_user: dict = Depends(require_doctor_or_patient),
):
    """
    Fetch all referrals for a patient, newest first.
    - Doctors and specialists can query any patient_id.
    - Patients can only query their own patient_id.
    Returns empty list if no referrals exist — never a 404.
    """
    # Patients may only see their own referrals
    if current_user["role"] == "patient" and current_user["id"] != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    referrals = await referral_service.get_referrals_for_patient(patient_id)
    return referrals


# ---------------------------------------------------------------------------
# GET /referrals/doctor/inbox
# Guard: doctor only (received referrals)
# ---------------------------------------------------------------------------

@router.get("/doctor/inbox", response_model=List[ReferralResponse])
async def get_doctor_received_inbox(
    current_user: dict = Depends(require_doctor),
):
    """
    Fetch all referrals assigned to the logged-in doctor (receiver), newest first.
    Returns empty list if no referrals exist.
    """
    doctor_id = current_user["id"]
    referrals = await referral_service.get_referrals_for_specialist(doctor_id)
    return referrals


# ---------------------------------------------------------------------------
# GET /referrals/doctor/sent
# Guard: doctor only (sent referrals)
# ---------------------------------------------------------------------------

@router.get("/doctor/sent", response_model=List[ReferralResponse])
async def get_doctor_sent(
    current_user: dict = Depends(require_doctor),
):
    """
    Fetch all referrals created by the logged-in doctor, newest first.
    Returns empty list if no referrals exist.
    """
    doctor_id = current_user["id"]
    referrals = await referral_service.get_referrals_by_doctor(doctor_id)
    return referrals


# Backward-compat alias: old specialist inbox path now maps to doctor inbox.
@router.get("/specialist/inbox", response_model=List[ReferralResponse])
async def get_specialist_inbox_compat(
    current_user: dict = Depends(require_doctor),
):
    doctor_id = current_user["id"]
    referrals = await referral_service.get_referrals_for_specialist(doctor_id)
    return referrals
