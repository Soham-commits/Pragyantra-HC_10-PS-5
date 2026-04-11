from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "mediq_db"
    
    # JWT
    JWT_SECRET_KEY: str = "your-secret-key-here-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # File uploads
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/jpg"]
    
    # AI/LLM Configuration
    LLM_PROVIDER: str = "mock"  # Options: "mock", "openai", "gemini"
    LLM_MODEL: str = "gpt-4"  # Model name for the selected provider
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    
    # Google Places API (for hospital recommendations)
    GOOGLE_PLACES_API_KEY: Optional[str] = None
    
    # Chat Settings
    CHAT_TEMPERATURE: float = 0.7  # Temperature for AI responses (0.0-1.0)
    MAX_CONTEXT_LENGTH: int = 4000  # Maximum context length for AI
    MAX_CONVERSATION_HISTORY: int = 10  # Number of previous messages to include
    
    # RAG (Retrieval-Augmented Generation) Configuration
    ENABLE_RAG: bool = False  # Enable RAG for medical knowledge retrieval
    RAG_MAX_RESULTS: int = 5  # Maximum results from knowledge base
    RAG_RELEVANCE_THRESHOLD: float = 0.7  # Minimum similarity score (0-1) to use RAG results
    
    # Pinecone Configuration
    PINECONE_API_KEY: Optional[str] = None  # Pinecone API key
    PINECONE_ENVIRONMENT: Optional[str] = None  # e.g., "us-west1-gcp-free"
    PINECONE_INDEX_NAME: str = "medical-knowledge"  # Pinecone index name
    PINECONE_NAMESPACE: str = "pubmed"  # Namespace for organizing data
    
    # Embeddings Configuration
    EMBEDDING_PROVIDER: str = "sentence-transformers"  # Options: "sentence-transformers", "openai"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"  # Model name for embeddings
    EMBEDDING_DIMENSION: int = 384  # Dimension for Pinecone index (384 for MiniLM, 1536 for OpenAI)
    
    # Legacy settings (for ChromaDB if needed)
    RAG_PERSIST_DIRECTORY: str = "./chroma_db"  # Local ChromaDB storage directory
    RAG_COLLECTION_NAME: str = "medical_knowledge"  # ChromaDB collection name
    PUBMED_API_KEY: Optional[str] = None  # NCBI API key for PubMed access
    
    # Feature Flags
    ENABLE_PROFILE_CONTEXT: bool = True  # Inject patient profile into chat
    ENABLE_CHAT_STREAMING: bool = True  # Enable streaming responses
    
    class Config:
        env_file = ".env"


settings = Settings()
