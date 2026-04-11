"""
Medical History API Routes
Endpoints for managing patient medical history timeline
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime

from app.schemas.history import (
    MedicalHistoryEntryCreate,
    MedicalHistoryEntryResponse,
    MedicalHistoryTimelineResponse,
    HistoryEntryType
)
from app.services.history_service import MedicalHistoryService
from app.routes.auth import get_current_user
from app.database import get_users_collection, get_health_profiles_collection

router = APIRouter(prefix="/api/history", tags=["medical-history"])


@router.post("/", response_model=MedicalHistoryEntryResponse, status_code=201)
async def create_history_entry(
    entry: MedicalHistoryEntryCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new medical history entry (append-only)
    
    - **health_id**: Patient's Unified Health ID
    - **entry_type**: Type of entry (chatbot_screening, scan_analysis, medical_report, doctor_visit)
    - **title**: Brief title for the entry
    - **summary**: Detailed summary of the event
    - **risk_level**: Risk assessment (low, moderate, high, critical, none)
    """
    try:
        # Verify user has permission to create entry for this health_id
        user_health_id = current_user["id"]
        user_role = current_user["role"]
        
        # Users can only create entries for themselves, doctors can create for patients
        if user_role == "patient" and entry.health_id != user_health_id:
            raise HTTPException(status_code=403, detail="Cannot create history entry for another patient")
        
        # Create the entry
        history_entry = await MedicalHistoryService.create_entry(entry)
        return history_entry
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create history entry: {str(e)}")


@router.get("/timeline/{health_id}", response_model=MedicalHistoryTimelineResponse)
async def get_medical_timeline(
    health_id: str,
    limit: int = Query(default=100, le=500),
    entry_type: Optional[HistoryEntryType] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get medical history timeline for a patient
    
    - **health_id**: Patient's Unified Health ID
    - **limit**: Maximum number of entries to return (default: 100, max: 500)
    - **entry_type**: Filter by entry type (optional)
    - **start_date**: Filter entries after this date (ISO format, optional)
    - **end_date**: Filter entries before this date (ISO format, optional)
    
    Returns chronological timeline sorted by date (newest first)
    """
    try:
        # Verify access
        user_health_id = current_user["id"]
        user_role = current_user["role"]
        
        has_access = await MedicalHistoryService.verify_access(
            health_id=health_id,
            user_health_id=user_health_id,
            user_role=user_role
        )
        
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view this medical history"
            )
        
        # Parse dates if provided
        start_dt = datetime.fromisoformat(start_date) if start_date else None
        end_dt = datetime.fromisoformat(end_date) if end_date else None
        
        # Get timeline
        entries = await MedicalHistoryService.get_timeline(
            health_id=health_id,
            limit=limit,
            entry_type=entry_type,
            start_date=start_dt,
            end_date=end_dt
        )
        
        # Get patient name from health profiles
        health_profiles_collection = get_health_profiles_collection()
        profile_doc = await health_profiles_collection.find_one({"health_id": health_id})
        patient_name = profile_doc.get("full_name") if profile_doc else None
        
        return MedicalHistoryTimelineResponse(
            total_entries=len(entries),
            entries=entries,
            health_id=health_id,
            patient_name=patient_name
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve timeline: {str(e)}")


@router.get("/entry/{entry_id}", response_model=MedicalHistoryEntryResponse)
async def get_history_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific medical history entry by ID
    
    - **entry_id**: Medical history entry ID
    """
    try:
        entry = await MedicalHistoryService.get_entry_by_id(entry_id)
        
        if not entry:
            raise HTTPException(status_code=404, detail="History entry not found")
        
        # Verify access
        user_health_id = current_user["id"]
        user_role = current_user["role"]
        
        has_access = await MedicalHistoryService.verify_access(
            health_id=entry.health_id,
            user_health_id=user_health_id,
            user_role=user_role
        )
        
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view this history entry"
            )
        
        return entry
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve entry: {str(e)}")


@router.get("/stats/{health_id}")
async def get_history_stats(
    health_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get summary statistics for a patient's medical history
    
    - **health_id**: Patient's Unified Health ID
    
    Returns counts by entry type, risk level, and most recent entry
    """
    try:
        # Verify access
        user_health_id = current_user["id"]
        user_role = current_user["role"]
        
        has_access = await MedicalHistoryService.verify_access(
            health_id=health_id,
            user_health_id=user_health_id,
            user_role=user_role
        )
        
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view this medical history"
            )
        
        stats = await MedicalHistoryService.get_summary_stats(health_id)
        return stats
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve stats: {str(e)}")


@router.get("/my-timeline", response_model=MedicalHistoryTimelineResponse)
async def get_my_timeline(
    limit: int = Query(default=100, le=500),
    entry_type: Optional[HistoryEntryType] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get medical history timeline for the current authenticated user
    
    Convenience endpoint that automatically uses the current user's health ID
    """
    health_id = current_user["id"]
    
    try:
        entries = await MedicalHistoryService.get_timeline(
            health_id=health_id,
            limit=limit,
            entry_type=entry_type
        )
        
        # Get patient name from health profiles
        health_profiles_collection = get_health_profiles_collection()
        profile_doc = await health_profiles_collection.find_one({"health_id": health_id})
        patient_name = profile_doc.get("full_name") if profile_doc else None
        
        return MedicalHistoryTimelineResponse(
            total_entries=len(entries),
            entries=entries,
            health_id=health_id,
            patient_name=patient_name
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve timeline: {str(e)}")
