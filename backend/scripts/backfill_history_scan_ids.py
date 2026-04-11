import argparse
import asyncio
from datetime import datetime
from typing import Optional

from app.database import connect_to_mongo, close_mongo_connection, get_medical_history_collection, get_scans_collection


def resolve_scan_id(scan_doc: Optional[dict]) -> Optional[str]:
    if not scan_doc:
        return None
    return scan_doc.get("scan_id")


async def find_nearest_scan(health_id: str, created_at: datetime) -> Optional[dict]:
    scans_collection = get_scans_collection()

    scan_before = await scans_collection.find_one(
        {"health_id": health_id, "upload_date": {"$lte": created_at}},
        sort=[("upload_date", -1)]
    )
    if scan_before:
        return scan_before

    scan_after = await scans_collection.find_one(
        {"health_id": health_id, "upload_date": {"$gte": created_at}},
        sort=[("upload_date", 1)]
    )
    return scan_after


async def backfill_history_scan_ids(limit: int, dry_run: bool) -> int:
    history_collection = get_medical_history_collection()

    query = {
        "entry_type": "scan_analysis",
        "$or": [
            {"metadata.scan_id": {"$exists": False}},
            {"metadata.scan_id": None},
            {"metadata.scan_id": ""},
        ]
    }

    cursor = history_collection.find(query)
    if limit > 0:
        cursor = cursor.limit(limit)

    updated = 0
    skipped = 0
    total = 0

    async for entry in cursor:
        total += 1
        health_id = entry.get("health_id")
        created_at = entry.get("created_at")
        if not health_id or not created_at:
            skipped += 1
            continue

        scan_doc = await find_nearest_scan(health_id, created_at)
        scan_id = resolve_scan_id(scan_doc)
        if not scan_id:
            skipped += 1
            continue

        if not dry_run:
            await history_collection.update_one(
                {"_id": entry["_id"]},
                {"$set": {"metadata.scan_id": scan_id}}
            )
        updated += 1

    print(f"History entries checked: {total}")
    print(f"Scan IDs filled: {updated}")
    print(f"Skipped: {skipped}")

    return updated


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill scan_id in medical history entries")
    parser.add_argument("--limit", type=int, default=0, help="Max entries to process (0 = no limit)")
    parser.add_argument("--dry-run", action="store_true", help="Run without writing updates")
    args = parser.parse_args()

    await connect_to_mongo()
    try:
        await backfill_history_scan_ids(limit=args.limit, dry_run=args.dry_run)
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
