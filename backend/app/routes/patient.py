from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status, Request
from pathlib import Path
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from app.schemas.schemas import (
    ChatMessage, ChatResponse, ScanResponse, ScanType,
    MedicalReportCreate, MedicalReportResponse, HealthHistory,
    UserProfile, DoctorVisit, AppointmentResponse,
    ChatSessionSummary, ChatSessionResponse, ChatHistoryMessage,
    HospitalRecommendation, HospitalSearchRequest, LocationData
)
from app.schemas.history import RiskLevel
from app.services.history_service import create_scan_analysis_entry
from app.services.health_chain_service import hash_and_chain_report, hash_and_chain_scan
from app.routes.auth import require_patient, get_current_user
from app.database import get_consents_collection
from app.database import (
    get_chats_collection, get_scans_collection, 
    get_medical_reports_collection, get_health_profiles_collection,
    get_users_collection, get_appointments_collection,
    get_patient_remarks_collection, get_referrals_collection,
    get_notifications_collection, get_deletion_audit_collection
)
from app.utils.health_id import (
    generate_scan_id, generate_report_id, generate_chat_session_id
)
from app.utils.pdf_generator import generate_medical_report_pdf, generate_patient_data_export_pdf
from app.services.chat_service import ChatService
from app.config import settings
from datetime import datetime
from typing import List, Optional
import uuid
import asyncio
import logging

from pydantic import BaseModel, Field

try:
    from google.api_core.exceptions import ResourceExhausted
except Exception:
    ResourceExhausted = None

# Import lung scan service
try:
    from app.services import lung_scan_service
    LUNG_SCAN_AVAILABLE = True
except Exception as e:
    LUNG_SCAN_AVAILABLE = False
    print(f"Warning: Lung scan service not available: {e}")

# Import skin scan service
try:
    from app.services import skin_scan_service
    SKIN_SCAN_AVAILABLE = True
except Exception as e:
    SKIN_SCAN_AVAILABLE = False
    print(f"Warning: Skin scan service not available: {e}")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/patient", tags=["Patient"])


class DeleteAccountRequest(BaseModel):
    confirm: str = Field(..., description='Must be exactly "DELETE"')


def resolve_review_status(scan: dict) -> str:
    if scan.get("flagged_followup"):
        return "reviewed"
    if scan.get("doctor_notes"):
        return "reviewed"
    if scan.get("reviewed_by_doctor") or scan.get("reviewed_by_name"):
        return "reviewed"
    return scan.get("review_status") or scan.get("status") or "pending"


def resolve_reviewer_fields(scan: dict) -> tuple[Optional[bool], Optional[str]]:
    reviewed_by_value = scan.get("reviewed_by_doctor")
    reviewed_by_name = scan.get("reviewed_by_name")
    if isinstance(reviewed_by_value, str) and not reviewed_by_name:
        reviewed_by_name = reviewed_by_value
    reviewed_by_doctor = reviewed_by_value if isinstance(reviewed_by_value, bool) else bool(reviewed_by_value)
    if reviewed_by_name:
        reviewed_by_doctor = True
    return reviewed_by_doctor, reviewed_by_name
    
def resolve_probability(scan: dict) -> Optional[float]:
    direct_prob = scan.get("abnormal_probability")
    if direct_prob is None:
        direct_prob = scan.get("malignant_probability")
    if direct_prob is not None:
        return direct_prob / 100.0 if direct_prob > 1 else direct_prob

    confidence = scan.get("confidence")
    if confidence is not None:
        return confidence / 100.0 if confidence > 1 else confidence

    return None


def resolve_scan_risk(prediction: dict) -> RiskLevel:
    severity = (prediction.get("severity") or "").lower()
    if severity == "high":
        return RiskLevel.HIGH
    if severity == "moderate":
        return RiskLevel.MODERATE
    if severity == "low":
        return RiskLevel.LOW

    model_result = (prediction.get("model_result") or "").lower()
    if model_result in {"abnormal", "malignant"}:
        return RiskLevel.HIGH
    if model_result in {"normal", "benign"}:
        return RiskLevel.LOW

    return RiskLevel.NONE

# Initialize chat service
chat_service = ChatService()


