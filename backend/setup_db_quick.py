#!/usr/bin/env python3
"""
Quick database setup script for development.
Sets up WordMate database with default development settings.
"""
import subprocess
import sys
import getpass
from pathlib import Path

def run_mysql_command(command, password=None):
    """Run a MySQL command."""
    if password:
        cmd = f'mysql -u root -p{password} -e "{command}"'
    else:
        cmd = f'mysql -u root -e "{command}"'
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Error: {result.stderr}")
            return False
        return True
    except Exception as e:
        print(f"❌ Error running command: {e}")
        return False

def main():
    print("🚀 WordMate Database Quick Setup")
    print("=" * 40)
    
    # Get MySQL root password
    print("Enter MySQL root password (or press Enter if no password):")
    root_password = getpass.getpass("Root password: ")
    
    if not root_password:
        root_password = None
    
    print("\n📝 Setting up database and user...")
    
    # Create database and user
    commands = [
        "CREATE DATABASE IF NOT EXISTS wordmate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
        "CREATE DATABASE IF NOT EXISTS wordmate_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
        "CREATE USER IF NOT EXISTS 'wordmate_user'@'localhost' IDENTIFIED BY 'wordmate_password';",
        "GRANT ALL PRIVILEGES ON wordmate.* TO 'wordmate_user'@'localhost';",
        "GRANT ALL PRIVILEGES ON wordmate_test.* TO 'wordmate_user'@'localhost';",
        "FLUSH PRIVILEGES;"
    ]
    
    success = True
    for cmd in commands:
        if not run_mysql_command(cmd, root_password):
            success = False
            break
    
    if not success:
        print("❌ Failed to set up database. Please check your MySQL configuration.")
        sys.exit(1)
    
    print("✅ Database and user created successfully!")
    
    # Update .env file
    env_file = Path(".env")
    if env_file.exists():
        print("\n📝 Updating .env file...")
        content = env_file.read_text()
        
        # Update database credentials
        lines = content.split('\n')
        updated_lines = []
        
        for line in lines:
            if line.startswith('MYSQL_USER='):
                updated_lines.append('MYSQL_USER=wordmate_user')
            elif line.startswith('MYSQL_PASSWORD='):
                updated_lines.append('MYSQL_PASSWORD=wordmate_password')
            elif line.startswith('MYSQL_DATABASE='):
                updated_lines.append('MYSQL_DATABASE=wordmate')
            else:
                updated_lines.append(line)
        
        env_file.write_text('\n'.join(updated_lines))
        print("✅ .env file updated!")
    
    print("\n🔧 Running database initialization...")
    
    # Run the initialization script
    try:
        result = subprocess.run([sys.executable, "init_db.py"], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Database tables created successfully!")
            print(result.stdout)
        else:
            print("❌ Failed to initialize database tables:")
            print(result.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"❌ Error running init_db.py: {e}")
        sys.exit(1)
    
    print("\n🧪 Testing the setup...")
    
    # Test the connection
    try:
        from app.main import app
        from fastapi.testclient import TestClient
        
        client = TestClient(app)
        response = client.get('/health')
        health_data = response.json()
        
        if health_data.get('database_connected'):
            print("✅ Database connection test passed!")
        else:
            print("⚠️  Database connection test failed, but tables were created.")
            
    except Exception as e:
        print(f"⚠️  Could not test connection: {e}")
    
    print("\n🎉 WordMate database setup completed!")
    print("\n📋 Summary:")
    print(f"   • Database: wordmate")
    print(f"   • User: wordmate_user")
    print(f"   • Password: wordmate_password")
    print(f"   • Tables: users, user_words, sessions, session_answers, payments, events")
    
    print("\n🔥 Your backend is ready! You can now:")
    print("   • Run the FastAPI server: uvicorn app.main:app --reload")
    print("   • Run tests: python -m pytest tests/test_auth.py -v")
    print("   • Check health: curl http://localhost:8000/health")

if __name__ == "__main__":
    main()
