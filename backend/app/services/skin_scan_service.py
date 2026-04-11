"""
Skin Scan Analysis Service using ONNX Runtime
Lightweight model inference without TensorFlow dependency
"""
import os

import numpy as np
from PIL import Image
import io
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Model will be loaded lazily on first use
_session = None
MODEL_PATH = Path(__file__).parent.parent.parent / "model" / "mediq_skin_screening_densenet121.onnx"

# Constants
IMAGE_SIZE = (224, 224)
THRESHOLD = 0.5
MODEL_INPUT_SHAPE = (224, 224, 3)

# Binary classification: Malignant vs Benign
SKIN_CLASSES = {
    "benign": "Benign (Non-cancerous)",
    "malignant": "Malignant (Potentially cancerous)"
}


def generate_gradcam_overlay(image_bytes: bytes, scan_id: str) -> str:
    """
    Generate a model-driven Grad-CAM visualization using DenseNet-121 activations.

    Delegates to the shared gradcam_service which extracts activations from
    conv5_block16_2_conv layer and produces a real activation heatmap.

    Args:
        image_bytes: Raw image bytes
        scan_id: Scan ID used for output filename

    Returns:
        URL path to the saved Grad-CAM image
    """
    from app.services.gradcam_service import generate_skin_gradcam

    result = generate_skin_gradcam(image_bytes, scan_id)
    if result is None:
        raise RuntimeError("Grad-CAM generation failed for skin scan")
    return result


def load_model():
    """Load the ONNX model lazily"""
    global _session
    if _session is None:
        try:
            import onnxruntime as ort
            
            logger.info(f"Loading skin scan ONNX model from {MODEL_PATH}")
            
            if not MODEL_PATH.exists():
                raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
            
            # Create ONNX Runtime session
            _session = ort.InferenceSession(str(MODEL_PATH))
            
            # Get model info
            input_name = _session.get_inputs()[0].name
            output_name = _session.get_outputs()[0].name
            input_shape = _session.get_inputs()[0].shape
            output_shape = _session.get_outputs()[0].shape
            
            logger.info(f"ONNX model loaded successfully")
            logger.info(f"Input: {input_name} {input_shape}")
            logger.info(f"Output: {output_name} {output_shape}")
        except Exception as e:
            logger.error(f"Error loading ONNX model: {e}")
            raise RuntimeError(f"Failed to load skin scan ONNX model: {e}")
    return _session


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Preprocess the uploaded image for model prediction
    
    Args:
        image_bytes: Raw image bytes from upload
        
    Returns:
        Preprocessed numpy array ready for model input
    """
    try:
        # Open image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB (in case image is RGBA or grayscale)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize to 224x224
        image = image.resize(IMAGE_SIZE, Image.LANCZOS)
        
        # Convert to numpy array
        img_array = np.array(image)
        
        # Normalize to [0, 1] by dividing by 255.0
        img_array = img_array.astype(np.float32) / 255.0
        
        # Add batch dimension: (1, 224, 224, 3)
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    
    except Exception as e:
        logger.error(f"Error preprocessing image: {e}")
        raise ValueError(f"Failed to preprocess image: {e}")


async def predict_skin_scan(image_bytes: bytes) -> dict:
    """
    Analyze skin scan image and return prediction using ONNX Runtime
    
    Args:
        image_bytes: Raw image bytes from upload
        
    Returns:
        Dictionary with prediction results:
        {
            "result": str (benign or malignant),
            "confidence": float (0-100),
            "malignant_probability": float (0-100)
        }
    """
    try:
        # Load ONNX session
        session = load_model()
        
        # Preprocess image
        processed_image = preprocess_image(image_bytes)
        
        # Get input/output names
        input_name = session.get_inputs()[0].name
        output_name = session.get_outputs()[0].name
        
        # Make prediction (outputs single probability value)
        prediction = session.run([output_name], {input_name: processed_image})[0]
        
        # Extract probability (model outputs malignant probability)
        malignant_prob = float(prediction[0][0]) * 100
        benign_prob = 100 - malignant_prob
        
        # Determine result based on threshold
        result = "malignant" if malignant_prob >= (THRESHOLD * 100) else "benign"
        confidence = malignant_prob if result == "malignant" else benign_prob
        
        return {
            "result": result,
            "confidence": round(confidence, 2),
            "malignant_probability": round(malignant_prob, 2),
            "benign_probability": round(benign_prob, 2)
        }
    
    except Exception as e:
        logger.error(f"Error during prediction: {e}")
        raise RuntimeError(f"Prediction failed: {e}")


def get_severity(result: str, malignant_probability: float) -> str:
    """
    Determine severity level based on prediction result and probability
    
    Args:
        result: "benign" or "malignant"
        malignant_probability: Malignant probability (0-100)
        
    Returns:
        Severity level: "Low", "Moderate", or "High"
    """
    if result == "malignant":
        if malignant_probability >= 80:
            return "High"
        elif malignant_probability >= 60:
            return "Moderate"
        else:
            return "Low"
    else:  # benign
        # Even benign cases should be monitored if probability is borderline
        if malignant_probability >= 40:
            return "Low"  # Close to threshold, monitor
        else:
            return "Low"


def get_recommendations(result: str, malignant_probability: float) -> list:
    """
    Get recommendations based on scan results
    
    Args:
        result: "benign" or "malignant"
        malignant_probability: Malignant probability (0-100)
        
    Returns:
        List of recommendation strings
    """
    severity = get_severity(result, malignant_probability)
    
    if result == "malignant":
        if severity == "High":
            return [
                "⚠️ High probability of malignancy detected",
                "Schedule an urgent appointment with a dermatologist immediately",
                "Do not delay - early detection is crucial for treatment success",
                "Avoid sun exposure to the affected area",
                "Bring this report and clear photos to your consultation",
                "Consider getting a biopsy for definitive diagnosis"
            ]
        elif severity == "Moderate":
            return [
                "⚠️ Moderate concern for malignancy detected",
                "Consult with a dermatologist within 1-2 weeks",
                "Monitor the lesion daily for any changes",
                "Protect the area from sun exposure with SPF 50+ sunscreen",
                "Document with photos for comparison",
                "Professional evaluation is strongly recommended"
            ]
        else:  # Low severity malignant
            return [
                "Potential concern detected - professional evaluation needed",
                "Schedule a dermatologist appointment within 2-4 weeks",
                "Use broad-spectrum SPF 30+ sunscreen daily",
                "Monitor for changes in size, shape, or color",
                "Document with regular photos",
                "Avoid picking or irritating the area"
            ]
    else:  # benign
        if malignant_probability >= 40:  # Close to threshold
            return [
                "Lesion appears benign but close to monitoring threshold",
                "Schedule a routine dermatologist check-up",
                "Monitor using the ABCDE rule (Asymmetry, Border, Color, Diameter, Evolving)",
                "Take monthly photos for comparison",
                "Use SPF 30+ sunscreen daily on the area",
                "Return for evaluation if any changes occur"
            ]
        else:
            return [
                "Lesion appears benign (non-cancerous)",
                "Routine monitoring recommended with annual skin checks",
                "Use the ABCDE rule to monitor for changes",
                "Protect from sun exposure with SPF 30+ sunscreen",
                "Take photos every 3-6 months for comparison",
                "Consult dermatologist if appearance changes"
            ]


# Check if model is available
def is_available() -> bool:
    """Check if the skin scan model is available"""
    return MODEL_PATH.exists()
