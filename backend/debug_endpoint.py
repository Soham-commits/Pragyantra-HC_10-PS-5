"""
Add this to your backend to create a debug endpoint
Add to app/main.py or create a new route file
"""

# Add this route to your FastAPI app
from fastapi import APIRouter
from app.database import get_referrals_collection, get_health_profiles_collection, get_users_collection

router = APIRouter(prefix="/api/debug", tags=["Debug"])

@router.get("/referrals")
async def debug_referrals():
    """Debug endpoint to check referral data"""
    referrals_col = get_referrals_collection()
    
    # Get all referrals
    all_referrals = await referrals_col.find({}, {"_id": 0}).to_list(length=100)
    
    # Get patient_id values
    patient_ids = [ref.get("patient_id") for ref in all_referrals]
    
    return {
        "total_referrals": len(all_referrals),
        "patient_ids": patient_ids,
        "referrals": all_referrals
    }

@router.get("/patient/{health_id}")
async def debug_patient(health_id: str):
    """Debug endpoint to check patient data"""
    health_profiles = get_health_profiles_collection()
    users = get_users_collection()
    referrals_col = get_referrals_collection()
    
    profile = await health_profiles.find_one({"health_id": health_id}, {"_id": 0})
    user = await users.find_one({"health_id": health_id}, {"_id": 0})
    referrals = await referrals_col.find({"patient_id": health_id}, {"_id": 0}).to_list(length=100)
    
    return {
        "health_id": health_id,
        "found_in_health_profiles": profile is not None,
        "found_in_users": user is not None,
        "referrals_count": len(referrals),
        "profile": profile,
        "user": user,
        "referrals": referrals
    }
