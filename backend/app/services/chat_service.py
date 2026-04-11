"""
Chat Service - Orchestrates AI conversations with context enrichment
"""

from typing import Dict, Any, Optional, List, Tuple
import re
import json
from datetime import datetime
from app.services.ai_service import AIService
from app.services.profile_service import ProfileService
from app.services.rag_service import RAGService
from app.services.hospital_service import HospitalService
from app.services.report_service import ReportService
from app.services.history_service import create_chatbot_screening_entry
from app.schemas.history import RiskLevel
from app.database import get_chats_collection
from app.utils.health_id import generate_chat_session_id
from app.config import settings


class ChatService:
    """
    Main orchestration service for chat functionality.
    Coordinates AI service, profile context, RAG retrieval, and persistence.
    """
    
    def __init__(self):
        self.ai_service = AIService()
        self.hospital_service = HospitalService()
        self.report_service = ReportService()
        self.profile_service = ProfileService()
        # Initialize RAG service (reads config from settings)
        self.rag_service = RAGService()

    @staticmethod
    def _extract_report_object(response_text: str) -> Tuple[str, Optional[Dict[str, Any]]]:
        marker_chat = "SECTION 1: CHAT_RESPONSE"
        marker_report = "SECTION 2: REPORT_OBJECT"
        lower_text = response_text.lower()

        idx_chat = lower_text.find(marker_chat.lower())
        idx_report = lower_text.find(marker_report.lower())

        if idx_chat == -1 or idx_report == -1 or idx_report <= idx_chat:
            return response_text.strip(), None

        chat_section = response_text[idx_chat + len(marker_chat):idx_report].strip()
        report_section = response_text[idx_report + len(marker_report):].strip()
        report_section = report_section.lstrip("- \n\r\t")

        try:
            report_object = json.loads(report_section)
        except json.JSONDecodeError:
            return chat_section or response_text.strip(), None

        return chat_section or response_text.strip(), report_object

    @staticmethod
    def _ensure_list(value: Any) -> List[Any]:
        return value if isinstance(value, list) else []

    @staticmethod
    def _normalize_symptoms(symptoms: Any) -> List[str]:
        normalized: List[str] = []
        for item in ChatService._ensure_list(symptoms):
            if isinstance(item, dict):
                symptom_value = item.get("symptom") or item.get("name")
                if symptom_value:
                    normalized.append(str(symptom_value))
                continue
            if item is None:
                continue
            normalized.append(str(item))
        return normalized
    
    async def process_message(
        self,
        health_id: str,
        message: str,
        session_id: Optional[str] = None,
        language: str = "en",
        location: Optional[Tuple[float, float]] = None,
        include_profile_context: bool = True,
        include_rag: bool = False
    ) -> Dict[str, Any]:
        """
        Process a chat message with full context enrichment.
        
        Args:
            health_id: Patient's health ID
            message: User's message
            session_id: Existing session ID or None for new session
            language: Language code (en, hi, es, etc.)
            location: Optional (latitude, longitude) tuple for hospital recommendations
            include_profile_context: Whether to inject patient profile
            include_rag: Whether to use RAG for knowledge retrieval
            
        Returns:
            Dict containing AI response, hospitals, and report info
        """
        
        # Create or use existing session
        if not session_id:
            session_id = generate_chat_session_id()
        
        # Retrieve conversation history
        conversation_history = await self.get_conversation_history(session_id)
        message_count = len(conversation_history) // 2 + 1  # Approximate message pairs
        
        # Build context
        context_parts = []
        patient_profile_data = None
        
        # Add patient profile context
        if include_profile_context:
            profile_context = await self.profile_service.get_patient_context(
                health_id=health_id,
                include_full_history=True
            )
            if profile_context:
                context_parts.append(profile_context)
            
            # Get structured profile for report generation
            patient_profile_data = await self.profile_service.get_patient_summary(health_id)
        
        # Add RAG context (if enabled and requested)
        if include_rag and self.rag_service.enabled:
            # Extract symptoms from message for better RAG retrieval
            rag_context = await self.rag_service.retrieve_context(
                symptoms=[],  # Will be populated by AI response
                patient_age=patient_profile_data.get("age", 0) if patient_profile_data else 0,
                patient_gender=patient_profile_data.get("gender", "unknown") if patient_profile_data else "unknown"
            )
            if rag_context:
                context_parts.append(rag_context)
        
        combined_context = "\n\n".join(context_parts) if context_parts else None
        
        # Get AI response
        ai_response = await self.ai_service.get_completion(
            message=message,
            context=combined_context,
            conversation_history=conversation_history
        )
        
        raw_response = ai_response.get("response", "")
        chat_response, report_object = self._extract_report_object(raw_response)
        ai_response["raw_response"] = raw_response
        ai_response["response"] = chat_response
        ai_response["report_object"] = report_object

        detected_symptoms = ai_response.get("detected_symptoms", [])
        severity_level = ai_response.get("severity_level")

        if report_object:
            symptoms_data = report_object.get("symptoms_and_signals", {})
            detected_symptoms = symptoms_data.get("details", []) if symptoms_data.get("detected") else []
            snapshot = report_object.get("clinical_snapshot", {})
            severity_value = snapshot.get("severity")
            if severity_value in ["low", "moderate", "high"]:
                severity_level = severity_value
            else:
                severity_level = None

            recommendations = report_object.get("care_plan_next_steps", [])
            ai_response["recommendations"] = self._ensure_list(recommendations)
            ai_response["detected_symptoms"] = self._ensure_list(detected_symptoms)
            ai_response["severity_level"] = severity_level

        detected_symptoms = self._normalize_symptoms(detected_symptoms)
        ai_response["detected_symptoms"] = detected_symptoms
        ai_response["recommendations"] = self._ensure_list(ai_response.get("recommendations"))
        
        # Check if hospital recommendation should be offered (but don't fetch yet)
        should_offer_hospitals = False
        hospital_reason = None
        hospitals = None
        
        if location:
            should_offer_hospitals, reason = self.hospital_service.should_recommend_hospital(
                severity_level=severity_level,
                symptoms=detected_symptoms
            )
            hospital_reason = reason if should_offer_hospitals else None
        
        # Check if we should offer to generate a report (but don't auto-generate)
        should_offer_report = self.report_service.should_generate_report(
            message_count=message_count,
            severity_level=severity_level,
            symptoms=detected_symptoms
        )
        
        # Save conversation to database
        await self.save_message(
            session_id=session_id,
            health_id=health_id,
            user_message=message,
            ai_response=ai_response,
            language=language
        )
        
        # Build complete response
        ai_response["session_id"] = session_id
        ai_response["language"] = language
        ai_response["hospitals"] = hospitals
        ai_response["should_offer_hospitals"] = should_offer_hospitals
        ai_response["hospital_recommendation_reason"] = hospital_reason
        ai_response["should_offer_report"] = should_offer_report
        ai_response["detected_symptoms"] = detected_symptoms
        ai_response["severity_level"] = severity_level
        
        return ai_response
    
    async def save_message(
        self,
        session_id: str,
        health_id: str,
        user_message: str,
        ai_response: Dict[str, Any],
        language: str = "en"
    ) -> None:
        """
        Save chat message to database.
        
        Args:
            session_id: Chat session ID
            health_id: Patient's health ID
            user_message: User's message
            ai_response: AI response dict
            language: Language code
        """
        chats_collection = get_chats_collection()
        
        def ensure_list(value: Any) -> List[Any]:
            return value if isinstance(value, list) else []

        chat_doc = {
            "session_id": session_id,
            "health_id": health_id,
            "user_message": user_message,
            "ai_response": ai_response.get("response", ""),
            "raw_response": ai_response.get("raw_response"),
            "detected_symptoms": ensure_list(ai_response.get("detected_symptoms")),
            "severity_level": ai_response.get("severity_level"),
            "recommendations": ensure_list(ai_response.get("recommendations")),
            "report_object": ai_response.get("report_object"),
            "language": language,
            "model": ai_response.get("model", "unknown"),
            "timestamp": datetime.utcnow(),
            "usage": ai_response.get("usage")  # Token usage if available
        }
        
        await chats_collection.insert_one(chat_doc)
    
    async def get_conversation_history(
        self,
        session_id: str,
        max_messages: int = 10
    ) -> List[Dict[str, str]]:
        """
        Retrieve conversation history for a session.
        
        Args:
            session_id: Chat session ID
            max_messages: Maximum number of messages to retrieve
            
        Returns:
            List of messages in format [{"role": "user/assistant", "content": "..."}]
        """
        chats_collection = get_chats_collection()
        
        cursor = chats_collection.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).limit(max_messages)
        
        messages = await cursor.to_list(length=max_messages)
        
        def normalize_response(value: Any) -> str:
            if isinstance(value, dict):
                return str(value.get("response") or value.get("message") or "")
            if value is None:
                return ""
            return str(value)

        # Convert to OpenAI-style message format
        conversation = []
        for msg in messages:
            conversation.append({
                "role": "user",
                "content": str(msg.get("user_message") or "")
            })
            conversation.append({
                "role": "assistant",
                "content": normalize_response(msg.get("ai_response"))
            })
        
        return conversation
    
    async def get_session_messages(
        self,
        session_id: str,
        health_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get all messages in a chat session (for frontend display).
        
        Args:
            session_id: Chat session ID
            health_id: Patient's health ID (for authorization)
            
        Returns:
            List of message dicts with full details
        """
        chats_collection = get_chats_collection()
        
        cursor = chats_collection.find({
            "session_id": session_id,
            "health_id": health_id
        }).sort("timestamp", 1)
        
        messages = await cursor.to_list(length=100)
        
        def normalize_response(value: Any) -> str:
            if isinstance(value, dict):
                return str(value.get("response") or value.get("message") or "")
            if value is None:
                return ""
            return str(value)

        def ensure_list(value: Any) -> List[Any]:
            return value if isinstance(value, list) else []

        sanitized_messages = []
        for msg in messages:
            user_message = msg.get("user_message")
            ai_response = normalize_response(msg.get("ai_response"))

            if not user_message and not ai_response:
                continue

            sanitized_messages.append({
                "user_message": str(user_message or ""),
                "ai_response": ai_response,
                "detected_symptoms": ensure_list(msg.get("detected_symptoms")),
                "severity_level": msg.get("severity_level"),
                "recommendations": ensure_list(msg.get("recommendations")),
                "report_object": msg.get("report_object"),
                "timestamp": msg.get("timestamp") or datetime.utcnow(),
                "language": msg.get("language", "en")
            })

        return sanitized_messages
    
    async def get_all_sessions(
        self,
        health_id: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get all chat sessions for a patient.
        
        Args:
            health_id: Patient's health ID
            limit: Maximum number of sessions to return
            
        Returns:
            List of session summaries
        """
        chats_collection = get_chats_collection()
        
        # Aggregate to get session summaries
        pipeline = [
            {"$match": {"health_id": health_id}},
            {"$sort": {"timestamp": -1}},
            {
                "$group": {
                    "_id": "$session_id",
                    "session_id": {"$first": "$session_id"},
                    "started_at": {"$min": "$timestamp"},
                    "last_message_at": {"$max": "$timestamp"},
                    "message_count": {"$sum": 1},
                    "first_message": {"$first": "$user_message"},
                    "last_symptoms": {"$last": "$detected_symptoms"}
                }
            },
            {"$sort": {"last_message_at": -1}},
            {"$limit": limit}
        ]
        
        sessions = await chats_collection.aggregate(pipeline).to_list(length=limit)
        
        return [
            {
                "session_id": session["session_id"],
                "started_at": session["started_at"],
                "last_message_at": session["last_message_at"],
                "message_count": session["message_count"],
                "preview": session["first_message"][:100] + "..." if len(session["first_message"]) > 100 else session["first_message"],
                "symptoms": session.get("last_symptoms", [])
            }
            for session in sessions
        ]
    
    async def generate_consultation_summary(
        self,
        session_id: str,
        health_id: str,
        recent_message_window: int = 8
    ) -> Dict[str, Any]:
        """
        Generate a summary of a consultation session for reports.
        
        Args:
            session_id: Chat session ID
            health_id: Patient's health ID
            
        Returns:
            Dict containing consultation summary
        """
        messages = await self.get_session_messages(session_id, health_id)
        
        if not messages:
            return {}
        
        def ensure_list(value: Any) -> List[Any]:
            if isinstance(value, list):
                return value
            return []

        def normalize_text_list(values: Any) -> List[str]:
            normalized: List[str] = []
            for item in ensure_list(values):
                if item is None:
                    continue
                if isinstance(item, dict):
                    candidate = (
                        item.get("recommendation")
                        or item.get("text")
                        or item.get("name")
                        or item.get("symptom")
                    )
                    if candidate:
                        normalized.append(str(candidate))
                    continue
                normalized.append(str(item))
            return normalized

        def extract_symptom_durations(text: str) -> List[str]:
            if not text:
                return []
            patterns = [
                r"\b(?:\d+\s*(?:hour|hours|day|days|week|weeks|month|months|year|years))(?:\s+\d+\s*(?:hour|hours|day|days|week|weeks|month|months|year|years))*\b",
                r"\b(?:a|an|few|couple of)\s+(?:hour|hours|day|days|week|weeks|month|months|year|years)\b",
                r"\b(?:since|for)\s+(?:yesterday|today|last night|last week|last month|last year)\b",
            ]

            matches: List[str] = []
            for pattern in patterns:
                for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                    matches.append(match.group(0).strip())
            return matches

        def parse_confidence_score(value: Any) -> Optional[float]:
            if value is None:
                return None
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                cleaned = value.strip().rstrip("%")
                try:
                    return float(cleaned)
                except ValueError:
                    return None
            return None

        # Focus summaries on the latest part of the session so older topics
        # do not override the current consultation.
        messages_for_summary = messages[-recent_message_window:] if recent_message_window > 0 else messages

        all_symptoms = set()
        all_recommendations: List[str] = []
        severity_levels: List[str] = []
        symptom_durations: List[str] = []
        probability_values: List[Any] = []
        primary_concern: Optional[str] = None
        key_findings: List[str] = []

        for msg in messages_for_summary:
            report_object = msg.get("report_object") or {}
            report_symptoms = ensure_list(
                report_object.get("symptoms_and_signals", {}).get("details")
            )
            report_recommendations = ensure_list(
                report_object.get("care_plan_next_steps")
            )
            report_severity = report_object.get("clinical_snapshot", {}).get("severity")
            report_probability = report_object.get("clinical_snapshot", {}).get("probability")

            detected_symptoms = ensure_list(msg.get("detected_symptoms"))
            recommendations = ensure_list(msg.get("recommendations"))

            normalized_report_symptoms = self._normalize_symptoms(report_symptoms)
            normalized_detected_symptoms = self._normalize_symptoms(detected_symptoms)
            all_symptoms.update(normalized_report_symptoms or normalized_detected_symptoms)

            normalized_report_recommendations = normalize_text_list(report_recommendations)
            normalized_recommendations = normalize_text_list(recommendations)
            all_recommendations.extend(
                normalized_report_recommendations or normalized_recommendations
            )

            if report_severity in ["low", "moderate", "high"]:
                severity_levels.append(report_severity)
            elif msg.get("severity_level"):
                severity_levels.append(msg["severity_level"])

            if report_probability:
                probability_values.append(report_probability)

            if not primary_concern:
                concern_candidate = report_object.get("primary_concern")
                if concern_candidate and str(concern_candidate).strip().lower() != "n/a":
                    primary_concern = str(concern_candidate).strip()

            if not key_findings:
                findings_candidate = ensure_list(report_object.get("key_findings"))
                normalized_findings = normalize_text_list(findings_candidate)
                if normalized_findings:
                    key_findings = normalized_findings

            user_text = str(msg.get("user_message") or "")
            symptom_durations.extend(extract_symptom_durations(user_text))
        
        # Determine overall severity
        severity_order = {"low": 1, "moderate": 2, "high": 3}
        max_severity = "moderate"
        if severity_levels:
            max_severity = max(severity_levels, key=lambda x: severity_order.get(x, 2))
        
        latest_user_message = ""
        for msg in reversed(messages_for_summary):
            candidate = str(msg.get("user_message") or "").strip()
            if candidate:
                latest_user_message = candidate
                break

        if not latest_user_message:
            latest_user_message = str(messages_for_summary[-1].get("user_message") or "")[:200]

        consultation_summary = latest_user_message[:300]
        if primary_concern and primary_concern.lower() not in consultation_summary.lower():
            consultation_summary = f"Primary concern: {primary_concern}. {consultation_summary}"
        if key_findings:
            consultation_summary = f"{consultation_summary} Key findings: {', '.join(key_findings[:3])}."

        probability_value = probability_values[-1] if probability_values else None
        confidence_score = parse_confidence_score(probability_value)
        probability_label = None
        if confidence_score is None and probability_value is not None:
            probability_label = str(probability_value)

        unique_durations: List[str] = []
        seen_durations = set()
        for duration in symptom_durations:
            duration_key = duration.lower()
            if duration_key in seen_durations:
                continue
            seen_durations.add(duration_key)
            unique_durations.append(duration)

        return {
            "session_id": session_id,
            "consultation_date": messages_for_summary[-1]["timestamp"],
            "duration_messages": len(messages_for_summary),
            "detected_symptoms": list(all_symptoms),
            "overall_severity": max_severity,
            "recommendations": list(set(all_recommendations)),  # Remove duplicates
            "conversation_preview": latest_user_message[:200],
            "consultation_summary": consultation_summary.strip(),
            "symptom_durations": unique_durations,
            "confidence_score": confidence_score,
            "probability_label": probability_label
        }
    
    async def create_history_entry_from_session(
        self,
        session_id: str,
        health_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Create a medical history entry from a chat session.
        Should be called when a consultation ends or reaches significant symptoms.
        
        Args:
            session_id: Chat session ID
            health_id: Patient's health ID
            
        Returns:
            Created history entry or None
        """
        summary = await self.generate_consultation_summary(session_id, health_id)
        
        if not summary or not summary.get("detected_symptoms"):
            return None
        
        # Map severity to risk level
        severity_to_risk = {
            "low": RiskLevel.LOW,
            "moderate": RiskLevel.MODERATE,
            "high": RiskLevel.HIGH
        }
        risk_level = severity_to_risk.get(summary["overall_severity"], RiskLevel.MODERATE)
        
        # Create title from symptoms
        symptoms_list = summary["detected_symptoms"][:3]
        title = f"Symptom Check: {', '.join(symptoms_list)}"
        if len(summary["detected_symptoms"]) > 3:
            title += f" +{len(summary['detected_symptoms']) - 3} more"
        
        # Create summary text
        summary_text = f"Consultation identified {len(summary['detected_symptoms'])} symptoms. "
        summary_text += f"Severity: {summary['overall_severity'].title()}. "
        if summary["recommendations"]:
            summary_text += f"Key recommendations: {', '.join(summary['recommendations'][:2])}."
        
        # Create history entry
        try:
            entry = await create_chatbot_screening_entry(
                health_id=health_id,
                title=title,
                summary=summary_text,
                risk_level=risk_level,
                symptoms=summary["detected_symptoms"],
                recommendations=summary["recommendations"]
            )
            return entry.dict()
        except Exception as e:
            print(f"Failed to create history entry: {e}")
            return None
