"""
Debug script to check referral data in MongoDB
Run with: python debug_referrals.py
"""
import asyncio
from app.database import get_referrals_collection, get_health_profiles_collection, get_users_collection

async def debug_referrals():
    print("\n" + "="*80)
    print("DEBUGGING REFERRALS")
    print("="*80 + "\n")
    
    # Check all referrals
    referrals_col = get_referrals_collection()
    all_referrals = await referrals_col.find({}, {"_id": 0}).to_list(length=100)
    
    print(f"📊 Total referrals in database: {len(all_referrals)}\n")
    
    if all_referrals:
        print("📋 Referral documents:")
        for i, ref in enumerate(all_referrals, 1):
            print(f"\n--- Referral {i} ---")
            print(f"  referral_id: {ref.get('referral_id')}")
            print(f"  patient_id: {ref.get('patient_id')}")
            print(f"  patient_name: {ref.get('patient_name')}")
            print(f"  status: {ref.get('status')}")
            print(f"  specialist_id: {ref.get('specialist_id')}")
            print(f"  created_at: {ref.get('created_at')}")
    else:
        print("❌ No referrals found in database!\n")
    
    # Check patient with specific health_id
    target_health_id = "UHID-3314C5792D01F38A"
    print(f"\n{'='*80}")
    print(f"CHECKING PATIENT: {target_health_id}")
    print("="*80 + "\n")
    
    # Check health_profiles
    health_profiles = get_health_profiles_collection()
    profile = await health_profiles.find_one({"health_id": target_health_id}, {"_id": 0})
    
    if profile:
        print(f"✅ Found in health_profiles:")
        print(f"  health_id: {profile.get('health_id')}")
        print(f"  full_name: {profile.get('full_name')}")
    else:
        print(f"❌ Not found in health_profiles")
    
    # Check users collection
    users = get_users_collection()
    user = await users.find_one({"health_id": target_health_id}, {"_id": 0})
    
    if user:
        print(f"\n✅ Found in users:")
        print(f"  health_id: {user.get('health_id')}")
        print(f"  email: {user.get('email')}")
        print(f"  full_name: {user.get('full_name')}")
    else:
        print(f"\n❌ Not found in users")
    
    # Check for referrals with this patient_id
    patient_referrals = await referrals_col.find(
        {"patient_id": target_health_id}, 
        {"_id": 0}
    ).to_list(length=100)
    
    print(f"\n📋 Referrals for {target_health_id}: {len(patient_referrals)}")
    if patient_referrals:
        for ref in patient_referrals:
            print(f"  - {ref.get('referral_id')} (status: {ref.get('status')})")
    
    # Check for partial matches
    print(f"\n{'='*80}")
    print("CHECKING FOR PARTIAL MATCHES")
    print("="*80 + "\n")
    
    partial_id = "3314C5792D01F38A"
    partial_matches = await referrals_col.find(
        {"patient_id": {"$regex": partial_id}},
        {"_id": 0, "patient_id": 1, "referral_id": 1}
    ).to_list(length=100)
    
    print(f"🔍 Referrals with patient_id containing '{partial_id}': {len(partial_matches)}")
    for match in partial_matches:
        print(f"  - referral_id: {match.get('referral_id')}, patient_id: {match.get('patient_id')}")
    
    print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    asyncio.run(debug_referrals())
