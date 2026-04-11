import argparse
import asyncio
from pathlib import Path
from typing import Optional

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, get_scans_collection
from app.services.skin_scan_service import generate_gradcam_overlay


UPLOADS_ROOT = Path(__file__).resolve().parent.parent / "uploads"


def resolve_image_path(image_url: Optional[str]) -> Optional[Path]:
    if not image_url:
        return None
    if image_url.startswith("http://") or image_url.startswith("https://"):
        return None
    if not image_url.startswith("/uploads/"):
        return None
    return UPLOADS_ROOT / image_url.removeprefix("/uploads/")


async def backfill_gradcam(limit: int, dry_run: bool) -> int:
    scans_collection = get_scans_collection()

    query = {
        "$or": [
            {"gradcam_url": {"$exists": False}},
            {"gradcam_url": None},
            {"gradcam_url": ""},
        ]
    }

    cursor = scans_collection.find(query)
    if limit > 0:
        cursor = cursor.limit(limit)

    updated = 0
    skipped = 0
    total = 0

    async for scan in cursor:
        total += 1
        image_url = scan.get("image_url")
        image_path = resolve_image_path(image_url)

        if not image_path or not image_path.exists():
            skipped += 1
            continue

        try:
            image_bytes = image_path.read_bytes()
            scan_id = scan.get("scan_id", "scan")
            scan_type = scan.get("scan_type", "")

            # Use the correct Grad-CAM generator per scan type
            if scan_type in ("x-ray", "xray", "lung"):
                from app.services.lung_scan_service import generate_gradcam_overlay as lung_gradcam
                gradcam_url = lung_gradcam(image_bytes, scan_id)
            else:
                gradcam_url = generate_gradcam_overlay(image_bytes, scan_id)

            if not dry_run:
                await scans_collection.update_one(
                    {"_id": scan["_id"]},
                    {"$set": {
                        "gradcam_url": gradcam_url,
                        "heatmap_url": gradcam_url,
                        "heatmap_generated": True,
                    }}
                )
            updated += 1
        except Exception as exc:
            skipped += 1
            print(f"Failed to process scan {scan.get('scan_id')}: {exc}")

    print(f"Scans checked: {total}")
    print(f"Grad-CAM generated: {updated}")
    print(f"Skipped: {skipped}")

    return updated


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill Grad-CAM overlays for existing scans")
    parser.add_argument("--limit", type=int, default=0, help="Max scans to process (0 = no limit)")
    parser.add_argument("--dry-run", action="store_true", help="Run without writing updates")
    args = parser.parse_args()

    await connect_to_mongo()
    try:
        await backfill_gradcam(limit=args.limit, dry_run=args.dry_run)
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
