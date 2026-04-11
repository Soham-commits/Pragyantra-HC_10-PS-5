"""
Report Generation Service
Generates structured preliminary medical reports from chat consultations
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from app.database import get_medical_reports_collection, get_health_profiles_collection
from app.utils.health_id import generate_report_id
from app.services.history_service import create_medical_report_entry
from app.services.health_chain_service import hash_and_chain_report
from app.schemas.history import RiskLevel
import logging

logger = logging.getLogger(__name__)


class ReportService:
    """Service for generating preliminary medical reports from chat consultations"""
    
    @staticmethod
    def should_generate_report(
        message_count: int,
        severity_level: str,
        symptoms: List[str]
    ) -> bool:
        """
        Determine if a preliminary report should be generated.
        
        Args:
            message_count: Number of messages in conversation
            severity_level: Severity level
            symptoms: Detected symptoms
            
        Returns:
            Boolean indicating if report should be generated
        """
        # Generate report if:
        # 1. Conversation has enough context (5+ exchanges) AND severity is identified
        # 2. High severity with at least a few exchanges
        # 3. Many symptoms detected with enough context
        
        if not severity_level or severity_level not in ["low", "moderate", "high"]:
            return False
        
        if severity_level == "high" and message_count >= 4 and len(symptoms) >= 2:
            return True
        
        if message_count >= 5 and severity_level in ["moderate", "high"] and len(symptoms) >= 2:
            return True
        
        if len(symptoms) >= 5 and message_count >= 4:
            return True
        
        return False
    
    @staticmethod
    async def generate_preliminary_report(
        health_id: str,
        session_id: str,
        conversation_summary: Dict[str, Any],
        patient_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a structured preliminary medical report from chat consultation.
        
        Args:
            health_id: Patient's health ID
            session_id: Chat session ID
            conversation_summary: Summary from ChatService
            patient_context: Patient profile data
            
        Returns:
            Generated report data
        """
        
        reports_collection = get_medical_reports_collection()
        health_profiles_collection = get_health_profiles_collection()
        
        profile = await health_profiles_collection.find_one({"health_id": health_id})
        patient_name = "N/A"
        patient_age = None
        patient_gender = None
        patient_blood_group = None

        if profile:
            patient_name = profile.get("full_name", "N/A")
            patient_age = profile.get("age")
            patient_gender = profile.get("gender")
            patient_blood_group = profile.get("blood_group")
        elif patient_context:
            patient_name = patient_context.get("name", "N/A")
            patient_age = patient_context.get("age")
            patient_gender = patient_context.get("gender")
        
        # Generate report ID
        report_id = generate_report_id()
        
        summary = conversation_summary or {}

        # Build report structure
        report = {
            "report_id": report_id,
            "health_id": health_id,
            "patient_name": patient_name,
            "report_type": "Preliminary AI Screening",
            "generated_date": datetime.utcnow(),
            "source": "ai_chatbot",
            "session_id": session_id,
            
            # Patient demographics
            "patient_age": patient_age,
            "patient_gender": patient_gender,
            "patient_blood_group": patient_blood_group,
            
            # Chief complaint from conversation
            "chief_complaint": summary.get("conversation_preview", ""),

            # Consultation summary
            "consultation_summary": summary.get("consultation_summary", ""),
            
            # Detected symptoms
            "detected_symptoms": summary.get("detected_symptoms", []),

            # Reported symptoms (alias for downstream consumers like PDF)
            "reported_symptoms": summary.get("detected_symptoms", []),

            # Reported symptom durations
            "symptom_duration": summary.get("symptom_durations", []),
            
            # Severity assessment
            "severity_assessment": {
                "level": summary.get("overall_severity", "moderate"),
                "confidence": "preliminary",
                "basis": "AI symptom analysis"
            },

            # Probability/confidence (if provided by the AI report object)
            "confidence_score": summary.get("confidence_score"),
            "probability_label": summary.get("probability_label"),
            
            # Recommendations
            "recommendations": summary.get("recommendations", []),
            
            # Important disclaimers
            "disclaimers": [
                "This is a preliminary AI-assisted screening, NOT a medical diagnosis",
                "Please consult a qualified healthcare professional for proper diagnosis",
                "Do not use this report to self-medicate",
                "Seek immediate medical attention if symptoms worsen"
            ],
            
            # Metadata
            "ai_model": "screening_assistant",
            "conversation_duration_messages": summary.get("duration_messages", 0),
            "generated_by": "AI_CHATBOT",
            "reviewed_by_doctor": False,
            "doctor_notes": None,
            "shared_for_review": False,
            "review_status": "pending",
            "shared_at": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Add patient context if available
        if patient_context:
            report["patient_context"] = {
                "bmi": patient_context.get("bmi"),
                "recent_conditions": patient_context.get("recent_conditions", [])[:3],
                "current_medications": patient_context.get("current_medications", [])[:5]
            }
        
        # Save report to database
        await reports_collection.insert_one(report)

        try:
            await hash_and_chain_report(report_id=report_id, patient_id=health_id)
        except Exception as exc:
            logger.warning("Failed to hash/chain report %s (non-blocking): %s", report_id, exc)
        
        # Create medical history entry
        severity_to_risk = {
            "low": RiskLevel.LOW,
            "moderate": RiskLevel.MODERATE,
            "high": RiskLevel.HIGH
        }
        risk_level = severity_to_risk.get(
            report["severity_assessment"]["level"],
            RiskLevel.MODERATE
        )
        
        try:
            await create_medical_report_entry(
                health_id=health_id,
                report_title=report["report_type"],
                summary=f"Generated from chatbot consultation. {len(report['detected_symptoms'])} symptoms detected. {report['severity_assessment']['level'].title()} severity.",
                risk_level=risk_level,
                report_id=report_id,
                diagnosis=None
            )
        except Exception as e:
            print(f"Failed to create history entry for report: {e}")
        
        return {
            "report_id": report_id,
            "generated_date": report["generated_date"],
            "report_type": report["report_type"],
            "chief_complaint": report["chief_complaint"],
            "detected_symptoms": report["detected_symptoms"],
            "severity_level": report["severity_assessment"]["level"],
            "recommendations": report["recommendations"]
        }
    
    @staticmethod
    def format_report_for_display(report: Dict[str, Any]) -> str:
        """
        Format report as readable text for AI response.
        
        Args:
            report: Report data dictionary
            
        Returns:
            Formatted report string
        """
        
        lines = [
            "📋 PRELIMINARY MEDICAL SCREENING REPORT",
            "=" * 50,
            f"Report ID: {report['report_id']}",
            f"Date: {report['generated_date'].strftime('%Y-%m-%d %H:%M')}",
            "",
            "⚠️ IMPORTANT DISCLAIMER:",
            "This is a preliminary AI screening, NOT a diagnosis.",
            "Please consult a healthcare professional.",
            "",
            f"Chief Complaint: {report['chief_complaint'][:100]}",
            "",
            "Detected Symptoms:",
        ]
        
        for symptom in report['detected_symptoms']:
            lines.append(f"  • {symptom}")
        
        lines.extend([
            "",
            f"Severity Assessment: {report['severity_level'].upper()}",
            "",
            "Recommendations:",
        ])
        
        for rec in report['recommendations'][:5]:
            lines.append(f"  • {rec}")
        
        lines.extend([
            "",
            "🏥 Next Steps:",
            "  • Consult a doctor for proper diagnosis",
            "  • Keep monitoring your symptoms",
            "  • Seek immediate care if symptoms worsen",
            "",
            f"This report is saved to your medical records (ID: {report['report_id']})"
        ])
        
        return "\n".join(lines)
