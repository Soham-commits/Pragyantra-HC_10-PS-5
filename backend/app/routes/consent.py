from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import logging

from app.schemas.consent import ConsentBulkRequest, ConsentResponse, ConsentType
from app.services.consent_service import (
    record_consent_bulk,
    get_patient_consents,
    ensure_required_signup_consents,
)
from app.database import get_consents_collection
from app.routes.auth import require_patient, get_current_user

router = APIRouter(prefix="/api/consent", tags=["consent"])
logger = logging.getLogger(__name__)


@router.post("/record/bulk", response_model=ConsentResponse)
async def record_bulk_consent(
    request: ConsentBulkRequest,
    current_user: dict = Depends(require_patient)
):
    """
    Record multiple consent entries at once.
    Called after successful patient registration.
    """
    # Ensure patient can only record consents for themselves
    if current_user["id"] != request.patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only record consents for your own account"
        )
    
    collection = get_consents_collection()
    
    try:
        consent_ids = await record_consent_bulk(
            collection=collection,
            patient_id=request.patient_id,
            consents=request.consents
        )
        
        return ConsentResponse(success=True, consent_ids=consent_ids)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record consents: {str(e)}"
        )


@router.get("/patient/{patient_id}")
async def get_patient_consent_history(
    patient_id: str,
    current_user: dict = Depends(require_patient)
):
    """
    Fetch all consent records for a patient.
    Patients can only view their own consent history.
    """
    # Ensure patient can only view their own consents
    if current_user["id"] != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only view your own consent history"
        )
    
    collection = get_consents_collection()
    
    try:
        inserted_types = await ensure_required_signup_consents(collection, patient_id)
        if inserted_types:
            logger.info(
                "Auto-repaired missing signup consents for patient %s: %s",
                patient_id,
                inserted_types,
            )
        consents = await get_patient_consents(collection, patient_id)
        return {"consents": consents}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch consents: {str(e)}"
        )
