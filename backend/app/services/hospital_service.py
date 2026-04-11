"""
Hospital Recommendation Service
Recommends nearby hospitals based on location and suspected condition
Uses Google Places API for real hospital data
"""

from typing import List, Dict, Any, Optional, Tuple
import math
import os
import aiohttp
from app.config import settings
from urllib.parse import quote
from app.services.osm_hospital_service import fetch_nearby_hospitals


class HospitalService:
    """Service for hospital recommendations based on symptoms and location"""
    
    @staticmethod
    def _calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate distance between two coordinates using Haversine formula.
        Returns distance in kilometers.
        """
        R = 6371  # Earth's radius in kilometers
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    @staticmethod
    def _get_specialization_for_symptoms(
        symptoms: List[str],
        severity_level: str
    ) -> List[str]:
        """
        Determine required medical specializations based on symptoms.
        
        Args:
            symptoms: List of detected symptoms
            severity_level: Severity (low/moderate/high)
            
        Returns:
            List of recommended specializations
        """
        specializations = set()
        
        # Map symptoms to specializations
        symptom_mapping = {
            "chest pain": ["Cardiologist", "Emergency"],
            "chest tightness": ["Cardiologist", "Emergency"],
            "heart pain": ["Cardiologist", "Emergency"],
            "heart": ["Cardiologist"],
            "palpitations": ["Cardiologist"],
            "irregular heartbeat": ["Cardiologist"],
            "fainting": ["Cardiologist"],
            "syncope": ["Cardiologist"],
            "high blood pressure": ["Cardiologist"],
            "shortness of breath on exertion": ["Cardiologist", "Pulmonologist"],
            "shortness of breath": ["Pulmonologist", "Emergency"],
            "breathing": ["Pulmonologist"],
            "wheezing": ["Pulmonologist"],
            "breathing difficulty": ["Pulmonologist"],
            "chest congestion": ["Pulmonologist"],
            "asthma": ["Pulmonologist"],
            "copd": ["Pulmonologist"],
            "low oxygen": ["Pulmonologist", "Emergency"],
            "headache": ["Neurologist", "General Physician"],
            "headaches": ["Neurologist", "General Physician"],
            "migraine": ["Neurologist"],
            "dizziness": ["Neurologist", "ENT Specialist"],
            "seizures": ["Neurologist"],
            "numbness": ["Neurologist"],
            "tingling": ["Neurologist"],
            "weakness": ["Neurologist"],
            "memory loss": ["Neurologist"],
            "tremors": ["Neurologist"],
            "loss of balance": ["Neurologist"],
            "fever": ["General Physician", "Infectious Disease"],
            "fatigue": ["General Physician"],
            "cough": ["Pulmonologist", "General Physician"],
            "chronic cough": ["Pulmonologist"],
            "stomach": ["Gastroenterologist"],
            "stomach pain": ["Gastroenterologist"],
            "abdominal pain": ["Gastroenterologist"],
            "abdomen": ["Gastroenterologist"],
            "bloating": ["Gastroenterologist"],
            "nausea": ["Gastroenterologist"],
            "vomiting": ["Gastroenterologist"],
            "acid reflux": ["Gastroenterologist"],
            "heartburn": ["Gastroenterologist"],
            "diarrhea": ["Gastroenterologist"],
            "constipation": ["Gastroenterologist"],
            "blood in stool": ["Gastroenterologist", "Emergency"],
            "skin": ["Dermatologist"],
            "rash": ["Dermatologist"],
            "itching": ["Dermatologist"],
            "acne": ["Dermatologist"],
            "eczema": ["Dermatologist"],
            "psoriasis": ["Dermatologist"],
            "skin lesions": ["Dermatologist"],
            "skin infection": ["Dermatologist"],
            "discoloration": ["Dermatologist"],
            "hair loss": ["Dermatologist"],
            "bone": ["Orthopedic"],
            "joint": ["Orthopedic", "Rheumatologist"],
            "leg": ["Orthopedic"],
            "knee": ["Orthopedic"],
            "ankle": ["Orthopedic"],
            "hip": ["Orthopedic"],
            "back": ["Orthopedic"],
            "neck": ["Orthopedic"],
            "shoulder": ["Orthopedic"],
            "fracture": ["Orthopedic", "Emergency"],
            "swelling after injury": ["Orthopedic"],
            "difficulty walking": ["Orthopedic"],
            "muscle": ["Orthopedic", "Physiatrist"],
            "diabetes": ["Endocrinologist"],
            "thyroid": ["Endocrinologist"],
            "weight gain": ["Endocrinologist"],
            "weight loss": ["Endocrinologist"],
            "hormonal": ["Endocrinologist"],
            "excessive thirst": ["Endocrinologist"],
            "frequent urination": ["Endocrinologist"],
            "mental": ["Psychiatrist"],
            "anxiety": ["Psychiatrist"],
            "depression": ["Psychiatrist"],
            "panic attacks": ["Psychiatrist"],
            "mood swings": ["Psychiatrist"],
            "insomnia": ["Psychiatrist"],
            "stress": ["Psychiatrist"],
            "hallucinations": ["Psychiatrist"],
            "suicidal thoughts": ["Psychiatrist", "Emergency"],
            "ear pain": ["ENT Specialist"],
            "hearing loss": ["ENT Specialist"],
            "ringing in ears": ["ENT Specialist"],
            "sore throat": ["ENT Specialist"],
            "difficulty swallowing": ["ENT Specialist"],
            "nasal congestion": ["ENT Specialist"],
            "sinus pain": ["ENT Specialist"],
            "voice changes": ["ENT Specialist"],
            "vision loss": ["Ophthalmologist"],
            "blurred vision": ["Ophthalmologist"],
            "vision": ["Ophthalmologist"],
            "eye pain": ["Ophthalmologist"],
            "redness in eyes": ["Ophthalmologist"],
            "eye discharge": ["Ophthalmologist"],
            "double vision": ["Ophthalmologist"],
        }
        
        for symptom in symptoms:
            symptom_lower = symptom.lower()
            for keyword, specs in symptom_mapping.items():
                if keyword in symptom_lower:
                    specializations.update(specs)
        
        # Add emergency if high severity
        if severity_level == "high":
            specializations.add("Emergency")
        
        # Default to general physician if nothing specific
        if not specializations:
            specializations.add("General Physician")
        
        return list(specializations)
    
    @staticmethod
    async def get_nearby_hospitals(
        latitude: float,
        longitude: float,
        symptoms: List[str],
        severity_level: str = "moderate",
        max_distance_km: float = 10.0,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get nearby hospitals based on location and symptoms.
        Uses Google Places API if available, otherwise returns mock data.
        
        Args:
            latitude: User's latitude
            longitude: User's longitude
            symptoms: List of detected symptoms
            severity_level: Severity level (low/moderate/high)
            max_distance_km: Maximum search radius in km
            limit: Maximum number of hospitals to return
            
        Returns:
            List of hospital recommendations with details
        """
        
        # Get required specializations
        required_specs = HospitalService._get_specialization_for_symptoms(
            symptoms, severity_level
        )
        
        # Check if Google Places API key is available
        google_api_key = os.getenv("GOOGLE_PLACES_API_KEY") or settings.GOOGLE_PLACES_API_KEY if hasattr(settings, "GOOGLE_PLACES_API_KEY") else None
        
        if google_api_key:
            try:
                return await HospitalService._get_hospitals_from_google(
                    latitude=latitude,
                    longitude=longitude,
                    required_specs=required_specs,
                    severity_level=severity_level,
                    max_distance_km=max_distance_km,
                    limit=limit,
                    api_key=google_api_key
                )
            except Exception as e:
                print(f"Error fetching from Google Places API: {e}")
                # Fall back to mock data
        
        # Fall back to OpenStreetMap Overpass when Google API is unavailable
        osm_results = await fetch_nearby_hospitals(
            lat=latitude,
            lng=longitude,
            radius=int(max_distance_km * 1000),
            limit=limit
        )

        return [
            {
                "hospital_id": f"osm-{h['latitude']}-{h['longitude']}-{idx}",
                "name": h["hospital_name"],
                "distance_km": h["distance_km"],
                "address": h["address"],
                "phone": "",
                "specializations": [],
                "has_required_specialization": False,
                "emergency_available": False,
                "rating": 0,
                "estimated_travel_time": f"{max(1, int(h['distance_km'] * 3))} mins",
                "google_maps_url": f"https://www.google.com/maps/search/?api=1&query={quote(h['hospital_name'])}%20{h['latitude']},{h['longitude']}"
            }
            for idx, h in enumerate(osm_results)
        ]
    
    @staticmethod
    async def _get_hospitals_from_google(
        latitude: float,
        longitude: float,
        required_specs: List[str],
        severity_level: str,
        max_distance_km: float,
        limit: int,
        api_key: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch real hospitals from Google Places API
        """
        # Convert km to meters for Google API
        radius_meters = int(max_distance_km * 1000)
        
        # Search for hospitals, clinics, and doctors
        search_types = ["hospital", "doctor", "health"]
        all_places = []
        
        async with aiohttp.ClientSession() as session:
            for search_type in search_types:
                url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
                params = {
                    "location": f"{latitude},{longitude}",
                    "radius": radius_meters,
                    "type": search_type,
                    "key": api_key
                }
                
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("status") == "OK":
                            all_places.extend(data.get("results", []))
        
        # Process and format results
        hospitals = []
        seen_place_ids = set()
        
        for place in all_places:
            place_id = place.get("place_id")
            if place_id in seen_place_ids:
                continue
            seen_place_ids.add(place_id)
            
            # Calculate distance
            place_lat = place.get("geometry", {}).get("location", {}).get("lat")
            place_lng = place.get("geometry", {}).get("location", {}).get("lng")
            
            if not place_lat or not place_lng:
                continue
            
            distance = HospitalService._calculate_distance(
                latitude, longitude, place_lat, place_lng
            )
            
            if distance > max_distance_km:
                continue
            
            # Extract place details
            name = place.get("name", "Unknown Hospital")
            address = place.get("vicinity", "Address not available")
            rating = place.get("rating", 0)
            is_open = place.get("opening_hours", {}).get("open_now", False)
            
            # Determine if emergency available (hospitals usually have emergency)
            types = place.get("types", [])
            emergency_available = "hospital" in types
            
            # Estimate specializations based on name and types
            specializations = []
            name_lower = name.lower()
            
            if "emergency" in name_lower or "hospital" in types:
                specializations.append("Emergency")
            if "heart" in name_lower or "cardiac" in name_lower:
                specializations.append("Cardiologist")
            if "children" in name_lower or "pediatric" in name_lower:
                specializations.append("Pediatrics")
            if "eye" in name_lower or "vision" in name_lower:
                specializations.append("Ophthalmologist")
            if "dental" in name_lower or "dentist" in name_lower:
                specializations.append("Dentist")
            
            # Default specializations
            if not specializations:
                if "hospital" in types:
                    specializations = ["Emergency", "General Physician"]
                else:
                    specializations = ["General Physician"]
            
            # Check if has required specialization
            has_required_spec = any(
                spec in specializations for spec in required_specs
            )
            
            # Calculate relevance score
            relevance_score = 0
            if has_required_spec:
                relevance_score += 10
            if emergency_available and severity_level == "high":
                relevance_score += 5
            relevance_score += rating
            
            hospitals.append({
                "hospital_id": place_id,
                "name": name,
                "distance_km": round(distance, 2),
                "address": address,
                "phone": "Call for details",  # Would need Place Details API for phone
                "specializations": specializations,
                "has_required_specialization": has_required_spec,
                "emergency_available": emergency_available,
                "rating": round(rating, 1),
                "estimated_travel_time": f"{int(distance * 3)} mins",
                "google_maps_url": f"https://maps.google.com/?q=place_id:{place_id}",
                "relevance_score": relevance_score
            })
        
        # Sort by relevance and distance
        hospitals.sort(key=lambda x: (-x["relevance_score"], x["distance_km"]))
        
        # Return top results
        return [
            {k: v for k, v in h.items() if k != "relevance_score"}
            for h in hospitals[:limit]
        ]
    
    @staticmethod
    def should_recommend_hospital(
        severity_level: str,
        symptoms: List[str]
    ) -> Tuple[bool, str]:
        """
        Determine if hospital recommendation should be made.
        Only recommend when there's clear clinical need — not on every response.
        
        Args:
            severity_level: Severity level
            symptoms: List of symptoms
            
        Returns:
            Tuple of (should_recommend, reason)
        """
        # Always recommend for high severity
        if severity_level == "high" and len(symptoms) >= 1:
            return True, "High severity symptoms require immediate medical attention"
        
        # Check for emergency keywords
        emergency_keywords = [
            "chest pain", "difficulty breathing", "severe bleeding",
            "loss of consciousness", "severe burn", "severe injury"
        ]
        
        for symptom in symptoms:
            symptom_lower = symptom.lower()
            if any(keyword in symptom_lower for keyword in emergency_keywords):
                return True, "Symptoms suggest you should seek immediate medical care"
        
        # Moderate severity - only recommend when multiple symptoms are detected
        if severity_level == "moderate" and len(symptoms) >= 3:
            return True, "Based on your symptoms, here are nearby healthcare facilities that can help"
        
        # Don't auto-recommend for low severity or few symptoms
        return False, ""

