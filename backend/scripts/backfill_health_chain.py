import argparse
import asyncio
import hashlib
from typing import Optional

from app.database import close_mongo_connection, connect_to_mongo, get_users_collection
from app.services.health_chain_service import backfill_patient_chain


def derive_wallet_address(health_id: str) -> str:
    digest = hashlib.sha256(health_id.encode("utf-8")).hexdigest()
    return f"0x{digest[:40]}"


async def backfill_wallet_addresses(patient_ids: list[str]) -> int:
    users_collection = get_users_collection()
    updated = 0

    for pid in patient_ids:
        user = await users_collection.find_one(
            {"health_id": pid},
            {"_id": 1, "wallet_address": 1},
        )
        if not user:
            continue
        if user.get("wallet_address"):
            continue

        wallet_address = derive_wallet_address(pid)
        result = await users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"wallet_address": wallet_address}},
        )
        if result.modified_count:
            updated += 1

    return updated


async def resolve_patient_ids(patient_id: Optional[str], limit: int) -> list[str]:
    if patient_id:
        return [patient_id]

    users_collection = get_users_collection()
    cursor = users_collection.find(
        {"role": "patient"},
        {"_id": 0, "health_id": 1},
    )
    if limit > 0:
        cursor = cursor.limit(limit)

    docs = await cursor.to_list(length=limit if limit > 0 else 100000)
    return [doc["health_id"] for doc in docs if doc.get("health_id")]


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill decentralized health chain data for existing patient records"
    )
    parser.add_argument("--patient-id", type=str, default=None, help="Backfill only this patient")
    parser.add_argument("--limit", type=int, default=0, help="Max patients when --patient-id is omitted")
    args = parser.parse_args()

    await connect_to_mongo()
    try:
        patient_ids = await resolve_patient_ids(args.patient_id, args.limit)
        if not patient_ids:
            print("No patient records found for backfill")
            return

        aggregate = {
            "patients": 0,
            "records_processed": 0,
            "hashes_written": 0,
            "blocks_created": 0,
            "errors": 0,
            "wallets_backfilled": 0,
        }

        aggregate["wallets_backfilled"] = await backfill_wallet_addresses(patient_ids)

        for pid in patient_ids:
            summary = await backfill_patient_chain(pid)
            aggregate["patients"] += 1
            aggregate["records_processed"] += summary.get("records_processed", 0)
            aggregate["hashes_written"] += summary.get("hashes_written", 0)
            aggregate["blocks_created"] += summary.get("blocks_created", 0)
            aggregate["errors"] += summary.get("errors", 0)
            print(
                f"[{pid}] processed={summary.get('records_processed', 0)} "
                f"hashes_written={summary.get('hashes_written', 0)} "
                f"blocks_created={summary.get('blocks_created', 0)} "
                f"errors={summary.get('errors', 0)}"
            )

        print("--- Backfill summary ---")
        print(f"Patients: {aggregate['patients']}")
        print(f"Records processed: {aggregate['records_processed']}")
        print(f"Hashes written: {aggregate['hashes_written']}")
        print(f"Blocks created: {aggregate['blocks_created']}")
        print(f"Wallets backfilled: {aggregate['wallets_backfilled']}")
        print(f"Errors: {aggregate['errors']}")
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
