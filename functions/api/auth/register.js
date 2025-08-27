/**
 * Optional Enhanced Registration Endpoint
 * 
 * File path: /functions/api/auth/register.js
 * Routes to: example.com/api/auth/register
 * 
 * For users who want explicit registration with more control
 * This is OPTIONAL - the login endpoint already handles auto-registration
 */

// Handle POST requests for explicit registration
export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { deviceId, email, username, grade, preferences } = body;

    // Validate required fields for explicit registration
    if (!deviceId) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Device ID is required', corsHeaders);
    }
    
    if (!email) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Email is required for registration', corsHeaders);
    }

    if (!username) {
      return createErrorResponse(400, 'VALIDATION_ERROR', 'Username is required for registration', corsHeaders);
    }

    console.log(`📝 Registration attempt for device: ${deviceId}`);

    // Check if user already exists by device ID
    const existingUserId = await env.WORDMATE_KV.get(`device:${deviceId}`);
    if (existingUserId) {
      return createErrorResponse(409, 'USER_EXISTS', 'User already registered on this device', corsHeaders);
    }

    // Check if email is already taken
    const existingEmailUser = await env.WORDMATE_KV.get(`email:${email}`);
    if (existingEmailUser) {
      return createErrorResponse(409, 'EMAIL_TAKEN', 'Email address already registered', corsHeaders);
    }

    // Create new user with enhanced data
    const userId = `user_${generateId()}`;
    
    console.log(`👤 Creating new user via registration: ${userId}`);
    
    const user = {
      id: userId,
      email,
      username,
      deviceId,
      grade: grade || 'grade6',
      preferences: preferences || {
        theme: 'light',
        soundEnabled: true,
        notifications: true,
        practiceReminders: true
      },
      registrationMethod: 'explicit',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save user data
    await env.WORDMATE_KV.put(`user:${userId}`, JSON.stringify(user));
    
    // Create mappings
    await env.WORDMATE_KV.put(`device:${deviceId}`, userId);
    await env.WORDMATE_KV.put(`email:${email}`, userId);

    // Initialize progress with preferences
    const initialProgress = {
      userId,
      totalWordsLearned: 0,
      currentStreak: 0,
      maxStreak: 0,
      lastActiveDate: new Date().toISOString().split('T')[0],
      wordProgress: [],
      recentSessionDates: [],
      preferences: user.preferences,
      version: 1,
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await env.WORDMATE_KV.put(`progress:${userId}`, JSON.stringify(initialProgress));

    // Generate JWT token
    const token = await generateJWT({
      userId,
      deviceId,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    }, env.JWT_SECRET || 'default-secret');

    return new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          grade: user.grade,
          preferences: user.preferences,
          createdAt: user.createdAt
        },
        token,
        isNewUser: true
      },
      message: 'Registration successful',
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return createErrorResponse(500, 'REGISTRATION_ERROR', error.message, corsHeaders);
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
