"""
Profile Service - Manages patient context and medical history retrieval
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from app.database import (
    get_health_profiles_collection,
    get_users_collection,
    get_medical_reports_collection,
    get_scans_collection
)


class ProfileService:
    """Service for retrieving and formatting patient context for AI"""
    
    @staticmethod
    async def get_patient_context(health_id: str, include_full_history: bool = False) -> str:
        """
        Get formatted patient context for AI injection.
        
        Args:
            health_id: Patient's health ID
            include_full_history: Whether to include detailed medical history
            
        Returns:
            Formatted string containing patient context
        """
        health_profiles = get_health_profiles_collection()
        users = get_users_collection()
        
        # Get basic profile
        profile = await health_profiles.find_one({"health_id": health_id})
        user = await users.find_one({"health_id": health_id})
        
        if not profile or not user:
            return ""
        
        # Build context string
        context_parts = [
            "=== PATIENT PROFILE ===",
            f"Name: {profile['full_name']}",
            f"Age: {profile['age']} years old",
            f"Gender: {profile['gender']}",
            f"Blood Group: {profile['blood_group']}",
            f"Height: {profile['height']} cm",
            f"Weight: {profile['weight']} kg",
            f"BMI: {ProfileService._calculate_bmi(profile['weight'], profile['height']):.1f}"
        ]
        
        # Add recent medical history if requested
        if include_full_history:
            recent_conditions = await ProfileService.get_recent_conditions(health_id)
            if recent_conditions:
                context_parts.append("\n=== RECENT MEDICAL HISTORY ===")
                context_parts.extend(recent_conditions)
            
            recent_meds = await ProfileService.get_current_medications(health_id)
            if recent_meds:
                context_parts.append("\n=== CURRENT MEDICATIONS ===")
                context_parts.extend(recent_meds)
        
        return "\n".join(context_parts)
    
    @staticmethod
    def _calculate_bmi(weight_kg: float, height_cm: float) -> float:
        """Calculate BMI from weight and height"""
        height_m = height_cm / 100
        return weight_kg / (height_m ** 2)
    
    @staticmethod
    async def get_recent_conditions(health_id: str, limit: int = 5) -> List[str]:
        """
        Get list of recent medical conditions/diagnoses.
        
        Args:
            health_id: Patient's health ID
            limit: Maximum number of conditions to return
            
        Returns:
            List of formatted condition strings
        """
        reports_collection = get_medical_reports_collection()
        
        # Get recent reports
        cursor = reports_collection.find(
            {"health_id": health_id}
        ).sort("generated_date", -1).limit(limit)
        
        reports = await cursor.to_list(length=limit)
        
        conditions = []
        for report in reports:
            if "diagnosis" in report and report["diagnosis"]:
                for diag in report["diagnosis"]:
                    date_str = report["generated_date"].strftime("%Y-%m-%d")
                    condition = f"- {diag.get('condition', 'Unknown')} ({date_str})"
                    if diag.get("severity"):
                        condition += f" - Severity: {diag['severity']}"
                    conditions.append(condition)
        
        return conditions[:limit]
    
    @staticmethod
    async def get_current_medications(health_id: str, limit: int = 10) -> List[str]:
        """
        Get list of current medications.
        
        Args:
            health_id: Patient's health ID
            limit: Maximum number of medications to return
            
        Returns:
            List of formatted medication strings
        """
        reports_collection = get_medical_reports_collection()
        
        # Get most recent report with medications
        cursor = reports_collection.find(
            {"health_id": health_id, "medications": {"$exists": True, "$ne": []}}
        ).sort("generated_date", -1).limit(3)
        
        reports = await cursor.to_list(length=3)
        
        medications = []
        seen_meds = set()
        
        for report in reports:
            if "medications" in report:
                for med in report["medications"]:
                    med_name = med.get("name", "Unknown")
                    if med_name not in seen_meds:
                        seen_meds.add(med_name)
                        med_str = f"- {med_name}"
                        if med.get("dosage"):
                            med_str += f" ({med['dosage']}"
                            if med.get("frequency"):
                                med_str += f", {med['frequency']}"
                            med_str += ")"
                        medications.append(med_str)
                        
                        if len(medications) >= limit:
                            break
            
            if len(medications) >= limit:
                break
        
        return medications
    
    @staticmethod
    async def get_recent_scans_summary(health_id: str, limit: int = 3) -> List[str]:
        """
        Get summary of recent medical scans.
        
        Args:
            health_id: Patient's health ID
            limit: Maximum number of scans to return
            
        Returns:
            List of formatted scan summaries
        """
        scans_collection = get_scans_collection()
        
        cursor = scans_collection.find(
            {"health_id": health_id}
        ).sort("upload_date", -1).limit(limit)
        
        scans = await cursor.to_list(length=limit)
        
        summaries = []
        for scan in scans:
            date_str = scan["upload_date"].strftime("%Y-%m-%d")
            scan_type = scan.get("scan_type", "Unknown").upper()
            prediction = scan.get("prediction", "No analysis available")
            summaries.append(f"- {scan_type} scan ({date_str}): {prediction}")
        
        return summaries
    
    @staticmethod
    async def get_patient_summary(health_id: str) -> Dict[str, Any]:
        """
        Get comprehensive patient summary for dashboard/reports.
        
        Args:
            health_id: Patient's health ID
            
        Returns:
            Dict containing patient summary data
        """
        health_profiles = get_health_profiles_collection()
        profile = await health_profiles.find_one({"health_id": health_id})
        
        if not profile:
            return {}
        
        return {
            "health_id": health_id,
            "name": profile["full_name"],
            "age": profile["age"],
            "gender": profile["gender"],
            "blood_group": profile["blood_group"],
            "bmi": ProfileService._calculate_bmi(profile["weight"], profile["height"]),
            "recent_conditions": await ProfileService.get_recent_conditions(health_id, limit=3),
            "current_medications": await ProfileService.get_current_medications(health_id, limit=5),
            "recent_scans": await ProfileService.get_recent_scans_summary(health_id, limit=3)
        }
