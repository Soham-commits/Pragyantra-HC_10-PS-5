from fastapi import APIRouter, HTTPException, Depends, status
from app.schemas.schemas import (
    DoctorProfile, UserProfile, AddDoctorVisit, DoctorVisit,
    AppointmentCreate, AppointmentResponse, AppointmentUpdate,
    AppointmentStatus, MedicalReportCreate, MedicalReportResponse,
    DoctorScanResponse, DoctorScanRemarksUpdate, DoctorScanStatusUpdate,
    DoctorScanReviewUpdate, ScanReviewStatus, AppointmentNotesCreate,
    AppointmentNotesResponse, PatientSummary, PatientRemarkCreate,
    PatientRemarkResponse
)
from app.routes.auth import require_doctor, get_current_user
from app.database import (
    get_doctors_collection, get_health_profiles_collection,
    get_users_collection, get_medical_reports_collection,
    get_appointments_collection, get_scans_collection,
    get_appointment_notes_collection, get_patient_remarks_collection,
    get_chats_collection
)
from app.utils.health_id import (
    generate_appointment_id, generate_visit_id, generate_report_id
)
from app.services.health_chain_service import hash_and_chain_report
from datetime import datetime
from typing import List, Optional
import logging

router = APIRouter(prefix="/api/doctor", tags=["Doctor"])
logger = logging.getLogger(__name__)


def is_abnormal_scan(scan: dict) -> bool:
    model_result = (scan.get("model_result") or "").lower()
    if model_result in {"abnormal", "malignant"}:
        return True
    prediction = (scan.get("prediction") or "").lower()
    return "abnormal" in prediction or "malignant" in prediction


def resolve_review_status(scan: dict) -> ScanReviewStatus:
    if scan.get("flagged_followup"):
        return ScanReviewStatus.REVIEWED
    if scan.get("doctor_notes"):
        return ScanReviewStatus.REVIEWED
    if scan.get("reviewed_by_doctor") or scan.get("reviewed_by_name"):
        return ScanReviewStatus.REVIEWED
    raw_status = scan.get("review_status") or scan.get("status")
    try:
        return ScanReviewStatus(raw_status)
    except Exception:
        return ScanReviewStatus.PENDING


def resolve_reviewer_fields(scan: dict) -> tuple[Optional[bool], Optional[str]]:
    reviewed_by_value = scan.get("reviewed_by_doctor")
    reviewed_by_name = scan.get("reviewed_by_name")
    if isinstance(reviewed_by_value, str) and not reviewed_by_name:
        reviewed_by_name = reviewed_by_value
    reviewed_by_doctor = reviewed_by_value if isinstance(reviewed_by_value, bool) else bool(reviewed_by_value)
    if reviewed_by_name:
        reviewed_by_doctor = True
    return reviewed_by_doctor, reviewed_by_name


async def get_doctor_name(doctor_id: str) -> Optional[str]:
    doctors_collection = get_doctors_collection()
    doctor = await doctors_collection.find_one({"doctor_id": doctor_id})
    if not doctor:
        return None
    return doctor.get("full_name")


@router.get("/profile", response_model=DoctorProfile)
async def get_doctor_profile(current_user: dict = Depends(require_doctor)):
    """
    Get current doctor's profile information.
    """
    doctor_id = current_user["id"]
    doctors_collection = get_doctors_collection()
    
    doctor = await doctors_collection.find_one({"doctor_id": doctor_id})
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found"
        )
    
    return DoctorProfile(
        doctor_id=doctor["doctor_id"],
        full_name=doctor["full_name"],
        email=doctor["email"],
        phone=doctor["phone"],
        medical_license=doctor["medical_license"],
        specialization=doctor["specialization"],
        qualification=doctor["qualification"],
        experience_years=doctor["experience_years"],
        hospital_affiliation=doctor.get("hospital_affiliation"),
        consultation_fee=doctor.get("consultation_fee"),
        rating=doctor.get("rating", 0.0),
        total_consultations=doctor.get("total_consultations", 0),
        created_at=doctor["created_at"]
    )


@router.get("/patient/{health_id}", response_model=UserProfile)
async def get_patient_profile(
    health_id: str,
    current_user: dict = Depends(require_doctor)
):
    """
    View patient profile using their Health ID.
    Doctors can access patient information for consultation.
    """
    health_profiles_collection = get_health_profiles_collection()
    users_collection = get_users_collection()
    
    profile = await health_profiles_collection.find_one({"health_id": health_id})
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    user = await users_collection.find_one({"health_id": health_id})
    
    return UserProfile(
        health_id=profile["health_id"],
        full_name=profile["full_name"],
        email=user["email"] if user else "N/A",
        phone=profile["phone"],
        date_of_birth=profile["date_of_birth"],
        age=profile["age"],
        gender=profile["gender"],
        height=profile["height"],
        weight=profile["weight"],
        blood_group=profile["blood_group"],
        emergency_contact_name=profile.get("emergency_contact_name"),
        emergency_contact_phone=profile.get("emergency_contact_phone"),
        created_at=profile["created_at"]
    )


