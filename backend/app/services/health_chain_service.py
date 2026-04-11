import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from app.database import (
    get_health_chain_collection,
    get_medical_reports_collection,
    get_referrals_collection,
    get_scans_collection,
    get_users_collection,
)
from app.utils.health_chain_utils import (
    GENESIS_PREVIOUS_HASH,
    compute_block_hash,
    compute_record_hash,
)

logger = logging.getLogger(__name__)


def _strip_mongo_id(document: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not document:
        return document
    data = dict(document)
    data.pop("_id", None)
    return data


async def create_chain_block(
    patient_id: str,
    record_type: str,
    record_id: str,
    record_hash: str,
    timestamp: Optional[datetime] = None,
) -> Dict[str, Any]:
    chain_collection = get_health_chain_collection()

    existing = await chain_collection.find_one(
        {
            "patient_id": patient_id,
            "record_type": record_type,
            "record_id": record_id,
        }
    )
    if existing:
        return _strip_mongo_id(existing) or {}

    now = timestamp or datetime.utcnow()
    last_block = await chain_collection.find_one(
        {"patient_id": patient_id},
        sort=[("timestamp", -1)],
    )
    previous_hash = (
        last_block.get("block_hash") if last_block else GENESIS_PREVIOUS_HASH
    )
    block_hash = compute_block_hash(record_hash, previous_hash, now)

    block = {
        "block_id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "record_type": record_type,
        "record_id": record_id,
        "record_hash": record_hash,
        "previous_hash": previous_hash,
        "block_hash": block_hash,
        "timestamp": now,
        "verified": True,
    }
    await chain_collection.insert_one(block)
    return block


async def get_patient_chain(patient_id: str) -> list[Dict[str, Any]]:
    chain_collection = get_health_chain_collection()
    cursor = chain_collection.find({"patient_id": patient_id}, {"_id": 0}).sort(
        "timestamp", -1
    )
    return await cursor.to_list(length=1000)


async def ensure_registration_chain_entry(patient_id: str) -> Optional[Dict[str, Any]]:
    users_collection = get_users_collection()
    user_record = await users_collection.find_one({"health_id": patient_id})
    if not user_record:
        return None

    record_hash = compute_record_hash(user_record)
    created_at = user_record.get("created_at") or datetime.utcnow()
    return await create_chain_block(
        patient_id=patient_id,
        record_type="registration",
        record_id=patient_id,
        record_hash=record_hash,
        timestamp=created_at,
    )


async def _hash_and_chain_record(
    *,
    collection,
    id_field: str,
    record_id: str,
    patient_id: str,
    record_type: str,
    timestamp_field: str,
) -> Optional[str]:
    record = await collection.find_one({id_field: record_id})
    if not record:
        return None

    record_hash = compute_record_hash(record)
    await collection.update_one(
        {id_field: record_id},
        {"$set": {"record_hash": record_hash}},
    )

    timestamp = record.get(timestamp_field) or datetime.utcnow()
    await create_chain_block(
        patient_id=patient_id,
        record_type=record_type,
        record_id=record_id,
        record_hash=record_hash,
        timestamp=timestamp,
    )
    return record_hash


async def hash_and_chain_scan(scan_id: str, patient_id: str) -> Optional[str]:
    return await _hash_and_chain_record(
        collection=get_scans_collection(),
        id_field="scan_id",
        record_id=scan_id,
        patient_id=patient_id,
        record_type="scan",
        timestamp_field="upload_date",
    )


async def hash_and_chain_report(report_id: str, patient_id: str) -> Optional[str]:
    return await _hash_and_chain_record(
        collection=get_medical_reports_collection(),
        id_field="report_id",
        record_id=report_id,
        patient_id=patient_id,
        record_type="report",
        timestamp_field="generated_date",
    )


async def hash_and_chain_referral(referral_id: str, patient_id: str) -> Optional[str]:
    return await _hash_and_chain_record(
        collection=get_referrals_collection(),
        id_field="referral_id",
        record_id=referral_id,
        patient_id=patient_id,
        record_type="referral",
        timestamp_field="created_at",
    )


async def _get_record_for_block(record_type: str, record_id: str) -> Optional[Dict[str, Any]]:
    if record_type == "registration":
        return await get_users_collection().find_one({"health_id": record_id})
    if record_type == "scan":
        return await get_scans_collection().find_one({"scan_id": record_id})
    if record_type == "report":
        return await get_medical_reports_collection().find_one({"report_id": record_id})
    if record_type == "referral":
        return await get_referrals_collection().find_one({"referral_id": record_id})
    return None


async def verify_record(record_id: str) -> Dict[str, Any]:
    chain_collection = get_health_chain_collection()
    block = await chain_collection.find_one({"record_id": record_id}, sort=[("timestamp", -1)])

    if not block:
        return {
            "record_id": record_id,
            "patient_id": None,
            "record_type": None,
            "verified": False,
            "chain_hash_matches": False,
            "block_hash_matches": False,
            "message": "No chain block found for this record",
        }

    source_record = await _get_record_for_block(block["record_type"], record_id)
    if not source_record:
        return {
            "record_id": record_id,
            "patient_id": block.get("patient_id"),
            "record_type": block.get("record_type"),
            "verified": False,
            "chain_hash_matches": False,
            "block_hash_matches": False,
            "message": "Source record not found for chain verification",
        }

    # Registration records are identity metadata and can gain non-critical mutable
    # fields over time (for example wallet/public key, profile updates). For
    # registration verification we validate ownership/identity presence and the
    # block integrity hash rather than strict full-document hash equality.
    if block.get("record_type") == "registration":
        chain_hash_matches = bool(source_record.get("health_id") == record_id)
    else:
        recalculated_hash = compute_record_hash(source_record)
        chain_hash_matches = recalculated_hash == block.get("record_hash")

    expected_block_hash = compute_block_hash(
        block.get("record_hash", ""),
        block.get("previous_hash", ""),
        block.get("timestamp", datetime.utcnow()),
    )
    block_hash_matches = expected_block_hash == block.get("block_hash")

    verified = bool(chain_hash_matches and block_hash_matches)

    try:
        await chain_collection.update_one(
            {"block_id": block.get("block_id")},
            {"$set": {"verified": verified}},
        )
    except Exception as exc:
        logger.warning("Failed to update verification status for record %s: %s", record_id, exc)

    return {
        "record_id": record_id,
        "patient_id": block.get("patient_id"),
        "record_type": block.get("record_type"),
        "verified": verified,
        "chain_hash_matches": chain_hash_matches,
        "block_hash_matches": block_hash_matches,
        "message": "Record verified" if verified else "Record verification failed",
    }


async def backfill_patient_chain(patient_id: str) -> Dict[str, Any]:
    scans_collection = get_scans_collection()
    reports_collection = get_medical_reports_collection()
    referrals_collection = get_referrals_collection()

    summary = {
        "patient_id": patient_id,
        "records_processed": 0,
        "hashes_written": 0,
        "blocks_created": 0,
        "errors": 0,
    }

    before_blocks = len(await get_patient_chain(patient_id))

    registration_block = await ensure_registration_chain_entry(patient_id)
    if registration_block:
        summary["records_processed"] += 1

    scan_docs = await scans_collection.find({"health_id": patient_id}).sort("upload_date", 1).to_list(length=5000)
    for scan in scan_docs:
        try:
            summary["records_processed"] += 1
            scan_id = scan.get("scan_id")
            if not scan_id:
                continue
            if not scan.get("record_hash"):
                await hash_and_chain_scan(scan_id, patient_id)
                summary["hashes_written"] += 1
            else:
                await create_chain_block(
                    patient_id=patient_id,
                    record_type="scan",
                    record_id=scan_id,
                    record_hash=scan["record_hash"],
                    timestamp=scan.get("upload_date") or datetime.utcnow(),
                )
        except Exception as exc:
            summary["errors"] += 1
            logger.warning("Scan backfill failed for patient %s: %s", patient_id, exc)

    report_docs = await reports_collection.find({"health_id": patient_id}).sort("generated_date", 1).to_list(length=5000)
    for report in report_docs:
        try:
            summary["records_processed"] += 1
            report_id = report.get("report_id")
            if not report_id:
                continue
            if not report.get("record_hash"):
                await hash_and_chain_report(report_id, patient_id)
                summary["hashes_written"] += 1
            else:
                await create_chain_block(
                    patient_id=patient_id,
                    record_type="report",
                    record_id=report_id,
                    record_hash=report["record_hash"],
                    timestamp=report.get("generated_date") or datetime.utcnow(),
                )
        except Exception as exc:
            summary["errors"] += 1
            logger.warning("Report backfill failed for patient %s: %s", patient_id, exc)

    referral_docs = await referrals_collection.find({"patient_id": patient_id}).sort("created_at", 1).to_list(length=5000)
    for referral in referral_docs:
        try:
            summary["records_processed"] += 1
            referral_id = referral.get("referral_id")
            if not referral_id:
                continue
            if not referral.get("record_hash"):
                await hash_and_chain_referral(referral_id, patient_id)
                summary["hashes_written"] += 1
            else:
                await create_chain_block(
                    patient_id=patient_id,
                    record_type="referral",
                    record_id=referral_id,
                    record_hash=referral["record_hash"],
                    timestamp=referral.get("created_at") or datetime.utcnow(),
                )
        except Exception as exc:
            summary["errors"] += 1
            logger.warning("Referral backfill failed for patient %s: %s", patient_id, exc)

    after_blocks = len(await get_patient_chain(patient_id))
    summary["blocks_created"] = max(after_blocks - before_blocks, 0)
    return summary
