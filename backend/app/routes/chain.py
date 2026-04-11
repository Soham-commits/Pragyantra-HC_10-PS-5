from fastapi import APIRouter, Depends, HTTPException, status

from app.routes.simple_auth import require_doctor_or_patient, require_patient
from app.services.health_chain_service import (
    backfill_patient_chain,
    get_patient_chain,
    verify_record,
)

router = APIRouter(prefix="/api/chain", tags=["Health Chain"])


@router.get("/patient/{patient_id}")
async def get_chain_for_patient(
    patient_id: str,
    current_user: dict = Depends(require_patient),
):
    if current_user["id"] != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    blocks = await get_patient_chain(patient_id)
    return {
        "patient_id": patient_id,
        "total_blocks": len(blocks),
        "blocks": blocks,
    }


@router.get("/verify/{record_id}")
async def verify_chain_record(
    record_id: str,
    current_user: dict = Depends(require_doctor_or_patient),
):
    result = await verify_record(record_id)

    patient_id = result.get("patient_id")
    if current_user["role"] == "patient" and patient_id and current_user["id"] != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return result


@router.post("/backfill/{patient_id}")
async def backfill_chain_for_patient(
    patient_id: str,
    current_user: dict = Depends(require_patient),
):
    if current_user["id"] != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    summary = await backfill_patient_chain(patient_id)
    return summary
