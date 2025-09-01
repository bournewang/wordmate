/**
 * EdgeOne Pages Function: WeChat Pay Payment Verification (REAL v3)
 * 
 * File path: /functions/api/payment/wechat/verify/[id].js
 * Routes to: example.com/api/payment/wechat/verify/{paymentId}
 * 
 * Verifies WeChat Pay payment status by calling v3 API with signed request
 */

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const te = new TextEncoder();

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  const b64 = stripPem(pem, 'PRIVATE KEY', 'PRIVATE KEY');
  const keyData = base64ToBytes(b64);
  return crypto.subtle.importKey('pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

function buildAuthHeader({ mchid, serial_no, nonce, timestamp, signature }) {
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serial_no}",signature="${signature}"`;
}

function randomString(len = 16) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => (b % 16).toString(16)).join('');
}

async function signMessage(privateKey, message) {
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, te.encode(message));
  const arr = new Uint8Array(sig);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

async function loadWechatConfig(env) {
  const appid = (await WORDMATE.get('WECHAT_APP_ID')) || env.WECHAT_APP_ID;
  const mchid = (await WORDMATE.get('WECHAT_MCH_ID')) || env.WECHAT_MCH_ID;
  const serial_no = (await WORDMATE.get('WECHAT_SERIAL_NO')) || env.WECHAT_SERIAL_NO || env.WECHAT_MERCHANT_SERIAL_NO;
  const privateKeyPem = (await WORDMATE.get('WECHAT_PRIVATE_KEY')) || env.WECHAT_PRIVATE_KEY || env.WECHAT_MCH_PRIVATE_KEY;
  const missing = [];
  if (!appid) missing.push('WECHAT_APP_ID');
  if (!mchid) missing.push('WECHAT_MCH_ID');
  if (!serial_no) missing.push('WECHAT_SERIAL_NO');
  if (!privateKeyPem) missing.push('WECHAT_PRIVATE_KEY');
  if (missing.length) throw new Error(`Missing WeChat config: ${missing.join(', ')}`);
  return { appid, mchid, serial_no, privateKeyPem };
}

/**
 * Handle GET requests for payment verification
 */
export async function onRequestGet(context) {
  const { env, params } = context;
  const paymentId = params.id;

  try {
    console.log('🔍 Verifying REAL WeChat Pay payment:', paymentId);
    if (!paymentId) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_PAYMENT_ID', message: 'Payment ID is required' } }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const cfg = await loadWechatConfig(env);

    const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(paymentId)}?mchid=${encodeURIComponent(cfg.mchid)}`;
    const url = `https://api.mch.weixin.qq.com${urlPath}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomString(16);
    const message = `GET\n${urlPath}\n${timestamp}\n${nonce}\n\n`;
    const privateKey = await importRSAPrivateKey(cfg.privateKeyPem);
    const signature = await signMessage(privateKey, message);
    const authorization = buildAuthHeader({ mchid: cfg.mchid, serial_no: cfg.serial_no, nonce, timestamp, signature });

    const wxResp = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authorization,
      }
    });

    const text = await wxResp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!wxResp.ok) {
      console.error('❌ WeChat Pay query failed:', json);
      return new Response(JSON.stringify({ success: false, error: { code: 'WECHAT_API_ERROR', message: json.message || json.code || 'WeChat API error', details: json }, status: 'error' }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const tradeState = json.trade_state;
    const totalAmount = json.amount ? json.amount.total / 100 : 0;
    const currency = json.amount ? json.amount.currency || 'CNY' : 'CNY';
    const transactionId = json.transaction_id;

    let status = 'pending';
    let success = false;
    switch (tradeState) {
      case 'SUCCESS':
        status = 'completed'; success = true; break;
      case 'CLOSED':
      case 'REVOKED':
      case 'PAYERROR':
        status = 'failed'; success = false; break;
      case 'USERPAYING':
      case 'NOTPAY':
        status = 'pending'; success = false; break;
      default:
        status = 'unknown'; success = false;
    }

    try {
      const existing = await WORDMATE.get(`payment:wechat:${paymentId}`);
      if (existing) {
        const rec = JSON.parse(existing);
        rec.status = status;
        rec.transactionId = transactionId;
        rec.verifiedAt = new Date().toISOString();
        rec.wechatStatus = tradeState;
        await WORDMATE.put(`payment:wechat:${paymentId}`, JSON.stringify(rec), { expirationTtl: 3600 * 24 * 7 });
      }
    } catch (e) {
      console.warn('⚠️ KV update failed:', e);
    }

    const responseData = {
      success,
      payment_id: paymentId,
      transaction_id: transactionId,
      amount: totalAmount,
      currency,
      status,
      trade_state: tradeState,
      verified_at: new Date().toISOString()
    };

    return new Response(JSON.stringify({ success: true, data: responseData, timestamp: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }, timestamp: new Date().toISOString() }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function onRequestOptions() { return new Response(null, { headers: corsHeaders }); }
