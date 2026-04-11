"""
Appointment Booking System Routes
- Doctors set available time slots
- Patients browse doctors & book slots
- Doctors accept/decline requests
- Patients see confirmed appointments
"""
from fastapi import APIRouter, HTTPException, Depends, status
from app.routes.auth import require_doctor, require_patient, get_current_user
from app.database import (
    get_doctors_collection, get_health_profiles_collection,
    get_appointments_collection, get_database
)
from app.utils.health_id import generate_appointment_id
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum
import uuid


router = APIRouter(prefix="/api", tags=["Appointment Booking"])


# ─── Schemas ────────────────────────────────────────────────

class TimeSlot(BaseModel):
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM (24h)
    end_time: str  # HH:MM (24h)


class AvailabilitySet(BaseModel):
    """Doctor sets multiple time slots at once."""
    slots: List[TimeSlot]


class SlotResponse(BaseModel):
    slot_id: str
    doctor_id: str
    date: str
    start_time: str
    end_time: str
    is_booked: bool = False


class BookingStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class BookAppointmentRequest(BaseModel):
    doctor_id: str
    slot_id: str
    reason: str
    notes: Optional[str] = None


class BookingRequestResponse(BaseModel):
    booking_id: str
    slot_id: str
    patient_health_id: str
    patient_name: str
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    doctor_id: str
    doctor_name: str
    doctor_specialization: Optional[str] = None
    date: str
    start_time: str
    end_time: str
    reason: str
    notes: Optional[str] = None
    status: str
    created_at: str
    updated_at: str


class DoctorListItem(BaseModel):
    doctor_id: str
    full_name: str
    specialization: str
    qualification: str
    experience_years: int
    hospital_affiliation: Optional[str] = None
    consultation_fee: Optional[float] = None
    rating: Optional[float] = None
    total_consultations: int = 0
    available_slot_count: int = 0


# ─── Helper: Collection getters ────────────────────────────

def get_slots_collection():
    db = get_database()
    return db.appointment_slots


def get_bookings_collection():
    db = get_database()
    return db.appointment_bookings


# ─── Doctor: Manage Availability ────────────────────────────

@router.post("/doctor/availability", status_code=status.HTTP_201_CREATED)
async def set_availability(
    data: AvailabilitySet,
    current_user: dict = Depends(require_doctor)
):
    """Doctor adds available time slots."""
    doctor_id = current_user["id"]
    slots_collection = get_slots_collection()

    created_slots = []
    for slot in data.slots:
        # Validate date
        try:
            slot_date = datetime.strptime(slot.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid date format: {slot.date}. Use YYYY-MM-DD"
            )

        # Validate time
        try:
            start = datetime.strptime(slot.start_time, "%H:%M")
            end = datetime.strptime(slot.end_time, "%H:%M")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid time format. Use HH:MM (24h)"
            )

        if end <= start:
            raise HTTPException(
                status_code=400,
                detail=f"End time must be after start time for slot on {slot.date}"
            )

        # Check for duplicate slot
        existing = await slots_collection.find_one({
            "doctor_id": doctor_id,
            "date": slot.date,
            "start_time": slot.start_time,
            "end_time": slot.end_time,
        })
        if existing:
            continue  # Skip duplicates silently

        slot_id = f"SLOT-{uuid.uuid4().hex[:12].upper()}"
        slot_doc = {
            "slot_id": slot_id,
            "doctor_id": doctor_id,
            "date": slot.date,
            "start_time": slot.start_time,
            "end_time": slot.end_time,
            "is_booked": False,
            "created_at": datetime.utcnow(),
        }
        await slots_collection.insert_one(slot_doc)
        created_slots.append(slot_id)

    return {
        "message": f"{len(created_slots)} slot(s) created successfully",
        "slot_ids": created_slots
    }