@router.get("/profile", response_model=UserProfile)
async def get_patient_profile(current_user: dict = Depends(require_patient)):
    """
    Get current patient's profile information.
    """
    health_id = current_user["id"]
    health_profiles_collection = get_health_profiles_collection()
    users_collection = get_users_collection()
    
    profile = await health_profiles_collection.find_one({"health_id": health_id})
    user = await users_collection.find_one({"health_id": health_id})
    
    if not profile or not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    return UserProfile(
        health_id=profile["health_id"],
        full_name=profile["full_name"],
        email=user["email"],
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


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    message: ChatMessage,
    current_user: dict = Depends(require_patient)
):
    """
    Patient chat endpoint for symptom consultation with AI.
    
    Features:
    - Multi-turn conversation support with session management
    - Automatic patient profile context injection
    - Symptom detection and severity classification
    - Medical knowledge base integration (RAG) when enabled
    - Multi-language support
    
    The endpoint uses the configured AI provider (mock/OpenAI/Gemini)
    and can be swapped without frontend changes.
    """
    health_id = current_user["id"]
    
    try:
        # Extract location if provided
        location = None
        if message.location:
            location = (message.location.latitude, message.location.longitude)
        
        # Process message through chat service
        result = await chat_service.process_message(
            health_id=health_id,
            message=message.message,
            session_id=message.session_id,
            language=message.language,
            location=location,
            include_profile_context=message.include_profile_context and settings.ENABLE_PROFILE_CONTEXT,
            include_rag=message.include_rag and settings.ENABLE_RAG
        )
        
        # Convert to response model
        return ChatResponse(
            response=result["response"],
            language=result["language"],
            timestamp=result["timestamp"],
            session_id=result["session_id"],
            detected_symptoms=result.get("detected_symptoms"),
            severity_level=result.get("severity_level"),
            recommendations=result.get("recommendations"),
            model=result.get("model"),
            hospitals=result.get("hospitals"),
            should_offer_hospitals=result.get("should_offer_hospitals", False),
            hospital_recommendation_reason=result.get("hospital_recommendation_reason"),
            should_offer_report=result.get("should_offer_report", False),
            report_object=result.get("report_object")
        )
        
    except Exception as e:
        logger.exception("Chat processing failed")
        if ResourceExhausted and isinstance(e, ResourceExhausted):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI provider quota exceeded. Please wait and retry, or switch provider.",
                headers={"Retry-After": "60"}
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat message: {str(e)}"
        )


@router.post("/chat/stream")
async def chat_with_ai_stream(
    message: ChatMessage,
    current_user: dict = Depends(require_patient)
):
    """
    Streaming chat endpoint for real-time AI responses.
    Returns Server-Sent Events (SSE) for progressive response display.
    """
    
    if not settings.ENABLE_CHAT_STREAMING:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat streaming is not enabled"
        )
    
    health_id = current_user["id"]
    
    async def event_generator():
        try:
            # Build context (same as regular chat)
            from app.services.profile_service import ProfileService
            profile_service = ProfileService()
            
            context = None
            if message.include_profile_context and settings.ENABLE_PROFILE_CONTEXT:
                context = await profile_service.get_patient_context(health_id, include_full_history=True)
            
            # Get conversation history
            session_id = message.session_id or generate_chat_session_id()
            conversation_history = await chat_service.get_conversation_history(session_id)
            
            # Stream response
            full_response = ""
            async for chunk in chat_service.ai_service.get_streaming_completion(
                message=message.message,
                context=context,
                conversation_history=conversation_history
            ):
                full_response += chunk
                yield {
                    "event": "message",
                    "data": chunk
                }
            
            # Save complete conversation
            await chat_service.save_message(
                session_id=session_id,
                health_id=health_id,
                user_message=message.message,
                ai_response={"response": full_response},
                language=message.language
            )
            
            yield {
                "event": "done",
                "data": session_id
            }
            
        except Exception as e:
            yield {
                "event": "error",
                "data": str(e)
            }
    
    return EventSourceResponse(event_generator())


@router.get("/chat/sessions", response_model=List[ChatSessionSummary])
async def get_chat_sessions(
    current_user: dict = Depends(require_patient),
    limit: int = 20
):
    """
    Get all chat sessions for the current patient.
    Returns session summaries with message counts and previews.
    """
    health_id = current_user["id"]
    
    try:
        sessions = await chat_service.get_all_sessions(health_id, limit=limit)
        
        return [
            ChatSessionSummary(
                session_id=session["session_id"],
                started_at=session["started_at"],
                last_message_at=session["last_message_at"],
                message_count=session["message_count"],
                preview=session["preview"],
                symptoms=session.get("symptoms", [])
            )
            for session in sessions
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving chat sessions: {str(e)}"
        )


@router.get("/chat/session/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    session_id: str,
    current_user: dict = Depends(require_patient)
):
    """
    Get all messages from a specific chat session.
    Used to restore conversation history in the frontend.
    """
    health_id = current_user["id"]
    
    try:
        messages = await chat_service.get_session_messages(session_id, health_id)
        
        if not messages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found"
            )
        
        return ChatSessionResponse(
            session_id=session_id,
            messages=[
                ChatHistoryMessage(**msg)
                for msg in messages
            ],
            total_messages=len(messages)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving chat session: {str(e)}"
        )


@router.post("/chat/session/{session_id}/create-history")
async def create_history_from_session(
    session_id: str,
    current_user: dict = Depends(require_patient)
):
    """
    Create a medical history entry from a completed chat session.
    This should be called when a user completes a significant consultation.
    """
    health_id = current_user["id"]
    
    try:
        # Create history entry from the session
        history_entry = await chat_service.create_history_entry_from_session(
            session_id=session_id,
            health_id=health_id
        )
        
        if not history_entry:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session does not have sufficient data to create history entry"
            )
        
        return {
            "success": True,
            "message": "Medical history entry created successfully",
            "entry": history_entry
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating history entry: {str(e)}"
        )


