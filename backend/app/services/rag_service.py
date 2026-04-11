"""
RAG (Retrieval-Augmented Generation) Service
Medical knowledge retrieval using Pinecone cloud vector database
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import os
from app.config import settings

try:
    from pinecone import Pinecone, ServerlessSpec
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False
    print("Warning: Pinecone not installed. RAG features will be disabled.")

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    SentenceTransformer = None

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    openai = None


class RAGService:
    """
    Service for retrieving relevant medical knowledge to augment AI responses.
    
    Uses Pinecone cloud vector database and sentence transformers for embeddings.
    Supports:
    - Medical knowledge base storage and retrieval from PubMed/articles
    - Semantic search for relevant medical information
    - Citation generation
    - Context augmentation for AI responses
    - Fallback to LLM knowledge when no relevant results found
    """
    
    def __init__(self):
        """
        Initialize RAG service with Pinecone.
        Reads configuration from settings.
        """
        self.enabled = False
        self.pc = None
        self.index = None
        self.embeddings_model = None
        self.embedding_provider = settings.EMBEDDING_PROVIDER
        self.embedding_dimension = settings.EMBEDDING_DIMENSION
        self.relevance_threshold = settings.RAG_RELEVANCE_THRESHOLD

        # Feature flag: avoid network calls / heavy imports unless explicitly enabled.
        if not settings.ENABLE_RAG:
            return
        
        if not PINECONE_AVAILABLE:
            print("⚠️  RAG Service disabled: Pinecone not installed")
            print("   Install with: pip install pinecone-client")
            return
        
        if not settings.PINECONE_API_KEY:
            print("⚠️  RAG Service disabled: PINECONE_API_KEY not set in .env")
            return
        
        # Check embedding provider
        if self.embedding_provider == "sentence-transformers" and not SENTENCE_TRANSFORMERS_AVAILABLE:
            print("⚠️  RAG Service disabled: sentence-transformers not installed")
            print("   Install with: pip install sentence-transformers")
            print("   Or switch to OpenAI embeddings: EMBEDDING_PROVIDER=openai")
            return
        
        if self.embedding_provider == "openai" and not OPENAI_AVAILABLE:
            print("⚠️  RAG Service disabled: openai not installed")
            print("   Install with: pip install openai")
            print("   Or switch to sentence-transformers: EMBEDDING_PROVIDER=sentence-transformers")
            return
        
        if self.embedding_provider == "openai" and not settings.OPENAI_API_KEY:
            print("⚠️  RAG Service disabled: OPENAI_API_KEY not set for OpenAI embeddings")
            return
        
        try:
            self._initialize_pinecone()
            self._initialize_embeddings()
            self.enabled = True
            print(f"✅ RAG Service initialized with Pinecone")
            print(f"   Index: {settings.PINECONE_INDEX_NAME}")
            print(f"   Namespace: {settings.PINECONE_NAMESPACE}")
            print(f"   Embeddings: {self.embedding_provider} (dimension: {self.embedding_dimension})")
            print(f"   Relevance threshold: {self.relevance_threshold}")
        except Exception as e:
            print(f"⚠️  Failed to initialize RAG Service: {e}")
            self.enabled = False
    
    def _initialize_pinecone(self):
        """Initialize Pinecone client and index"""
        # Initialize Pinecone client
        self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        
        # Check if index exists, create if not
        index_name = settings.PINECONE_INDEX_NAME
        
        if index_name not in [idx.name for idx in self.pc.list_indexes()]:
            print(f"   Creating new index: {index_name} (dimension: {self.embedding_dimension})")
            self.pc.create_index(
                name=index_name,
                dimension=self.embedding_dimension,
                metric='cosine',
                spec=ServerlessSpec(
                    cloud='aws',
                    region=settings.PINECONE_ENVIRONMENT or 'us-east-1'
                )
            )
            print(f"   Index created successfully")
        else:
            print(f"   Using existing index: {index_name}")
        
        # Connect to index
        self.index = self.pc.Index(index_name)
    
    def _initialize_embeddings(self):
        """Initialize embedding model based on provider"""
        if self.embedding_provider == "sentence-transformers":
            print(f"   Loading sentence transformer model: {settings.EMBEDDING_MODEL}")
            self.embeddings_model = SentenceTransformer(settings.EMBEDDING_MODEL)
            print("   Model loaded successfully")
        elif self.embedding_provider == "openai":
            print(f"   Using OpenAI embeddings: {settings.EMBEDDING_MODEL}")
            openai.api_key = settings.OPENAI_API_KEY
            self.embeddings_model = None  # Will use API directly
            print("   OpenAI client configured")
    
    def _generate_embeddings(self, texts: List[str], show_progress: bool = True) -> List[List[float]]:
        """
        Generate embeddings for texts using configured provider.
        
        Args:
            texts: List of texts to embed
            show_progress: Whether to show progress bar
            
        Returns:
            List of embeddings
        """
        if self.embedding_provider == "sentence-transformers":
            return self.embeddings_model.encode(texts, show_progress_bar=show_progress).tolist()
        
        elif self.embedding_provider == "openai":
            # Batch OpenAI embeddings (max 2048 texts per request)
            all_embeddings = []
            batch_size = 2048
            
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                response = openai.embeddings.create(
                    model=settings.EMBEDDING_MODEL or "text-embedding-ada-002",
                    input=batch
                )
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
                
                if show_progress:
                    print(f"   Embedded {min(i + batch_size, len(texts))}/{len(texts)} texts")
            
            return all_embeddings
        
        else:
            raise ValueError(f"Unknown embedding provider: {self.embedding_provider}")
    
    def add_knowledge(
        self,
        documents: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        ids: Optional[List[str]] = None,
        batch_size: int = 100
    ) -> bool:
        """
        Add medical knowledge documents to Pinecone vector database.
        
        Args:
            documents: List of text documents to add
            metadatas: Optional list of metadata dicts for each document
            ids: Optional list of unique IDs for each document
            batch_size: Number of documents to upload at once
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            return False
        
        try:
            # Generate IDs if not provided
            if ids is None:
                ids = [f"doc_{i}_{abs(hash(doc[:50]))}" for i, doc in enumerate(documents)]
            
            # Generate embeddings using configured provider
            print(f"   Generating embeddings for {len(documents)} documents...")
            embeddings = self._generate_embeddings(documents, show_progress=True)
            
            # Prepare vectors for Pinecone
            vectors = []
            for i, (doc_id, embedding, document) in enumerate(zip(ids, embeddings, documents)):
                metadata = metadatas[i] if metadatas and i < len(metadatas) else {}
                # Add document text to metadata (Pinecone requires metadata, not separate docs)
                metadata['text'] = document[:40000]  # Pinecone metadata limit
                metadata['length'] = len(document)
                
                vectors.append({
                    'id': doc_id,
                    'values': embedding,
                    'metadata': metadata
                })
            
            # Upload to Pinecone in batches
            print(f"   Uploading to Pinecone (batch size: {batch_size})...")
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                self.index.upsert(
                    vectors=batch,
                    namespace=settings.PINECONE_NAMESPACE
                )
                print(f"   Uploaded batch {i//batch_size + 1}/{(len(vectors)-1)//batch_size + 1}")
            
            print(f"✅ Added {len(documents)} documents to Pinecone knowledge base")
            return True
            
        except Exception as e:
            print(f"❌ Error adding knowledge: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def search_medical_knowledge(
        self,
        query: str,
        symptoms: Optional[List[str]] = None,
        max_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search Pinecone medical knowledge base for relevant information using semantic search.
        
        Args:
            query: Search query (symptoms, conditions, treatments)
            symptoms: List of detected symptoms for context
            max_results: Maximum number of results to return
            
        Returns:
            List of relevant medical documents/articles with relevance scores
            Returns empty list if no results meet relevance threshold
        """
        
        if not self.enabled:
            return []
        
        try:
            # Enhance query with symptoms if provided
            if symptoms:
                enhanced_query = f"{query} symptoms: {' '.join(symptoms)}"
            else:
                enhanced_query = query
            
            # Generate query embedding using configured provider
            query_embedding = self._generate_embeddings([enhanced_query], show_progress=False)[0]
            
            # Search in Pinecone
            results = self.index.query(
                vector=query_embedding,
                top_k=max_results,
                namespace=settings.PINECONE_NAMESPACE,
                include_metadata=True
            )
            
            # Format results
            formatted_results = []
            if results and results.matches:
                for match in results.matches:
                    relevance_score = match.score
                    
                    # Only include results above relevance threshold
                    if relevance_score < self.relevance_threshold:
                        continue
                    
                    metadata = match.metadata or {}
                    
                    formatted_results.append({
                        "id": match.id,
                        "title": metadata.get("title", "Medical Information"),
                        "source": metadata.get("source", "PubMed/Research Articles"),
                        "content": metadata.get("text", ""),
                        "relevance_score": relevance_score,
                        "url": metadata.get("url", ""),
                        "category": metadata.get("category", "medical"),
                        "published_date": metadata.get("published_date", ""),
                        "authors": metadata.get("authors", "")
                    })
            
            if not formatted_results:
                print(f"   No results above relevance threshold ({self.relevance_threshold})")
                print(f"   AI will use its own knowledge to answer")
            else:
                print(f"   Found {len(formatted_results)} relevant results")
            
            return formatted_results
            
        except Exception as e:
            print(f"❌ Error searching Pinecone: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def retrieve_context(
        self,
        symptoms: List[str],
        patient_age: int,
        patient_gender: str
    ) -> str:
        """
        Retrieve relevant medical context based on symptoms and patient demographics.
        
        Args:
            symptoms: List of symptoms
            patient_age: Patient's age
            patient_gender: Patient's gender
            
        Returns:
            Formatted context string for AI injection
        """
        
        if not self.enabled or not symptoms:
            return ""
        
        # Build demographic context
        demographic_context = f"Patient: {patient_age} years old, {patient_gender}"
        
        # Build query from symptoms
        symptom_query = " ".join(symptoms)
        full_query = f"{symptom_query} {demographic_context}"
        
        # Search knowledge base
        results = await self.search_medical_knowledge(
            query=full_query,
            symptoms=symptoms,
            max_results=3
        )
        
        if not results:
            return ""
        
        # Format context for AI
        context_parts = ["=== RELEVANT MEDICAL INFORMATION ==="]
        context_parts.append(f"Patient Demographics: {demographic_context}\n")
        
        for i, result in enumerate(results, 1):
            title = result['title']
            source = result['source']
            content = result['content']
            relevance = result.get('relevance_score', 0)
            
            context_parts.append(f"\n[Reference {i}] {title}")
            context_parts.append(f"Source: {source} (Relevance: {relevance:.2f})")
            context_parts.append(f"Content: {content[:300]}...")
            
            if result.get('url'):
                context_parts.append(f"URL: {result['url']}")
        
        context_parts.append("\n=== END MEDICAL INFORMATION ===")
        context_parts.append("\nUse the above information to provide accurate, evidence-based advice.")
        
        return "\n".join(context_parts)
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the Pinecone knowledge base.
        
        Returns:
            Dict with index statistics
        """
        if not self.enabled:
            return {"enabled": False, "vector_count": 0}
        
        try:
            stats = self.index.describe_index_stats()
            namespace_stats = stats.namespaces.get(settings.PINECONE_NAMESPACE, {})
            
            return {
                "enabled": True,
                "vector_count": namespace_stats.get('vector_count', 0),
                "index_name": settings.PINECONE_INDEX_NAME,
                "namespace": settings.PINECONE_NAMESPACE,
                "dimension": stats.dimension,
                "total_vectors": stats.total_vector_count,
                "relevance_threshold": self.relevance_threshold
            }
        except Exception as e:
            return {"enabled": True, "error": str(e), "vector_count": 0}
    
    async def get_treatment_guidelines(
        self,
        condition: str,
        patient_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get treatment guidelines for a specific condition.
        
        Args:
            condition: Medical condition name
            patient_context: Patient demographics and medical history
            
        Returns:
            Dict containing treatment guidelines and recommendations
        """
        
        if not self.enabled:
            return {
                "condition": condition,
                "guidelines": [],
                "recommendations": [],
                "sources": []
            }
        
        # Search for condition-specific guidelines
        query = f"treatment guidelines for {condition}"
        if patient_context:
            age = patient_context.get("age", "")
            gender = patient_context.get("gender", "")
            if age or gender:
                query += f" patient: {age} years old {gender}"
        
        results = await self.search_medical_knowledge(
            query=query,
            max_results=3
        )
        
        guidelines = []
        recommendations = []
        sources = []
        
        for result in results:
            content = result.get("content", "")
            source = result.get("source", "Unknown")
            
            # Extract relevant information from content
            if content:
                guidelines.append(content[:200])
                sources.append(source)
        
        return {
            "condition": condition,
            "guidelines": guidelines or ["No specific guidelines found. Consult with healthcare provider."],
            "recommendations": recommendations or ["Seek professional medical evaluation"],
            "sources": sources or ["Knowledge Base"]
        }
    
    def clear_knowledge_base(self) -> bool:
        """
        Clear all documents from the Pinecone namespace.
        WARNING: This will delete all stored medical knowledge in the namespace.
        
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            return False
        
        try:
            # Delete all vectors in the namespace
            self.index.delete(delete_all=True, namespace=settings.PINECONE_NAMESPACE)
            print(f"✅ Cleared knowledge base namespace: {settings.PINECONE_NAMESPACE}")
            return True
        except Exception as e:
            print(f"❌ Error clearing knowledge base: {e}")
            return False
    
    async def search_pubmed(
        self,
        query: str,
        max_results: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Search PubMed for relevant medical research.
        
        Args:
            query: Search query
            max_results: Maximum number of articles to return
            
        Returns:
            List of PubMed articles with metadata
        
        Note: This is a placeholder. For production, integrate with:
        PubMed E-utilities API: https://www.ncbi.nlm.nih.gov/books/NBK25501/
        """
        
        if not self.enabled:
            return []
        
        # PLACEHOLDER: In production, use httpx to query PubMed API
        # Example implementation:
        # async with httpx.AsyncClient() as client:
        #     response = await client.get(
        #         "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
        #         params={"db": "pubmed", "term": query, "retmax": max_results}
        #     )
        
        print(f"⚠️  PubMed search not implemented. Query: {query}")
        return []
    
    def format_citations(self, results: List[Dict[str, Any]]) -> str:
        """
        Format search results as citations for AI response.
        
        Args:
            results: List of search results
            
        Returns:
            Formatted citation string
        """
        
        if not results:
            return ""
        
        citations = ["\n\n📚 References:"]
        for i, result in enumerate(results, 1):
            title = result.get("title", "Unknown")
            source = result.get("source") or result.get("journal", "Unknown source")
            url = result.get("url", "")
            
            citation = f"{i}. {title} - {source}"
            if url:
                citation += f" [{url}]"
            citations.append(citation)
        
        return "\n".join(citations)
