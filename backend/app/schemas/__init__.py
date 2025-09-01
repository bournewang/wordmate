"""
Pydantic schemas for request/response validation.
Ensures type safety and automatic API documentation.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from enum import Enum

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# Enums
class PracticeType(str, Enum):
    flashcard = "flashcard"
    typing = "typing"
    choice = "choice"


class PlanStatus(str, Enum):
    trial = "trial"
    active = "active"
    expired = "expired"


class PaymentMethod(str, Enum):
    alipay = "alipay"
    wechat = "wechat"


class PaymentStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


# Base schemas
class BaseResponse(BaseModel):
    """Standard API response format."""
    success: bool = True
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class ErrorResponse(BaseModel):
    """Standard error response format."""
    success: bool = False
    error: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.now)


# User schemas
class UserBase(BaseModel):
    """Base user schema."""
    username: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    grade: str = Field(default="grade6", pattern=r"^grade[1-9]$")


class UserCreate(UserBase):
    """User creation schema."""
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    device_id: Optional[str] = Field(None, description="Device identifier for passwordless auth")
    trial_data: Optional[Dict[str, Any]] = None  # Anonymous trial data to import


class UserLogin(BaseModel):
    """User login schema."""
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: Optional[str] = None
    device_id: Optional[str] = Field(None, description="Device identifier for passwordless auth")
    
    @field_validator('email', 'username')
    @classmethod
    def validate_email_or_username(cls, v, info):
        # This will be called for each field, we validate in model_validator instead
        return v
    
    @model_validator(mode='after')
    def validate_credentials(self):
        if not self.email and not self.username and not self.device_id:
            raise ValueError("Either email, username, or device_id must be provided")
        return self


class UserResponse(UserBase):
    """User response schema."""
    id: str
    registered_from_trial: bool
    total_words_learned: int
    current_streak: int
    max_streak: int
    last_active_date: Optional[date]
    plan: str
    plan_status: PlanStatus
    plan_expires_at: Optional[datetime]
    created_at: datetime
    last_login_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class AuthResponse(BaseResponse):
    """Authentication response schema."""
    data: Dict[str, Any]  # Contains user and token


# Word progress schemas
class WordProgressBase(BaseModel):
    """Base word progress schema."""
    word_id: str
    mastery_level: float = Field(default=0.0, ge=0.0, le=5.0)
    repetitions: int = Field(default=0, ge=0)
    ease_factor: float = Field(default=2.5, ge=1.3, le=5.0)
    last_review: Optional[date] = None
    next_review: Optional[date] = None
    seen_count: int = Field(default=0, ge=0)
    correct_count: int = Field(default=0, ge=0)


class WordProgressCreate(WordProgressBase):
    """Word progress creation schema."""
    pass


class WordProgressUpdate(BaseModel):
    """Word progress update schema."""
    is_correct: bool
    response_time_ms: int = Field(default=0, ge=0)
    quality_score: int = Field(default=0, ge=0, le=5)


class WordProgressResponse(WordProgressBase):
    """Word progress response schema."""
    user_id: str
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Session schemas
class SessionAnswerBase(BaseModel):
    """Base session answer schema."""
    word_id: str
    is_correct: bool
    response_time_ms: int = Field(default=0, ge=0)
    quality_score: int = Field(default=0, ge=0, le=5)


class SessionAnswerCreate(SessionAnswerBase):
    """Session answer creation schema."""
    pass


class SessionBase(BaseModel):
    """Base session schema."""
    practice_type: PracticeType
    words_count: int = Field(default=0, ge=0)
    correct_count: int = Field(default=0, ge=0)
    accuracy: float = Field(default=0.0, ge=0.0, le=100.0)
    duration_seconds: int = Field(default=0, ge=0)


class SessionStart(BaseModel):
    """Session start schema."""
    practice_type: PracticeType


class SessionComplete(BaseModel):
    """Session completion schema."""
    words_count: int = Field(..., ge=0)
    correct_count: int = Field(..., ge=0)
    duration_seconds: int = Field(..., ge=0)
    answers: List[SessionAnswerCreate] = []


class SessionResponse(SessionBase):
    """Session response schema."""
    id: int
    user_id: str
    started_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Payment schemas
class PaymentCreate(BaseModel):
    """Payment creation schema."""
    amount: Decimal = Field(..., gt=0, max_digits=8, decimal_places=2)
    method: PaymentMethod
    plan_id: Optional[str] = None  # For subscription payments


class PaymentResponse(BaseModel):
    """Payment response schema."""
    id: int
    user_id: str
    amount: Decimal
    currency: str
    method: PaymentMethod
    status: PaymentStatus
    out_trade_no: str
    gateway_txn_id: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Progress sync schemas
class ProgressSyncData(BaseModel):
    """Progress sync data schema."""
    words: List[WordProgressBase] = []
    sessions: List[Dict[str, Any]] = []  # Recent session summaries
    stats: Dict[str, Any] = {}  # User statistics


class ProgressSyncRequest(BaseModel):
    """Progress sync request schema."""
    local_progress: ProgressSyncData


class ProgressSyncResponse(BaseResponse):
    """Progress sync response schema."""
    data: Dict[str, Any]  # Contains server progress and conflicts


# API response wrappers
class UserResponseWrapper(BaseResponse):
    """User response wrapper."""
    data: UserResponse


class SessionResponseWrapper(BaseResponse):
    """Session response wrapper."""
    data: SessionResponse


class PaymentResponseWrapper(BaseResponse):
    """Payment response wrapper."""
    data: PaymentResponse


class WordProgressListWrapper(BaseResponse):
    """Word progress list wrapper."""
    data: List[WordProgressResponse]


# Health check schema
class HealthCheck(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str = "1.0.0"
    database_connected: bool
    timestamp: datetime = Field(default_factory=datetime.now)