@router.get("/doctor/availability")
async def get_my_availability(
    current_user: dict = Depends(require_doctor),
    date_from: Optional[str] = None,
):
    """Get the current doctor's available time slots."""
    doctor_id = current_user["id"]
    slots_collection = get_slots_collection()

    query = {"doctor_id": doctor_id}

    # Default: show slots from today onwards
    if date_from:
        query["date"] = {"$gte": date_from}
    else:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        query["date"] = {"$gte": today}

    cursor = slots_collection.find(query).sort([("date", 1), ("start_time", 1)])
    slots = await cursor.to_list(length=200)

    return [
        {
            "slot_id": s["slot_id"],
            "doctor_id": s["doctor_id"],
            "date": s["date"],
            "start_time": s["start_time"],
            "end_time": s["end_time"],
            "is_booked": s.get("is_booked", False),
        }
        for s in slots
    ]


@router.delete("/doctor/availability/{slot_id}")
async def delete_slot(
    slot_id: str,
    current_user: dict = Depends(require_doctor)
):
    """Doctor deletes an available slot (only if not booked)."""
    doctor_id = current_user["id"]
    slots_collection = get_slots_collection()

    slot = await slots_collection.find_one({"slot_id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot["doctor_id"] != doctor_id:
        raise HTTPException(status_code=403, detail="Not your slot")
    if slot.get("is_booked"):
        raise HTTPException(status_code=400, detail="Cannot delete a booked slot")

    await slots_collection.delete_one({"slot_id": slot_id})
    return {"message": "Slot deleted successfully"}


# ─── Doctor: Booking requests ───────────────────────────────

@router.get("/doctor/booking-requests")
async def get_booking_requests(
    current_user: dict = Depends(require_doctor),
    status_filter: Optional[str] = None,
):
    """Doctor views incoming booking requests."""
    doctor_id = current_user["id"]
    bookings_collection = get_bookings_collection()

    query = {"doctor_id": doctor_id}
    if status_filter:
        query["status"] = status_filter

    cursor = bookings_collection.find(query).sort("created_at", -1)
    bookings = await cursor.to_list(length=100)

    return [
        {
            "booking_id": b["booking_id"],
            "slot_id": b["slot_id"],
            "patient_health_id": b["patient_health_id"],
            "patient_name": b["patient_name"],
            "patient_age": b.get("patient_age"),
            "patient_gender": b.get("patient_gender"),
            "doctor_id": b["doctor_id"],
            "doctor_name": b["doctor_name"],
            "doctor_specialization": b.get("doctor_specialization"),
            "date": b["date"],
            "start_time": b["start_time"],
            "end_time": b["end_time"],
            "reason": b["reason"],
            "notes": b.get("notes"),
            "status": b["status"],
            "created_at": b["created_at"].isoformat() if isinstance(b["created_at"], datetime) else b["created_at"],
            "updated_at": b["updated_at"].isoformat() if isinstance(b["updated_at"], datetime) else b["updated_at"],
        }
        for b in bookings
    ]


@router.patch("/doctor/booking-requests/{booking_id}")
async def respond_to_booking(
    booking_id: str,
    action: str,  # "accept" or "decline"
    current_user: dict = Depends(require_doctor),
):
    """Doctor accepts or declines a booking request."""
    doctor_id = current_user["id"]
    bookings_collection = get_bookings_collection()
    slots_collection = get_slots_collection()

    if action not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'decline'")

    booking = await bookings_collection.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["doctor_id"] != doctor_id:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["status"] != BookingStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Booking is already {booking['status']}")

    new_status = BookingStatus.ACCEPTED if action == "accept" else BookingStatus.DECLINED

    await bookings_collection.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    # If accepted, mark the slot as booked
    if action == "accept":
        await slots_collection.update_one(
            {"slot_id": booking["slot_id"]},
            {"$set": {"is_booked": True}}
        )
        # Decline other pending bookings for the same slot
        await bookings_collection.update_many(
            {
                "slot_id": booking["slot_id"],
                "booking_id": {"$ne": booking_id},
                "status": BookingStatus.PENDING,
            },
            {"$set": {"status": BookingStatus.DECLINED, "updated_at": datetime.utcnow()}}
        )

    # If declined, free up the slot
    if action == "decline":
        # Only free if no other accepted bookings exist for this slot
        other_accepted = await bookings_collection.find_one({
            "slot_id": booking["slot_id"],
            "status": BookingStatus.ACCEPTED,
        })
        if not other_accepted:
            await slots_collection.update_one(
                {"slot_id": booking["slot_id"]},
                {"$set": {"is_booked": False}}
            )

    updated = await bookings_collection.find_one({"booking_id": booking_id})
    return {
        "message": f"Booking {action}ed successfully",
        "booking_id": booking_id,
        "status": updated["status"],
    }


# ─── Patient: Browse doctors ────────────────────────────────

@router.get("/patient/available-doctors")
async def get_available_doctors(
    current_user: dict = Depends(require_patient),
    specialization: Optional[str] = None,
):
    """Patient browses list of doctors who have available slots."""
    doctors_collection = get_doctors_collection()
    slots_collection = get_slots_collection()

    today = datetime.utcnow().strftime("%Y-%m-%d")

    # Build doctor query
    doc_query = {"is_active": True}
    if specialization:
        doc_query["specialization"] = {"$regex": specialization, "$options": "i"}

    cursor = doctors_collection.find(doc_query).sort("full_name", 1)
    doctors = await cursor.to_list(length=100)

    result = []
    for doc in doctors:
        # Count available (unbooked) slots from today onwards
        slot_count = await slots_collection.count_documents({
            "doctor_id": doc["doctor_id"],
            "date": {"$gte": today},
            "is_booked": False,
        })
        result.append({
            "doctor_id": doc["doctor_id"],
            "full_name": doc["full_name"],
            "specialization": doc.get("specialization", "General"),
            "qualification": doc.get("qualification", ""),
            "experience_years": doc.get("experience_years", 0),
            "hospital_affiliation": doc.get("hospital_affiliation"),
            "consultation_fee": doc.get("consultation_fee"),
            "rating": doc.get("rating", 0.0),
            "total_consultations": doc.get("total_consultations", 0),
            "available_slot_count": slot_count,
        })

    return result


@router.get("/patient/doctor/{doctor_id}/slots")
async def get_doctor_slots(
    doctor_id: str,
    current_user: dict = Depends(require_patient),
):
    """Patient views a specific doctor's available (unbooked) time slots."""
    slots_collection = get_slots_collection()
    doctors_collection = get_doctors_collection()

    doctor = await doctors_collection.find_one({"doctor_id": doctor_id})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    today = datetime.utcnow().strftime("%Y-%m-%d")
    cursor = slots_collection.find({
        "doctor_id": doctor_id,
        "date": {"$gte": today},
        "is_booked": False,
    }).sort([("date", 1), ("start_time", 1)])
    slots = await cursor.to_list(length=200)

    return {
        "doctor": {
            "doctor_id": doctor["doctor_id"],
            "full_name": doctor["full_name"],
            "specialization": doctor.get("specialization", "General"),
            "qualification": doctor.get("qualification", ""),
            "experience_years": doctor.get("experience_years", 0),
            "hospital_affiliation": doctor.get("hospital_affiliation"),
            "consultation_fee": doctor.get("consultation_fee"),
        },
        "slots": [
            {
                "slot_id": s["slot_id"],
                "date": s["date"],
                "start_time": s["start_time"],
                "end_time": s["end_time"],
            }
            for s in slots
        ],
    }


# ─── Patient: Book appointment ──────────────────────────────

@router.post("/patient/book-appointment", status_code=status.HTTP_201_CREATED)
async def book_appointment(
    data: BookAppointmentRequest,
    current_user: dict = Depends(require_patient),
):
    """Patient requests a booking for a doctor's time slot."""
    health_id = current_user["id"]
    slots_collection = get_slots_collection()
    bookings_collection = get_bookings_collection()
    doctors_collection = get_doctors_collection()
    health_profiles = get_health_profiles_collection()

    # Validate slot
    slot = await slots_collection.find_one({"slot_id": data.slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Time slot not found")
    if slot["doctor_id"] != data.doctor_id:
        raise HTTPException(status_code=400, detail="Slot does not belong to this doctor")
    if slot.get("is_booked"):
        raise HTTPException(status_code=400, detail="This slot is already booked")

    # Check if patient already has a pending booking for this slot
    existing = await bookings_collection.find_one({
        "patient_health_id": health_id,
        "slot_id": data.slot_id,
        "status": {"$in": [BookingStatus.PENDING, BookingStatus.ACCEPTED]},
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have a booking for this slot")

    # Get doctor info
    doctor = await doctors_collection.find_one({"doctor_id": data.doctor_id})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Get patient info
    patient = await health_profiles.find_one({"health_id": health_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    booking_id = f"BKG-{uuid.uuid4().hex[:12].upper()}"

    booking_doc = {
        "booking_id": booking_id,
        "slot_id": data.slot_id,
        "patient_health_id": health_id,
        "patient_name": patient["full_name"],
        "patient_age": patient.get("age"),
        "patient_gender": patient.get("gender"),
        "doctor_id": data.doctor_id,
        "doctor_name": doctor["full_name"],
        "doctor_specialization": doctor.get("specialization"),
        "date": slot["date"],
        "start_time": slot["start_time"],
        "end_time": slot["end_time"],
        "reason": data.reason,
        "notes": data.notes,
        "status": BookingStatus.PENDING,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    await bookings_collection.insert_one(booking_doc)

    return {
        "message": "Appointment request sent successfully",
        "booking_id": booking_id,
        "status": BookingStatus.PENDING,
        "doctor_name": doctor["full_name"],
        "date": slot["date"],
        "time": f"{slot['start_time']} - {slot['end_time']}",
    }


# ─── Patient: My appointments ───────────────────────────────

@router.get("/patient/my-appointments")
async def get_my_appointments(
    current_user: dict = Depends(require_patient),
    status_filter: Optional[str] = None,
):
    """Patient views their appointment bookings."""
    health_id = current_user["id"]
    bookings_collection = get_bookings_collection()

    query = {"patient_health_id": health_id}
    if status_filter:
        query["status"] = status_filter

    cursor = bookings_collection.find(query).sort("created_at", -1)
    bookings = await cursor.to_list(length=100)

    return [
        {
            "booking_id": b["booking_id"],
            "slot_id": b["slot_id"],
            "doctor_id": b["doctor_id"],
            "doctor_name": b["doctor_name"],
            "doctor_specialization": b.get("doctor_specialization"),
            "date": b["date"],
            "start_time": b["start_time"],
            "end_time": b["end_time"],
            "reason": b["reason"],
            "notes": b.get("notes"),
            "status": b["status"],
            "created_at": b["created_at"].isoformat() if isinstance(b["created_at"], datetime) else b["created_at"],
            "updated_at": b["updated_at"].isoformat() if isinstance(b["updated_at"], datetime) else b["updated_at"],
        }
        for b in bookings
    ]


@router.delete("/patient/my-appointments/{booking_id}")
async def cancel_my_appointment(
    booking_id: str,
    current_user: dict = Depends(require_patient),
):
    """Patient cancels their booking."""
    health_id = current_user["id"]
    bookings_collection = get_bookings_collection()
    slots_collection = get_slots_collection()

    booking = await bookings_collection.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["patient_health_id"] != health_id:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["status"] in (BookingStatus.CANCELLED, BookingStatus.DECLINED):
        raise HTTPException(status_code=400, detail="Booking is already cancelled/declined")

    await bookings_collection.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": BookingStatus.CANCELLED, "updated_at": datetime.utcnow()}}
    )

    # Free up the slot
    await slots_collection.update_one(
        {"slot_id": booking["slot_id"]},
        {"$set": {"is_booked": False}}
    )

    return {"message": "Appointment cancelled successfully"}
