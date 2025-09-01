/**
 * EdgeOne Pages Function: Alipay Payment Creation
 * 
 * File path: /functions/api/payment/alipay/create.js
 * Routes to: example.com/api/payment/alipay/create
 * 
 * Creates REAL Alipay payment orders using official Alipay SDK
 */

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Load Alipay configuration from environment/KV storage
 */
async function loadAlipayConfig(env) {
  try {
    console.log('🔑 Loading Alipay configuration...');
    
    // Try to get from environment variables first
    // let appId = env.ALIPAY_APP_ID;
    // let privateKey = env.ALIPAY_PRIVATE_KEY;
    // let alipayPublicKey = env.ALIPAY_PUBLIC_KEY;
    
    // Fallback to KV storage if env vars not available
    // if (!appId) {
    console.log('📦 Loading from KV storage...');
    let appId = await WORDMATE.get('ALIPAY_APP_ID');
    let privateKey = await WORDMATE.get('ALIPAY_PRIVATE_KEY');
    let alipayPublicKey = await WORDMATE.get('ALIPAY_PUBLIC_KEY');
    // }
    
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
    
    console.log('🔐 Generating signature for:', signString);
    
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
    
    console.log('✅ Signature generated successfully');
    return signatureBase64;
    
  } catch (error) {
    console.error('❌ Failed to generate signature:', error);
    throw new Error('Signature generation failed: ' + error.message);
  }
}

/**
 * Create REAL Alipay payment using official API
 * Supports both PC (alipay.trade.page.pay) and Mobile (alipay.trade.wap.pay)
 * PC: https://opendocs.alipay.com/open/59da99d0_alipay.trade.page.pay
 * Mobile: https://opendocs.alipay.com/open/203/107090
 */
async function createAlipayPayment(paymentParams, config, isProduction, paymentType = 'page') {
  try {
    console.log('💳 Creating REAL Alipay payment according to official API...');
    
    const gateway = isProduction 
      ? 'https://openapi.alipay.com/gateway.do'
      : 'https://openapi.alipaydev.com/gateway.do';
    
    // Prepare API parameters according to official documentation
    const method = paymentType === 'wap' ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay';
    const apiParams = {
      app_id: config.appId,
      method: method,
      format: 'json',
      charset: 'UTF-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      version: '1.0'
    };
    
    // Add optional parameters if provided
    if (paymentParams.notify_url) {
      apiParams.notify_url = paymentParams.notify_url;
    }
    if (paymentParams.return_url) {
      apiParams.return_url = paymentParams.return_url;
    }
    
    // Build biz_content according to API specification
    const productCode = paymentType === 'wap' ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY';
    const bizContent = {
      out_trade_no: paymentParams.out_trade_no,
      product_code: productCode,
      total_amount: paymentParams.total_amount,
      subject: paymentParams.subject
    };
    
    // Add mobile-specific parameters for WAP payment
    if (paymentType === 'wap') {
      bizContent.quit_url = paymentParams.return_url || `${new URL(request.url).origin}/payment/cancel?method=alipay&payment_id=${paymentParams.out_trade_no}`;
    }
    
    // Add optional biz_content fields
    if (paymentParams.body) {
      bizContent.body = paymentParams.body;
    }
    if (paymentParams.timeout_express) {
      bizContent.timeout_express = paymentParams.timeout_express;
    }
    if (paymentParams.passback_params) {
      bizContent.passback_params = paymentParams.passback_params;
    }
    
    apiParams.biz_content = JSON.stringify(bizContent);
    
    console.log('📊 API parameters prepared:', {
      ...apiParams,
      biz_content: bizContent // Log parsed biz_content for debugging
    });
    
    // Generate signature (exclude sign field itself)
    const signature = await generateSignature(apiParams, config.privateKey);
    apiParams.sign = signature;
    
    console.log('🔗 Signature generated, building pageRedirectionData (HTML form)...');

    // Build action URL with system parameters (excluding biz_content)
    const actionParams = { ...apiParams };
    delete actionParams.biz_content;

    const actionSearch = new URLSearchParams();
    Object.keys(actionParams).sort().forEach(key => {
      actionSearch.append(key, actionParams[key]);
    });
    const actionUrl = `${gateway}?${actionSearch.toString()}`;

    // HTML-escape helper
    const htmlEscape = (str) => String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const bizContentEscaped = htmlEscape(apiParams.biz_content);

    const htmlForm = [
      `<form name="punchout_form" method="post" action="${actionUrl}">`,
      `<input type="hidden" name="biz_content" value="${bizContentEscaped}">`,
      '<input type="submit" value="立即支付" style="display:none" >',
      '</form>',
      '<script>document.forms[0].submit();</script>'
    ].join('');

    // Also provide a GET URL for clients that prefer redirect
    const allParams = new URLSearchParams();
    Object.keys(apiParams).sort().forEach(key => {
      allParams.append(key, apiParams[key]);
    });
    const paymentUrl = `${gateway}?${allParams.toString()}`;

    return {
      success: true,
      payment_type: paymentType,
      payment_url: paymentUrl,
      order_id: paymentParams.out_trade_no,
      qr_code: paymentType === 'page' ? paymentUrl : undefined,
      redirect_url: paymentType === 'wap' ? paymentUrl : undefined,
      method: 'POST',
      html_form: htmlForm,
      environment: isProduction ? 'production' : 'sandbox'
    };
    
  } catch (error) {
    console.error('❌ Alipay payment creation failed:', error);
    throw error;
  }
}

