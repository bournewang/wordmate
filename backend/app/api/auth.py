"""
Authentication API endpoints.
Handles user registration, login, and trial data import.
"""
from datetime import datetime, timezone
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.database import get_db
from app.models.database import User, Event
from app.core.auth import (
    generate_user_id, hash_password, authenticate_user, 
    create_user_token, generate_device_id
)
from app.core.dependencies import get_current_user_from_token
from app.schemas import (
    UserCreate, UserLogin, AuthResponse, ErrorResponse,
    UserResponse, UserResponseWrapper
)
from app.services.progress_service import ProgressService


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=AuthResponse)
async def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Register a new user account.
    Imports anonymous trial data if provided.
    """
    try:
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Generate user ID and hash password (if provided)
        user_id = generate_user_id()
        password_hash = hash_password(user_data.password) if user_data.password else None
        device_id = user_data.device_id or generate_device_id()
        
        # Create user record
        db_user = User(
            id=user_id,
            email=user_data.email,
            username=user_data.username,
            password_hash=password_hash,
            device_id=device_id,
            grade=user_data.grade,
            registered_from_trial=bool(user_data.trial_data),
            created_at=datetime.now(timezone.utc),
            last_login_at=datetime.now(timezone.utc)
        )
        
        db.add(db_user)
        db.flush()  # Get the user ID without committing
        
        # Import trial data if provided
        if user_data.trial_data:
            progress_service = ProgressService()
            await progress_service.import_trial_progress(
                db=db,
                user_id=user_id,
                trial_data=user_data.trial_data
            )
        
        # Log registration event
        event = Event(
            user_id=user_id,
            event_type="registration",
            event_data={
                "method": "passwordless" if not user_data.password else "email",
                "from_trial": bool(user_data.trial_data),
                "grade": user_data.grade,
                "device_id": device_id
            }
        )
        db.add(event)
        
        # Commit all changes
        db.commit()
        db.refresh(db_user)
        
        # Generate JWT token
        token = create_user_token(db_user)
        
        # Prepare response data
        user_response = UserResponse.from_orm(db_user)
        
        return {
            "success": True,
            "message": "Registration successful",
            "data": {
                "user": user_response.dict(),
                "token": token,
                "expires_in": 60 * 24 * 7  # 7 days in minutes
            },
            "timestamp": datetime.now()
        }
        
    except IntegrityError as e:
        db.rollback()
        # Handle duplicate email constraint
        if "email" in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed due to data constraint"
        )
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=AuthResponse)
async def login_user(
    login_data: UserLogin,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Authenticate user and return JWT token.
    Updates last login timestamp.
    """
    try:
        # Debug logging
        print(f"🔍 Login attempt: email={login_data.email}, username={login_data.username}, device_id={login_data.device_id}, has_password={bool(login_data.password)}")
        
        # Authenticate user with flexible parameters
        user = authenticate_user(
            db=db, 
            email=login_data.email, 
            username=login_data.username,
            password=login_data.password,
            device_id=login_data.device_id
        )
        if not user:
            print(f"❌ Authentication failed for: email={login_data.email}, username={login_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Update last login timestamp
        user.last_login_at = datetime.now(timezone.utc)
        
        # Log login event
        auth_method = "device" if login_data.device_id else "passwordless" if not login_data.password else "email"
        event = Event(
            user_id=user.id,
            event_type="login",
            event_data={
                "method": auth_method,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "device_id": login_data.device_id or user.device_id
            }
        )
        db.add(event)
        
        db.commit()
        db.refresh(user)
        
        # Generate JWT token
        token = create_user_token(user)
        
        # Prepare response data
        user_response = UserResponse.from_orm(user)
        
        return {
            "success": True,
            "message": "Login successful",
            "data": {
                "user": user_response.dict(),
                "token": token,
                "expires_in": 60 * 24 * 7  # 7 days in minutes
            },
            "timestamp": datetime.now()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.get("/me", response_model=UserResponseWrapper)
async def get_current_user(
    current_user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get current user information from JWT token.
    """
    try:
        user_response = UserResponse.from_orm(current_user)
        
        return {
            "success": True,
            "data": user_response.dict(),
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user info: {str(e)}"
        )


@router.post("/refresh")
async def refresh_token(
    current_user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Refresh JWT token for authenticated user.
    """
    try:
        # Generate new JWT token
        token = create_user_token(current_user)
        
        return {
            "success": True,
            "message": "Token refreshed successfully",
            "data": {
                "token": token,
                "expires_in": 60 * 24 * 7  # 7 days in minutes
            },
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token refresh failed: {str(e)}"
        )


@router.post("/logout")
async def logout_user() -> Dict[str, Any]:
    """
    Logout user (client should discard token).
    This is a placeholder for client-side token removal.
    """
    return {
        "success": True,
        "message": "Logout successful. Please discard your token.",
        "timestamp": datetime.now()
    }
