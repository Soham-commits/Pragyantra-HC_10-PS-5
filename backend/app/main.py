from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.routes import auth, patient, doctor, simple_auth, history, location, referrals, appointments, consent, notification, privacy, chain

# Create FastAPI app
app = FastAPI(
    title="MediQ Health Companion API",
    description="Backend API for MediQ - A comprehensive healthcare web application with patient and doctor portals",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Static files for uploaded assets
uploads_root = Path(__file__).resolve().parent.parent / "uploads"
uploads_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_root)), name="uploads")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database connection on startup"""
    await connect_to_mongo()
    try:
        from app.database import client as mongo_client
        if mongo_client is None:
            print("✅ MediQ API started (MongoDB: disconnected)")
        else:
            print("✅ MediQ API started (MongoDB: connected)")
    except Exception:
        print("✅ MediQ API started")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection on shutdown"""
    await close_mongo_connection()
    print("👋 MediQ API shut down")


# Health check endpoint
@app.get("/", tags=["Health Check"])
async def root():
    """Root endpoint - API health check"""
    return {
        "status": "healthy",
        "message": "MediQ Health Companion API is running",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


@app.get("/api/health", tags=["Health Check"])
async def health_check():
    """Detailed health check with database connectivity"""
    try:
        from app.database import client
        if client is None:
            db_status = "disconnected"
        else:
            # Ping database
            await client.admin.command("ping")
            db_status = "connected"
    except Exception as e:
        # Avoid leaking internal errors / secrets when pointing at a remote DB.
        if settings.MONGODB_URL.startswith("mongodb://localhost") or settings.MONGODB_URL.startswith("mongodb://127.0.0.1"):
            db_status = f"disconnected: {str(e)}"
        else:
            db_status = "disconnected"
    
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "api": "operational",
        "database": db_status,
        "timestamp": "2024-12-17T00:00:00Z"
    }


# Include routers
app.include_router(simple_auth.router)  # New simplified auth flow
app.include_router(auth.router)  # Keep old auth for backward compatibility
app.include_router(patient.router)
app.include_router(doctor.router)
app.include_router(history.router)  # Medical history timeline
app.include_router(location.router)   # Nearby hospital discovery (OSM)
app.include_router(referrals.router)  # Referral Module (Step 4)
app.include_router(appointments.router)  # Appointment booking system
app.include_router(consent.router)  # Consent Module (Compliance V2)
app.include_router(notification.router)  # Notifications Module (Compliance V2)
app.include_router(privacy.router)  # Privacy & Grievance Module (Compliance V2)
app.include_router(chain.router)  # Simulated decentralized health chain


# DEBUG ENDPOINT - Remove in production
@app.get("/api/debug/referrals-check", tags=["Debug"])
async def debug_referrals_check():
    """Debug endpoint to check referral data - NO AUTH REQUIRED"""
    from app.database import get_referrals_collection
    
    referrals_col = get_referrals_collection()
    
    # Get all referrals
    all_referrals = await referrals_col.find({}, {"_id": 0}).to_list(length=100)
    
    # Get unique patient_ids
    patient_ids = list(set([ref.get("patient_id") for ref in all_referrals if ref.get("patient_id")]))
    
    return {
        "total_referrals": len(all_referrals),
        "unique_patient_ids": patient_ids,
        "referrals": all_referrals
    }


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle unexpected exceptions"""
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred",
            "message": str(exc) if settings.MONGODB_URL == "mongodb://localhost:27017" else "Internal server error"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
