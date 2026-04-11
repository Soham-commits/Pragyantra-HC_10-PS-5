"""
One-off migration:
- Merge legacy "specialist" user records into "doctor".

This updates:
- users.role: "specialist" -> "doctor"
- users.doctor_id: set from users.specialist_id if missing
- users.specialist_id: unset (optional)

Run:
  ./venv/bin/python scripts/migrate_specialists_to_doctors.py
"""

from __future__ import annotations

from pymongo import MongoClient

from app.config import settings


def _redact_mongo_url(url: str) -> str:
    if "@" not in url or "://" not in url:
        return url
    prefix, rest = url.split("://", 1)
    creds, host = rest.split("@", 1)
    if ":" in creds:
        user, _pw = creds.split(":", 1)
        return f"{prefix}://{user}:***@{host}"
    return f"{prefix}://***@{host}"


def main() -> None:
    print(f"Connecting to MongoDB: {_redact_mongo_url(settings.MONGODB_URL)}")
    client = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
    db = client[settings.DATABASE_NAME]

    users = db.users
    legacy = list(users.find({"role": "specialist"}, {"_id": 1, "specialist_id": 1, "doctor_id": 1}))
    if not legacy:
        print("No legacy specialist users found.")
        return

    updated = 0
    for doc in legacy:
        specialist_id = doc.get("specialist_id")
        doctor_id = doc.get("doctor_id") or specialist_id

        update = {"$set": {"role": "doctor"}}
        if doctor_id:
            update["$set"]["doctor_id"] = doctor_id
        update["$unset"] = {"specialist_id": ""}

        res = users.update_one({"_id": doc["_id"]}, update)
        updated += int(res.modified_count)

    print(f"Updated {updated}/{len(legacy)} user records.")


if __name__ == "__main__":
    main()

