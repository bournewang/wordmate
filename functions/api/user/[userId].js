/**
 * EdgeOne Pages Function: User Management
 * 
 * File path: /functions/api/user/[userId].js
 * Routes to: example.com/api/user/{userId}
 * 
 * Handles user profile operations
 */

// Handle GET requests - retrieve user information
export async function onRequestGet(context) {
  const { params, env } = context;
  const { userId } = params;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request, env);
    if (!authResult.success) {
      return createErrorResponse(401, 'UNAUTHORIZED', authResult.error, corsHeaders);
    }

    if (authResult.userId !== userId) {
      return createErrorResponse(403, 'FORBIDDEN', 'User ID mismatch', corsHeaders);
    }

    console.log(`👤 Get user info for: ${userId}`);

    // Get user data from KV
    const user = await env.WORDMATE_KV.get(`user:${userId}`, 'json');
    
    if (!user) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found', corsHeaders);
    }

    // Remove sensitive information before returning
    const safeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      grade: user.grade,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastSyncAt: user.lastSyncAt
    };

    return new Response(JSON.stringify({
      success: true,
      data: safeUser,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    return createErrorResponse(500, 'GET_USER_ERROR', error.message, corsHeaders);
  }
}

// Handle PUT requests - update user information
export async function onRequestPut(context) {
  const { request, params, env } = context;
  const { userId } = params;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Authenticate request
    const authResult = await authenticateRequest(request, env);
    if (!authResult.success) {
      return createErrorResponse(401, 'UNAUTHORIZED', authResult.error, corsHeaders);
    }

    if (authResult.userId !== userId) {
      return createErrorResponse(403, 'FORBIDDEN', 'User ID mismatch', corsHeaders);
    }

    const body = await request.json();
    const { email, username, grade } = body;

    console.log(`✏️ Update user info for: ${userId}`);

    // Rate limiting check
    const rateLimitOk = await checkRateLimit(userId, 'user_update', env);
    if (!rateLimitOk) {
      return createErrorResponse(429, 'RATE_LIMITED', 'Too many update requests', corsHeaders);
    }

    // Get existing user data
    const existingUser = await env.WORDMATE_KV.get(`user:${userId}`, 'json');
    if (!existingUser) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found', corsHeaders);
    }

    // Validate and update fields
    const updatedUser = { ...existingUser };
    let hasChanges = false;

    if (email !== undefined && email !== existingUser.email) {
      // Validate email format
      if (email && !isValidEmail(email)) {
        return createErrorResponse(400, 'INVALID_EMAIL', 'Invalid email format', corsHeaders);
      }
      
      // Check if email is already taken (if not empty)
      if (email) {
        const existingEmailUser = await env.WORDMATE_KV.get(`email:${email}`);
        if (existingEmailUser && existingEmailUser !== userId) {
          return createErrorResponse(400, 'EMAIL_TAKEN', 'Email already in use', corsHeaders);
        }
      }

      // Update email mappings
      if (existingUser.email) {
        await env.WORDMATE_KV.delete(`email:${existingUser.email}`);
      }
      if (email) {
        await env.WORDMATE_KV.put(`email:${email}`, userId);
      }

      updatedUser.email = email;
      hasChanges = true;
    }

    if (username !== undefined && username !== existingUser.username) {
      // Validate username
      if (username && (username.length < 1 || username.length > 50)) {
        return createErrorResponse(400, 'INVALID_USERNAME', 'Username must be 1-50 characters', corsHeaders);
      }
      updatedUser.username = username || `User_${updatedUser.deviceId.slice(-6)}`;
      hasChanges = true;
    }

    if (grade !== undefined && grade !== existingUser.grade) {
      // Validate grade
      const validGrades = ['grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6', 'grade7', 'grade8', 'grade9'];
      if (grade && !validGrades.includes(grade)) {
        return createErrorResponse(400, 'INVALID_GRADE', 'Invalid grade value', corsHeaders);
      }
      updatedUser.grade = grade || 'grade6';
      hasChanges = true;
    }

    if (!hasChanges) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: existingUser.id,
          email: existingUser.email,
          username: existingUser.username,
          grade: existingUser.grade,
          createdAt: existingUser.createdAt,
          updatedAt: existingUser.updatedAt,
          lastSyncAt: existingUser.lastSyncAt
        },
        message: 'No changes to update',
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Update timestamp and save
    updatedUser.updatedAt = new Date().toISOString();
    await env.WORDMATE_KV.put(`user:${userId}`, JSON.stringify(updatedUser));

    console.log(`✅ User ${userId} updated successfully`);

    // Return updated user data (without sensitive info)
    const safeUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      grade: updatedUser.grade,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      lastSyncAt: updatedUser.lastSyncAt
    };

    return new Response(JSON.stringify({
      success: true,
      data: safeUser,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    return createErrorResponse(500, 'UPDATE_USER_ERROR', error.message, corsHeaders);
  }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

/**
 * Authenticate request using JWT token
 */
async function authenticateRequest(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Missing or invalid authorization header' };
    }

    const token = authHeader.substring(7);
    const payload = parseJWT(token);
    
    if (!payload || !payload.userId || !payload.deviceId) {
      return { success: false, error: 'Invalid token payload' };
    }

    // Check token expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { success: false, error: 'Token expired' };
    }

    return {
      success: true,
      userId: payload.userId,
      deviceId: payload.deviceId
    };

  } catch (error) {
    return { success: false, error: 'Token verification failed' };
  }
}

/**
 * Simple JWT parser
 */
function parseJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

/**
 * Rate limiting check
 */
async function checkRateLimit(userId, action, env) {
  const key = `rate_limit:${userId}:${action}`;
  const current = await env.WORDMATE_KV.get(key);
  
  const limits = {
    user_update: { max: 5, window: 60 * 60 }, // 5 updates per hour
  };
  
  const limit = limits[action];
  if (!limit) return true;
  
  const count = current ? parseInt(current) : 0;
  if (count >= limit.max) {
    return false;
  }
  
  await env.WORDMATE_KV.put(key, (count + 1).toString(), { expirationTtl: limit.window });
  return true;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
