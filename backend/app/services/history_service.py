"""
Medical History Service
Manages append-only medical timeline for patients tied to Unified Health ID
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

from app.database import get_medical_history_collection, get_users_collection
from app.schemas.history import (
    MedicalHistoryEntryCreate,
    MedicalHistoryEntryResponse,
    HistoryEntryType,
    RiskLevel
)


class MedicalHistoryService:
    """Service for managing medical history entries"""
    
    @staticmethod
    async def create_entry(entry_data: MedicalHistoryEntryCreate) -> MedicalHistoryEntryResponse:
        """
        Create a new medical history entry (append-only)
        
        Args:
            entry_data: Medical history entry data
            
        Returns:
            Created medical history entry
        """
        collection = get_medical_history_collection()
        
        # Prepare document for insertion
        document = {
            "health_id": entry_data.health_id,
            "entry_type": entry_data.entry_type.value,
            "title": entry_data.title,
            "summary": entry_data.summary,
            "risk_level": entry_data.risk_level.value,
            "metadata": entry_data.metadata or {},
            "doctor_id": entry_data.doctor_id,
            "related_report_id": entry_data.related_report_id,
            "created_at": datetime.utcnow(),
        }
        
        # Insert (append-only, no updates allowed)
        result = await collection.insert_one(document)
        document["_id"] = result.inserted_id
        
        return MedicalHistoryService._document_to_response(document)
    
    @staticmethod
    async def get_timeline(
        health_id: str,
        limit: Optional[int] = 100,
        entry_type: Optional[HistoryEntryType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[MedicalHistoryEntryResponse]:
        """
        Get medical history timeline for a patient
        
        Args:
            health_id: Patient's Unified Health ID
            limit: Maximum number of entries to return
            entry_type: Filter by entry type
            start_date: Filter entries after this date
            end_date: Filter entries before this date
            
        Returns:
            List of medical history entries, sorted by date (newest first)
        """
        collection = get_medical_history_collection()
        
        # Build query
        query = {"health_id": health_id}
        
        if entry_type:
            query["entry_type"] = entry_type.value
        
        if start_date or end_date:
            query["created_at"] = {}
            if start_date:
                query["created_at"]["$gte"] = start_date
            if end_date:
                query["created_at"]["$lte"] = end_date
        
        # Execute query with sorting (newest first)
        cursor = collection.find(query).sort("created_at", -1).limit(limit)
        documents = await cursor.to_list(length=limit)
        
        return [MedicalHistoryService._document_to_response(doc) for doc in documents]
    
    @staticmethod
    async def get_entry_by_id(entry_id: str) -> Optional[MedicalHistoryEntryResponse]:
        """
        Get a specific medical history entry by ID
        
        Args:
            entry_id: Entry ID
            
        Returns:
            Medical history entry or None
        """
        collection = get_medical_history_collection()
        
        try:
            document = await collection.find_one({"_id": ObjectId(entry_id)})
            if document:
                return MedicalHistoryService._document_to_response(document)
        except Exception:
            pass
        
        return None
    
    @staticmethod
    async def verify_access(health_id: str, user_health_id: str, user_role: str) -> bool:
        """
        Verify if a user has access to view medical history
        
        Args:
            health_id: Target patient's health ID
            user_health_id: Requesting user's health ID
            user_role: User's role (patient/doctor)
            
        Returns:
            True if access is granted
        """
        # Patient can always access their own history
        if health_id == user_health_id:
            return True
        
        # Doctors can access with consent (implement consent logic here)
        # For now, allowing doctor access - enhance with consent management later
        if user_role == "doctor":
            return True
        
        return False
    
    @staticmethod
    async def get_summary_stats(health_id: str) -> Dict[str, Any]:
        """
        Get summary statistics for a patient's medical history
        
        Args:
            health_id: Patient's Unified Health ID
            
        Returns:
            Dictionary with summary statistics
        """
        collection = get_medical_history_collection()
        
        # Count by entry type
        pipeline = [
            {"$match": {"health_id": health_id}},
            {"$group": {
                "_id": "$entry_type",
                "count": {"$sum": 1}
            }}
        ]
        
        type_counts = {}
        async for doc in collection.aggregate(pipeline):
            type_counts[doc["_id"]] = doc["count"]
        
        # Count by risk level
        pipeline = [
            {"$match": {"health_id": health_id}},
            {"$group": {
                "_id": "$risk_level",
                "count": {"$sum": 1}
            }}
        ]
        
        risk_counts = {}
        async for doc in collection.aggregate(pipeline):
            risk_counts[doc["_id"]] = doc["count"]
        
        # Total entries
        total = await collection.count_documents({"health_id": health_id})
        
        # Most recent entry
        recent_doc = await collection.find_one(
            {"health_id": health_id},
            sort=[("created_at", -1)]
        )
        
        return {
            "total_entries": total,
            "entries_by_type": type_counts,
            "entries_by_risk": risk_counts,
            "most_recent_entry": MedicalHistoryService._document_to_response(recent_doc) if recent_doc else None
        }
    
    @staticmethod
    def _document_to_response(document: dict) -> MedicalHistoryEntryResponse:
        """Convert MongoDB document to response schema"""
        return MedicalHistoryEntryResponse(
            id=str(document["_id"]),
            health_id=document["health_id"],
            entry_type=HistoryEntryType(document["entry_type"]),
            title=document["title"],
            summary=document["summary"],
            risk_level=RiskLevel(document["risk_level"]),
            metadata=document.get("metadata", {}),
            doctor_id=document.get("doctor_id"),
            related_report_id=document.get("related_report_id"),
            created_at=document["created_at"]
        )


# Helper functions for creating entries from different sources

async def create_chatbot_screening_entry(
    health_id: str,
    title: str,
    summary: str,
    risk_level: RiskLevel,
    symptoms: List[str],
    recommendations: List[str]
) -> MedicalHistoryEntryResponse:
    """Create a medical history entry from chatbot screening"""
    entry = MedicalHistoryEntryCreate(
        health_id=health_id,
        entry_type=HistoryEntryType.CHATBOT_SCREENING,
        title=title,
        summary=summary,
        risk_level=risk_level,
        metadata={
            "symptoms": symptoms,
            "recommendations": recommendations
        }
    )
    return await MedicalHistoryService.create_entry(entry)


async def create_scan_analysis_entry(
    health_id: str,
    scan_type: str,
    findings: str,
    risk_level: RiskLevel,
    confidence: float,
    scan_id: Optional[str] = None
) -> MedicalHistoryEntryResponse:
    """Create a medical history entry from scan analysis"""
    entry = MedicalHistoryEntryCreate(
        health_id=health_id,
        entry_type=HistoryEntryType.SCAN_ANALYSIS,
        title=f"{scan_type} Scan Analysis",
        summary=findings,
        risk_level=risk_level,
        metadata={
            "scan_type": scan_type,
            "confidence": confidence,
            "scan_id": scan_id
        }
    )
    return await MedicalHistoryService.create_entry(entry)


async def create_medical_report_entry(
    health_id: str,
    report_title: str,
    summary: str,
    risk_level: RiskLevel,
    report_id: str,
    diagnosis: Optional[str] = None
) -> MedicalHistoryEntryResponse:
    """Create a medical history entry from generated medical report"""
    entry = MedicalHistoryEntryCreate(
        health_id=health_id,
        entry_type=HistoryEntryType.MEDICAL_REPORT,
        title=report_title,
        summary=summary,
        risk_level=risk_level,
        related_report_id=report_id,
        metadata={
            "diagnosis": diagnosis
        }
    )
    return await MedicalHistoryService.create_entry(entry)


async def create_doctor_visit_entry(
    health_id: str,
    doctor_id: str,
    visit_summary: str,
    diagnosis: str,
    treatment: str,
    risk_level: RiskLevel = RiskLevel.NONE
) -> MedicalHistoryEntryResponse:
    """Create a medical history entry from doctor visit"""
    entry = MedicalHistoryEntryCreate(
        health_id=health_id,
        entry_type=HistoryEntryType.DOCTOR_VISIT,
        title="Doctor Visit",
        summary=visit_summary,
        risk_level=risk_level,
        doctor_id=doctor_id,
        metadata={
            "diagnosis": diagnosis,
            "treatment": treatment
        }
    )
    return await MedicalHistoryService.create_entry(entry)
