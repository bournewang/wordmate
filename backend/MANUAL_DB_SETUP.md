# Manual Database Setup Instructions

Since the MySQL root password is not accessible via automation, here's how to set up the database manually:

## Step 1: Connect to MySQL

Try each of these commands until one works:

```bash
# Option 1: Root with no password (most common on fresh installs)
mysql -u root

# Option 2: Root with password (you set during installation)
mysql -u root -p

# Option 3: Using the system user (on some macOS setups)
sudo mysql -u root
```

## Step 2: Run the Database Setup

Once connected to MySQL, run these commands:

```sql
-- Create databases
CREATE DATABASE IF NOT EXISTS wordmate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS wordmate_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER IF NOT EXISTS 'wordmate_user'@'localhost' IDENTIFIED BY 'wordmate_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON wordmate.* TO 'wordmate_user'@'localhost';
GRANT ALL PRIVILEGES ON wordmate_test.* TO 'wordmate_user'@'localhost';
FLUSH PRIVILEGES;

-- Verify setup
SHOW DATABASES LIKE 'wordmate%';
SHOW GRANTS FOR 'wordmate_user'@'localhost';

-- Exit MySQL
EXIT;
```

## Step 3: Update Environment Configuration

Update the `.env` file with these values:

```env
MYSQL_USER=wordmate_user
MYSQL_PASSWORD=wordmate_password
MYSQL_DATABASE=wordmate
```

## Step 4: Initialize Tables

Run the initialization script:

```bash
python init_db.py
```

## Step 5: Test the Setup

```bash
# Test the health endpoint
python -c "
from app.main import app
from fastapi.testclient import TestClient
client = TestClient(app)
response = client.get('/health')
print(f'Health: {response.json()}')
"

# Run authentication tests
python -m pytest tests/test_auth.py -v
```

## Alternative: Use SQLite for Development

If MySQL setup is problematic, you can use SQLite for development by updating your config:

1. **Create a development config file** `.env.dev`:
```env
# SQLite configuration for development
MYSQL_HOST=
MYSQL_PORT=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=

# This will make the app use SQLite
DATABASE_URL=sqlite:///./wordmate_dev.db

JWT_SECRET_KEY=dev_jwt_secret_key_not_for_production
DEBUG=True
```

2. **Update the database configuration** in `app/core/config.py` to handle SQLite:
```python
@property
def DATABASE_URL(self) -> str:
    if hasattr(self, 'DATABASE_URL') and self.DATABASE_URL:
        return self.DATABASE_URL
    return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}?charset=utf8mb4"
```

3. **Run with development config**:
```bash
ENV_FILE=.env.dev python -m uvicorn app.main:app --reload
```

---

Choose the approach that works best for your setup! The tests are already passing with SQLite, so either option will work.
