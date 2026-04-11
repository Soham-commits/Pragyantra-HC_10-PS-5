from datetime import datetime
from uuid import uuid4
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorCollection

from app.schemas.consent import ConsentCreate, ConsentRecord, ConsentType


REQUIRED_SIGNUP_CONSENT_TYPES = [
    ConsentType.REGISTRATION.value,
    ConsentType.SCAN_UPLOAD.value,
    ConsentType.REFERRAL_NOTIFICATION.value,
]


async def record_consent(
    collection: AsyncIOMotorCollection,
    patient_id: str,
    consent_type: ConsentType,
    consented: bool = True,
    consent_version: str = "1.0",
    metadata: Optional[dict] = None
) -> str:
    """Record a single consent entry."""
    consent_id = str(uuid4())
    doc = {
        "consent_id": consent_id,
        "patient_id": patient_id,
        "consent_type": consent_type.value,
        "consented": consented,
        "consent_version": consent_version,
        "timestamp": datetime.utcnow(),
        "metadata": metadata or {}
    }
    await collection.insert_one(doc)
    return consent_id


async def record_consent_bulk(
    collection: AsyncIOMotorCollection,
    patient_id: str,
    consents: list[ConsentCreate]
) -> list[str]:
    """Record multiple consent entries at once."""
    consent_ids = []
    docs = []
    
    for consent in consents:
        consent_id = str(uuid4())
        consent_ids.append(consent_id)
        doc = {
            "consent_id": consent_id,
            "patient_id": patient_id,
            "consent_type": consent.consent_type.value,
            "consented": consent.consented,
            "consent_version": consent.consent_version,
            "timestamp": datetime.utcnow(),
            "metadata": consent.metadata or {}
        }
        docs.append(doc)
    
    if docs:
        await collection.insert_many(docs)
    
    return consent_ids


async def get_patient_consents(
    collection: AsyncIOMotorCollection,
    patient_id: str
) -> list[dict]:
    """Fetch all consent records for a patient."""
    cursor = collection.find(
        {"patient_id": patient_id},
        {"_id": 0}
    ).sort("timestamp", -1)
    return await cursor.to_list(length=100)


async def ensure_required_signup_consents(
    collection: AsyncIOMotorCollection,
    patient_id: str,
) -> list[str]:
    """Ensure the 3 required signup consent types exist for this patient.

    Returns a list of consent_type values that were newly inserted.
    """
    inserted_types: list[str] = []

    for consent_type in REQUIRED_SIGNUP_CONSENT_TYPES:
        consent_id = str(uuid4())
        doc = {
            "consent_id": consent_id,
            "patient_id": patient_id,
            "consent_type": consent_type,
            "consented": True,
            "consent_version": "1.0",
            "timestamp": datetime.utcnow(),
            "metadata": {
                "source": "auto_repair",
                "reason": "missing_required_signup_consent",
            },
        }

        result = await collection.update_one(
            {"patient_id": patient_id, "consent_type": consent_type},
            {"$setOnInsert": doc},
            upsert=True,
        )
        if result.upserted_id is not None:
            inserted_types.append(consent_type)

    return inserted_types
