"""
Location API routes — nearby hospital discovery via OpenStreetMap.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List
from app.services.osm_hospital_service import fetch_nearby_hospitals

router = APIRouter(prefix="/api/location", tags=["Location"])


@router.get("/nearby-hospitals")
async def nearby_hospitals(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius: int = Query(5000, ge=500, le=50000, description="Search radius in metres"),
):
    """
    Return nearby hospitals/clinics from OpenStreetMap Overpass API.

    Results are sorted by distance (ascending) and limited to 10.
    Responses are cached for 5 minutes per coordinate+radius.
    """
    try:
        hospitals = await fetch_nearby_hospitals(
            lat=lat,
            lng=lng,
            radius=radius,
            limit=10,
        )
        return hospitals
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching hospitals: {str(exc)}")
