"""
Lung Scan Analysis Service using ONNX Runtime
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
MODEL_PATH = Path(__file__).parent.parent.parent / "model" / "chest_xray_screening_model.onnx"

# Constants
IMAGE_SIZE = (224, 224)
THRESHOLD = 0.30
MODEL_INPUT_SHAPE = (224, 224, 3)


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
    from app.services.gradcam_service import generate_lung_gradcam

    result = generate_lung_gradcam(image_bytes, scan_id)
    if result is None:
        raise RuntimeError("Grad-CAM generation failed for lung scan")
    return result

def load_model():
    """Load the ONNX model lazily"""
    global _session
    if _session is None:
        try:
            import onnxruntime as ort
            
            logger.info(f"Loading lung scan ONNX model from {MODEL_PATH}")
            
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
            raise RuntimeError(f"Failed to load lung scan ONNX model: {e}")
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


async def predict_lung_scan(image_bytes: bytes) -> dict:
    """
    Analyze lung scan image and return prediction using ONNX Runtime
    
    Args:
        image_bytes: Raw image bytes from upload
        
    Returns:
        Dictionary with prediction results:
        {
            "result": "normal" or "abnormal",
            "abnormal_probability": float (0-100),
            "threshold_used": float (0-1)
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
        
        # Make prediction
        prediction = session.run([output_name], {input_name: processed_image})[0]
        
        # Extract probability (model outputs probability of NORMAL class)
        # So we need to invert it to get abnormal probability
        normal_prob = float(prediction[0][0])
        abnormal_prob = 1.0 - normal_prob
        
        # Convert to percentage
        abnormal_prob_percent = round(abnormal_prob * 100, 2)
        
        # Determine result based on threshold
        result = "abnormal" if abnormal_prob >= THRESHOLD else "normal"
        
        return {
            "result": result,
            "abnormal_probability": abnormal_prob_percent,
            "threshold_used": THRESHOLD
        }
    
    except Exception as e:
        logger.error(f"Error during prediction: {e}")
        raise RuntimeError(f"Prediction failed: {e}")


def get_recommendations(result: str, probability: float) -> list:
    """
    Get recommendations based on scan results
    
    Args:
        result: "normal" or "abnormal"
        probability: Abnormal probability (0-100)
        
    Returns:
        List of recommendation strings
    """
    if result == "abnormal":
        if probability >= 80:
            return [
                "⚠️ High probability of abnormality detected",
                "Consult with a pulmonologist immediately",
                "Schedule a follow-up CT scan for detailed analysis",
                "Bring previous medical records to your consultation",
                "Avoid smoking and exposure to air pollution"
            ]
        elif probability >= 60:
            return [
                "Moderate probability of abnormality detected",
                "Schedule an appointment with a pulmonologist",
                "Consider a follow-up chest X-ray in 3 months",
                "Monitor for symptoms like persistent cough or breathing difficulty",
                "Maintain a healthy lifestyle"
            ]
        else:
            return [
                "Low to moderate probability of abnormality detected",
                "Consult with your primary care physician",
                "Regular health checkups recommended",
                "Monitor any respiratory symptoms",
                "Maintain good respiratory health"
            ]
    else:
        return [
            "✓ No significant abnormalities detected",
            "Continue regular health screenings",
            "Maintain a healthy lifestyle",
            "Monitor your respiratory health",
            "Consult a doctor if symptoms develop"
        ]


def get_severity(result: str, probability: float) -> str:
    """
    Determine severity level based on results
    
    Args:
        result: "normal" or "abnormal"
        probability: Abnormal probability (0-100)
        
    Returns:
        Severity string: "Low", "Moderate", or "High"
    """
    if result == "normal":
        return "Low"
    elif probability >= 80:
        return "High"
    elif probability >= 60:
        return "Moderate"
    else:
        return "Low"
