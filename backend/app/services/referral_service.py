from typing import Optional
from datetime import datetime
import uuid
import logging

from app.database import (
    get_specialists_collection,
    get_referrals_collection,
    get_scans_collection,
    get_users_collection,
    get_doctors_collection,
    get_health_profiles_collection,
    get_notifications_collection
)
from app.schemas.referral_schemas import (
    ReferralCreate,
    ReferralStatus,
    ReferralStatusUpdate,
    AuditLogEntry,
    SpecialistCreate,
)
from app.services.health_chain_service import hash_and_chain_referral

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Specialist operations
# ---------------------------------------------------------------------------

async def search_specialists(query: str) -> list:
    """
    Fuzzy search across doctors by name, specialization, or hospital affiliation.
    Returns a list of dicts shaped like SpecialistResponse for compatibility.
    """
    query = (query or "").strip()
    doctors = get_doctors_collection()
    if query:
        regex = {"$regex": query, "$options": "i"}
        qfilter = {"$or": [
            {"full_name": regex},
            {"specialization": regex},
            {"hospital_affiliation": regex},
        ]}
    else:
        qfilter = {}

    cursor = doctors.find(qfilter, {"_id": 0}).limit(20)
    doctor_results = await cursor.to_list(length=20)

    # Optional supplement: legacy seeded specialists may live only in `specialists`.
    # We still prefer searching `doctors` (per role restructure), but if results are
    # sparse we fill up to 20 from `specialists` for backward compatibility.
    specialists_fallback = []
    if len(doctor_results) < 20:
        specialists = get_specialists_collection()
        if query:
            sregex = {"$regex": query, "$options": "i"}
            sfilter = {"$or": [
                {"name": sregex},
                {"specialty": sregex},
                {"hospital_name": sregex},
            ]}
        else:
            sfilter = {}
        scursor = specialists.find(sfilter, {"_id": 0}).limit(20 - len(doctor_results))
        specialists_fallback = await scursor.to_list(length=20 - len(doctor_results))

    # Build photo_url map for any fallback specialists.
    specialist_photo_by_id = {s.get("specialist_id"): s.get("photo_url") for s in specialists_fallback if s.get("specialist_id")}

    # Map doctors -> SpecialistResponse shape (DB field names are not renamed).
    mapped: list[dict] = []
    seen_ids: set[str] = set()
    for doc in doctor_results:
        sid = doc.get("doctor_id")
        if sid:
            seen_ids.add(sid)
        mapped.append(
            {
                "specialist_id": sid,
                "name": doc.get("full_name") or "Unknown",
                "specialty": doc.get("specialization") or "General",
                "hospital_name": doc.get("hospital_affiliation") or "N/A",
                "city": doc.get("city") or "N/A",
                "country": doc.get("country") or "N/A",
                "contact": doc.get("email") or doc.get("phone") or "N/A",
                "is_registered": True,
                "photo_url": doc.get("photo_url") or specialist_photo_by_id.get(sid),
                "hospital_admin_id": doc.get("hospital_admin_id"),
            }
        )

    # Append fallback specialists that are not already represented in doctors results.
    for s in specialists_fallback:
        sid = s.get("specialist_id")
        if sid and sid in seen_ids:
            continue
        mapped.append(
            {
                "specialist_id": sid or _new_id(),
                "name": s.get("name") or "Unknown",
                "specialty": s.get("specialty") or "General",
                "hospital_name": s.get("hospital_name") or "N/A",
                "city": s.get("city") or "N/A",
                "country": s.get("country") or "N/A",
                "contact": s.get("contact") or "N/A",
                "is_registered": bool(s.get("is_registered", True)),
                "photo_url": s.get("photo_url"),
                "hospital_admin_id": s.get("hospital_admin_id"),
            }
        )
    return mapped


async def create_specialist(payload: SpecialistCreate) -> dict:
    """Insert a new specialist document. Used during seeding (Step 8)."""
    collection = get_specialists_collection()
    doc = payload.model_dump()
    doc["specialist_id"] = _new_id()
    await collection.insert_one(doc)
    return doc


