"""
SQLAlchemy database models.
Matches the optimized MySQL schema with auto-increment IDs.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, DECIMAL, Date, 
    DateTime, Text, JSON, Enum as SQLEnum, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class User(Base):
    """User model - registered users only."""
    __tablename__ = "users"
    
    id = Column(String(50), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=True)  # Made optional for passwordless auth
    device_id = Column(String(100), nullable=True)  # For device-based auth
    grade = Column(String(20), default="grade6")
    
    # Trial conversion tracking
    registered_from_trial = Column(Boolean, default=False)
    
    # Progress stats (denormalized for performance)
    total_words_learned = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    max_streak = Column(Integer, default=0)
    last_active_date = Column(Date, nullable=True)
    
    # Subscription (embedded)
    plan = Column(String(50), default="free-trial")
    plan_status = Column(SQLEnum("trial", "active", "expired", name="plan_status"), default="trial")
    plan_expires_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime, nullable=True)
    
    # Relationships
    user_words = relationship("UserWord", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="user")
    
    # Indexes defined in schema creation
    __table_args__ = (
        Index("idx_email", "email"),
        Index("idx_device_id", "device_id"),
        Index("idx_plan_expires", "plan_expires_at"),
        Index("idx_last_active", "last_active_date"),
        Index("idx_plan_status", "plan_status"),
    )


class UserWord(Base):
    """User word progress - spaced repetition data."""
    __tablename__ = "user_words"
    
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    word_id = Column(String(100), primary_key=True)  # References JSON vocabulary
    
    # Spaced repetition core data
    mastery_level = Column(DECIMAL(3, 1), default=0.0)  # 0.0 to 5.0
    repetitions = Column(Integer, default=0)
    ease_factor = Column(DECIMAL(3, 1), default=2.5)
    last_review = Column(Date, nullable=True)
    next_review = Column(Date, nullable=True)
    
    # Simple counters
    seen_count = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="user_words")
    
    # Indexes for review queries
    __table_args__ = (
        Index("idx_review_due", "user_id", "next_review"),
        Index("idx_mastery", "user_id", "mastery_level"),
        Index("idx_last_review", "user_id", "last_review"),
        Index("idx_user_words_review_compound", "user_id", "next_review", "mastery_level"),
    )


class Session(Base):
    """Practice sessions with auto-increment ID for performance."""
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    practice_type = Column(SQLEnum("flashcard", "typing", "choice", name="practice_type"), nullable=False)
    
    # Results summary
    words_count = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    accuracy = Column(DECIMAL(4, 1), default=0.0)
    duration_seconds = Column(Integer, default=0)
    
    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    session_answers = relationship("SessionAnswer", back_populates="session", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_user_date", "user_id", "started_at"),
        Index("idx_completed", "completed_at"),
        Index("idx_user_completed", "user_id", "completed_at"),
        Index("idx_sessions_user_completed_compound", "user_id", "completed_at", "started_at"),
    )


class SessionAnswer(Base):
    """Session answers with auto-increment for high performance."""
    __tablename__ = "session_answers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    word_id = Column(String(100), nullable=False)  # References JSON vocabulary
    is_correct = Column(Boolean, nullable=False)
    response_time_ms = Column(Integer, default=0)
    quality_score = Column(Integer, default=0)  # 0-5 for spaced repetition
    
    # Relationships
    session = relationship("Session", back_populates="session_answers")
    
    # Indexes for analytics
    __table_args__ = (
        Index("idx_session", "session_id"),
        Index("idx_word_performance", "word_id", "is_correct"),
        Index("idx_session_word", "session_id", "word_id"),
        Index("idx_session_answers_performance", "session_id", "is_correct", "response_time_ms"),
    )


class Payment(Base):
    """Payments with auto-increment and string trade numbers."""
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(8, 2), nullable=False)
    currency = Column(String(10), default="CNY")
    method = Column(SQLEnum("alipay", "wechat", name="payment_method"), nullable=False)
    status = Column(SQLEnum("pending", "completed", "failed", name="payment_status"), nullable=False)
    
    # Gateway identifiers (strings for external compatibility)
    out_trade_no = Column(String(200), unique=True, nullable=False)
    gateway_txn_id = Column(String(200), nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="payments")
    
    # Indexes for payment lookups
    __table_args__ = (
        Index("idx_user", "user_id"),
        Index("idx_status", "status"),
        Index("idx_trade_no", "out_trade_no"),
        Index("idx_payments_created", "created_at"),
    )


class Event(Base):
    """System events with auto-increment for high-volume logging."""
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    anonymous_session_id = Column(String(100), nullable=True)  # Track anonymous users
    event_type = Column(
        SQLEnum("anonymous_trial", "registration", "login", "payment", "session", "sync", "error", 
                name="event_type"), 
        nullable=False
    )
    event_data = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="events")
    
    # Indexes for event queries
    __table_args__ = (
        Index("idx_user_type", "user_id", "event_type"),
        Index("idx_anonymous_session", "anonymous_session_id", "event_type"),
        Index("idx_events_created", "created_at"),
        Index("idx_event_type", "event_type"),
    )
