from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


RecordType = Literal["registration", "scan", "report", "referral"]


class HealthChainBlock(BaseModel):
    block_id: str
    patient_id: str
    record_type: RecordType
    record_id: str
    record_hash: str
    previous_hash: str
    block_hash: str
    timestamp: datetime
    verified: bool = True


class VerifyRecordResponse(BaseModel):
    record_id: str
    patient_id: Optional[str] = None
    record_type: Optional[RecordType] = None
    verified: bool
    chain_hash_matches: bool
    block_hash_matches: bool
    message: str