@router.post("/scan", response_model=ScanResponse)
async def upload_scan(
    scan_type: ScanType = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_patient)
):
    """
    Upload medical scan for AI analysis.
    
    PLACEHOLDER: This endpoint will be integrated with AI/ML models later.
    Currently saves the file and returns a mock prediction.
    
    Future integration points:
    - X-ray analysis for fractures, pneumonia, etc.
    - MRI/CT scan analysis
    - Skin condition detection
    - Medical image preprocessing
    - Confidence scoring
    """
    health_id = current_user["id"]
    scans_collection = get_scans_collection()
    
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG/PNG images are allowed."
        )
    
    # Generate scan ID
    scan_id = generate_scan_id()
    
    # In production, save file to cloud storage (S3, Azure Blob, etc.)
    # For now, save locally and expose via static files
    file_extension = file.filename.split(".")[-1]
    image_url = f"/uploads/scans/{scan_id}.{file_extension}"

    uploads_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "scans"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    file_path = uploads_dir / f"{scan_id}.{file_extension}"
    
    # Read file contents
    contents = await file.read()
    file_path.write_bytes(contents)

    gradcam_url = None
    try:
        if scan_type == ScanType.SKIN and SKIN_SCAN_AVAILABLE:
            gradcam_url = skin_scan_service.generate_gradcam_overlay(contents, scan_id)
        elif scan_type == ScanType.XRAY and LUNG_SCAN_AVAILABLE:
            gradcam_url = lung_scan_service.generate_gradcam_overlay(contents, scan_id)
    except Exception as e:
        logger.warning(f"Failed to generate Grad-CAM overlay: {e}")
    
    # AI Model Integration for Lung Scans (X-ray)
    if scan_type == ScanType.XRAY and LUNG_SCAN_AVAILABLE:
        try:
            logger.info("Starting lung scan prediction...")
            # Use the lung scan model for prediction
            model_result = await lung_scan_service.predict_lung_scan(contents)
            
            # Extract model results
            result = model_result["result"]  # "normal" or "abnormal"
            abnormal_prob = model_result["abnormal_probability"]
            threshold = model_result["threshold_used"]
            
            # Get recommendations and severity
            recommendations = lung_scan_service.get_recommendations(result, abnormal_prob)
            severity = lung_scan_service.get_severity(result, abnormal_prob)
            
            # Format prediction data
            if result == "normal":
                confidence_percent = 100 - abnormal_prob  # Confidence in normal result
                prediction_text = "No significant abnormalities detected"
                findings = [
                    f"✓ Scan appears normal (confidence: {confidence_percent:.1f}%)",
                    "No suspicious patterns detected",
                    "Lung fields appear clear"
                ]
            else:
                confidence_percent = abnormal_prob  # Confidence in abnormal result
                prediction_text = f"Abnormality detected - {severity} risk"
                findings = [
                    f"⚠️ Abnormal patterns detected (probability: {abnormal_prob:.1f}%)",
                    f"Risk level: {severity}",
                    "Further medical evaluation recommended"
                ]
            
            prediction_data = {
                "prediction": prediction_text,
                "confidence": confidence_percent / 100.0,  # Convert back to 0-1 range
                "findings": findings,
                "recommendations": recommendations,
                "model_result": result,
                "abnormal_probability": abnormal_prob,
                "threshold_used": threshold,
                "severity": severity
            }
            
            logger.info(f"Lung scan analyzed: {result} (prob: {abnormal_prob}%)")
            
        except Exception as e:
            logger.error(f"Error in lung scan prediction: {e}", exc_info=True)
            print(f"DETAILED ERROR: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to placeholder if model fails
            prediction_data = {
                "prediction": "Analysis temporarily unavailable",
                "confidence": 0.0,
                "findings": ["Model prediction failed", "Manual review required"],
                "recommendations": ["Please consult with a radiologist", "Upload image may be retried"]
            }
    # AI Model Integration for Skin Scans
    elif scan_type == ScanType.SKIN and SKIN_SCAN_AVAILABLE:
        try:
            logger.info("Starting skin scan prediction...")
            # Use the skin scan model for prediction
            model_result = await skin_scan_service.predict_skin_scan(contents)
            
            # Extract model results
            result = model_result["result"]  # "benign" or "malignant"
            confidence = model_result["confidence"]
            malignant_prob = model_result["malignant_probability"]
            benign_prob = model_result["benign_probability"]
            
            # Get recommendations and severity
            recommendations = skin_scan_service.get_recommendations(result, malignant_prob)
            severity = skin_scan_service.get_severity(result, malignant_prob)
            
            # Format prediction data
            if result == "benign":
                prediction_text = "Benign (Non-cancerous)"
                findings = [
                    f"✓ Lesion appears benign (confidence: {confidence:.1f}%)",
                    f"Malignancy probability: {malignant_prob:.1f}%",
                    f"Risk level: {severity}"
                ]
            else:
                prediction_text = f"Malignant - {severity} risk"
                findings = [
                    f"⚠️ Potential malignancy detected (probability: {malignant_prob:.1f}%)",
                    f"Confidence: {confidence:.1f}%",
                    f"Risk level: {severity}",
                    "Professional evaluation urgently recommended"
                ]
            
            prediction_data = {
                "prediction": prediction_text,
                "confidence": confidence / 100.0,  # Convert to 0-1 range
                "findings": findings,
                "recommendations": recommendations,
                "model_result": result,
                "malignant_probability": malignant_prob,
                "severity": severity
            }
            
            logger.info(f"Skin scan analyzed: {result} (malignant prob: {malignant_prob}%)")
            
        except Exception as e:
            logger.error(f"Error in skin scan prediction: {e}", exc_info=True)
            print(f"DETAILED ERROR: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to placeholder if model fails
            prediction_data = {
                "prediction": "Analysis temporarily unavailable",
                "confidence": 0.0,
                "findings": ["Model prediction failed", "Manual review required"],
                "recommendations": ["Please consult with a dermatologist", "Upload image may be retried"]
            }
    else:
        # PLACEHOLDER AI PREDICTION for other scan types
        placeholder_predictions = {
            "x-ray": {
                "prediction": "Model not loaded",
                "confidence": 0.0,
                "findings": ["AI model unavailable", "Manual review required"],
                "recommendations": ["Consult with a radiologist"]
            },
            "mri": {
                "prediction": "Normal scan results",
                "confidence": 0.88,
                "findings": ["No significant abnormalities", "Normal tissue density"],
                "recommendations": ["Consult with specialist for detailed analysis"]
            },
            "ct-scan": {
                "prediction": "Analysis complete",
                "confidence": 0.85,
                "findings": ["Standard scan appearance"],
                "recommendations": ["Doctor review recommended"]
            },
            "skin": {
                "prediction": "Benign condition",
                "confidence": 0.90,
                "findings": ["No malignant features detected", "Common skin condition"],
                "recommendations": ["Monitor for changes", "Use recommended skincare"]
            },
            "other": {
                "prediction": "Image received",
                "confidence": 0.80,
                "findings": ["Manual review recommended"],
                "recommendations": ["Consult with appropriate specialist"]
            }
        }
        
        prediction_data = placeholder_predictions.get(scan_type, placeholder_predictions["other"])
    
    # Save scan record
    scan_doc = {
        "scan_id": scan_id,
        "health_id": health_id,
        "scan_type": scan_type,
        "image_url": image_url,
        "gradcam_url": gradcam_url,
        "heatmap_url": gradcam_url,
        "heatmap_generated": gradcam_url is not None,
        "upload_date": datetime.utcnow(),
        "prediction": prediction_data["prediction"],
        "probability": resolve_probability(prediction_data),
        "confidence": prediction_data["confidence"],
        "findings": prediction_data["findings"],
        "recommendations": prediction_data["recommendations"],
        "analyzed": True,  # Will be False until AI processes it
        "review_status": "pending",
        "status": "pending",
        "reviewed_by_doctor": None,
        "reviewed_at": None,
        "doctor_notes": None,
        # Scan specific fields (optional)
        "model_result": prediction_data.get("model_result"),
        "abnormal_probability": prediction_data.get("abnormal_probability"),
        "malignant_probability": prediction_data.get("malignant_probability"),
        "threshold_used": prediction_data.get("threshold_used"),
        "severity": prediction_data.get("severity"),
        # Referral fields (Step 2 — defaulted, set by referral router later)
        "referral_triggered": False,
        "referral_id": None,
    }

    await scans_collection.insert_one(scan_doc)

    try:
        await hash_and_chain_scan(scan_id=scan_id, patient_id=health_id)
    except Exception as exc:
        logger.warning("Failed to hash/chain scan %s (non-blocking): %s", scan_id, exc)

    # Silently log consent for scan upload (wrapped in try/except - must not affect scan upload)
    try:
        from datetime import datetime as dt
        from uuid import uuid4
        consent_collection = get_consents_collection()
        consent_record = {
            "consent_id": str(uuid4()),
            "patient_id": health_id,
            "consent_type": "scan_upload",
            "consented": True,
            "consent_version": "1.0",
            "timestamp": dt.utcnow(),
            "metadata": {"scan_id": scan_id, "scan_type": scan_type.value if hasattr(scan_type, 'value') else str(scan_type)}
        }
        await consent_collection.insert_one(consent_record)
        logger.info(f"Scan upload consent logged for scan {scan_id}")
    except Exception as e:
        logger.warning(f"Failed to log scan upload consent (non-blocking): {e}")

    try:
        findings = prediction_data.get("findings") or []
        summary = "; ".join(findings[:3]) if findings else (prediction_data.get("prediction") or "Scan analyzed")
        scan_type_value = scan_type.value if hasattr(scan_type, "value") else str(scan_type)
        await create_scan_analysis_entry(
            health_id=health_id,
            scan_type=scan_type_value,
            findings=summary,
            risk_level=resolve_scan_risk(prediction_data),
            confidence=prediction_data.get("confidence") or 0.0,
            scan_id=scan_id
        )
    except Exception as e:
        logger.warning(f"Failed to create scan history entry: {e}")
    
    reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(scan_doc)

    return ScanResponse(
        scan_id=scan_id,
        health_id=health_id,
        scan_type=scan_type,
        image_url=image_url,
        gradcam_url=gradcam_url,
        upload_date=scan_doc["upload_date"],
        prediction=prediction_data["prediction"],
        probability=scan_doc.get("probability"),
        confidence=prediction_data["confidence"],
        findings=prediction_data["findings"],
        recommendations=prediction_data["recommendations"],
        model_result=prediction_data.get("model_result"),
        abnormal_probability=prediction_data.get("abnormal_probability"),
        malignant_probability=prediction_data.get("malignant_probability"),
        threshold_used=prediction_data.get("threshold_used"),
        severity=prediction_data.get("severity"),
        review_status=resolve_review_status(scan_doc),
        reviewed_by_doctor=reviewed_by_doctor,
        reviewed_by_name=reviewed_by_name,
        reviewed_at=scan_doc.get("reviewed_at"),
        doctor_notes=scan_doc.get("doctor_notes")
    )


@router.post("/report/generate-from-chat/{session_id}")
async def generate_report_from_chat(
    session_id: str,
    current_user: dict = Depends(require_patient)
):
    """
    Generate a preliminary medical report from a chat session.
    User must explicitly request this after chat consultation.
    """
    health_id = current_user["id"]
    
    try:
        # Generate consultation summary
        conversation_summary = await chat_service.generate_consultation_summary(
            session_id=session_id,
            health_id=health_id
        )
        
        # Get patient profile data
        from app.services.profile_service import ProfileService
        profile_service = ProfileService()
        patient_profile_data = await profile_service.get_patient_summary(health_id)
        
        # Generate the report
        from app.services.report_service import ReportService
        report_service = ReportService()
        report_data = await report_service.generate_preliminary_report(
            health_id=health_id,
            session_id=session_id,
            conversation_summary=conversation_summary,
            patient_context=patient_profile_data
        )
        
        return {
            "success": True,
            "report_id": report_data["report_id"],
            "generated_date": report_data["generated_date"],
            "chief_complaint": report_data["chief_complaint"],
            "detected_symptoms": report_data["detected_symptoms"],
            "severity_level": report_data["severity_level"],
            "recommendations": report_data["recommendations"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating report: {str(e)}"
        )


@router.post("/report/generate", response_model=MedicalReportResponse)
async def generate_medical_report(
    report_data: MedicalReportCreate,
    current_user: dict = Depends(require_patient)
):
    """
    Generate a structured medical report.
    Can be used to create reports from consultation data, scan results, etc.
    """
    health_id = current_user["id"]
    
    # Verify the patient is creating report for themselves
    if report_data.health_id != health_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only generate reports for yourself"
        )
    
    reports_collection = get_medical_reports_collection()
    health_profiles_collection = get_health_profiles_collection()
    
    # Get patient name
    profile = await health_profiles_collection.find_one({"health_id": health_id})
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Generate report ID
    report_id = generate_report_id()
    
    # Create report document
    report_doc = {
        "report_id": report_id,
        "health_id": health_id,
        "patient_name": profile["full_name"],
        "report_type": report_data.report_type,
        "generated_date": datetime.utcnow(),
        "chief_complaint": report_data.chief_complaint,
        "vital_signs": report_data.vital_signs.dict() if report_data.vital_signs else None,
        "diagnosis": [d.dict() for d in report_data.diagnosis],
        "medications": [m.dict() for m in report_data.medications],
        "lab_results": report_data.lab_results,
        "doctor_notes": report_data.doctor_notes,
        "generated_by": None,  # Patient-generated
        "created_at": datetime.utcnow()
    }
    
    await reports_collection.insert_one(report_doc)

    try:
        await hash_and_chain_report(report_id=report_id, patient_id=health_id)
    except Exception as exc:
        logger.warning("Failed to hash/chain report %s (non-blocking): %s", report_id, exc)
    
    return MedicalReportResponse(
        report_id=report_id,
        health_id=health_id,
        patient_name=profile["full_name"],
        report_type=report_data.report_type,
        generated_date=report_doc["generated_date"],
        chief_complaint=report_data.chief_complaint,
        vital_signs=report_data.vital_signs,
        diagnosis=report_data.diagnosis,
        medications=report_data.medications,
        lab_results=report_data.lab_results,
        doctor_notes=report_data.doctor_notes,
        generated_by=None
    )


@router.get("/report/{report_id}")
async def get_report_detail(
    report_id: str,
    current_user: dict = Depends(require_patient)
):
    """
    Get detailed information for a specific medical report.
    """
    health_id = current_user["id"]
    reports_collection = get_medical_reports_collection()
    
    # Get report
    report = await reports_collection.find_one({"report_id": report_id})
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Verify patient owns this report
    if report["health_id"] != health_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return {
        "report_id": report["report_id"],
        "health_id": report["health_id"],
        "patient_name": report["patient_name"],
        "report_type": report["report_type"],
        "generated_date": report["generated_date"],
        "chief_complaint": report.get("chief_complaint"),
        "detected_symptoms": report.get("detected_symptoms", []),
        "severity_assessment": report.get("severity_assessment", {}),
        "recommendations": report.get("recommendations", []),
        "patient_age": report.get("patient_age"),
        "patient_gender": report.get("patient_gender"),
        "patient_blood_group": report.get("patient_blood_group"),
        "disclaimers": report.get("disclaimers", []),
        "shared_for_review": report.get("shared_for_review", False),
        "review_status": report.get("review_status", "pending"),
        "shared_at": report.get("shared_at"),
        "shared_scan_id": report.get("shared_scan_id")
    }


@router.post("/report/{report_id}/share")
async def share_report_with_doctor(
    report_id: str,
    current_user: dict = Depends(require_patient)
):
    """
    Share a report with a doctor for review.
    Creates a pending review request linked to the report.
    """
    health_id = current_user["id"]
    reports_collection = get_medical_reports_collection()
    scans_collection = get_scans_collection()

    report = await reports_collection.find_one({"report_id": report_id})
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    if report.get("health_id") != health_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if report.get("shared_for_review") is True:
        return {
            "shared": True,
            "scan_id": report.get("shared_scan_id"),
            "message": "Report already shared for review"
        }

    # If report includes a scan_id, prefer linking to that scan
    linked_scan_id = report.get("scan_id") or report.get("metadata", {}).get("scan_id")

    if linked_scan_id:
        await scans_collection.update_one(
            {"scan_id": linked_scan_id},
            {"$set": {
                "review_status": "pending",
                "status": "pending",
                "shared_for_review": True,
                "shared_at": datetime.utcnow(),
                "report_id": report_id,
                "updated_at": datetime.utcnow()
            }}
        )
        shared_scan_id = linked_scan_id
    else:
        # Create a minimal scan-like document so it appears in doctor pending reviews
        shared_scan_id = generate_scan_id()
        scan_doc = {
            "scan_id": shared_scan_id,
            "health_id": health_id,
            "scan_type": "other",
            "image_url": "",
            "upload_date": datetime.utcnow(),
            "prediction": "Report review",
            "review_status": "pending",
            "status": "pending",
            "shared_for_review": True,
            "shared_at": datetime.utcnow(),
            "report_id": report_id,
            "report_type": report.get("report_type"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            # Referral fields
            "referral_triggered": False,
            "referral_id": None,
        }
        await scans_collection.insert_one(scan_doc)

        try:
            await hash_and_chain_scan(scan_id=shared_scan_id, patient_id=health_id)
        except Exception as exc:
            logger.warning("Failed to hash/chain shared scan %s (non-blocking): %s", shared_scan_id, exc)

    await reports_collection.update_one(
        {"report_id": report_id},
        {"$set": {
            "shared_for_review": True,
            "review_status": "pending",
            "shared_at": datetime.utcnow(),
            "shared_scan_id": shared_scan_id,
            "updated_at": datetime.utcnow()
        }}
    )

    return {
        "shared": True,
        "scan_id": shared_scan_id
    }


@router.get("/report/{report_id}/pdf")
async def download_report_pdf(
    report_id: str,
    current_user: dict = Depends(require_patient)
):
    """
    Download medical report as PDF.
    """
    health_id = current_user["id"]
    reports_collection = get_medical_reports_collection()
    
    # Get report
    report = await reports_collection.find_one({"report_id": report_id})
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Verify patient owns this report
    if report["health_id"] != health_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Generate PDF
    pdf_buffer = generate_medical_report_pdf(report)
    
    # Return as streaming response
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=medical_report_{report_id}.pdf"
        }
    )


@router.get("/export")
async def export_my_data(
    current_user: dict = Depends(require_patient),
):
    """
    Export everything MediQ holds about the patient as a PDF.
    """
    health_id = current_user["id"]

    profiles_collection = get_health_profiles_collection()
    scans_collection = get_scans_collection()
    reports_collection = get_medical_reports_collection()
    referrals_collection = get_referrals_collection()
    consents_collection = get_consents_collection()

    profile = await profiles_collection.find_one({"health_id": health_id}, {"_id": 0}) or {}

    scans = await scans_collection.find({"health_id": health_id}, {"_id": 0}).sort("upload_date", -1).to_list(length=5000)
    reports = await reports_collection.find({"health_id": health_id}, {"_id": 0}).sort("generated_date", -1).to_list(length=5000)
    referrals = await referrals_collection.find({"patient_id": health_id}, {"_id": 0}).sort("created_at", -1).to_list(length=5000)
    consents = await consents_collection.find({"patient_id": health_id}, {"_id": 0}).sort("timestamp", -1).to_list(length=5000)

    export_data = {
        "profile": {
            "full_name": profile.get("full_name"),
            "health_id": profile.get("health_id") or health_id,
            "blood_group": profile.get("blood_group"),
            "age": profile.get("age"),
        },
        "scans": scans,
        "reports": reports,
        "referrals": referrals,
        "consents": consents,
    }

    pdf_buffer = generate_patient_data_export_pdf(export_data)
    filename = f"mediq_export_{health_id}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/delete-account")
