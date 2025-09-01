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
│   ├── payment/
│   │   ├── alipay/
│   │   │   ├── create.js               # POST /api/payment/alipay/create
│   │   │   ├── notify.js               # POST /api/payment/alipay/notify
│   │   │   └── verify/
│   │   │       └── [id].js             # GET /api/payment/alipay/verify/{id}
│   │   └── wechat/
│   │       ├── create.js               # POST /api/payment/wechat/create
│   │       ├── notify.js               # POST /api/payment/wechat/notify
│   │       └── verify/
│   │           └── [id].js             # GET /api/payment/wechat/verify/{id}
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
| `/functions/api/payment/alipay/create.js` | `/api/payment/alipay/create` | Create Alipay payments |
| `/functions/api/payment/alipay/verify/[id].js` | `/api/payment/alipay/verify/{id}` | Verify Alipay payments |
| `/functions/api/payment/alipay/notify.js` | `/api/payment/alipay/notify` | Alipay webhooks |
| `/functions/api/payment/wechat/create.js` | `/api/payment/wechat/create` | Create WeChat Pay payments |
| `/functions/api/payment/wechat/verify/[id].js` | `/api/payment/wechat/verify/{id}` | Verify WeChat Pay payments |
| `/functions/api/payment/wechat/notify.js` | `/api/payment/wechat/notify` | WeChat Pay webhooks |
| `/functions/api/health.js` | `/api/health` | Health check |

## Environment Setup

1. **KV Namespace**: Configure `WORDMATE_KV` in EdgeOne dashboard
2. **Environment Variables**:
   - `JWT_SECRET`: Secret key for JWT token signing
   - `APP_ENV`: Environment (development/production)
   
3. **Payment Configuration**:
   - **Alipay**:
     - `ALIPAY_APP_ID`: Alipay application ID
     - `ALIPAY_PRIVATE_KEY`: Alipay merchant private key
     - `ALIPAY_PUBLIC_KEY`: Alipay public key
   - **WeChat Pay**:
     - `WECHAT_APP_ID`: WeChat Pay application ID
     - `WECHAT_MCH_ID`: WeChat Pay merchant ID
     - `WECHAT_PRIVATE_KEY`: Merchant private key PEM (apiclient_key.pem, PKCS#8)
     - `WECHAT_SERIAL_NO`: Merchant certificate serial number (serial_no)
     - `WECHAT_APIV3_KEY`: WeChat Pay API v3 key (32 characters)
     - Optional: `WECHAT_PLATFORM_PUBLIC_KEY_{serial}`: WeChat platform PUBLIC KEY (PEM) for signature verification, keyed by certificate serial
   - **Sandbox (Development)** (optional):
     - `WECHAT_SANDBOX_APP_ID`: Sandbox application ID
     - `WECHAT_SANDBOX_MCH_ID`: Sandbox merchant ID
     - `WECHAT_SANDBOX_PRIVATE_KEY`: Sandbox private key
     - `WECHAT_SANDBOX_PUBLIC_KEY`: Sandbox public certificate
     - `WECHAT_SANDBOX_APIV3_KEY`: Sandbox API v3 key

Notes:
- The backend signs requests using RSASSA-PKCS1-v1_5 with SHA-256 via Web Crypto.
- For notification signature verification, the function will use `WECHAT_PLATFORM_PUBLIC_KEY_{serial}` if present. When absent, it will fetch platform certificates from `/v3/certificates` and cache raw certificates in KV as `WECHAT_PLATFORM_CERT_{serial}`. You can paste the corresponding platform PUBLIC KEY into `WECHAT_PLATFORM_PUBLIC_KEY_{serial}` to enable verification on Edge runtime.

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

### Payment Operations

#### Create Alipay Payment
```javascript
POST /api/payment/alipay/create
{
  "subject": "WordMate高级会员",
  "out_trade_no": "WM_premium_user123_1640995200000_abc123",
  "total_amount": 38.00,
  "return_url": "https://wordmate.com/payment/success",
  "attach": "user123"
}
```

#### Verify Alipay Payment
```javascript
GET /api/payment/alipay/verify/WM_premium_user123_1640995200000_abc123
```

#### Create WeChat Pay Payment
```javascript
POST /api/payment/wechat/create
{
  "description": "WordMate高级会员",
  "out_trade_no": "WM_premium_user123_1640995200000_abc123",
  "amount": {
    "total": 3800,
    "currency": "CNY"
  },
  "attach": "user123"
}
```

#### Verify WeChat Pay Payment
```javascript
GET /api/payment/wechat/verify/WM_premium_user123_1640995200000_abc123
```
