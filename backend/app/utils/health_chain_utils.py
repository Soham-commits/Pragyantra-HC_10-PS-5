import hashlib
import json
from datetime import datetime
from typing import Any, Dict, Tuple

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


GENESIS_PREVIOUS_HASH = "0000000000000000"


def generate_rsa_key_pair() -> Tuple[str, str]:
    """Generate an RSA key pair and return (private_key_pem, public_key_pem)."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    return private_pem, public_pem


def generate_wallet_address(public_key: str) -> str:
    """Generate wallet address as 0x + first 20 hex chars of SHA-256(public_key)."""
    wallet_digest = hashlib.sha256(public_key.encode("utf-8")).hexdigest()
    return f"0x{wallet_digest[:20]}"


def _sanitize_record_for_hash(record: Dict[str, Any]) -> Dict[str, Any]:
    """Remove fields that must not recursively affect record hash stability."""
    sanitized = dict(record)
    sanitized.pop("record_hash", None)
    return sanitized


def compute_record_hash(record: Dict[str, Any]) -> str:
    """Compute SHA-256 over canonical JSON representation of the record."""
    canonical = json.dumps(
        _sanitize_record_for_hash(record),
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_block_hash(record_hash: str, previous_hash: str, timestamp: datetime) -> str:
    """Compute block hash as SHA-256(record_hash + previous_hash + timestamp)."""
    payload = f"{record_hash}{previous_hash}{timestamp.isoformat()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
