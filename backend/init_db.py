#!/usr/bin/env python3
"""
Database initialization script.
Creates all tables and sets up the WordMate database.
"""
import sys
import asyncio
from sqlalchemy import text

from app.core.config import settings
from app.db.database import engine, Base
from app.models.database import User, UserWord, Session, SessionAnswer, Payment, Event


async def create_database_if_not_exists():
    """Create the database if it doesn't exist."""
    print(f"📝 Checking if database '{settings.MYSQL_DATABASE}' exists...")
    
    # Create connection to MySQL server (not specific database)
    server_url = (
        f"mysql+pymysql://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}"
        f"@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}"
        f"?charset=utf8mb4"
    )
    
    from sqlalchemy import create_engine
    server_engine = create_engine(server_url)
    
    try:
        with server_engine.connect() as conn:
            # Check if database exists
            result = conn.execute(
                text("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = :db_name"),
                {"db_name": settings.MYSQL_DATABASE}
            )
            
            if not result.fetchone():
                print(f"🔨 Creating database '{settings.MYSQL_DATABASE}'...")
                conn.execute(text(f"CREATE DATABASE {settings.MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                conn.commit()
                print(f"✅ Database '{settings.MYSQL_DATABASE}' created successfully!")
            else:
                print(f"✅ Database '{settings.MYSQL_DATABASE}' already exists.")
                
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False
    finally:
        server_engine.dispose()
    
    return True


async def create_tables():
    """Create all database tables."""
    print("📝 Creating database tables...")
    
    try:
        # Test database connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connection successful!")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully!")
        
        # List created tables
        with engine.connect() as conn:
            result = conn.execute(text("SHOW TABLES"))
            tables = [row[0] for row in result]
            print(f"📋 Created tables: {', '.join(tables)}")
            
        return True
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False


async def verify_setup():
    """Verify the database setup."""
    print("🔍 Verifying database setup...")
    
    try:
        with engine.connect() as conn:
            # Check each table exists and has correct structure
            tables_to_check = ['users', 'user_words', 'sessions', 'session_answers', 'payments', 'events']
            
            for table in tables_to_check:
                result = conn.execute(text(f"DESCRIBE {table}"))
                columns = [row[0] for row in result]
                print(f"✅ Table '{table}' has {len(columns)} columns")
            
            print("✅ Database verification completed!")
            return True
            
    except Exception as e:
        print(f"❌ Database verification failed: {e}")
        return False


async def main():
    """Main initialization function."""
    print("🚀 Starting WordMate database initialization...")
    print(f"📍 Target database: {settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}")
    print(f"👤 User: {settings.MYSQL_USER}")
    print()
    
    # Step 1: Create database
    if not await create_database_if_not_exists():
        print("❌ Failed to create database. Exiting.")
        sys.exit(1)
    
    print()
    
    # Step 2: Create tables
    if not await create_tables():
        print("❌ Failed to create tables. Exiting.")
        sys.exit(1)
    
    print()
    
    # Step 3: Verify setup
    if not await verify_setup():
        print("❌ Database verification failed. Exiting.")
        sys.exit(1)
    
    print()
    print("🎉 WordMate database initialization completed successfully!")
    print("🔥 Your backend is ready to rock!")


if __name__ == "__main__":
    asyncio.run(main())
