/**
 * EdgeOne Pages Function: WeChat Pay Payment Creation (REAL v3)
 * 
 * File path: /functions/api/payment/wechat/create.js
 * Routes to: example.com/api/payment/wechat/create
 * 
 * Creates REAL WeChat Pay Native orders via v3 API using Edge runtime crypto
 */

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Utilities
const te = new TextEncoder();
const td = new TextDecoder();

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function stripPem(pem, header, footer) {
  return pem
    .replace(/\r/g, '')
    .replace('-----BEGIN ' + header + '-----', '')
    .replace('-----END ' + header + '-----', '')
    .replace(/\n/g, '')
    .trim();
}

async function importRSAPrivateKey(pem) {
  // Expect PKCS#8 "BEGIN PRIVATE KEY" format (WeChat apiclient_key.pem)
  const b64 = stripPem(pem, 'PRIVATE KEY', 'PRIVATE KEY');
  const keyData = base64ToBytes(b64);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function randomString(len = 16) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => (b % 16).toString(16)).join('');
}

async function signMessage(privateKey, message) {
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, te.encode(message));
  return bytesToBase64(new Uint8Array(sig));
}

function buildAuthHeader({ mchid, serial_no, nonce, timestamp, signature }) {
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serial_no}",signature="${signature}"`;
}

async function loadWechatConfig(env) {
  console.log('🔑 Loading WeChat Pay configuration...');
  // Prefer KV to avoid exposing secrets in env
  const appid = (await WORDMATE.get('WECHAT_APP_ID')) || env.WECHAT_APP_ID;
  const mchid = (await WORDMATE.get('WECHAT_MCH_ID')) || env.WECHAT_MCH_ID;
  const serial_no = (await WORDMATE.get('WECHAT_SERIAL_NO')) || env.WECHAT_SERIAL_NO || env.WECHAT_MERCHANT_SERIAL_NO;
  const privateKeyPem = (await WORDMATE.get('WECHAT_PRIVATE_KEY')) || env.WECHAT_PRIVATE_KEY || env.WECHAT_MCH_PRIVATE_KEY;
  const apiv3_key = (await WORDMATE.get('WECHAT_APIV3_KEY')) || env.WECHAT_APIV3_KEY;

  const missing = [];
  if (!appid) missing.push('WECHAT_APP_ID');
  if (!mchid) missing.push('WECHAT_MCH_ID');
  if (!serial_no) missing.push('WECHAT_SERIAL_NO');
  if (!privateKeyPem) missing.push('WECHAT_PRIVATE_KEY');
  if (!apiv3_key) missing.push('WECHAT_APIV3_KEY');
  if (missing.length) {
    throw new Error(`Missing WeChat Pay config: ${missing.join(', ')}`);
  }

  return { appid, mchid, serial_no, privateKeyPem, apiv3_key };
}

/**
 * Handle POST requests for payment creation (REAL WeChat Pay Native)
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    console.log('🔄 Creating REAL WeChat Pay Native order:', body);

    // Validate fields
    const requiredFields = ['description', 'out_trade_no', 'amount'];
    const missingFields = requiredFields.filter(k => !body[k]);
    if (missingFields.length) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Missing required fields: ${missingFields.join(', ')}` }
      }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!body.amount || typeof body.amount.total !== 'number') {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'amount.total (number, cents) is required' }
      }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Determine payment type: native (QR) or h5 (mobile redirect)
    const paymentType = body.payment_type || 'native'; // 'native' or 'h5'
    if (!['native', 'h5'].includes(paymentType)) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'payment_type must be "native" or "h5"' }
      }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const isProduction = env.APP_ENV === 'production';
    const cfg = await loadWechatConfig(env);

    const payload = {
      appid: cfg.appid,
      mchid: cfg.mchid,
      description: body.description,
      out_trade_no: body.out_trade_no,
      notify_url: body.notify_url || `${new URL(request.url).origin}/api/payment/wechat/notify`,
      amount: {
        total: body.amount.total,
        currency: (body.amount.currency || 'CNY')
      },
      attach: body.attach || ''
    };

    // Add scene_info for H5 payment
    if (paymentType === 'h5') {
      payload.scene_info = {
        payer_client_ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '127.0.0.1',
        h5_info: {
          type: 'Wap',
          wap_url: new URL(request.url).origin,
          wap_name: 'WordMate'
        }
      };
    }

    const urlPath = paymentType === 'h5' ? '/v3/pay/transactions/h5' : '/v3/pay/transactions/native';
    const url = `https://api.mch.weixin.qq.com${urlPath}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomString(16);
    const bodyString = JSON.stringify(payload);

    // Sign
    const privateKey = await importRSAPrivateKey(cfg.privateKeyPem);
    const message = `POST\n${urlPath}\n${timestamp}\n${nonce}\n${bodyString}\n`;
    const signature = await signMessage(privateKey, message);
    const authorization = buildAuthHeader({ mchid: cfg.mchid, serial_no: cfg.serial_no, nonce, timestamp, signature });

    const wxResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
        'Authorization': authorization,
      },
      body: bodyString,
    });

    const text = await wxResp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!wxResp.ok) {
      console.error('❌ WeChat Pay create order failed:', json);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'WECHAT_API_ERROR', message: json.message || json.code || 'WeChat API error', details: json }
      }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Extract payment URL based on type
    const paymentUrl = paymentType === 'h5' ? json.h5_url : json.code_url;
    if (!paymentUrl) {
      console.warn(`⚠️ No ${paymentType === 'h5' ? 'h5_url' : 'code_url'} in WeChat response:`, json);
    }

    // Save to KV
    try {
      const record = {
        orderId: body.out_trade_no,
        amount: payload.amount.total / 100,
        description: payload.description,
        userId: payload.attach || 'unknown',
        status: 'pending',
        method: 'wechat',
        paymentType: paymentType,
        environment: isProduction ? 'production' : 'sandbox',
        createdAt: new Date().toISOString(),
        realPayment: true,
        payment_url: paymentUrl
      };
      await WORDMATE.put(`payment:wechat:${body.out_trade_no}`, JSON.stringify(record), { expirationTtl: 3600 * 24 });
    } catch (e) {
      console.warn('⚠️ Failed to store payment KV record:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        payment_type: paymentType,
        code_url: paymentType === 'native' ? paymentUrl : undefined,
        h5_url: paymentType === 'h5' ? paymentUrl : undefined,
        payment_url: paymentUrl,
        order_id: body.out_trade_no,
        qr_code: paymentType === 'native' ? paymentUrl : undefined,
      },
      message: `REAL WeChat Pay ${paymentType.toUpperCase()} order created (${isProduction ? 'PRODUCTION' : 'SANDBOX'})`,
      timestamp: new Date().toISOString()
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error('❌ REAL WeChat Pay creation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
      timestamp: new Date().toISOString()
    }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

/**
 * Generic request handler (fallback for all methods)
 */
export async function onRequest(context) {
  const { request } = context;
  const method = request.method;
  console.log(`📨 Received ${method} request to /api/payment/wechat/create`);
  if (method === 'POST') return onRequestPost(context);
  if (method === 'OPTIONS') return onRequestOptions();
  return new Response(JSON.stringify({
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: `Method ${method} not allowed. This endpoint only supports POST requests.`,
      allowedMethods: ['POST', 'OPTIONS']
    }
  }), { status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS', ...corsHeaders } });
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
