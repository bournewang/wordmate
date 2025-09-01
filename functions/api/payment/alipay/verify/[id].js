/**
 * EdgeOne Pages Function: Alipay Payment Verification
 * 
 * File path: /functions/api/payment/alipay/verify/[id].js
 * Routes to: example.com/api/payment/alipay/verify/{paymentId}
 * 
 * Verifies Alipay payment status using REAL Alipay API (no external dependencies)
 */

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Load Alipay configuration from environment/KV storage
 */
async function loadAlipayConfig(env) {
  try {
    console.log('🔑 Loading Alipay configuration for verification...');
    
    // Try to get from environment variables first
    let appId = env.ALIPAY_APP_ID;
    let privateKey = env.ALIPAY_PRIVATE_KEY;
    let alipayPublicKey = env.ALIPAY_PUBLIC_KEY;
    
    // Fallback to KV storage if env vars not available
    if (!appId && env.WORDMATE) {
      console.log('📦 Loading from KV storage...');
      appId = await WORDMATE.get('ALIPAY_APP_ID');
      privateKey = await WORDMATE.get('ALIPAY_PRIVATE_KEY');
      alipayPublicKey = await WORDMATE.get('ALIPAY_PUBLIC_KEY');
    }
    
    if (!appId || !privateKey || !alipayPublicKey) {
      throw new Error('Missing Alipay credentials. Please configure ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, and ALIPAY_PUBLIC_KEY');
    }
    
    console.log('✅ Alipay configuration loaded successfully');
    return { appId, privateKey, alipayPublicKey };
    
  } catch (error) {
    console.error('❌ Failed to load Alipay config:', error);
    throw error;
  }
}

/**
 * Generate RSA signature for Alipay requests
 */
async function generateSignature(params, privateKey) {
  try {
    // Sort parameters alphabetically and create query string
    const sortedKeys = Object.keys(params).sort();
    const signString = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    console.log('🔐 Generating verification signature for:', signString);
    
    // Import private key
    const keyData = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    
    const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );
    
    // Sign the string
    const encoder = new TextEncoder();
    const data = encoder.encode(signString);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data);
    
    // Convert to base64
    const signatureArray = new Uint8Array(signature);
    const signatureBase64 = btoa(String.fromCharCode.apply(null, signatureArray));
    
    console.log('✅ Verification signature generated successfully');
    return signatureBase64;
    
  } catch (error) {
    console.error('❌ Failed to generate verification signature:', error);
    throw new Error('Signature generation failed: ' + error.message);
  }
}

/**
 * Query payment status from REAL Alipay API
 */
async function queryAlipayPayment(paymentId, config, isProduction) {
  try {
    console.log('🔍 Querying REAL Alipay payment status...');
    
    const gateway = isProduction 
      ? 'https://openapi.alipay.com/gateway.do'
      : 'https://openapi.alipaydev.com/gateway.do';
    
    // Prepare API parameters
    const apiParams = {
      app_id: config.appId,
      method: 'alipay.trade.query',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      version: '1.0',
      biz_content: JSON.stringify({
        out_trade_no: paymentId
      })
    };
    
    // Generate signature
    const signature = await generateSignature(apiParams, config.privateKey);
    apiParams.sign = signature;
    
    // Make API request
    const params = new URLSearchParams(apiParams);
    const response = await fetch(gateway, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    const responseText = await response.text();
    console.log('📋 Alipay API response:', responseText);
    
    // Parse response (Alipay returns JSON wrapped in alipay_trade_query_response)
    const result = JSON.parse(responseText);
    const queryResult = result.alipay_trade_query_response;
    
    if (!queryResult) {
      throw new Error('Invalid Alipay API response format');
    }
    
    console.log('✅ REAL Alipay query completed successfully');
    
    return queryResult;
    
  } catch (error) {
    console.error('❌ Alipay payment query failed:', error);
    throw error;
  }
}

/**
 * Handle GET requests for payment verification
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const paymentId = params.id;

  try {
    console.log('🔍 Verifying Alipay payment:', paymentId);

    if (!paymentId) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'MISSING_PAYMENT_ID',
          message: 'Payment ID is required'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Load Alipay configuration
    const alipayConfig = await loadAlipayConfig(env);
    
    // Determine environment
    const isProduction = env.APP_ENV === 'production';
    console.log(`🚀 Verifying in ${isProduction ? 'PRODUCTION' : 'SANDBOX'} mode`);

    console.log(`🔍 Querying REAL payment status (${isProduction ? 'production' : 'sandbox'}):`, paymentId);

    // Query payment status from REAL Alipay API
    let result;
    try {
      result = await queryAlipayPayment(paymentId, alipayConfig, isProduction);

      console.log('📋 REAL Alipay query result:', result);

      // Check if the API call was successful
      if (!result || result.code !== '10000') {
        console.warn('⚠️ Alipay API returned error:', result);
        
        // Handle specific error codes
        let errorMessage = 'Payment verification failed';
        if (result && result.code === '40004') {
          errorMessage = 'Payment not found';
        } else if (result && result.sub_msg) {
          errorMessage = result.sub_msg;
        }

        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'PAYMENT_NOT_FOUND',
            message: errorMessage
          },
          status: 'not_found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Parse payment status (note: Alipay uses snake_case in API responses)
      const tradeStatus = result.trade_status;
      const totalAmount = parseFloat(result.total_amount || 0);
      const tradeNo = result.trade_no; // Alipay transaction ID
      
      // Map Alipay status to our standard status
      let status = 'pending';
      let success = false;

      switch (tradeStatus) {
        case 'TRADE_SUCCESS':
        case 'TRADE_FINISHED':
          status = 'completed';
          success = true;
          break;
        case 'WAIT_BUYER_PAY':
          status = 'pending';
          success = false;
          break;
        case 'TRADE_CLOSED':
          status = 'failed';
          success = false;
          break;
        default:
          status = 'unknown';
          success = false;
      }

      // Update payment record in KV if it exists
      try {
        if (env.WORDMATE) {
          const existingRecord = await WORDMATE.get(`payment:alipay:${paymentId}`);
          if (existingRecord) {
            const record = JSON.parse(existingRecord);
            record.status = status;
            record.tradeNo = tradeNo;
            record.verifiedAt = new Date().toISOString();
            record.alipayStatus = tradeStatus;
            
            await WORDMATE.put(
              `payment:alipay:${paymentId}`,
              JSON.stringify(record),
              { expirationTtl: 3600 * 24 * 7 } // 7 days for completed payments
            );
            console.log('✅ Payment record updated in KV');
          }
        }
      } catch (kvError) {
        console.warn('⚠️ Failed to update payment record in KV:', kvError);
        // Don't fail the request if KV update fails
      }

      // Return verification result
      const responseData = {
        success,
        payment_id: paymentId,
        transaction_id: tradeNo,
        amount: totalAmount,
        currency: 'CNY',
        status,
        trade_status: tradeStatus,
        verified_at: new Date().toISOString()
      };

      if (success) {
        console.log('✅ Payment verified successfully:', paymentId);
      } else {
        console.log(`⏳ Payment status: ${status} (${tradeStatus})`, paymentId);
      }

      return new Response(JSON.stringify({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (alipayError) {
      console.error('❌ Alipay verification error:', alipayError);
      
      // Handle network or API errors
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'ALIPAY_API_ERROR',
          message: 'Failed to verify payment with Alipay',
          details: isProduction ? undefined : alipayError.message
        },
        status: 'error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      },
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function onRequestOptions() {
  return new Response(null, {
    headers: corsHeaders
  });
}