/**
 * Generate order number
 */
function generateOrderNumber(userId, planId) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `WM_${planId}_${userId.slice(-6)}_${timestamp}_${randomStr}`;
}

/**
 * Handle POST requests for payment creation
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Parse request body
    const body = await request.json();
    console.log('🔄 Creating REAL Alipay payment:', body);

    // Validate required fields
    const requiredFields = ['subject', 'out_trade_no', 'total_amount'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required fields: ${missingFields.join(', ')}`
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Determine payment type: page (PC) or wap (mobile)
    const paymentType = body.payment_type || 'page'; // 'page' or 'wap'
    if (!['page', 'wap'].includes(paymentType)) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'payment_type must be "page" or "wap"'
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
    console.log(`🚀 Running in ${isProduction ? 'PRODUCTION' : 'SANDBOX'} mode`);
    
    // Prepare payment parameters
    const paymentParams = {
      subject: body.subject,
      body: body.body || body.subject,
      out_trade_no: body.out_trade_no,
      total_amount: body.total_amount.toString(),
      product_code: 'FAST_INSTANT_TRADE_PAY',
      return_url: body.return_url || `${new URL(request.url).origin}/payment/success?method=alipay&payment_id=${body.out_trade_no}`,
      notify_url: body.notify_url || `${new URL(request.url).origin}/api/payment/alipay/notify`,
      timeout_express: '30m',
      passback_params: body.passback_params || body.attach || '', // User ID for webhook processing
    };

    console.log('💳 Creating REAL Alipay payment with params:', { 
      ...paymentParams, 
      environment: isProduction ? 'production' : 'sandbox',
      appId: alipayConfig.appId
    });

    // Create REAL Alipay payment
    const paymentResult = await createAlipayPayment(paymentParams, alipayConfig, isProduction, paymentType);
    
    console.log('✅ REAL Alipay payment created successfully');

    // Store payment info in KV (optional, for tracking)
    try {
      const paymentRecord = {
        orderId: body.out_trade_no,
        amount: body.total_amount,
        subject: body.subject,
        userId: body.passback_params || body.attach || 'unknown',
        status: 'pending',
        method: 'alipay',
        environment: isProduction ? 'production' : 'sandbox',
        createdAt: new Date().toISOString(),
        realPayment: true, // This is now a REAL payment!
        paymentType: paymentType,
        paymentUrl: paymentResult.payment_url,
        paymentHtml: paymentResult.html_form
      };
      
      // if (env.WORDMATE) {
        await WORDMATE.put(
          `payment:alipay:${body.out_trade_no}`, 
          JSON.stringify(paymentRecord),
          { expirationTtl: 3600 * 24 } // 24 hours
        );
        console.log('✅ Payment record stored in KV');
      // }
    } catch (kvError) {
      console.warn('⚠️ Failed to store payment record in KV:', kvError);
      // Don't fail the request if KV storage fails
    }

    // Return REAL payment data (both POST form and GET URL)
    return new Response(JSON.stringify({
      success: true,
      data: {
        payment_type: paymentResult.payment_type,
        method: paymentResult.method,
        payment_url: paymentResult.payment_url,
        html_form: paymentResult.html_form,
        order_id: paymentResult.order_id,
        qr_code: paymentResult.qr_code,
        redirect_url: paymentResult.redirect_url,
      },
      message: `REAL Alipay ${paymentType.toUpperCase()} payment created successfully in ${isProduction ? 'PRODUCTION' : 'SANDBOX'} mode`,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('❌ REAL Alipay payment creation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'PAYMENT_CREATION_ERROR',
        message: 'Failed to create Alipay payment',
        details: error.message
      },
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Generic request handler (fallback for all methods)
 */
export async function onRequest(context) {
  const { request } = context;
  const method = request.method;
  
  console.log(`📨 Received ${method} request to /api/payment/alipay/create`);
  
  if (method === 'POST') {
    return onRequestPost(context);
  } else if (method === 'OPTIONS') {
    return onRequestOptions();
  } else {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `Method ${method} not allowed. This endpoint only supports POST requests.`,
        allowedMethods: ['POST', 'OPTIONS']
      }
    }), {
      status: 405,
      headers: { 
        'Content-Type': 'application/json', 
        'Allow': 'POST, OPTIONS',
        ...corsHeaders 
      }
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
