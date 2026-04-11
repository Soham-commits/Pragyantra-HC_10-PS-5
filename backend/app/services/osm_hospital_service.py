"""
OpenStreetMap Overpass API Hospital Discovery Service
Fetches real nearby hospitals/clinics using the user's geolocation.
"""

import math
import time
import aiohttp
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# In-memory session cache: key = "lat,lng,radius" -> (timestamp, results)
_hospital_cache: Dict[str, tuple] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def _cache_key(lat: float, lng: float, radius: int) -> str:
    return f"{round(lat, 4)},{round(lng, 4)},{radius}"


def _get_cached(lat: float, lng: float, radius: int) -> Optional[List[Dict[str, Any]]]:
    key = _cache_key(lat, lng, radius)
    entry = _hospital_cache.get(key)
    if entry:
        ts, results = entry
        if time.time() - ts < CACHE_TTL_SECONDS:
            logger.info("Returning cached hospital results for %s", key)
            return results
        else:
            del _hospital_cache[key]
    return None


def _set_cache(lat: float, lng: float, radius: int, results: List[Dict[str, Any]]):
    key = _cache_key(lat, lng, radius)
    _hospital_cache[key] = (time.time(), results)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance between two coordinates, in kilometres."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def fetch_nearby_hospitals(
    lat: float,
    lng: float,
    radius: int = 5000,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Query OpenStreetMap Overpass API for hospitals and clinics within `radius`
    metres of (lat, lng). Returns up to `limit` results sorted by distance.
    Results are cached per coordinate+radius for 5 minutes.
    """

    # Check cache first
    cached = _get_cached(lat, lng, radius)
    if cached is not None:
        return cached[:limit]

    overpass_url = "https://overpass-api.de/api/interpreter"

    # Query for amenity=hospital OR amenity=clinic within radius
    overpass_query = f"""
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](around:{radius},{lat},{lng});
      way["amenity"="hospital"](around:{radius},{lat},{lng});
      relation["amenity"="hospital"](around:{radius},{lat},{lng});
      node["amenity"="clinic"](around:{radius},{lat},{lng});
      way["amenity"="clinic"](around:{radius},{lat},{lng});
      relation["amenity"="clinic"](around:{radius},{lat},{lng});
    );
    out center body;
    """

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                overpass_url,
                data={"data": overpass_query},
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                if resp.status != 200:
                    logger.error("Overpass API returned status %d", resp.status)
                    return []
                data = await resp.json(content_type=None)
    except Exception as exc:
        logger.exception("Overpass API request failed: %s", exc)
        return []

    elements = data.get("elements", [])
    hospitals: List[Dict[str, Any]] = []

    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            # Skip unnamed facilities
            continue

        # Coordinates: nodes have lat/lon directly; ways/relations use "center"
        el_lat = el.get("lat") or el.get("center", {}).get("lat")
        el_lng = el.get("lon") or el.get("center", {}).get("lon")
        if el_lat is None or el_lng is None:
            continue

        # Build a human-readable address from available tags
        addr_parts = []
        for key in ("addr:housenumber", "addr:street", "addr:suburb",
                     "addr:city", "addr:state", "addr:postcode"):
            val = tags.get(key)
            if val:
                addr_parts.append(val)
        address = ", ".join(addr_parts) if addr_parts else tags.get("addr:full", "Address not available")

        distance = haversine_km(lat, lng, el_lat, el_lng)

        hospitals.append({
            "hospital_name": name,
            "address": address,
            "distance_km": round(distance, 1),
            "latitude": round(el_lat, 6),
            "longitude": round(el_lng, 6),
        })

    # Sort by distance ascending
    hospitals.sort(key=lambda h: h["distance_km"])

    # Keep nearest `limit` results
    hospitals = hospitals[:limit]

    # Cache the results
    _set_cache(lat, lng, radius, hospitals)

    return hospitals