async def delete_my_account(
    payload: DeleteAccountRequest,
    request: Request,
    current_user: dict = Depends(require_patient),
):
    """
    Delete patient account and associated data, leaving an audit record for DPDP compliance.
    """
    if payload.confirm != "DELETE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Confirmation must be exactly "DELETE"',
        )

    health_id = current_user["id"]

    scans_collection = get_scans_collection()
    reports_collection = get_medical_reports_collection()
    referrals_collection = get_referrals_collection()
    consents_collection = get_consents_collection()
    notifications_collection = get_notifications_collection()
    users_collection = get_users_collection()
    profiles_collection = get_health_profiles_collection()
    deletion_audit_collection = get_deletion_audit_collection()

    audit_id = str(uuid.uuid4())
    now = datetime.utcnow()

    audit_doc = {
        "audit_id": audit_id,
        "patient_id": health_id,
        "requested_at": now,
        "status": "started",
        "request_ip": getattr(getattr(request, "client", None), "host", None),
        "user_agent": request.headers.get("user-agent"),
        "deleted_counts": {},
    }
    await deletion_audit_collection.insert_one(audit_doc)

    deleted_counts: dict[str, int] = {}
    try:
        deleted_counts["scans"] = (await scans_collection.delete_many({"health_id": health_id})).deleted_count
        deleted_counts["reports"] = (await reports_collection.delete_many({"health_id": health_id})).deleted_count
        deleted_counts["referrals"] = (await referrals_collection.delete_many({"patient_id": health_id})).deleted_count
        deleted_counts["consents"] = (await consents_collection.delete_many({"patient_id": health_id})).deleted_count
        deleted_counts["notifications"] = (await notifications_collection.delete_many({"patient_id": health_id})).deleted_count
        deleted_counts["profile"] = (await profiles_collection.delete_many({"health_id": health_id})).deleted_count
        deleted_counts["user"] = (await users_collection.delete_many({"health_id": health_id})).deleted_count

        await deletion_audit_collection.update_one(
            {"audit_id": audit_id},
            {"$set": {"status": "completed", "completed_at": datetime.utcnow(), "deleted_counts": deleted_counts}},
        )
    except Exception as exc:
        await deletion_audit_collection.update_one(
            {"audit_id": audit_id},
            {"$set": {"status": "failed", "failed_at": datetime.utcnow(), "error": str(exc), "deleted_counts": deleted_counts}},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account",
        )

    return {"success": True, "audit_id": audit_id}


