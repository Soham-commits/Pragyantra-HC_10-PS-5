from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse
import json
import io

from app.schemas.privacy import (
    GrievanceCreate,
    GrievanceResponse,
    GrievanceListResponse,
    DataExportRequest,
    DataExportResponse,
    DataRetentionSettings,
    AccountDeletionRequest,
    PrivacySettingsResponse,
)
from app.services.privacy_service import PrivacyService
from app.routes.auth import require_patient
from app.database import get_scans_collection, get_health_profiles_collection, get_referrals_collection

router = APIRouter(prefix="/api/privacy", tags=["Privacy & Grievance"])


@router.post("/grievance", response_model=GrievanceResponse, status_code=status.HTTP_201_CREATED)
async def submit_grievance(
    payload: GrievanceCreate,
    patient_id: str = Depends(require_patient)
):
    """
    Submit a new grievance/complaint.
    """
    # Override patient_id from auth
    payload.patient_id = patient_id
    return await PrivacyService.submit_grievance(payload)


@router.get("/grievances", response_model=GrievanceListResponse)
async def get_my_grievances(
    patient_id: str = Depends(require_patient)
):
    """
    Get all grievances submitted by the current patient.
    """
    grievances = await PrivacyService.get_patient_grievances(patient_id)
    return GrievanceListResponse(grievances=grievances)


@router.post("/export", response_model=DataExportResponse)
async def request_data_export(
    payload: DataExportRequest,
    patient_id: str = Depends(require_patient)
):
    """
    Request a data export of all personal health data.
    """
    payload.patient_id = patient_id
    return await PrivacyService.request_data_export(payload)


@router.get("/export/{export_id}/download")
async def download_export(
    export_id: str,
    patient_id: str = Depends(require_patient)
):
    """
    Download a generated data export as JSON file.
    """
    from app.database import get_data_exports_collection
    from app.database import get_consents_collection
    from app.database import get_notifications_collection
    
    exports_collection = get_data_exports_collection()
    
    # Verify export exists and belongs to patient
    export = await exports_collection.find_one({
        "export_id": export_id,
        "patient_id": patient_id,
        "status": "ready"
    })
    
    if not export:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export not found or not ready"
        )
    
    # Gather all patient data
    scans_collection = get_scans_collection()
    profile_collection = get_health_profiles_collection()
    referrals_collection = get_referrals_collection()
    consents_collection = get_consents_collection()
    notifications_collection = get_notifications_collection()
    
    # Get profile
    profile = await profile_collection.find_one({"health_id": patient_id}, {"_id": 0})
    
    # Get scans
    scans_cursor = scans_collection.find({"health_id": patient_id}, {"_id": 0})
    scans = await scans_cursor.to_list(length=1000)
    
    # Get referrals
    referrals_cursor = referrals_collection.find({"patient_id": patient_id}, {"_id": 0})
    referrals = await referrals_cursor.to_list(length=100)
    
    # Get consents
    consents_cursor = consents_collection.find({"patient_id": patient_id}, {"_id": 0})
    consents = await consents_cursor.to_list(length=100)
    
    # Get notifications
    notifications_cursor = notifications_collection.find({"patient_id": patient_id}, {"_id": 0})
    notifications = await notifications_cursor.to_list(length=100)
    
    # Build export data
    export_data = {
        "export_metadata": {
            "export_id": export_id,
            "patient_id": patient_id,
            "generated_at": datetime.utcnow().isoformat(),
            "version": "1.0"
        },
        "profile": profile or {},
        "scans": scans,
        "referrals": referrals,
        "consents": consents,
        "notifications": notifications,
    }
    
    # Convert to JSON bytes
    json_content = json.dumps(export_data, indent=2, default=str)
    json_bytes = io.BytesIO(json_content.encode('utf-8'))
    
    return StreamingResponse(
        json_bytes,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=mediq_export_{patient_id}_{datetime.utcnow().strftime('%Y%m%d')}.json"
        }
    )


@router.get("/settings", response_model=PrivacySettingsResponse)
async def get_privacy_settings(
    patient_id: str = Depends(require_patient)
):
    """
    Get current privacy settings for the patient.
    """
    return await PrivacyService.get_privacy_settings(patient_id)


@router.post("/settings/retention", response_model=PrivacySettingsResponse)
async def update_retention_settings(
    settings: DataRetentionSettings,
    patient_id: str = Depends(require_patient)
):
    """
    Update data retention settings.
    """
    settings.patient_id = patient_id
    return await PrivacyService.update_data_retention(settings)


@router.post("/account/delete")
async def request_account_deletion(
    request: AccountDeletionRequest,
    patient_id: str = Depends(require_patient)
):
    """
    Request account deletion (30-day grace period).
    """
    request.patient_id = patient_id
    result = await PrivacyService.request_account_deletion(request)
    return result