# ---------------------------------------------------------------------------
# Referral operations
# ---------------------------------------------------------------------------

async def create_referral(payload: ReferralCreate, referring_doctor_id: str) -> dict:
    """
    Insert a new referral record.

    Rules (enforced here, not just in the schema):
    - specialist_id XOR external_specialist must be set.
    - If external_specialist is given → status starts as pending_registration.
    - If specialist_id is given → status starts as pending.
    - First audit_log entry is written automatically.
    """
    initial_status = (
        ReferralStatus.PENDING_REGISTRATION
        if payload.external_specialist
        else ReferralStatus.PENDING
    )

    first_audit_entry = AuditLogEntry(
        status=initial_status,
        changed_by=referring_doctor_id,
        changed_by_role="doctor",
        timestamp=datetime.utcnow(),
        note="Referral created by referring doctor.",
    )

    # Resolve names and image_url to avoid N+1 queries later
    patient_name = "Unknown Patient"
    health_profiles = get_health_profiles_collection()
    patient_profile = await health_profiles.find_one({"health_id": payload.patient_id})
    if patient_profile and "full_name" in patient_profile:
        patient_name = patient_profile["full_name"]
    else:
        # Fallback to users collection
        users = get_users_collection()
        user = await users.find_one({"health_id": payload.patient_id})
        if user and "full_name" in user:
            patient_name = user["full_name"]
            
    doctor_name = "Unknown Doctor"
    doctors = get_doctors_collection()
    doctor = await doctors.find_one({"doctor_id": referring_doctor_id})
    if doctor and "full_name" in doctor:
        doctor_name = doctor["full_name"]
    else:
        # Fallback for older seeded accounts stored in users collection.
        users = get_users_collection()
        legacy_doctor = await users.find_one(
            {"$or": [
                {"doctor_id": referring_doctor_id},
                {"specialist_id": referring_doctor_id},
                {"health_id": referring_doctor_id},
            ]},
            {"_id": 0, "full_name": 1},
        )
        if legacy_doctor and legacy_doctor.get("full_name"):
            doctor_name = legacy_doctor["full_name"]

    image_url = None
    gradcam_url = None
    confidence = payload.confidence  # Default from payload
    scans = get_scans_collection()
    scan = await scans.find_one({"scan_id": payload.source_scan_id})
    if scan:
        if "image_url" in scan:
            image_url = scan["image_url"]
        if "gradcam_url" in scan:
            gradcam_url = scan["gradcam_url"]
        if "confidence" in scan and scan["confidence"] is not None:
            confidence = scan["confidence"]

    specialist_name = None
    specialist_specialty = None
    specialist_hospital_name = None
    specialist_verified = None
    if payload.specialist_id:
        # specialist_id now refers to the receiving doctor's doctor_id.
        doctors_col = get_doctors_collection()
        receiving_doctor = await doctors_col.find_one({"doctor_id": payload.specialist_id}, {"_id": 0})
        if receiving_doctor:
            specialist_name = receiving_doctor.get("full_name")
            specialist_specialty = receiving_doctor.get("specialization")
            specialist_hospital_name = receiving_doctor.get("hospital_affiliation")
            specialist_verified = True
        else:
            # Fallback: older specialist directory collection.
            specialists_col = get_specialists_collection()
            spec = await specialists_col.find_one({"specialist_id": payload.specialist_id}, {"_id": 0})
            if spec:
                specialist_name = spec.get("name")
                specialist_specialty = spec.get("specialty")
                specialist_hospital_name = spec.get("hospital_name")
                specialist_verified = bool(spec.get("is_registered", True))
    elif payload.external_specialist:
        specialist_name = payload.external_specialist.name
        specialist_specialty = payload.external_specialist.specialty
        specialist_verified = False

    doc = {
        "referral_id": _new_id(),
        "patient_id": payload.patient_id,
        "patient_name": patient_name,
        "source_scan_id": payload.source_scan_id,
        "image_url": image_url,
        "scan_type": payload.scan_type,
        "prediction": payload.prediction,
        "confidence": confidence,
        "gradcam_url": gradcam_url,
        "referring_doctor_id": referring_doctor_id,
        "referring_doctor_name": doctor_name,
        "specialist_id": payload.specialist_id,
        "specialist_name": specialist_name,
        "specialist_specialty": specialist_specialty,
        "specialist_hospital_name": specialist_hospital_name,
        "specialist_verified": specialist_verified,
        "external_specialist": (
            payload.external_specialist.model_dump()
            if payload.external_specialist else None
        ),
        "clinical_notes": payload.clinical_notes,
        "priority": payload.priority.value,
        "status": initial_status.value,
        "created_at": datetime.utcnow(),
        "audit_log": [first_audit_entry.model_dump()],
    }

    collection = get_referrals_collection()
    await collection.insert_one(doc)

    try:
        await hash_and_chain_referral(referral_id=doc["referral_id"], patient_id=payload.patient_id)
    except Exception as exc:
        logger.warning("Failed to hash/chain referral %s (non-blocking): %s", doc["referral_id"], exc)

    # Strip internal Mongo _id before returning
    doc.pop("_id", None)

    # Mark the source scan as referred — all DB writes stay in the service layer
    scans = get_scans_collection()
    await scans.update_one(
        {"scan_id": payload.source_scan_id},
        {"$set": {
            "referral_triggered": True,
            "referral_id": doc["referral_id"],
        }}
    )

    # Create notification for patient about referral (wrapped in try/except - must not affect referral creation)
    try:
        from datetime import datetime as dt
        notifications_collection = get_notifications_collection()
        notification_doc = {
            "notification_id": str(uuid.uuid4()),
            "patient_id": payload.patient_id,
            "type": "referral_initiated",
            "message": f"Your doctor has referred you to {specialist_name or 'a specialist'}. Your scan and report have been shared for specialist review.",
            "referral_id": doc["referral_id"],
            "is_read": False,
            "created_at": dt.utcnow()
        }
        await notifications_collection.insert_one(notification_doc)
    except Exception as e:
        # Non-blocking: log but don't raise
        logger.warning(f"Failed to create referral notification (non-blocking): {e}")

    return doc


