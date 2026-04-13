from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from typing import Optional
import certifi
import re
from urllib.parse import parse_qs, urlparse

client: Optional[AsyncIOMotorClient] = None


def _redact_mongo_url(url: str) -> str:
    # Redact credentials in MongoDB URIs: mongodb://user:pass@host -> mongodb://user:***@host
    return re.sub(r"^(mongodb(?:\+srv)?://)([^/@:]+):([^@]+)@", r"\1\2:***@", url)


def _should_use_tls(mongo_url: str) -> bool:
    """Enable TLS only when the URI requires it (Atlas/SRV or explicit tls/ssl=true)."""
    if mongo_url.startswith("mongodb+srv://"):
        return True

    parsed = urlparse(mongo_url)
    params = parse_qs(parsed.query)
    tls_param = (params.get("tls") or params.get("ssl") or [""])[0].lower()
    return tls_param in {"true", "1", "yes"}


async def connect_to_mongo():
    """Connect to MongoDB.

    This app should still be able to boot (for local dev / demos) even if MongoDB
    is unavailable, so connection errors are swallowed and surfaced via
    `/api/health` and downstream DB calls.
    """
    global client
    try:
        client_kwargs = {
            "serverSelectionTimeoutMS": 3000,
            "connectTimeoutMS": 3000,
        }
        if _should_use_tls(settings.MONGODB_URL):
            # Use certifi for TLS certificate verification (Atlas/SRV/explicit TLS setups).
            client_kwargs["tlsCAFile"] = certifi.where()

        mongo = AsyncIOMotorClient(settings.MONGODB_URL, **client_kwargs)
        # Force a connection attempt during startup so we can fail gracefully.
        await mongo.admin.command("ping")
        client = mongo
        print(f"Connected to MongoDB at {_redact_mongo_url(settings.MONGODB_URL)}")
    except Exception as exc:
        client = None
        print(f"⚠️  MongoDB connection failed ({_redact_mongo_url(settings.MONGODB_URL)}): {exc}")


async def close_mongo_connection():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()
        print("Closed MongoDB connection")


def get_database():
    """Get database instance"""
    if client is None:
        raise RuntimeError("MongoDB client is not initialized")
    return client[settings.DATABASE_NAME]


# Collection getters
def get_users_collection():
    db = get_database()
    return db.users


def get_doctors_collection():
    db = get_database()
    return db.doctors


def get_health_profiles_collection():
    db = get_database()
    return db.health_profiles


def get_medical_reports_collection():
    db = get_database()
    return db.medical_reports


def get_appointments_collection():
    db = get_database()
    return db.appointments


def get_scans_collection():
    db = get_database()
    return db.scans


def get_chats_collection():
    db = get_database()
    return db.chats


def get_medical_history_collection():
    db = get_database()
    return db.medical_history


def get_appointment_notes_collection():
    db = get_database()
    return db.appointment_notes


def get_patient_remarks_collection():
    db = get_database()
    return db.patient_remarks


def get_specialists_collection():
    db = get_database()
    return db.specialists


def get_referrals_collection():
    db = get_database()
    return db.referrals


def get_health_chain_collection():
    db = get_database()
    return db.health_chain


def get_consents_collection():
    db = get_database()
    return db.consents


def get_notifications_collection():
    db = get_database()
    return db.notifications


def get_grievances_collection():
    db = get_database()
    return db.grievances


def get_data_exports_collection():
    db = get_database()
    return db.data_exports


def get_privacy_settings_collection():
    db = get_database()
    return db.privacy_settings


def get_deletion_audit_collection():
    db = get_database()
    return db.deletion_audit