@router.post("/visit/add", status_code=status.HTTP_201_CREATED)
async def add_doctor_visit(
    visit_data: AddDoctorVisit,
    current_user: dict = Depends(require_doctor)
):
    """
    Add a new doctor visit with diagnosis, prescriptions, and notes.
    This creates a medical record for the patient.
    """
    doctor_id = current_user["id"]
    doctors_collection = get_doctors_collection()
    health_profiles_collection = get_health_profiles_collection()
    reports_collection = get_medical_reports_collection()
    
    # Verify patient exists
    patient = await health_profiles_collection.find_one({"health_id": visit_data.health_id})
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Get doctor info
    doctor = await doctors_collection.find_one({"doctor_id": doctor_id})
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Generate visit/report ID
    report_id = generate_report_id()
    
    # Create medical report from visit
    report_doc = {
        "report_id": report_id,
        "visit_id": generate_visit_id(),
        "health_id": visit_data.health_id,
        "patient_name": patient["full_name"],
        "report_type": "Doctor Visit",
        "generated_date": datetime.utcnow(),
        "diagnosis": [d.dict() for d in visit_data.diagnosis],
        "medications": [m.dict() for m in visit_data.medications],
        "lab_tests_recommended": visit_data.lab_tests_recommended,
        "follow_up_date": visit_data.follow_up_date,
        "doctor_notes": visit_data.visit_notes,
        "generated_by": doctor_id,
        "doctor_name": doctor["full_name"],
        "doctor_specialization": doctor["specialization"],
        "created_at": datetime.utcnow()
    }
    
    # Insert visit record
    await reports_collection.insert_one(report_doc)

    try:
        await hash_and_chain_report(report_id=report_id, patient_id=visit_data.health_id)
    except Exception as exc:
        logger.warning("Failed to hash/chain report %s (non-blocking): %s", report_id, exc)
    
    # Update doctor's consultation count
    await doctors_collection.update_one(
        {"doctor_id": doctor_id},
        {"$inc": {"total_consultations": 1}}
    )
    
    return {
        "message": "Visit record added successfully",
        "visit_id": report_doc["visit_id"],
        "report_id": report_id
    }


@router.post("/appointment/create", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment_data: AppointmentCreate,
    current_user: dict = Depends(require_doctor)
):
    """
    Schedule an appointment with a patient.
    """
    doctor_id = current_user["id"]
    doctors_collection = get_doctors_collection()
    health_profiles_collection = get_health_profiles_collection()
    appointments_collection = get_appointments_collection()
    
    # Verify patient exists
    patient = await health_profiles_collection.find_one({"health_id": appointment_data.health_id})
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Get doctor info
    doctor = await doctors_collection.find_one({"doctor_id": doctor_id})
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Parse appointment date
    try:
        appointment_date = datetime.fromisoformat(appointment_data.appointment_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
        )
    
    # Validate appointment is in the future
    if appointment_date < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment date must be in the future"
        )
    
    # Generate appointment ID
    appointment_id = generate_appointment_id()
    
    # Create appointment document
    appointment_doc = {
        "appointment_id": appointment_id,
        "health_id": appointment_data.health_id,
        "patient_name": patient["full_name"],
        "doctor_id": doctor_id,
        "doctor_name": doctor["full_name"],
        "doctor_specialization": doctor["specialization"],
        "appointment_date": appointment_date,
        "reason": appointment_data.reason,
        "status": AppointmentStatus.SCHEDULED,
        "notes": appointment_data.notes,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert appointment
    await appointments_collection.insert_one(appointment_doc)
    
    return AppointmentResponse(
        appointment_id=appointment_id,
        health_id=appointment_data.health_id,
        patient_name=patient["full_name"],
        doctor_id=doctor_id,
        doctor_name=doctor["full_name"],
        appointment_date=appointment_date,
        reason=appointment_data.reason,
        status=AppointmentStatus.SCHEDULED,
        notes=appointment_data.notes,
        created_at=appointment_doc["created_at"]
    )


@router.get("/appointments", response_model=List[AppointmentResponse])
async def get_doctor_appointments(
    current_user: dict = Depends(require_doctor),
    status_filter: Optional[AppointmentStatus] = None,
    limit: int = 50
):
    """
    Get all appointments for the current doctor.
    Can filter by appointment status.
    """
    doctor_id = current_user["id"]
    appointments_collection = get_appointments_collection()
    
    # Build query
    query = {"doctor_id": doctor_id}
    if status_filter:
        query["status"] = status_filter
    
    # Get appointments
    appointments_cursor = appointments_collection.find(query).sort("appointment_date", -1).limit(limit)
    appointments = await appointments_cursor.to_list(length=limit)
    
    return [
        AppointmentResponse(
            appointment_id=apt["appointment_id"],
            health_id=apt["health_id"],
            patient_name=apt["patient_name"],
            doctor_id=apt["doctor_id"],
            doctor_name=apt["doctor_name"],
            appointment_date=apt["appointment_date"],
            reason=apt["reason"],
            status=apt["status"],
            notes=apt.get("notes"),
            created_at=apt["created_at"]
        )
        for apt in appointments
    ]


@router.patch("/appointment/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: str,
    update_data: AppointmentUpdate,
    current_user: dict = Depends(require_doctor)
):
    """
    Update appointment status or notes.
    """
    doctor_id = current_user["id"]
    appointments_collection = get_appointments_collection()
    
    # Find appointment
    appointment = await appointments_collection.find_one({"appointment_id": appointment_id})
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Verify doctor owns this appointment
    if appointment["doctor_id"] != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own appointments"
        )
    
    # Build update dict
    update_fields = {"updated_at": datetime.utcnow()}
    if update_data.status:
        update_fields["status"] = update_data.status
    if update_data.notes is not None:
        update_fields["notes"] = update_data.notes
    
    # Update appointment
    await appointments_collection.update_one(
        {"appointment_id": appointment_id},
        {"$set": update_fields}
    )
    
    # Get updated appointment
    updated_appointment = await appointments_collection.find_one({"appointment_id": appointment_id})
    
    return AppointmentResponse(
        appointment_id=updated_appointment["appointment_id"],
        health_id=updated_appointment["health_id"],
        patient_name=updated_appointment["patient_name"],
        doctor_id=updated_appointment["doctor_id"],
        doctor_name=updated_appointment["doctor_name"],
        appointment_date=updated_appointment["appointment_date"],
        reason=updated_appointment["reason"],
        status=updated_appointment["status"],
        notes=updated_appointment.get("notes"),
        created_at=updated_appointment["created_at"]
    )


