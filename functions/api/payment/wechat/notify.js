/**
 * EdgeOne Pages Function: WeChat Pay Payment Notification Handler (REAL v3)
 * 
 * File path: /functions/api/payment/wechat/notify.js
 * Routes to: example.com/api/payment/wechat/notify
 * 
 * Handles payment notifications (webhooks) from WeChat Pay
 */

// CORS headers (not strictly needed for webhook but kept consistent)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const te = new TextEncoder();
const td = new TextDecoder();

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

async function importRSAPublicKeyFromPublicKeyPEM(pem) {
  const b64 = stripPem(pem, 'PUBLIC KEY', 'PUBLIC KEY');
  const keyData = base64ToBytes(b64);
  return crypto.subtle.importKey('spki', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

async function verifySignatureWithPublicKey(publicKeyPem, message, signatureB64) {
  const key = await importRSAPublicKeyFromPublicKeyPEM(publicKeyPem);
  const sig = base64ToBytes(signatureB64);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, te.encode(message));
}

async function loadWechatConfig(env) {
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
  if (missing.length) throw new Error(`Missing WeChat Pay config: ${missing.join(', ')}`);
  return { appid, mchid, serial_no, privateKeyPem, apiv3_key };
}

// Decrypt resource.ciphertext using API v3 key (AES-256-GCM)
async function decryptResource(apiv3_key, resource) {
  const keyBytes = te.encode(apiv3_key);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const iv = te.encode(resource.nonce);
  const aad = resource.associated_data ? te.encode(resource.associated_data) : undefined;
  const cipherBytes = base64ToBytes(resource.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, cryptoKey, cipherBytes);
  const json = td.decode(decrypted);
  return JSON.parse(json);
}

// Fetch and cache WeChat platform certificates, return PUBLIC KEY PEM by serial
async function getWechatPlatformPublicKeyBySerial(env, serial) {
  // Try KV first
  const cachedPub = await WORDMATE.get(`WECHAT_PLATFORM_PUBLIC_KEY_${serial}`);
  if (cachedPub) return cachedPub;

  const { mchid, serial_no, privateKeyPem } = await loadWechatConfig(env);

  // Build signed request to /v3/certificates
  const urlPath = '/v3/certificates';
  const url = `https://api.mch.weixin.qq.com${urlPath}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).slice(2, 18);
  const message = `GET\n${urlPath}\n${timestamp}\n${nonce}\n\n`;

  // Import private key and sign
  const strip = (pem) => pem.replace(/\r/g, '').replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\n/g,'').trim();
  const keyData = Uint8Array.from(atob(strip(privateKeyPem)), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey('pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, te.encode(message));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serial_no}",signature="${sigB64}"`;

  const resp = await fetch(url, { headers: { 'Accept': 'application/json', 'Authorization': authorization } });
  const text = await resp.text();
  let json; try { json = JSON.parse(text); } catch { throw new Error('Invalid certs response'); }
  if (!resp.ok) {
    console.error('❌ Fetch platform certs failed:', json);
    throw new Error('Failed to fetch platform certificates');
  }

  // Load apiv3 key to decrypt certs
  const { apiv3_key } = await loadWechatConfig(env);
  for (const item of json.data || []) {
    if (!item.encrypt_certificate) continue;
    const dec = await decryptResource(apiv3_key, item.encrypt_certificate);
    // dec is the PEM certificate string (BEGIN CERTIFICATE)
    // Extract public key using subtle? We cannot parse cert to SPKI easily; however, many setups also store PUBLIC KEY in KV.
    // Here we rely on an additional KV entry WECHAT_PLATFORM_PUBLIC_KEY_{serial} if provided; otherwise, try to convert certificate to public key via WASM/ASN1 (not available). We'll store cert itself and require PUBLIC KEY KV for signature verification.
    const existingPub = await WORDMATE.get(`WECHAT_PLATFORM_PUBLIC_KEY_${item.serial_no}`);
    if (!existingPub) {
      // Cache certificate raw for reference
      await WORDMATE.put(`WECHAT_PLATFORM_CERT_${item.serial_no}`, dec, { expirationTtl: 86400 * 3 });
    }
  }

  // After fetching, try KV again
  const pub = await WORDMATE.get(`WECHAT_PLATFORM_PUBLIC_KEY_${serial}`);
  if (!pub) {
    console.warn('⚠️ Platform PUBLIC KEY not found in KV; signature verification may be skipped.');
  }
  return pub;
}

async function processPaymentSuccess(env, paymentData) {
  try {
    const userId = paymentData.attach;
    const orderId = paymentData.out_trade_no;
    const amount = paymentData.amount.total / 100;
    const transactionId = paymentData.transaction_id;

    console.log('💰 Processing successful WeChat Pay payment:', { userId, orderId, amount, transactionId });

    const paymentKey = `payment:wechat:${orderId}`;
    const existingRecord = await WORDMATE.get(paymentKey);
    if (existingRecord) {
      const record = JSON.parse(existingRecord);
      record.status = 'completed';
      record.transactionId = transactionId;
      record.completedAt = new Date().toISOString();
      record.notificationProcessed = true;
      await WORDMATE.put(paymentKey, JSON.stringify(record), { expirationTtl: 3600 * 24 * 30 });
    }

    if (userId) {
      try {
        const userKey = `user:${userId}`;
        const userData = await WORDMATE.get(userKey);
        let user = userData ? JSON.parse(userData) : { id: userId };

        let planType = 'basic';
        let durationDays = 30;
        if (amount >= 38) { planType = 'premium'; durationDays = 30; }
        else if (amount >= 98) { planType = 'premium'; durationDays = 90; }
        else if (amount >= 298) { planType = 'premium'; durationDays = 365; }

        const now = new Date();
        const expiryDate = new Date(now.getTime() + durationDays * 86400000);

        user.subscription = {
          plan: planType,
          status: 'active',
          startDate: now.toISOString(),
          expiryDate: expiryDate.toISOString(),
          paymentMethod: 'wechat',
          lastPayment: { orderId, amount, transactionId, processedAt: now.toISOString() }
        };

        await WORDMATE.put(userKey, JSON.stringify(user));
        console.log('✅ User subscription updated:', { userId, plan: planType, expiryDate: expiryDate.toISOString() });
      } catch (err) {
        console.error('❌ Failed to update user subscription:', err);
      }
    }

    return { success: true, userId, orderId, amount };
  } catch (error) {
    console.error('❌ Failed to process payment success:', error);
    throw error;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const bodyText = await request.text();
    const headers = request.headers;

    const timestamp = headers.get('wechatpay-timestamp');
    const nonce = headers.get('wechatpay-nonce');
    const signature = headers.get('wechatpay-signature');
    const serial = headers.get('wechatpay-serial');

    console.log('🔔 Received WeChat Pay notification', { timestamp, nonce, hasSignature: !!signature, serial });

    // Parse JSON body
    let payload;
    try { payload = JSON.parse(bodyText); } catch (e) {
      return new Response(JSON.stringify({ code: 'FAIL', message: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const isProduction = env.APP_ENV === 'production';
    const { apiv3_key, mchid } = await loadWechatConfig(env);

    // Optional: verify signature if platform public key is available or retrievable
    let signatureVerified = false;
    if (!isProduction) {
      console.log('🧪 Development mode: skipping signature verification');
      signatureVerified = true;
    } else if (timestamp && nonce && signature && serial) {
      try {
        const message = `${timestamp}\n${nonce}\n${bodyText}\n`;
        // First try to read public key from KV directly
        let platformPublicKey = await WORDMATE.get(`WECHAT_PLATFORM_PUBLIC_KEY_${serial}`);
        if (!platformPublicKey) {
          // Attempt to fetch and cache platform certificates; user should populate PUBLIC KEY in KV for verification
          await getWechatPlatformPublicKeyBySerial(env, serial);
          platformPublicKey = await WORDMATE.get(`WECHAT_PLATFORM_PUBLIC_KEY_${serial}`);
        }
        if (platformPublicKey) {
          signatureVerified = await verifySignatureWithPublicKey(platformPublicKey, message, signature);
        } else {
          console.warn('⚠️ Platform PUBLIC KEY not available; proceeding with order query verification.');
        }
      } catch (e) {
        console.warn('⚠️ Signature verification error:', e);
      }
    }

    // Decrypt notification resource
    let decrypted;
    try {
      decrypted = await decryptResource(apiv3_key, payload.resource);
      console.log('🔓 Decrypted notification:', decrypted);
    } catch (e) {
      console.error('❌ Decryption failed:', e);
      return new Response(JSON.stringify({ code: 'FAIL', message: 'Decryption failed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // If signature not verified, double-check by querying order status to prevent spoofing
    if (isProduction && !signatureVerified) {
      try {
        const outTradeNo = decrypted.out_trade_no;
        const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(mchid)}`;
        const url = `https://api.mch.weixin.qq.com${urlPath}`;
        const ts = Math.floor(Date.now() / 1000).toString();
        const nn = Math.random().toString(36).slice(2, 18);
        const msg = `GET\n${urlPath}\n${ts}\n${nn}\n\n`;
        const privPem = (await WORDMATE.get('WECHAT_PRIVATE_KEY')) || env.WECHAT_PRIVATE_KEY || env.WECHAT_MCH_PRIVATE_KEY;
        const strip = (pem) => pem.replace(/\r/g, '').replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\n/g,'').trim();
        const keyData = Uint8Array.from(atob(strip(privPem)), c => c.charCodeAt(0));
        const privateKey = await crypto.subtle.importKey('pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
        const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, te.encode(msg));
        const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
        const serial_no = (await WORDMATE.get('WECHAT_SERIAL_NO')) || env.WECHAT_SERIAL_NO || env.WECHAT_MERCHANT_SERIAL_NO;
        const authz = `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nn}",timestamp="${ts}",serial_no="${serial_no}",signature="${sigB64}"`;
        const verifyResp = await fetch(url, { headers: { 'Accept': 'application/json', 'Authorization': authz } });
        const vText = await verifyResp.text();
        const vJson = JSON.parse(vText);
        if (!verifyResp.ok || vJson.trade_state !== 'SUCCESS') {
          console.error('❌ Order query verification failed:', vJson);
          return new Response(JSON.stringify({ code: 'FAIL', message: 'Order verification failed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (e) {
        console.error('❌ Failed to verify order via query:', e);
        return new Response(JSON.stringify({ code: 'FAIL', message: 'Order verification error' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Process successful or failed payment
    const eventType = payload.event_type;
    const tradeState = decrypted.trade_state;
    const outTradeNo = decrypted.out_trade_no;

    console.log('📊 Processing event:', { eventType, tradeState, outTradeNo });

    if (eventType === 'TRANSACTION.SUCCESS' && tradeState === 'SUCCESS') {
      try {
        const result = await processPaymentSuccess(env, decrypted);
        console.log('✅ WeChat Pay notification processed successfully:', result);
        return new Response(JSON.stringify({ code: 'SUCCESS', message: 'OK' }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        console.error('❌ Processing error:', e);
        return new Response(JSON.stringify({ code: 'FAIL', message: 'Processing failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    } else if (['CLOSED','REVOKED','PAYERROR'].includes(tradeState)) {
      try {
        const paymentKey = `payment:wechat:${outTradeNo}`;
        const existingRecord = await WORDMATE.get(paymentKey);
        if (existingRecord) {
          const record = JSON.parse(existingRecord);
          record.status = 'failed';
          record.failedAt = new Date().toISOString();
          record.failReason = `Trade ${tradeState.toLowerCase()}`;
          await WORDMATE.put(paymentKey, JSON.stringify(record));
        }
      } catch (e) {
        console.warn('⚠️ Failed to update failed payment record:', e);
      }
      return new Response(JSON.stringify({ code: 'SUCCESS', message: 'OK' }), { headers: { 'Content-Type': 'application/json' } });
    } else {
      // Other states: acknowledge
      return new Response(JSON.stringify({ code: 'SUCCESS', message: 'OK' }), { headers: { 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error('❌ Notification processing error:', error);
    return new Response(JSON.stringify({ code: 'FAIL', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ message: 'WeChat Pay notification endpoint', method: 'POST', timestamp: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json' } });
}
