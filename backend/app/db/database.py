"""
Database connection and session management.
Uses SQLAlchemy with MySQL connection pooling.
"""
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from app.core.config import settings

# Create database engine with optimized settings
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Validates connections before use
    pool_recycle=3600,   # Recycle connections every hour
    echo=settings.DEBUG,  # Log SQL queries in debug mode
)

# Configure session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for database models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Database dependency for FastAPI.
    Provides a database session and ensures proper cleanup.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Event listeners for connection optimization
@event.listens_for(engine, "connect")
def set_mysql_pragma(dbapi_connection, connection_record):
    """Set MySQL connection parameters for optimal performance."""
    with dbapi_connection.cursor() as cursor:
        # Set timezone to UTC
        cursor.execute("SET time_zone = '+00:00'")
        # Enable strict mode
        cursor.execute("SET sql_mode = 'STRICT_TRANS_TABLES'")
        # Optimize for InnoDB
        cursor.execute("SET innodb_lock_wait_timeout = 5")


async def test_database_connection() -> bool:
    """
    Test database connectivity.
    Returns True if connection is successful.
    """
    try:
        from sqlalchemy import text
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1 as test"))
            return result.scalar() == 1
    except Exception as e:
        print(f"Database connection test failed: {e}")
        return False
