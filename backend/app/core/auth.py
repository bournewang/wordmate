"""
Authentication utilities.
Handles JWT tokens, password hashing, and user verification.
"""
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.database import User


# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_user_id() -> str:
    """Generate unique user ID."""
    timestamp = str(int(datetime.now().timestamp()))
    random_part = secrets.token_hex(4)
    return f"user_{timestamp}_{random_part}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token.
    
    Args:
        data: Payload data to encode
        expires_delta: Token expiration time
    
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify JWT token and return payload.
    
    Args:
        token: JWT token string
    
    Returns:
        Token payload if valid, None if invalid
    """
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Check if token is expired
        exp = payload.get("exp")
        if exp is None:
            return None
            
        if datetime.utcnow().timestamp() > exp:
            return None
            
        return payload
        
    except JWTError:
        return None


def authenticate_user(db: Session, email: str = None, username: str = None, password: str = None, device_id: str = None) -> Optional[User]:
    """
    Authenticate user by email/username and password, or by device_id for passwordless auth.
    
    Args:
        db: Database session
        email: User email (optional)
        username: Username (optional)
        password: Plain text password (optional)
        device_id: Device ID for passwordless auth (optional)
    
    Returns:
        User object if authentication successful, None otherwise
    """
    user = None
    
    # Find user by email, username, or device_id
    if email:
        user = db.query(User).filter(User.email == email).first()
    elif username:
        user = db.query(User).filter(User.username == username).first()
    elif device_id:
        user = db.query(User).filter(User.device_id == device_id).first()
    
    if not user:
        return None
    
    # For passwordless auth (device_id provided), skip password verification
    if device_id and user.device_id == device_id:
        return user
        
    # For password auth, verify password if provided
    if password and user.password_hash:
        if not verify_password(password, user.password_hash):
            return None
        return user
    
    # If user has no password set (passwordless account), allow access with email/username
    if not user.password_hash and (email or username):
        return user
    
    return None


def get_current_user_id(token: str) -> str:
    """
    Extract user ID from JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        User ID string
    
    Raises:
        HTTPException: If token is invalid or user ID not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    return user_id


def create_user_token(user: User) -> str:
    """
    Create JWT token for user.
    
    Args:
        user: User object
    
    Returns:
        JWT token string
    """
    token_data = {
        "sub": user.id,  # Subject (user ID)
        "email": user.email,
        "username": user.username,
        "iat": datetime.utcnow().timestamp(),  # Issued at
    }
    
    return create_access_token(token_data)


def hash_password(password: str) -> str:
    """
    Hash a password for storage.
    
    Args:
        password: Plain text password
    
    Returns:
        Hashed password string
    """
    return get_password_hash(password)


def generate_device_id() -> str:
    """Generate a unique device ID."""
    timestamp = str(int(datetime.now().timestamp()))
    random_part = secrets.token_hex(8)
    return f"device_{timestamp}_{random_part}"
