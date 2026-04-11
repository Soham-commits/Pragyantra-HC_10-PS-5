import uuid
import hashlib
from datetime import datetime


def generate_health_id(aadhaar_number: str, date_of_birth: str) -> str:
    """
    Generate a unique Health ID based on Aadhaar and DOB.
    This creates a permanent, privacy-preserving identifier.
    Format: UHID-XXXXXXXXXXXXXXXX (16 character hex)
    """
    # Combine Aadhaar, DOB, and a timestamp for uniqueness
    data = f"{aadhaar_number}{date_of_birth}{datetime.utcnow().isoformat()}"
    hash_object = hashlib.sha256(data.encode())
    hex_dig = hash_object.hexdigest()[:16].upper()
    return f"UHID-{hex_dig}"


def generate_doctor_id() -> str:
    """
    Generate a unique Doctor ID.
    Format: DOC-XXXXXXXXXXXX (12 character hex)
    """
    uid = uuid.uuid4().hex[:12].upper()
    return f"DOC-{uid}"


def generate_report_id() -> str:
    """Generate unique report ID"""
    return f"REP-{uuid.uuid4().hex[:12].upper()}"


def generate_scan_id() -> str:
    """Generate unique scan ID"""
    return f"SCAN-{uuid.uuid4().hex[:12].upper()}"


def generate_visit_id() -> str:
    """Generate unique visit ID"""
    return f"VISIT-{uuid.uuid4().hex[:12].upper()}"


def generate_appointment_id() -> str:
    """Generate unique appointment ID"""
    return f"APT-{uuid.uuid4().hex[:12].upper()}"


def generate_chat_session_id() -> str:
    """Generate unique chat session ID"""
    return f"CHAT-{uuid.uuid4().hex[:12].upper()}"


def calculate_age(date_of_birth: str) -> int:
    """
    Calculate age from date of birth string (YYYY-MM-DD)
    """
    from datetime import datetime
    dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
    today = datetime.now()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age