@router.get("/audit")
async def get_my_audit_trail(
    patient_id: str = Depends(require_patient),
):
    """
    Surface an audit trail for the current patient.

    Note: This is a best-effort aggregation of existing immutable logs (e.g. referral audit_log,
    consent records, export requests, deletion audit records). It is not a full data-access
    audit across every read path.
    """
    from app.database import (
        get_consents_collection,
        get_data_exports_collection,
        get_deletion_audit_collection,
        get_privacy_settings_collection,
    )

    consents_collection = get_consents_collection()
    exports_collection = get_data_exports_collection()
    deletion_audit_collection = get_deletion_audit_collection()
    privacy_settings_collection = get_privacy_settings_collection()
    referrals_collection = get_referrals_collection()

    # Gather source records (bounded).
    consents = await consents_collection.find(
        {"patient_id": patient_id},
        {"_id": 0},
    ).sort("timestamp", -1).to_list(length=200)

    exports = await exports_collection.find(
        {"patient_id": patient_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(length=50)

    deletions = await deletion_audit_collection.find(
        {"patient_id": patient_id},
        {"_id": 0},
    ).sort("requested_at", -1).to_list(length=20)

    privacy_settings = await privacy_settings_collection.find(
        {"patient_id": patient_id},
        {"_id": 0},
    ).sort("updated_at", -1).to_list(length=20)

    referrals = await referrals_collection.find(
        {"patient_id": patient_id},
        {"_id": 0, "referral_id": 1, "audit_log": 1, "created_at": 1, "specialist_name": 1, "specialist_specialty": 1},
    ).sort("created_at", -1).to_list(length=200)

    events: list[dict] = []

    # Consents
    for c in consents:
        ts = c.get("timestamp") or c.get("created_at")
        events.append(
            {
                "event_id": f"consent:{c.get('consent_id') or c.get('timestamp')}",
                "timestamp": ts,
                "category": "consent",
                "action": f"Consent recorded: {c.get('consent_type') or 'consent'}",
                "actor_role": "patient",
                "details": {
                    "consent_type": c.get("consent_type"),
                    "version": c.get("version"),
                    "status": c.get("status"),
                },
            }
        )

    # Export requests (JSON export flow)
    for ex in exports:
        ts = ex.get("created_at") or ex.get("requested_at")
        events.append(
            {
                "event_id": f"export:{ex.get('export_id')}",
                "timestamp": ts,
                "category": "export",
                "action": "Data export requested",
                "actor_role": "patient",
                "details": {
                    "export_id": ex.get("export_id"),
                    "status": ex.get("status"),
                },
            }
        )

    # Retention settings changes
    for s in privacy_settings:
        ts = s.get("updated_at") or s.get("created_at")
        if ts is None:
            continue
        events.append(
            {
                "event_id": f"retention:{s.get('settings_id') or ts}",
                "timestamp": ts,
                "category": "retention",
                "action": "Data retention settings updated",
                "actor_role": "patient",
                "details": {
                    "data_retention_years": s.get("data_retention_years"),
                    "auto_delete_after_retention": s.get("auto_delete_after_retention"),
                },
            }
        )

    # Referral audit log
    for r in referrals:
        rid = r.get("referral_id")
        for idx, entry in enumerate(r.get("audit_log") or []):
            events.append(
                {
                    "event_id": f"referral:{rid}:{idx}",
                    "timestamp": entry.get("timestamp") or r.get("created_at"),
                    "category": "referral",
                    "action": f"Referral status changed to {entry.get('status')}",
                    "actor_role": entry.get("changed_by_role") or "system",
                    "details": {
                        "referral_id": rid,
                        "status": entry.get("status"),
                        "note": entry.get("note"),
                        "specialist_name": r.get("specialist_name"),
                        "specialist_specialty": r.get("specialist_specialty"),
                    },
                }
            )

    # Deletion audit record (if exists)
    for d in deletions:
        events.append(
            {
                "event_id": f"deletion:{d.get('audit_id')}",
                "timestamp": d.get("requested_at"),
                "category": "deletion",
                "action": f"Account deletion {d.get('status')}",
                "actor_role": "patient",
                "details": {
                    "audit_id": d.get("audit_id"),
                    "status": d.get("status"),
                    "deleted_counts": d.get("deleted_counts"),
                },
            }
        )

    # Sort newest first; tolerate mixed timestamp types/strings.
    def _ts(e: dict):
        v = e.get("timestamp")
        if isinstance(v, datetime):
            return v
        try:
            return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        except Exception:
            return datetime.min

    events.sort(key=_ts, reverse=True)
    return {"events": events[:300]}
