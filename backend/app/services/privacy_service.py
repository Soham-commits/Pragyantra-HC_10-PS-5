from datetime import datetime, timedelta
import uuid
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient

from app.schemas.privacy import (
    GrievanceCreate,
    GrievanceResponse,
    GrievanceStatus,
    DataExportRequest,
    DataExportResponse,
    DataRetentionSettings,
    AccountDeletionRequest,
    PrivacySettingsResponse,
)
from app.database import get_grievances_collection, get_data_exports_collection, get_privacy_settings_collection


class PrivacyService:
    @staticmethod
    async def submit_grievance(payload: GrievanceCreate) -> GrievanceResponse:
        """Submit a new grievance."""
        collection = get_grievances_collection()
        
        grievance_id = str(uuid.uuid4())
        reference_id = f"GR-{datetime.utcnow().year}-{str(uuid.uuid4())[:8].upper()}"
        
        now = datetime.utcnow()
        doc = {
            "grievance_id": grievance_id,
            "patient_id": payload.patient_id,
            "grievance_type": payload.grievance_type.value,
            "description": payload.description,
            "status": GrievanceStatus.SUBMITTED.value,
            "submitted_at": now,
            "resolved_at": None,
            "resolution_notes": None,
            "reference_id": reference_id,
        }
        
        await collection.insert_one(doc)
        
        return GrievanceResponse(
            grievance_id=grievance_id,
            patient_id=payload.patient_id,
            grievance_type=payload.grievance_type,
            description=payload.description,
            status=GrievanceStatus.SUBMITTED,
            submitted_at=now,
            reference_id=reference_id,
        )
    
    @staticmethod
    async def get_patient_grievances(patient_id: str) -> list[GrievanceResponse]:
        """Get all grievances for a patient."""
        collection = get_grievances_collection()
        
        cursor = collection.find({"patient_id": patient_id}).sort("submitted_at", -1)
        grievances = []
        
        async for doc in cursor:
            grievances.append(GrievanceResponse(
                grievance_id=doc["grievance_id"],
                patient_id=doc.get("patient_id"),
                grievance_type=doc["grievance_type"],
                description=doc["description"],
                status=doc["status"],
                submitted_at=doc["submitted_at"],
                resolved_at=doc.get("resolved_at"),
                resolution_notes=doc.get("resolution_notes"),
                reference_id=doc["reference_id"],
            ))
        
        return grievances
    
    @staticmethod
    async def request_data_export(payload: DataExportRequest) -> DataExportResponse:
        """Request a data export for a patient."""
        collection = get_data_exports_collection()
        
        export_id = str(uuid.uuid4())
        now = datetime.utcnow()
        expires_at = now + timedelta(days=7)
        
        doc = {
            "export_id": export_id,
            "patient_id": payload.patient_id,
            "status": "processing",
            "requested_at": now,
            "include_scans": payload.include_scans,
            "include_consultations": payload.include_consultations,
            "include_referrals": payload.include_referrals,
            "download_url": None,
            "expires_at": expires_at,
        }
        
        await collection.insert_one(doc)
        
        # In production, this would trigger a background job to generate the export
        # For now, we'll simulate it being ready immediately for demo purposes
        await collection.update_one(
            {"export_id": export_id},
            {"$set": {"status": "ready", "download_url": f"/api/privacy/export/{export_id}/download"}}
        )
        
        return DataExportResponse(
            export_id=export_id,
            patient_id=payload.patient_id,
            status="ready",
            requested_at=now,
            download_url=f"/api/privacy/export/{export_id}/download",
            expires_at=expires_at,
        )
    
    @staticmethod
    async def update_data_retention(settings: DataRetentionSettings) -> PrivacySettingsResponse:
        """Update data retention settings for a patient."""
        collection = get_privacy_settings_collection()
        
        now = datetime.utcnow()
        doc = {
            "patient_id": settings.patient_id,
            "data_retention_years": settings.retention_years,
            "auto_delete_enabled": settings.auto_delete_after_retention,
            "updated_at": now,
        }
        
        await collection.update_one(
            {"patient_id": settings.patient_id},
            {"$set": doc},
            upsert=True
        )
        
        return await PrivacyService.get_privacy_settings(settings.patient_id)
    
    @staticmethod
    async def get_privacy_settings(patient_id: str) -> PrivacySettingsResponse:
        """Get privacy settings for a patient."""
        collection = get_privacy_settings_collection()
        exports_collection = get_data_exports_collection()
        
        doc = await collection.find_one({"patient_id": patient_id})
        
        # Get last export request
        last_export = await exports_collection.find_one(
            {"patient_id": patient_id},
            sort=[("requested_at", -1)]
        )
        
        if not doc:
            # Return default settings
            return PrivacySettingsResponse(
                patient_id=patient_id,
                data_retention_years=7,
                auto_delete_enabled=False,
                last_export_request=last_export["requested_at"] if last_export else None,
            )
        
        return PrivacySettingsResponse(
            patient_id=patient_id,
            data_retention_years=doc.get("data_retention_years", 7),
            auto_delete_enabled=doc.get("auto_delete_enabled", False),
            last_export_request=last_export["requested_at"] if last_export else None,
            account_deletion_scheduled=doc.get("account_deletion_scheduled", False),
            deletion_scheduled_date=doc.get("deletion_scheduled_date"),
        )
    
    @staticmethod
    async def request_account_deletion(request: AccountDeletionRequest) -> dict:
        """Request account deletion for a patient."""
        collection = get_privacy_settings_collection()
        
        scheduled_date = datetime.utcnow() + timedelta(days=30)
        
        await collection.update_one(
            {"patient_id": request.patient_id},
            {"$set": {
                "account_deletion_scheduled": True,
                "deletion_scheduled_date": scheduled_date,
                "deletion_reason": request.reason,
                "deletion_requested_at": datetime.utcnow(),
            }},
            upsert=True
        )
        
        return {
            "message": "Account deletion scheduled",
            "scheduled_date": scheduled_date,
            "reference_id": f"DEL-{datetime.utcnow().year}-{str(uuid.uuid4())[:8].upper()}",
        }