@router.post("/appointment/notes", response_model=AppointmentNotesResponse, status_code=status.HTTP_201_CREATED)
async def add_appointment_notes(
    notes_data: AppointmentNotesCreate,
    current_user: dict = Depends(require_doctor)
):
    """
    Add notes after an appointment with a patient.
    Includes care details, prescription information, and follow-up requirements.
    """
    doctor_id = current_user["id"]
    appointments_collection = get_appointments_collection()
    appointment_notes_collection = get_appointment_notes_collection()
    doctors_collection = get_doctors_collection()
    health_profiles_collection = get_health_profiles_collection()
    
    # Find appointment
    appointment = await appointments_collection.find_one({"appointment_id": notes_data.appointment_id})
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Verify doctor owns this appointment
    if appointment["doctor_id"] != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add notes to your own appointments"
        )
    
    # Get doctor info
    doctor = await doctors_collection.find_one({"doctor_id": doctor_id})
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Get patient info
    patient = await health_profiles_collection.find_one({"health_id": appointment["health_id"]})
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Parse follow-up date if provided
    follow_up_date = None
    if notes_data.follow_up_date:
        try:
            follow_up_date = datetime.fromisoformat(notes_data.follow_up_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid follow-up date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
            )
    
    # Generate notes ID
    import uuid
    notes_id = f"NOTE-{uuid.uuid4().hex[:12].upper()}"
    
    # Create appointment notes document
    notes_doc = {
        "notes_id": notes_id,
        "appointment_id": notes_data.appointment_id,
        "health_id": appointment["health_id"],
        "patient_name": patient["full_name"],
        "doctor_id": doctor_id,
        "doctor_name": doctor["full_name"],
        "care_details": notes_data.care_details,
        "prescription_notes": notes_data.prescription_notes,
        "prescription_image_url": notes_data.prescription_image_url,
        "follow_up_required": notes_data.follow_up_required or False,
        "follow_up_date": follow_up_date,
        "additional_notes": notes_data.additional_notes,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert notes
    await appointment_notes_collection.insert_one(notes_doc)
    
    # Update appointment status to completed if not already
    if appointment["status"] != AppointmentStatus.COMPLETED:
        await appointments_collection.update_one(
            {"appointment_id": notes_data.appointment_id},
            {"$set": {"status": AppointmentStatus.COMPLETED, "updated_at": datetime.utcnow()}}
        )
    
    return AppointmentNotesResponse(
        notes_id=notes_id,
        appointment_id=notes_data.appointment_id,
        health_id=appointment["health_id"],
        patient_name=patient["full_name"],
        doctor_id=doctor_id,
        doctor_name=doctor["full_name"],
        care_details=notes_data.care_details,
        prescription_notes=notes_data.prescription_notes,
        prescription_image_url=notes_data.prescription_image_url,
        follow_up_required=notes_data.follow_up_required or False,
        follow_up_date=follow_up_date,
        additional_notes=notes_data.additional_notes,
        created_at=notes_doc["created_at"],
        updated_at=notes_doc["updated_at"]
    )


@router.get("/appointment/{appointment_id}/notes", response_model=List[AppointmentNotesResponse])
async def get_appointment_notes(
    appointment_id: str,
    current_user: dict = Depends(require_doctor)
):
    """
    Get all notes for a specific appointment.
    """
    appointment_notes_collection = get_appointment_notes_collection()
    
    # Get notes
    notes_cursor = appointment_notes_collection.find({"appointment_id": appointment_id}).sort("created_at", -1)
    notes = await notes_cursor.to_list(length=None)
    
    return [
        AppointmentNotesResponse(
            notes_id=note["notes_id"],
            appointment_id=note["appointment_id"],
            health_id=note["health_id"],
            patient_name=note["patient_name"],
            doctor_id=note["doctor_id"],
            doctor_name=note["doctor_name"],
            care_details=note["care_details"],
            prescription_notes=note.get("prescription_notes"),
            prescription_image_url=note.get("prescription_image_url"),
            follow_up_required=note.get("follow_up_required", False),
            follow_up_date=note.get("follow_up_date"),
            additional_notes=note.get("additional_notes"),
            created_at=note["created_at"],
            updated_at=note["updated_at"]
        )
        for note in notes
    ]


@router.patch("/appointment/notes/{notes_id}", response_model=AppointmentNotesResponse)
async def update_appointment_notes(
    notes_id: str,
    notes_data: AppointmentNotesCreate,
    current_user: dict = Depends(require_doctor)
):
    """
    Update existing appointment notes.
    """
    doctor_id = current_user["id"]
    appointment_notes_collection = get_appointment_notes_collection()
    
    # Find notes
    notes = await appointment_notes_collection.find_one({"notes_id": notes_id})
    if not notes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notes not found"
        )
    
    # Verify doctor owns these notes
    if notes["doctor_id"] != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own notes"
        )
    
    # Parse follow-up date if provided
    follow_up_date = None
    if notes_data.follow_up_date:
        try:
            follow_up_date = datetime.fromisoformat(notes_data.follow_up_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid follow-up date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
            )
    
    # Update notes
    update_fields = {
        "care_details": notes_data.care_details,
        "prescription_notes": notes_data.prescription_notes,
        "prescription_image_url": notes_data.prescription_image_url,
        "follow_up_required": notes_data.follow_up_required or False,
        "follow_up_date": follow_up_date,
        "additional_notes": notes_data.additional_notes,
        "updated_at": datetime.utcnow()
    }
    
    await appointment_notes_collection.update_one(
        {"notes_id": notes_id},
        {"$set": update_fields}
    )
    
    # Get updated notes
    updated_notes = await appointment_notes_collection.find_one({"notes_id": notes_id})
    
    return AppointmentNotesResponse(
        notes_id=updated_notes["notes_id"],
        appointment_id=updated_notes["appointment_id"],
        health_id=updated_notes["health_id"],
        patient_name=updated_notes["patient_name"],
        doctor_id=updated_notes["doctor_id"],
        doctor_name=updated_notes["doctor_name"],
        care_details=updated_notes["care_details"],
        prescription_notes=updated_notes.get("prescription_notes"),
        prescription_image_url=updated_notes.get("prescription_image_url"),
        follow_up_required=updated_notes.get("follow_up_required", False),
        follow_up_date=updated_notes.get("follow_up_date"),
        additional_notes=updated_notes.get("additional_notes"),
        created_at=updated_notes["created_at"],
        updated_at=updated_notes["updated_at"]
    )


