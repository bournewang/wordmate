/**
 * EdgeOne Pages Function: User Subscription Status
 * 
 * File path: /functions/api/user/[userId]/subscription.js
 * Routes to: example.com/api/user/{userId}/subscription
 * 
 * Handles user subscription status operations
 */

// Handle GET requests - retrieve user subscription information
export async function onRequestGet(context) {
  const { params, env } = context;
  const { userId } = params;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    console.log(`📋 Get subscription info for: ${userId}`);

    // Get user data from KV (which includes subscription)
    const user = await WORDMATE.get(`user:${userId}`, 'json');
    
    if (!user) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found', corsHeaders);
    }

    // Extract subscription information
    const subscription = user.subscription || null;
    
    // If no subscription, return trial status
    if (!subscription) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          hasSubscription: false,
          status: 'trial',
          plan: 'free-trial',
          message: 'No active subscription'
        },
        debug: {
          userFound: true,
          rawUserData: process.env.NODE_ENV === 'development' ? user : 'hidden in production',
          subscriptionFound: false
        },
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Check if subscription is still active
    const now = new Date();
    const expiryDate = new Date(subscription.expiryDate);
    const isActive = subscription.status === 'active' && now < expiryDate;
    
    const subscriptionData = {
      hasSubscription: true,
      status: isActive ? 'active' : 'expired',
      plan: subscription.plan,
      startDate: subscription.startDate,
      expiryDate: subscription.expiryDate,
      paymentMethod: subscription.paymentMethod,
      daysRemaining: isActive ? Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : 0,
      lastPayment: subscription.lastPayment
    };

    console.log(`✅ Subscription status for ${userId}:`, {
      hasSubscription: subscriptionData.hasSubscription,
      status: subscriptionData.status,
      plan: subscriptionData.plan,
      daysRemaining: subscriptionData.daysRemaining
    });

    return new Response(JSON.stringify({
      success: true,
      data: subscriptionData,
      debug: {
        userFound: true,
        rawUserData: process.env.NODE_ENV === 'development' ? user : 'hidden in production',
        subscriptionFound: !!subscription
      },
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    return createErrorResponse(500, 'GET_SUBSCRIPTION_ERROR', error.message, corsHeaders);
  }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
