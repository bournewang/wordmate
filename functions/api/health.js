/**
 * EdgeOne Pages Function: Health Check
 * 
 * File path: /functions/api/health.js
 * Routes to: example.com/api/health
 * 
 * Simple health check endpoint for monitoring
 */

// Handle GET requests for health check
export async function onRequestGet(context) {
  const { env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Test KV connectivity
    let kvStatus = 'unknown';
    try {
      // Try to perform a simple KV operation
      const testKey = `health_check:${Date.now()}`;
      await WORDMATE.put(testKey, 'ok', { expirationTtl: 10 });
      const testValue = await WORDMATE.get(testKey);
      kvStatus = testValue === 'ok' ? 'connected' : 'error';
      
      // Clean up test key
      await WORDMATE.delete(testKey);
    } catch (error) {
      console.error('KV health check failed:', error);
      kvStatus = 'error';
    }

    const healthData = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      kvStatus,
      region: process.env.CF_RAY || 'unknown',
      environment: env.APP_ENV || 'production'
    };

    return new Response(JSON.stringify({
      success: true,
      data: healthData,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
