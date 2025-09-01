"""
FastAPI main application.
Sets up routing, middleware, and application lifecycle.
"""
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.db.database import test_database_connection
from app.api import auth
from app.schemas import HealthCheck


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print("🚀 Starting WordMate API...")
    
    # Test database connection
    db_connected = await test_database_connection()
    if not db_connected:
        print("❌ Database connection failed!")
    else:
        print("✅ Database connected successfully")
    
    yield
    
    # Shutdown
    print("🛑 Shutting down WordMate API...")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="WordMate API for vocabulary learning with spaced repetition",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    docs_url=f"{settings.API_V1_STR}/docs" if settings.DEBUG else None,
    redoc_url=f"{settings.API_V1_STR}/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail
            },
            "timestamp": datetime.now().isoformat()
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed information."""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": errors
            },
            "timestamp": datetime.now().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    print(f"Unexpected error: {exc}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred" if not settings.DEBUG else str(exc)
            },
            "timestamp": datetime.now().isoformat()
        }
    )


# Health check endpoint
@app.get("/health", response_model=HealthCheck, tags=["health"])
async def health_check():
    """Health check endpoint for monitoring."""
    db_connected = await test_database_connection()
    
    return HealthCheck(
        status="healthy" if db_connected else "unhealthy",
        database_connected=db_connected,
        version="1.0.0"
    )


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "WordMate API",
        "version": "1.0.0",
        "docs": f"{settings.API_V1_STR}/docs" if settings.DEBUG else "Documentation disabled in production",
        "health": "/health",
        "timestamp": datetime.now().isoformat()
    }


# API routes
app.include_router(auth.router, prefix=settings.API_V1_STR)


# Development middleware for request logging
if settings.DEBUG:
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        """Log all requests in debug mode."""
        start_time = datetime.now()
        
        print(f"📝 {request.method} {request.url}")
        
        response = await call_next(request)
        
        process_time = datetime.now() - start_time
        print(f"✅ {request.method} {request.url} - {response.status_code} - {process_time.total_seconds():.3f}s")
        
        return response
