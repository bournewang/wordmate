/**
 * EdgeOne Pages Function: Authentication
 * 
 * File path: /functions/api/auth/login.js
 * Routes to: example.com/api/auth/login
 * 
 * Handles user authentication with device-based identification
 */

// Handle POST requests for login
export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { deviceId, email, username, grade } = body;

    // Validate required fields
    if (!deviceId) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Device ID is required', corsHeaders);
    }

    console.log(`🔐 Login attempt for device: ${deviceId}`);

    // Step 1: Check if user exists by device ID
    let userId = await WORDMATE.get(`device:${deviceId}`);
    let isNewUser = false;
    let isNewDevice = false;

    // Step 2: If no user found by device, check by email
    if (!userId && email) {
      console.log(`📧 Checking for existing user with email: ${email}`);
      userId = await WORDMATE.get(`email:${email}`);
      
      if (userId) {
        // Existing user on new device - link the device
        console.log(`🔗 Linking new device ${deviceId} to existing user ${userId}`);
        await WORDMATE.put(`device:${deviceId}`, userId);
        isNewDevice = true;
        
        // Update the user's device ID to the latest one (optional)
        const existingUser = await WORDMATE.get(`user:${userId}`, 'json');
        if (existingUser) {
          existingUser.deviceId = deviceId; // Update to latest device
          existingUser.lastSyncAt = new Date().toISOString();
          existingUser.updatedAt = new Date().toISOString();
          await WORDMATE.put(`user:${userId}`, JSON.stringify(existingUser));
        }
      }
    }

    // Step 3: If still no user found, create new user
    if (!userId) {
      userId = `user_${generateId()}`;
      isNewUser = true;
      
      console.log(`👤 Creating new user: ${userId}`);
      
      // Check if email is already taken (safety check)
      if (email) {
        const existingEmailUser = await WORDMATE.get(`email:${email}`);
        if (existingEmailUser) {
          return createErrorResponse(409, 'EMAIL_TAKEN', 'Email already registered on another account', corsHeaders);
        }
      }
      
      // Create user account
      const user = {
        id: userId,
        email: email || null,
        username: username || `User_${deviceId.slice(-6)}`,
        deviceId,
        grade: grade || 'grade6',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save user data
      await WORDMATE.put(`user:${userId}`, JSON.stringify(user));
      
      // Create device mapping
      await WORDMATE.put(`device:${deviceId}`, userId);
      
      // Create email mapping if provided
      if (email) {
        await WORDMATE.put(`email:${email}`, userId);
      }

      // Initialize empty progress
      const emptyProgress = {
        userId,
        totalWordsLearned: 0,
        currentStreak: 0,
        maxStreak: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
        wordProgress: [],
        recentSessionDates: [],
        version: 1,
        lastSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await WORDMATE.put(`progress:${userId}`, JSON.stringify(emptyProgress));

    } else {
      // Existing user - update last login
      console.log(`👤 Existing user login: ${userId}`);
      
      const userKey = `user:${userId}`;
      const existingUser = await WORDMATE.get(userKey, 'json');
      
      if (existingUser) {
        // Update user info if provided
        let updated = false;
        if (email && existingUser.email !== email) {
          existingUser.email = email;
          updated = true;
        }
        if (username && existingUser.username !== username) {
          existingUser.username = username;
          updated = true;
        }
        if (grade && existingUser.grade !== grade) {
          existingUser.grade = grade;
          updated = true;
        }
        
        if (updated) {
          existingUser.updatedAt = new Date().toISOString();
          await WORDMATE.put(userKey, JSON.stringify(existingUser));
        }
        
        // Update last sync time
        existingUser.lastSyncAt = new Date().toISOString();
        await WORDMATE.put(userKey, JSON.stringify(existingUser));
      }
    }

    // Generate JWT token
    const token = await generateJWT({
      userId,
      deviceId,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    }, env.JWT_SECRET || 'default-secret');

    // Get user data for response
    const user = await WORDMATE.get(`user:${userId}`, 'json');

    return new Response(JSON.stringify({
      success: true,
      data: {
        user,
        token,
        isNewUser,
        isNewDevice
      },
      message: isNewUser ? 'New account created' : 
               isNewDevice ? 'Existing account linked to new device' : 
               'Welcome back',
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return createErrorResponse(500, 'LOGIN_ERROR', error.message, corsHeaders);
  }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

/**
 * Generate a simple JWT token
 */
async function generateJWT(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const message = `${encodedHeader}.${encodedPayload}`;
  
  // Simple HMAC-SHA256 simulation (in production, use Web Crypto API)
  const signature = btoa(`${message}.${secret}`).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${message}.${signature}`;
}

/**
 * Generate unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Create standardized error response
 */
function createErrorResponse(status, code, message, corsHeaders) {
  return new Response(JSON.stringify({
    success: false,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
