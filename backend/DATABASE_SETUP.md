# WordMate Database Setup Guide

## 📋 Prerequisites

### 1. Install MySQL Server

**macOS (using Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

**Windows:**
Download and install from: https://dev.mysql.com/downloads/mysql/

### 2. Install Python MySQL Driver

The PyMySQL driver is already included in `requirements.txt`, but if needed:
```bash
pip install pymysql
```

## 🔧 Database Setup Steps

### Step 1: Configure MySQL

1. **Secure MySQL installation (recommended):**
   ```bash
   sudo mysql_secure_installation
   ```

2. **Create database user:**
   ```sql
   mysql -u root -p
   
   -- Create user for WordMate
   CREATE USER 'wordmate_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';
   
   -- Grant privileges
   GRANT ALL PRIVILEGES ON wordmate.* TO 'wordmate_user'@'localhost';
   GRANT ALL PRIVILEGES ON wordmate_test.* TO 'wordmate_user'@'localhost';
   
   -- Apply changes
   FLUSH PRIVILEGES;
   
   -- Exit MySQL
   EXIT;
   ```

### Step 2: Update Configuration

1. **Edit `.env` file:**
   ```bash
   nano /Users/wangxiaopei/work/wordmate/backend/.env
   ```

2. **Update these values:**
   ```env
   MYSQL_USER=wordmate_user
   MYSQL_PASSWORD=your_secure_password_here
   MYSQL_DATABASE=wordmate
   
   # IMPORTANT: Change these in production!
   JWT_SECRET_KEY=your_super_secret_jwt_key_change_this_in_production_256_bits_long
   ```

### Step 3: Initialize Database

Run the initialization script:
```bash
cd /Users/wangxiaopei/work/wordmate/backend
python init_db.py
```

This script will:
- ✅ Create the `wordmate` database if it doesn't exist
- ✅ Create all required tables (users, sessions, payments, etc.)
- ✅ Set up indexes for optimal performance
- ✅ Verify the setup

## 🧪 Testing the Setup

### Test Database Connection
```bash
# Test the health endpoint
python -c "
from app.main import app
from fastapi.testclient import TestClient
client = TestClient(app)
response = client.get('/health')
print(f'Health: {response.json()}')
"
```

### Run Authentication Tests
```bash
# Run all tests to verify everything works
python -m pytest tests/test_auth.py -v
```

## 📊 Database Schema

The system creates these tables:

### Core Tables
- **`users`** - User accounts and profiles
- **`user_words`** - Spaced repetition progress per word
- **`sessions`** - Practice session records
- **`session_answers`** - Individual answers within sessions

### System Tables  
- **`payments`** - Payment transactions
- **`events`** - System event logging

### Key Features
- **Optimized indexes** for fast queries
- **Foreign key constraints** for data integrity
- **UTF8MB4 encoding** for full Unicode support (emojis, Chinese characters)
- **Auto-increment IDs** for high-performance inserts

## 🔒 Security Notes

### Production Checklist
- [ ] Change default passwords in `.env`
- [ ] Use strong JWT secret key (256+ bits)
- [ ] Restrict database user permissions
- [ ] Enable SSL for database connections
- [ ] Set up database backups
- [ ] Configure firewall rules

### Environment Files
- **`.env`** - Production configuration
- **`.env.test`** - Test environment (uses SQLite)

## 🚨 Troubleshooting

### Common Issues

**"Can't connect to MySQL server"**
```bash
# Check if MySQL is running
brew services list | grep mysql
# or
sudo systemctl status mysql

# Start MySQL if needed
brew services start mysql
```

**"Access denied for user"**
- Verify username/password in `.env`
- Check user exists: `SELECT User FROM mysql.user;`
- Check privileges: `SHOW GRANTS FOR 'wordmate_user'@'localhost';`

**"Database does not exist"**
- The `init_db.py` script creates it automatically
- Or create manually: `CREATE DATABASE wordmate;`

**"Table already exists"**
- This is normal if you run the script multiple times
- Tables are created with `IF NOT EXISTS` logic

## 📈 Performance Optimization

The schema includes optimized indexes:
- **User lookups**: email, plan status, expiry dates  
- **Progress queries**: review dates, mastery levels
- **Session analytics**: user sessions, completion times
- **Payment tracking**: transaction lookups
- **Event logging**: time-based queries

## 🔄 Migrations

For schema changes, create migration scripts in a `migrations/` folder:
```bash
# Future migration example
python -c "
from sqlalchemy import text
from app.db.database import engine

with engine.connect() as conn:
    conn.execute(text('ALTER TABLE users ADD COLUMN new_field VARCHAR(255)'))
    conn.commit()
"
```

---

✅ **Once setup is complete, your WordMate backend will be ready for production!**
