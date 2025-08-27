# WordMate EdgeOne Pages Functions

This directory contains EdgeOne Pages Functions for WordMate backend API.

## File Structure

```
functions/
├── api/
│   ├── auth/
│   │   └── login.js                    # POST /api/auth/login
│   ├── progress/
│   │   └── [userId]/
│   │       └── sync.js                 # GET/POST /api/progress/{userId}/sync
│   ├── user/
│   │   └── [userId].js                 # GET/PUT /api/user/{userId}
│   ├── devices/
│   │   └── link.js                     # POST /api/devices/link
│   └── health.js                       # GET /api/health
└── index.js                           # GET / (optional root handler)
```

## Routes Generated

Based on EdgeOne Pages routing rules:

| File Path | Route | Description |
|-----------|-------|-------------|
| `/functions/api/auth/login.js` | `/api/auth/login` | User authentication |
| `/functions/api/progress/[userId]/sync.js` | `/api/progress/{userId}/sync` | Progress sync |
| `/functions/api/user/[userId].js` | `/api/user/{userId}` | User management |
| `/functions/api/devices/link.js` | `/api/devices/link` | Device linking |
| `/functions/api/health.js` | `/api/health` | Health check |

## Environment Setup

1. **KV Namespace**: Configure `WORDMATE_KV` in EdgeOne dashboard
2. **Environment Variables**:
   - `JWT_SECRET`: Secret key for JWT token signing
   - `APP_ENV`: Environment (development/production)

## Deployment

1. Initialize EdgeOne Pages project:
   ```bash
   npm install -g edgeone
   edgeone pages init
   ```

2. Link to your EdgeOne project:
   ```bash
   edgeone pages link
   ```

3. Local development:
   ```bash
   edgeone pages dev
   ```

4. Deploy: Push to your repository for auto-deployment

## Usage Examples

### Authentication
```javascript
POST /api/auth/login
{
  "deviceId": "device_abc123",
  "email": "user@example.com",
  "username": "John Doe"
}
```

### Progress Sync
```javascript
POST /api/progress/user123/sync
Authorization: Bearer {token}
{
  "localProgress": { /* user progress data */ },
  "lastSyncVersion": 1,
  "deviceInfo": { /* device info */ }
}
```

### Get User Info
```javascript
GET /api/user/user123
Authorization: Bearer {token}
```