async def get_referrals_for_patient(patient_id: str) -> list:
    """Return all referrals belonging to a patient, newest first."""
    collection = get_referrals_collection()
    cursor = collection.find(
        {"patient_id": patient_id},
        {"_id": 0}
    ).sort("created_at", -1)
    return await cursor.to_list(length=100)


async def update_referral_status(
    referral_id: str,
    update: ReferralStatusUpdate,
    changed_by: str,
    changed_by_role: str,
    require_assignee_id: Optional[str] = None,
) -> Optional[dict]:
    """
    Update the status of a referral and append an audit log entry.
    Implements the reroute pattern from AutoReferral: every state
    transition is recorded immutably in the audit_log array.
    Returns the updated document or None if not found.
    """
    collection = get_referrals_collection()

    new_entry = AuditLogEntry(
        status=update.status,
        changed_by=changed_by,
        changed_by_role=changed_by_role,
        timestamp=datetime.utcnow(),
        note=update.note,
    )

    query: dict = {"referral_id": referral_id}
    if require_assignee_id:
        query["specialist_id"] = require_assignee_id

    result = await collection.find_one_and_update(
        query,
        {
            "$set": {"status": update.status.value},
            "$push": {"audit_log": new_entry.model_dump()},
        },
        projection={"_id": 0},
        return_document=True,   # return the post-update document
    )
    return result


async def get_referrals_for_specialist(specialist_id: str) -> list:
    """Return all referrals assigned to a specialist, newest first."""
    collection = get_referrals_collection()
    cursor = collection.find(
        {"specialist_id": specialist_id},
        {"_id": 0}
    ).sort("created_at", -1)
    return await cursor.to_list(length=100)


async def get_referrals_by_doctor(referring_doctor_id: str) -> list:
    """Return all referrals created by a specific doctor, newest first."""
    collection = get_referrals_collection()
    cursor = collection.find(
        {"referring_doctor_id": referring_doctor_id},
        {"_id": 0}
    ).sort("created_at", -1)
    return await cursor.to_list(length=100)
