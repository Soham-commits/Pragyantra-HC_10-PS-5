"""
AI Service Layer - Abstraction for multiple LLM providers
Supports: OpenAI GPT, Google Gemini, Claude, or Mock providers
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any, AsyncGenerator
from datetime import datetime
from app.config import settings
import json


class AIProvider(ABC):
    """Abstract base class for AI providers"""
    
    @abstractmethod
    async def send_message(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send a message to the AI and get a response.
        
        Args:
            message: User's message
            context: Additional context (patient profile, medical history)
            conversation_history: Previous messages in format [{"role": "user/assistant", "content": "..."}]
            **kwargs: Provider-specific parameters
            
        Returns:
            Dict with 'response', 'detected_symptoms', 'severity_level', 'recommendations'
        """
        pass
    
    @abstractmethod
    async def stream_message(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream AI response token by token.
        
        Yields:
            Individual tokens/chunks of the response
        """
        pass



REPORT_SYSTEM_PROMPT = """You are an agentic healthcare decision-support system.

Your role is to:
1. Converse naturally with the user.
2. Internally reason about their inputs.
3. Produce a structured clinical summary that will be used to generate a report UI.

IMPORTANT RULES:
- The report MUST be grounded ONLY in the current conversation.
- Do NOT invent findings, symptoms, probabilities, or facilities.
- If information is missing, explicitly mark it as "N/A" or "Pending Review".
- You are NOT allowed to create new clinical facts that were not discussed.
- The report is a reflection of the conversation, not an independent diagnosis.

OUTPUT FORMAT (MANDATORY):
Always respond in TWO sections.

--------------------
SECTION 1: CHAT_RESPONSE
(Write a clear, empathetic, user-facing response in plain language.)

--------------------
SECTION 2: REPORT_OBJECT (JSON ONLY)
Return valid JSON. No markdown. No comments.

Schema:
{
  "clinical_snapshot": {
    "condition_status": "pending_review | identified | unclear",
    "probability": "low | medium | high | N/A",
    "severity": "low | moderate | high | N/A"
  },
  "symptoms_and_signals": {
    "detected": true | false,
    "details": []
  },
  "primary_concern": "",
  "risk_flag": "",
  "key_findings": [],
  "care_plan_next_steps": [],
  "safety_checks": [],
  "nearest_facility": {
    "name": "N/A",
    "distance": "N/A",
    "eta": "N/A"
  }
}

CONSTRAINTS:
- If a section is not discussed, return empty arrays or "N/A".
- Never guess facility names, distances, or timings.
- Severity and probability must align with stated evidence only.
- The UI report will be generated directly from this JSON.
"""


class MockAIProvider(AIProvider):
    """Mock AI provider for testing and development"""

    async def send_message(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Return mock responses based on keywords"""

        lower_message = message.lower()

        detected_symptoms = []
        severity = "moderate"
        recommendations = []

        symptom_keywords = {
            "headache": "headache",
            "fever": "fever",
            "cough": "cough",
            "chest pain": "chest pain",
            "nausea": "nausea",
            "fatigue": "fatigue",
            "shortness of breath": "shortness of breath",
            "dizziness": "dizziness",
            "joint pain": "joint pain",
            "leg pain": "leg pain",
            "knee pain": "knee pain",
            "ankle pain": "ankle pain"
        }

        for keyword, symptom in symptom_keywords.items():
            if keyword in lower_message:
                detected_symptoms.append(symptom)

        if "headache" in lower_message or "head pain" in lower_message:
            response = (
                "I understand you're experiencing headaches. "
                "To better assist you, could you tell me:\n\n"
                "• How long have you had this headache?\n"
                "• Is the pain localized or spread across your head?\n"
                "• Are you experiencing any other symptoms like nausea or vision changes?"
            )
            recommendations = [
                "Stay hydrated",
                "Rest in a quiet, dark room",
                "Monitor for worsening symptoms"
            ]
            severity = "moderate"

        elif "fever" in lower_message or "temperature" in lower_message:
            response = (
                "A fever can indicate your body is fighting an infection. "
                "Could you share your current temperature and when it started?"
            )
            recommendations = [
                "Stay hydrated",
                "Rest adequately",
                "Monitor temperature regularly"
            ]
            severity = "moderate"

        elif "chest" in lower_message or "heart" in lower_message:
            response = (
                "Chest discomfort can be serious. "
                "Is the pain sharp, dull, or pressure-like, and do you have shortness of breath?"
            )
            recommendations = [
                "Seek immediate medical attention if symptoms are severe",
                "Avoid exertion while symptoms persist"
            ]
            severity = "high"

        elif "cough" in lower_message or "cold" in lower_message:
            response = (
                "I am sorry you are dealing with a cough. "
                "Is it dry or productive, and how long has it been going on?"
            )
            recommendations = [
                "Stay hydrated",
                "Avoid irritants like smoke",
                "Monitor for worsening symptoms"
            ]
            severity = "low"

        elif any(keyword in lower_message for keyword in ["joint", "knee", "leg", "ankle"]):
            response = (
                "Thanks for sharing. Joint or leg pain can have several causes. "
                "Which joints are involved, and did the pain start after an injury or activity?"
            )
            recommendations = [
                "Rest the affected area if activity-related",
                "Note any swelling, redness, or warmth",
                "Seek care if pain worsens or limits movement"
            ]
            severity = "moderate"

        else:
            response = (
                "Thank you for sharing that with me. "
                "When did these symptoms start, and how severe are they on a 1-10 scale?"
            )
            recommendations = [
                "Provide more detailed symptom information",
                "Monitor your symptoms",
                "Seek medical care if symptoms worsen"
            ]
            severity = "N/A"

        if context:
            response = f"[Note: I have access to your medical profile]\n\n{response}"

        report_object = {
            "clinical_snapshot": {
                "condition_status": "identified" if detected_symptoms else "unclear",
                "probability": "N/A",
                "severity": severity if severity in ["low", "moderate", "high"] else "N/A"
            },
            "symptoms_and_signals": {
                "detected": bool(detected_symptoms),
                "details": detected_symptoms
            },
            "primary_concern": detected_symptoms[0] if detected_symptoms else "N/A",
            "risk_flag": severity if severity in ["low", "moderate", "high"] else "N/A",
            "key_findings": [],
            "care_plan_next_steps": recommendations,
            "safety_checks": [],
            "nearest_facility": {
                "name": "N/A",
                "distance": "N/A",
                "eta": "N/A"
            }
        }

        formatted_response = (
            "SECTION 1: CHAT_RESPONSE\n"
            f"{response}\n\n"
            "SECTION 2: REPORT_OBJECT\n"
            f"{json.dumps(report_object, ensure_ascii=True)}"
        )

        return {
            "response": formatted_response,
            "detected_symptoms": detected_symptoms,
            "severity_level": severity if severity in ["low", "moderate", "high"] else None,
            "recommendations": recommendations,
            "model": "mock-provider",
            "timestamp": datetime.utcnow()
        }

    async def stream_message(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Stream mock response word by word"""
        import asyncio

        result = await self.send_message(message, context, conversation_history, **kwargs)
        response = result["response"]

        words = response.split()
        for word in words:
            yield word + " "
            await asyncio.sleep(0.05)


class OpenAIProvider(AIProvider):
    """OpenAI GPT provider (requires openai package and API key)"""
    
    def __init__(self, api_key: str, model: str = "gpt-4"):
        self.api_key = api_key
        self.model = model
        # Import openai only if this provider is used
        try:
            import openai
            self.client = openai.AsyncOpenAI(api_key=api_key)
        except ImportError:
            raise ImportError("openai package is required for OpenAIProvider. Install with: pip install openai")
    
    async def send_message(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Send message to OpenAI GPT"""
        
        # Build messages array
        messages = []
        
        system_prompt = REPORT_SYSTEM_PROMPT
        
        if context:
            system_prompt += f"\n\nPatient Context:\n{context}"
        
        messages.append({"role": "system", "content": system_prompt})
        
        # Add conversation history
        if conversation_history:
            messages.extend(conversation_history)
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # Call OpenAI API
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=kwargs.get("temperature", settings.CHAT_TEMPERATURE),
            max_tokens=kwargs.get("max_tokens", 500)
        )
        
        ai_response = response.choices[0].message.content
        
        return {
            "response": ai_response,
            "detected_symptoms": [],
            "severity_level": None,
            "recommendations": [],
            "model": self.model,
            "timestamp": datetime.utcnow(),
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        }
    
    async def stream_message(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Stream message from OpenAI GPT"""
        
        messages = []
        system_prompt = REPORT_SYSTEM_PROMPT
        
        if context:
            system_prompt += f"\n\nPatient Context:\n{context}"
        
        messages.append({"role": "system", "content": system_prompt})
        
        if conversation_history:
            messages.extend(conversation_history)
        
        messages.append({"role": "user", "content": message})
        
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=kwargs.get("temperature", settings.CHAT_TEMPERATURE),
            stream=True
        )
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class GeminiProvider(AIProvider):
    """Google Gemini provider (requires google-generativeai package and API key)"""
    
    def __init__(self, api_key: str, model: str = "gemini-pro"):
        self.api_key = api_key
        self.model_name = model
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(model)
        except ImportError:
            raise ImportError("google-generativeai package is required. Install with: pip install google-generativeai")
    
    async def send_message(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Send message to Google Gemini"""
        
        system_prompt = REPORT_SYSTEM_PROMPT
        
        # Build full prompt with system instructions, context, and conversation history
        full_prompt = system_prompt + "\n\n"
        
        if context:
            full_prompt += f"Patient Context:\n{context}\n\n"
        
        if conversation_history:
            full_prompt += "Conversation History:\n"
            for msg in conversation_history[-6:]:  # Last 3 exchanges
                role = msg.get("role", "user")
                content = msg.get("content", "")
                full_prompt += f"{role.title()}: {content}\n"
            full_prompt += "\n"
        
        full_prompt += f"User: {message}\n\nAssistant:"
        
        # Generate response
        response = await self.model.generate_content_async(full_prompt)
        
        return {
            "response": response.text,
            "detected_symptoms": [],
            "severity_level": None,
            "recommendations": [],
            "model": self.model_name,
            "timestamp": datetime.utcnow()
        }
    
    async def stream_message(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Stream message from Google Gemini"""
        
        system_prompt = REPORT_SYSTEM_PROMPT
        
        full_prompt = system_prompt + "\n\n"
        
        if context:
            full_prompt += f"Patient Context:\n{context}\n\n"
        
        if conversation_history:
            full_prompt += "Conversation History:\n"
            for msg in conversation_history[-6:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                full_prompt += f"{role.title()}: {content}\n"
            full_prompt += "\n"
        
        full_prompt += f"User: {message}\n\nAssistant:"
        
        response = await self.model.generate_content_async(full_prompt, stream=True)
        
        async for chunk in response:
            if chunk.text:
                yield chunk.text


class AIService:
    """
    Main AI service that manages provider selection and routing.
    Acts as a facade for different AI providers.
    """
    
    def __init__(self):
        self.provider = self._initialize_provider()
    
    def _initialize_provider(self) -> AIProvider:
        """Initialize the appropriate AI provider based on configuration"""
        
        provider_name = settings.LLM_PROVIDER.lower()
        
        if provider_name == "openai":
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is required for OpenAI provider")
            return OpenAIProvider(
                api_key=settings.OPENAI_API_KEY,
                model=settings.LLM_MODEL
            )
        
        elif provider_name == "gemini":
            if not settings.GOOGLE_API_KEY:
                raise ValueError("GOOGLE_API_KEY is required for Gemini provider")
            return GeminiProvider(
                api_key=settings.GOOGLE_API_KEY,
                model=settings.LLM_MODEL
            )
        
        elif provider_name == "mock":
            return MockAIProvider()
        
        else:
            # Default to mock if unknown provider
            print(f"⚠️ Unknown provider '{provider_name}', falling back to MockAIProvider")
            return MockAIProvider()
    
    async def get_completion(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Get a completion from the configured AI provider.
        
        Args:
            message: User's message
            context: Additional context (patient profile, RAG results)
            conversation_history: Previous conversation messages
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dict containing response and metadata
        """
        return await self.provider.send_message(
            message=message,
            context=context,
            conversation_history=conversation_history,
            **kwargs
        )
    
    async def get_streaming_completion(
        self,
        message: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Get a streaming completion from the configured AI provider.
        
        Yields:
            Response chunks as they're generated
        """
        async for chunk in self.provider.stream_message(
            message=message,
            context=context,
            conversation_history=conversation_history,
            **kwargs
        ):
            yield chunk