@router.post("/patient/remark", response_model=PatientRemarkResponse, status_code=status.HTTP_201_CREATED)
async def add_patient_remark(
    remark_data: PatientRemarkCreate,
    current_user: dict = Depends(require_doctor)
):
    """
    Add a general remark/note about a patient.
    These are doctor observations not tied to a specific appointment.
    """
    doctor_id = current_user["id"]
    patient_remarks_collection = get_patient_remarks_collection()
    doctors_collection = get_doctors_collection()
    health_profiles_collection = get_health_profiles_collection()
    
    # Verify patient exists
    patient = await health_profiles_collection.find_one({"health_id": remark_data.health_id})
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Get doctor info
    doctor = await doctors_collection.find_one({"doctor_id": doctor_id})
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Generate remark ID
    import uuid
    remark_id = f"REM-{uuid.uuid4().hex[:12].upper()}"
    
    # Create remark document
    remark_doc = {
        "remark_id": remark_id,
        "health_id": remark_data.health_id,
        "patient_name": patient["full_name"],
        "doctor_id": doctor_id,
        "doctor_name": doctor["full_name"],
        "remark": remark_data.remark,
        "category": remark_data.category,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert remark
    await patient_remarks_collection.insert_one(remark_doc)
    
    return PatientRemarkResponse(
        remark_id=remark_id,
        health_id=remark_data.health_id,
        patient_name=patient["full_name"],
        doctor_id=doctor_id,
        doctor_name=doctor["full_name"],
        remark=remark_data.remark,
        category=remark_data.category,
        created_at=remark_doc["created_at"],
        updated_at=remark_doc["updated_at"]
    )


@router.get("/patient/{health_id}/remarks", response_model=List[PatientRemarkResponse])
async def get_patient_remarks(
    health_id: str,
    current_user: dict = Depends(require_doctor)
):
    """
    Get all remarks for a specific patient.
    """
    patient_remarks_collection = get_patient_remarks_collection()
    
    # Get remarks
    remarks_cursor = patient_remarks_collection.find({"health_id": health_id}).sort("created_at", -1)
    remarks = await remarks_cursor.to_list(length=None)
    
    return [
        PatientRemarkResponse(
            remark_id=remark["remark_id"],
            health_id=remark["health_id"],
            patient_name=remark["patient_name"],
            doctor_id=remark["doctor_id"],
            doctor_name=remark["doctor_name"],
            remark=remark["remark"],
            category=remark.get("category"),
            created_at=remark["created_at"],
            updated_at=remark["updated_at"]
        )
        for remark in remarks
    ]


@router.get("/patient/{health_id}/history")
async def get_patient_history(
    health_id: str,
    current_user: dict = Depends(require_doctor),
    limit: int = 20
):
    """
    Get patient's medical history.
    Doctors can view complete patient history for consultation.
    """
    health_profiles_collection = get_health_profiles_collection()
    reports_collection = get_medical_reports_collection()
    
    # Verify patient exists
    patient = await health_profiles_collection.find_one({"health_id": health_id})
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Get patient's medical reports (including visit records)
    reports_cursor = reports_collection.find(
        {"health_id": health_id}
    ).sort("generated_date", -1).limit(limit)
    reports = await reports_cursor.to_list(length=limit)
    
    # Format as visits
    visits = []
    for report in reports:
        if report.get("generated_by"):  # Only include doctor-generated reports
            visit = {
                "visit_id": report.get("visit_id", report["report_id"]),
                "date": report["generated_date"],
                "doctor_name": report.get("doctor_name", "Unknown"),
                "doctor_specialization": report.get("doctor_specialization"),
                "diagnosis": report.get("diagnosis", []),
                "medications": report.get("medications", []),
                "lab_tests_recommended": report.get("lab_tests_recommended"),
                "follow_up_date": report.get("follow_up_date"),
                "visit_notes": report.get("doctor_notes")
            }
            visits.append(visit)
    
    return {
        "patient_name": patient["full_name"],
        "health_id": health_id,
        "age": patient["age"],
        "gender": patient["gender"],
        "blood_group": patient["blood_group"],
        "visits": visits,
        "total_visits": len(visits)
    }


@router.get("/patients/recent", response_model=List[PatientSummary])
async def get_recent_patients(
    current_user: dict = Depends(require_doctor),
    limit: int = 10
):
    """
    Get recent patients (by most recent scan or visit).
    Returns patient summaries with visit/scan statistics.
    """
    health_profiles_collection = get_health_profiles_collection()
    scans_collection = get_scans_collection()
    appointments_collection = get_appointments_collection()
    reports_collection = get_medical_reports_collection()
    
    # Get recent scans to find active patients
    recent_scans = await scans_collection.find({}).sort("upload_date", -1).limit(50).to_list(length=50)
    recent_health_ids = list(dict.fromkeys([scan["health_id"] for scan in recent_scans]))[:limit]
    
    patients_cursor = health_profiles_collection.find({"health_id": {"$in": recent_health_ids}})
    patients = await patients_cursor.to_list(length=limit)
    
    # For each patient, get statistics
    patient_summaries = []
    for patient in patients:
        health_id = patient["health_id"]
        
        # Get total scans
        total_scans = await scans_collection.count_documents({"health_id": health_id})
        
        # Get total appointments
        total_appointments = await appointments_collection.count_documents({"health_id": health_id})
        
        # Get pending appointments
        pending_appointments = await appointments_collection.count_documents({
            "health_id": health_id,
            "status": AppointmentStatus.SCHEDULED
        })
        
        # Get last visit date from reports
        last_report = await reports_collection.find_one(
            {"health_id": health_id},
            sort=[("generated_date", -1)]
        )
        last_visit_date = last_report["generated_date"] if last_report else None
        
        patient_summaries.append(
            PatientSummary(
                health_id=health_id,
                full_name=patient["full_name"],
                age=patient["age"],
                gender=patient["gender"],
                blood_group=patient["blood_group"],
                last_visit_date=last_visit_date,
                total_scans=total_scans,
                total_appointments=total_appointments,
                pending_appointments=pending_appointments
            )
        )
    
    return patient_summaries


@router.get("/patients/search", response_model=List[PatientSummary])
async def search_patients(
    query: str,
    current_user: dict = Depends(require_doctor),
    limit: int = 10
):
    """
    Search for patients by name or Health ID.
    Returns patient summaries with visit/scan statistics.
    """
    health_profiles_collection = get_health_profiles_collection()
    scans_collection = get_scans_collection()
    appointments_collection = get_appointments_collection()
    reports_collection = get_medical_reports_collection()
    
    # Search by Health ID or name
    search_query = {
        "$or": [
            {"health_id": {"$regex": query, "$options": "i"}},
            {"full_name": {"$regex": query, "$options": "i"}}
        ]
    }
    
    patients_cursor = health_profiles_collection.find(search_query).limit(limit)
    patients = await patients_cursor.to_list(length=limit)
    
    # For each patient, get statistics
    patient_summaries = []
    for patient in patients:
        health_id = patient["health_id"]
        
        # Get total scans
        total_scans = await scans_collection.count_documents({"health_id": health_id})
        
        # Get total appointments
        total_appointments = await appointments_collection.count_documents({"health_id": health_id})
        
        # Get pending appointments
        pending_appointments = await appointments_collection.count_documents({
            "health_id": health_id,
            "status": AppointmentStatus.SCHEDULED
        })
        
        # Get last visit date from reports
        last_report = await reports_collection.find_one(
            {"health_id": health_id},
            sort=[("generated_date", -1)]
        )
        last_visit_date = last_report["generated_date"] if last_report else None
        
        patient_summaries.append(
            PatientSummary(
                health_id=health_id,
                full_name=patient["full_name"],
                age=patient["age"],
                gender=patient["gender"],
                blood_group=patient["blood_group"],
                last_visit_date=last_visit_date,
                total_scans=total_scans,
                total_appointments=total_appointments,
                pending_appointments=pending_appointments
            )
        )
    
    return patient_summaries


@router.get("/patients/{health_id}/details")
async def get_patient_details(
    health_id: str,
    current_user: dict = Depends(require_doctor)
):
    """
    Get comprehensive patient details including profile, scans, appointments, and medical history.
    """
    health_profiles_collection = get_health_profiles_collection()
    scans_collection = get_scans_collection()
    appointments_collection = get_appointments_collection()
    reports_collection = get_medical_reports_collection()
    users_collection = get_users_collection()
    patient_remarks_collection = get_patient_remarks_collection()
    appointment_notes_collection = get_appointment_notes_collection()
    
    # Get patient profile
    patient = await health_profiles_collection.find_one({"health_id": health_id})
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Get user info for email
    user = await users_collection.find_one({"health_id": health_id})
    
    # Get all scans
    scans_cursor = scans_collection.find({"health_id": health_id}).sort("upload_date", -1)
    scans = await scans_cursor.to_list(length=None)
    
    # Get all appointments
    appointments_cursor = appointments_collection.find({"health_id": health_id}).sort("appointment_date", -1)
    appointments = await appointments_cursor.to_list(length=None)
    
    # Get medical history
    reports_cursor = reports_collection.find({"health_id": health_id}).sort("generated_date", -1)
    reports = await reports_cursor.to_list(length=None)
    
    # Format scans
    scan_list = []
    for scan in scans:
        review_status = resolve_review_status(scan)
        reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(scan)
        scan_list.append({
            "scan_id": scan["scan_id"],
            "scan_type": scan["scan_type"],
            "image_url": scan["image_url"],
            "gradcam_url": scan.get("gradcam_url"),
            "heatmap_url": scan.get("heatmap_url") or scan.get("gradcam_url"),
            "heatmap_generated": scan.get("heatmap_generated", scan.get("gradcam_url") is not None),
            "upload_date": scan["upload_date"],
            "prediction": scan.get("prediction"),
            "confidence": scan.get("confidence"),
            "model_result": scan.get("model_result"),
            "abnormal_probability": scan.get("abnormal_probability"),
            "malignant_probability": scan.get("malignant_probability"),
            "severity": scan.get("severity"),
            "review_status": review_status,
            "reviewed_by_doctor": reviewed_by_doctor,
            "reviewed_by_name": reviewed_by_name,
            "reviewed_at": scan.get("reviewed_at"),
            "doctor_notes": scan.get("doctor_notes"),
            "flagged_followup": scan.get("flagged_followup")
        })
    
    # Format appointments
    appointment_list = []
    for apt in appointments:
        appointment_list.append({
            "appointment_id": apt["appointment_id"],
            "doctor_id": apt["doctor_id"],
            "doctor_name": apt["doctor_name"],
            "doctor_specialization": apt.get("doctor_specialization"),
            "appointment_date": apt["appointment_date"],
            "reason": apt["reason"],
            "status": apt["status"],
            "notes": apt.get("notes"),
            "created_at": apt["created_at"]
        })
    
    # Format medical history
    medical_history = []
    for report in reports:
        medical_history.append({
            "report_id": report["report_id"],
            "report_type": report.get("report_type", "Doctor Visit"),
            "generated_date": report["generated_date"],
            "doctor_name": report.get("doctor_name", "Unknown"),
            "doctor_specialization": report.get("doctor_specialization"),
            "diagnosis": report.get("diagnosis", []),
            "medications": report.get("medications", []),
            "lab_tests_recommended": report.get("lab_tests_recommended"),
            "follow_up_date": report.get("follow_up_date"),
            "doctor_notes": report.get("doctor_notes")
        })
    
    # Get patient remarks
    remarks_cursor = patient_remarks_collection.find({"health_id": health_id}).sort("created_at", -1)
    remarks = await remarks_cursor.to_list(length=None)
    
    remarks_list = []
    for remark in remarks:
        remarks_list.append({
            "remark_id": remark["remark_id"],
            "doctor_id": remark["doctor_id"],
            "doctor_name": remark["doctor_name"],
            "remark": remark["remark"],
            "category": remark.get("category"),
            "created_at": remark["created_at"],
            "updated_at": remark["updated_at"]
        })
    
    # Get appointment notes for all appointments
    appointment_ids = [apt["appointment_id"] for apt in appointments]
    notes_cursor = appointment_notes_collection.find({"appointment_id": {"$in": appointment_ids}})
    all_notes = await notes_cursor.to_list(length=None)
    
    # Group notes by appointment_id
    notes_by_appointment = {}
    for note in all_notes:
        apt_id = note["appointment_id"]
        if apt_id not in notes_by_appointment:
            notes_by_appointment[apt_id] = []
        notes_by_appointment[apt_id].append({
            "notes_id": note["notes_id"],
            "care_details": note["care_details"],
            "prescription_notes": note.get("prescription_notes"),
            "prescription_image_url": note.get("prescription_image_url"),
            "follow_up_required": note.get("follow_up_required", False),
            "follow_up_date": note.get("follow_up_date"),
            "additional_notes": note.get("additional_notes"),
            "created_at": note["created_at"],
            "updated_at": note["updated_at"]
        })
    
    # Add notes to appointments
    for apt in appointment_list:
        apt["notes_records"] = notes_by_appointment.get(apt["appointment_id"], [])
    
    return {
        "patient": {
            "health_id": patient["health_id"],
            "full_name": patient["full_name"],
            "email": user["email"] if user else "N/A",
            "phone": patient["phone"],
            "date_of_birth": patient["date_of_birth"],
            "age": patient["age"],
            "gender": patient["gender"],
            "height": patient["height"],
            "weight": patient["weight"],
            "blood_group": patient["blood_group"],
            "emergency_contact_name": patient.get("emergency_contact_name"),
            "emergency_contact_phone": patient.get("emergency_contact_phone"),
            "created_at": patient["created_at"]
        },
        "scans": scan_list,
        "appointments": appointment_list,
        "medical_history": medical_history,
        "remarks": remarks_list,
        "statistics": {
            "total_scans": len(scan_list),
            "total_appointments": len(appointment_list),
            "total_visits": len(medical_history),
            "total_remarks": len(remarks_list)
        }
    }


@router.get("/scans", response_model=List[DoctorScanResponse])
async def get_scans_for_review(
    current_user: dict = Depends(require_doctor),
    limit: int = 50,
    pending_only: bool = False,
    reviewed_only: bool = False,
    followup_only: bool = False
):
    """
    Get recent scans for doctor review.
    """
    scans_collection = get_scans_collection()
    health_profiles_collection = get_health_profiles_collection()

    scans_cursor = scans_collection.find({}).sort("upload_date", -1).limit(limit)
    scans = await scans_cursor.to_list(length=limit)

    health_ids = list({scan.get("health_id") for scan in scans if scan.get("health_id")})
    profiles_cursor = health_profiles_collection.find({"health_id": {"$in": health_ids}})
    profiles = await profiles_cursor.to_list(length=len(health_ids))
    name_map = {profile["health_id"]: profile.get("full_name", "Unknown") for profile in profiles}

    results = []
    for scan in scans:
        review_status = resolve_review_status(scan)
        has_followup = scan.get("flagged_followup", False)

        if pending_only and review_status != ScanReviewStatus.PENDING:
            continue
        if reviewed_only and review_status != ScanReviewStatus.REVIEWED:
            continue
        if followup_only and not has_followup:
            continue

        reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(scan)
        results.append(
            DoctorScanResponse(
                scan_id=scan["scan_id"],
                health_id=scan["health_id"],
                patient_name=name_map.get(scan["health_id"], "Unknown"),
                scan_type=scan["scan_type"],
                image_url=scan["image_url"],
                gradcam_url=scan.get("gradcam_url"),
                upload_date=scan["upload_date"],
                prediction=scan.get("prediction"),
                confidence=scan.get("confidence"),
                model_result=scan.get("model_result"),
                abnormal_probability=scan.get("abnormal_probability"),
                malignant_probability=scan.get("malignant_probability"),
                severity=scan.get("severity"),
                review_status=review_status,
                reviewed_by_doctor=reviewed_by_doctor,
                reviewed_by_name=reviewed_by_name,
                reviewed_at=scan.get("reviewed_at"),
                doctor_notes=scan.get("doctor_notes"),
                flagged_followup=scan.get("flagged_followup")
            )
        )

    return results


@router.get("/scans/{scan_id}", response_model=DoctorScanResponse)
async def get_scan_detail(
    scan_id: str,
    current_user: dict = Depends(require_doctor)
):
    """
    Get scan detail for doctor review.
    """
    scans_collection = get_scans_collection()
    health_profiles_collection = get_health_profiles_collection()

    scan = await scans_collection.find_one({"scan_id": scan_id})
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    profile = await health_profiles_collection.find_one({"health_id": scan["health_id"]})
    patient_name = profile.get("full_name", "Unknown") if profile else "Unknown"

    reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(scan)

    return DoctorScanResponse(
        scan_id=scan["scan_id"],
        health_id=scan["health_id"],
        patient_name=patient_name,
        scan_type=scan["scan_type"],
        image_url=scan["image_url"],
        gradcam_url=scan.get("gradcam_url"),
        upload_date=scan["upload_date"],
        prediction=scan.get("prediction"),
        confidence=scan.get("confidence"),
        model_result=scan.get("model_result"),
        abnormal_probability=scan.get("abnormal_probability"),
        malignant_probability=scan.get("malignant_probability"),
        severity=scan.get("severity"),
        review_status=resolve_review_status(scan),
        reviewed_by_doctor=reviewed_by_doctor,
        reviewed_by_name=reviewed_by_name,
        reviewed_at=scan.get("reviewed_at"),
        doctor_notes=scan.get("doctor_notes"),
        flagged_followup=scan.get("flagged_followup")
    )


@router.post("/scans/{scan_id}/remarks", response_model=DoctorScanResponse)
async def add_scan_remarks(
    scan_id: str,
    payload: DoctorScanRemarksUpdate,
    current_user: dict = Depends(require_doctor)
):
    """
    Add doctor remarks to a scan.
    """
    scans_collection = get_scans_collection()
    health_profiles_collection = get_health_profiles_collection()

    scan = await scans_collection.find_one({"scan_id": scan_id})
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    doctor_id = current_user["id"]
    doctor_name = await get_doctor_name(doctor_id)

    await scans_collection.update_one(
        {"scan_id": scan_id},
        {"$set": {
            "doctor_notes": payload.notes,
            "review_status": ScanReviewStatus.REVIEWED,
            "status": ScanReviewStatus.REVIEWED,
            "reviewed_by_doctor": True,
            "reviewed_by_name": doctor_name,
            "reviewed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )

    updated_scan = await scans_collection.find_one({"scan_id": scan_id})
    profile = await health_profiles_collection.find_one({"health_id": updated_scan["health_id"]})
    patient_name = profile.get("full_name", "Unknown") if profile else "Unknown"

    reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(updated_scan)

    return DoctorScanResponse(
        scan_id=updated_scan["scan_id"],
        health_id=updated_scan["health_id"],
        patient_name=patient_name,
        scan_type=updated_scan["scan_type"],
        image_url=updated_scan["image_url"],
        gradcam_url=updated_scan.get("gradcam_url"),
        upload_date=updated_scan["upload_date"],
        prediction=updated_scan.get("prediction"),
        confidence=updated_scan.get("confidence"),
        model_result=updated_scan.get("model_result"),
        abnormal_probability=updated_scan.get("abnormal_probability"),
        malignant_probability=updated_scan.get("malignant_probability"),
        severity=updated_scan.get("severity"),
        review_status=resolve_review_status(updated_scan),
        reviewed_by_doctor=reviewed_by_doctor,
        reviewed_by_name=reviewed_by_name,
        reviewed_at=updated_scan.get("reviewed_at"),
        doctor_notes=updated_scan.get("doctor_notes"),
        flagged_followup=updated_scan.get("flagged_followup")
    )


@router.post("/scans/{scan_id}/review", response_model=DoctorScanResponse)
async def submit_scan_review(
    scan_id: str,
    payload: DoctorScanReviewUpdate,
    current_user: dict = Depends(require_doctor)
):
    """
    Submit doctor review for a scan (notes + status).
    """
    scans_collection = get_scans_collection()
    health_profiles_collection = get_health_profiles_collection()

    scan = await scans_collection.find_one({"scan_id": scan_id})
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    doctor_id = current_user["id"]
    doctor_name = payload.reviewed_by_doctor or await get_doctor_name(doctor_id)

    has_remarks = bool(payload.doctor_notes and payload.doctor_notes.strip())
    effective_status = ScanReviewStatus.REVIEWED if has_remarks else payload.status

    update_fields = {
        "doctor_notes": payload.doctor_notes,
        "review_status": effective_status,
        "status": effective_status,
        "updated_at": datetime.utcnow()
    }

    if effective_status == ScanReviewStatus.REVIEWED:
        update_fields["reviewed_by_doctor"] = True
        update_fields["reviewed_by_name"] = doctor_name
        update_fields["reviewed_at"] = datetime.utcnow()
    else:
        update_fields["reviewed_by_doctor"] = None
        update_fields["reviewed_by_name"] = None
        update_fields["reviewed_at"] = None

    await scans_collection.update_one({"scan_id": scan_id}, {"$set": update_fields})

    updated_scan = await scans_collection.find_one({"scan_id": scan_id})
    profile = await health_profiles_collection.find_one({"health_id": updated_scan["health_id"]})
    patient_name = profile.get("full_name", "Unknown") if profile else "Unknown"

    reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(updated_scan)

    return DoctorScanResponse(
        scan_id=updated_scan["scan_id"],
        health_id=updated_scan["health_id"],
        patient_name=patient_name,
        scan_type=updated_scan["scan_type"],
        image_url=updated_scan["image_url"],
        gradcam_url=updated_scan.get("gradcam_url"),
        upload_date=updated_scan["upload_date"],
        prediction=updated_scan.get("prediction"),
        confidence=updated_scan.get("confidence"),
        model_result=updated_scan.get("model_result"),
        abnormal_probability=updated_scan.get("abnormal_probability"),
        malignant_probability=updated_scan.get("malignant_probability"),
        severity=updated_scan.get("severity"),
        review_status=resolve_review_status(updated_scan),
        reviewed_by_doctor=reviewed_by_doctor,
        reviewed_by_name=reviewed_by_name,
        reviewed_at=updated_scan.get("reviewed_at"),
        doctor_notes=updated_scan.get("doctor_notes"),
        flagged_followup=updated_scan.get("flagged_followup")
    )


@router.put("/scans/{scan_id}/status", response_model=DoctorScanResponse)
async def update_scan_status(
    scan_id: str,
    payload: DoctorScanStatusUpdate,
    current_user: dict = Depends(require_doctor)
):
    """
    Update scan review status.
    """
    scans_collection = get_scans_collection()
    health_profiles_collection = get_health_profiles_collection()

    scan = await scans_collection.find_one({"scan_id": scan_id})
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    doctor_id = current_user["id"]
    doctor_name = await get_doctor_name(doctor_id)

    effective_status = payload.status
    if payload.flagged_followup:
        effective_status = ScanReviewStatus.REVIEWED

    update_fields = {
        "review_status": effective_status,
        "status": effective_status,
        "updated_at": datetime.utcnow()
    }

    if effective_status == ScanReviewStatus.REVIEWED:
        update_fields["reviewed_by_doctor"] = True
        update_fields["reviewed_by_name"] = doctor_name
        update_fields["reviewed_at"] = datetime.utcnow()
    else:
        update_fields["reviewed_by_doctor"] = None
        update_fields["reviewed_by_name"] = None
        update_fields["reviewed_at"] = None

    if payload.flagged_followup is not None:
        update_fields["flagged_followup"] = payload.flagged_followup

    await scans_collection.update_one({"scan_id": scan_id}, {"$set": update_fields})

    updated_scan = await scans_collection.find_one({"scan_id": scan_id})
    profile = await health_profiles_collection.find_one({"health_id": updated_scan["health_id"]})
    patient_name = profile.get("full_name", "Unknown") if profile else "Unknown"

    reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(updated_scan)

    return DoctorScanResponse(
        scan_id=updated_scan["scan_id"],
        health_id=updated_scan["health_id"],
        patient_name=patient_name,
        scan_type=updated_scan["scan_type"],
        image_url=updated_scan["image_url"],
        gradcam_url=updated_scan.get("gradcam_url"),
        upload_date=updated_scan["upload_date"],
        prediction=updated_scan.get("prediction"),
        confidence=updated_scan.get("confidence"),
        model_result=updated_scan.get("model_result"),
        abnormal_probability=updated_scan.get("abnormal_probability"),
        malignant_probability=updated_scan.get("malignant_probability"),
        severity=updated_scan.get("severity"),
        review_status=resolve_review_status(updated_scan),
        reviewed_by_doctor=reviewed_by_doctor,
        reviewed_by_name=reviewed_by_name,
        reviewed_at=updated_scan.get("reviewed_at"),
        doctor_notes=updated_scan.get("doctor_notes"),
        flagged_followup=updated_scan.get("flagged_followup")
    )


@router.get("/dashboard/stats")
async def get_doctor_dashboard_stats(current_user: dict = Depends(require_doctor)):
    """
    Get dashboard statistics for the doctor.
    """
    doctor_id = current_user["id"]
    doctors_collection = get_doctors_collection()
    appointments_collection = get_appointments_collection()
    reports_collection = get_medical_reports_collection()
    scans_collection = get_scans_collection()
    
    doctor = await doctors_collection.find_one({"doctor_id": doctor_id})
    
    # Count today's appointments
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)
    
    today_appointments = await appointments_collection.count_documents({
        "doctor_id": doctor_id,
        "appointment_date": {"$gte": today_start, "$lte": today_end}
    })
    
    # Count upcoming appointments
    upcoming_appointments = await appointments_collection.count_documents({
        "doctor_id": doctor_id,
        "status": AppointmentStatus.SCHEDULED,
        "appointment_date": {"$gte": datetime.utcnow()}
    })
    
    # Count total patients consulted
    total_patients = await reports_collection.distinct("health_id", {"generated_by": doctor_id})

    # Scan review metrics
    total_screenings = await scans_collection.count_documents({})
    abnormal_cases = await scans_collection.count_documents({
        "$or": [
            {"model_result": {"$in": ["abnormal", "malignant"]}},
            {"prediction": {"$regex": "abnormal|malignant", "$options": "i"}}
        ]
    })
    pending_reviews = await scans_collection.count_documents({
        "$and": [
            {"review_status": ScanReviewStatus.PENDING},
            {"$or": [
                {"flagged_followup": {"$exists": False}},
                {"flagged_followup": False}
            ]},
            {"$or": [
                {"doctor_notes": {"$exists": False}},
                {"doctor_notes": None},
                {"doctor_notes": ""}
            ]},
            {"$or": [
                {"reviewed_by_doctor": {"$exists": False}},
                {"reviewed_by_doctor": False},
                {"reviewed_by_doctor": None}
            ]},
            {"$or": [
                {"reviewed_by_name": {"$exists": False}},
                {"reviewed_by_name": None},
                {"reviewed_by_name": ""}
            ]}
        ]
    })
    reviewed_cases = await scans_collection.count_documents({
        "review_status": ScanReviewStatus.REVIEWED
    })
    followup_cases = await scans_collection.count_documents({"flagged_followup": True})
    
    return {
        "total_consultations": doctor.get("total_consultations", 0),
        "total_patients": len(total_patients),
        "today_appointments": today_appointments,
        "upcoming_appointments": upcoming_appointments,
        "rating": doctor.get("rating", 0.0),
        "specialization": doctor["specialization"],
        "total_screenings": total_screenings,
        "abnormal_cases": abnormal_cases,
        "pending_reviews": pending_reviews,
        "reviewed_cases": reviewed_cases,
        "followup_cases": followup_cases
    }


@router.delete("/patients/{health_id}")
async def delete_patient(
    health_id: str,
    current_user: dict = Depends(require_doctor)
):
    """
    Delete a patient profile and all associated data (scans, reports, appointments, etc.).
    This is a destructive operation - use with caution.
    Only accessible by doctors for managing test/dummy accounts.
    """
    health_profiles_collection = get_health_profiles_collection()
    users_collection = get_users_collection()
    scans_collection = get_scans_collection()
    reports_collection = get_medical_reports_collection()
    appointments_collection = get_appointments_collection()
    chats_collection = get_chats_collection()
    patient_remarks_collection = get_patient_remarks_collection()
    appointment_notes_collection = get_appointment_notes_collection()
    
    # Verify patient exists
    patient = await health_profiles_collection.find_one({"health_id": health_id})
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Delete all associated data
    await scans_collection.delete_many({"health_id": health_id})
    await reports_collection.delete_many({"health_id": health_id})
    await appointments_collection.delete_many({"health_id": health_id})
    await chats_collection.delete_many({"health_id": health_id})
    await patient_remarks_collection.delete_many({"health_id": health_id})
    
    # Delete appointment notes where patient is involved
    await appointment_notes_collection.delete_many({"health_id": health_id})
    
    # Delete user account
    await users_collection.delete_one({"health_id": health_id})
    
    # Delete health profile
    await health_profiles_collection.delete_one({"health_id": health_id})
    
    return {
        "message": f"Patient {patient['full_name']} ({health_id}) and all associated data deleted successfully",
        "deleted_health_id": health_id
    }