@router.get("/history", response_model=HealthHistory)
async def get_health_history(
    current_user: dict = Depends(require_patient),
    limit: int = 10
):
    """
    Get complete medical history for the patient.
    Includes visits, scans, reports, and appointments.
    """
    health_id = current_user["id"]
    
    health_profiles_collection = get_health_profiles_collection()
    reports_collection = get_medical_reports_collection()
    scans_collection = get_scans_collection()
    appointments_collection = get_appointments_collection()
    
    # Get profile
    profile = await health_profiles_collection.find_one({"health_id": health_id})
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    # Include probability in the scan document
    scan_doc["probability"] = resolve_probability(prediction_data)
    
    # Get recent reports with doctor visits
    reports_cursor = reports_collection.find(
        {"health_id": health_id}
    ).sort("generated_date", -1).limit(limit)
    reports = await reports_cursor.to_list(length=limit)
    
    recent_reports = []
    recent_visits = []
    
    for report in reports:
        report_response = MedicalReportResponse(
            report_id=report["report_id"],
            health_id=report["health_id"],
            patient_name=report["patient_name"],
            report_type=report["report_type"],
            generated_date=report["generated_date"],
            chief_complaint=report.get("chief_complaint"),
            vital_signs=report.get("vital_signs"),
            diagnosis=[],  # Simplified for listing
            medications=[],  # Simplified for listing
            lab_results=report.get("lab_results"),
            doctor_notes=report.get("doctor_notes"),
            generated_by=report.get("generated_by")
        )
        recent_reports.append(report_response)
        
        # If generated by doctor, add to visits
        if report.get("generated_by"):
            visit = DoctorVisit(
                visit_id=report["report_id"],
                health_id=report["health_id"],
                doctor_id=report["generated_by"],
                doctor_name="Dr. " + report.get("doctor_name", "Unknown"),
                date=report["generated_date"],
                diagnosis=[],
                medications=[],
                visit_notes=report.get("doctor_notes")
            )
            recent_visits.append(visit)
    
    # Get recent scans
    scans_cursor = scans_collection.find(
        {"health_id": health_id}
    ).sort("upload_date", -1).limit(limit)
    scans = await scans_cursor.to_list(length=limit)
    
    recent_scans = []
    for scan in scans:
        reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(scan)
        recent_scans.append(
            ScanResponse(
                scan_id=scan["scan_id"],
                health_id=scan["health_id"],
                scan_type=scan["scan_type"],
                image_url=scan["image_url"],
                upload_date=scan["upload_date"],
                prediction=scan.get("prediction"),
                probability=resolve_probability(scan),
                confidence=scan.get("confidence"),
                findings=scan.get("findings"),
                recommendations=scan.get("recommendations"),
                review_status=resolve_review_status(scan),
                reviewed_by_doctor=reviewed_by_doctor,
                reviewed_by_name=reviewed_by_name,
                reviewed_at=scan.get("reviewed_at"),
                doctor_notes=scan.get("doctor_notes")
            )
        )
    
    # Get upcoming appointments
    appointments_cursor = appointments_collection.find({
        "health_id": health_id,
        "status": "scheduled",
        "appointment_date": {"$gte": datetime.utcnow()}
    }).sort("appointment_date", 1).limit(limit)
    appointments = await appointments_cursor.to_list(length=limit)
    
    upcoming_appointments = [
        AppointmentResponse(
            appointment_id=apt["appointment_id"],
            health_id=apt["health_id"],
            patient_name=profile["full_name"],
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
    
    # Get total counts
    total_reports = await reports_collection.count_documents({"health_id": health_id})
    total_scans = await scans_collection.count_documents({"health_id": health_id})
    total_visits = len(recent_visits)
    
    return HealthHistory(
        health_id=health_id,
        patient_name=profile["full_name"],
        age=profile["age"],
        gender=profile["gender"],
        blood_group=profile["blood_group"],
        recent_visits=recent_visits,
        recent_scans=recent_scans,
        recent_reports=recent_reports,
        upcoming_appointments=upcoming_appointments,
        total_visits=total_visits,
        total_scans=total_scans,
        total_reports=total_reports
    )


@router.get("/scans", response_model=List[ScanResponse])
async def get_patient_scans(
    current_user: dict = Depends(require_patient),
    limit: int = 20
):
    """Get all scans for the current patient"""
    health_id = current_user["id"]
    scans_collection = get_scans_collection()
    
    scans_cursor = scans_collection.find(
        {"health_id": health_id}
    ).sort("upload_date", -1).limit(limit)
    scans = await scans_cursor.to_list(length=limit)
    
    results = []
    for scan in scans:
        reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(scan)
        results.append(
            ScanResponse(
                scan_id=scan["scan_id"],
                health_id=scan["health_id"],
                scan_type=scan["scan_type"],
                image_url=scan["image_url"],
                upload_date=scan["upload_date"],
                prediction=scan.get("prediction"),
                probability=resolve_probability(scan),
                confidence=scan.get("confidence"),
                findings=scan.get("findings"),
                recommendations=scan.get("recommendations"),
                review_status=resolve_review_status(scan),
                reviewed_by_doctor=reviewed_by_doctor,
                reviewed_by_name=reviewed_by_name,
                reviewed_at=scan.get("reviewed_at"),
                doctor_notes=scan.get("doctor_notes")
            )
        )
    return results


@router.get("/scans/{scan_id}", response_model=ScanResponse)
async def get_patient_scan_detail(
    scan_id: str,
    current_user: dict = Depends(require_patient)
):
    """Get a specific scan detail for the current patient"""
    health_id = current_user["id"]
    scans_collection = get_scans_collection()

    scan = await scans_collection.find_one({"scan_id": scan_id})
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    if scan.get("health_id") != health_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    reviewed_by_doctor, reviewed_by_name = resolve_reviewer_fields(scan)

    return ScanResponse(
        scan_id=scan["scan_id"],
        health_id=scan["health_id"],
        scan_type=scan["scan_type"],
        image_url=scan["image_url"],
        gradcam_url=scan.get("gradcam_url"),
        upload_date=scan["upload_date"],
        prediction=scan.get("prediction"),
        probability=resolve_probability(scan),
        confidence=scan.get("confidence"),
        findings=scan.get("findings"),
        recommendations=scan.get("recommendations"),
        model_result=scan.get("model_result"),
        abnormal_probability=scan.get("abnormal_probability"),
        malignant_probability=scan.get("malignant_probability"),
        threshold_used=scan.get("threshold_used"),
        severity=scan.get("severity"),
        review_status=resolve_review_status(scan),
        reviewed_by_doctor=reviewed_by_doctor,
        reviewed_by_name=reviewed_by_name,
        reviewed_at=scan.get("reviewed_at"),
        doctor_notes=scan.get("doctor_notes")
    )


@router.get("/reports", response_model=List[MedicalReportResponse])
async def get_patient_reports(
    current_user: dict = Depends(require_patient),
    limit: int = 20
):
    """Get all medical reports for the current patient"""
    health_id = current_user["id"]
    reports_collection = get_medical_reports_collection()
    
    reports_cursor = reports_collection.find(
        {"health_id": health_id}
    ).sort("generated_date", -1).limit(limit)
    reports = await reports_cursor.to_list(length=limit)
    
    return [
        MedicalReportResponse(
            report_id=report["report_id"],
            health_id=report["health_id"],
            patient_name=report["patient_name"],
            report_type=report["report_type"],
            generated_date=report["generated_date"],
            chief_complaint=report.get("chief_complaint"),
            vital_signs=report.get("vital_signs"),
            diagnosis=[],
            medications=[],
            lab_results=report.get("lab_results"),
            doctor_notes=report.get("doctor_notes"),
            generated_by=report.get("generated_by")
        )
        for report in reports
    ]


@router.get("/remarks")
async def get_patient_remarks(
    current_user: dict = Depends(require_patient),
    limit: int = 50
):
    """
    Get all doctor remarks for the current patient.
    These are observations, warnings, and notes added by doctors during consultations.
    """
    health_id = current_user["id"]
    patient_remarks_collection = get_patient_remarks_collection()
    
    remarks_cursor = patient_remarks_collection.find(
        {"health_id": health_id}
    ).sort("created_at", -1).limit(limit)
    remarks = await remarks_cursor.to_list(length=limit)
    
    return [
        {
            "remark_id": remark["remark_id"],
            "doctor_id": remark["doctor_id"],
            "doctor_name": remark["doctor_name"],
            "remark": remark["remark"],
            "category": remark.get("category", "general"),
            "created_at": remark["created_at"],
            "updated_at": remark["updated_at"]
        }
        for remark in remarks
    ]


@router.post("/hospitals/search", response_model=List[HospitalRecommendation])
async def search_nearby_hospitals(
    request: HospitalSearchRequest,
    current_user: dict = Depends(require_patient)
):
    """
    Search for nearby hospitals based on location and symptoms.
    Called when user confirms they want to see hospital recommendations.
    """
    from app.services.hospital_service import HospitalService
    
    hospital_service = HospitalService()
    
    try:
        hospitals = await hospital_service.get_nearby_hospitals(
            latitude=request.latitude,
            longitude=request.longitude,
            symptoms=request.symptoms or [],
            severity_level=request.severity_level or "moderate",
            max_distance_km=10.0,
            limit=8  # Show more for horizontal scroll
        )
        
        return [
            HospitalRecommendation(**hospital)
            for hospital in hospitals
        ]
    
    except Exception as e:
        logger.exception("Hospital search failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching hospitals: {str(e)}"
        )
