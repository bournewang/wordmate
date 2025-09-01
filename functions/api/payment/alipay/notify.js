/**
 * EdgeOne Pages Function: Alipay Payment Notification Handler
 * 
 * File path: /functions/api/payment/alipay/notify.js
 * Routes to: example.com/api/payment/alipay/notify
 * 
 * Handles payment notifications (webhooks) from Alipay
 */

import AlipaySdk from 'alipay-sdk';

/**
 * Load Alipay configuration from KV storage
 */
async function loadAlipayConfig(env, isProduction = false) {
  try {
    // Fetch configuration from KV storage
    const appId = await WORDMATE.get('ALIPAY_APP_ID');
    const privateKey = await WORDMATE.get('ALIPAY_PRIVATE_KEY');
    const publicKey = await WORDMATE.get('ALIPAY_PUBLIC_KEY');
    
    console.log('📋 Loading Alipay config from KV:', {
      appIdLoaded: !!appId,
      privateKeyLoaded: !!privateKey,
      publicKeyLoaded: !!publicKey,
      environment: isProduction ? 'production' : 'sandbox'
    });
    
    if (!appId || !privateKey || !publicKey) {
      const missing = [];
      if (!appId) missing.push('ALIPAY_APP_ID');
      if (!privateKey) missing.push('ALIPAY_PRIVATE_KEY');
      if (!publicKey) missing.push('ALIPAY_PUBLIC_KEY');
      
      throw new Error(`Missing Alipay configuration in KV: ${missing.join(', ')}`);
    }
    
    return {
      appId,
      privateKey,
      alipayPublicKey: publicKey
    };
    
  } catch (error) {
    console.error('❌ Failed to load Alipay config from KV:', error);
    throw error;
  }
}

/**
 * Create Alipay SDK instance
 */
function createAlipaySDK(alipayConfig, isProduction = false) {
  const config = {
    appId: alipayConfig.appId,
    privateKey: alipayConfig.privateKey,
    signType: 'RSA2',
    alipayPublicKey: alipayConfig.alipayPublicKey,
    gateway: isProduction ? 'https://openapi.alipay.com/gateway.do' : 'https://openapi.alipaydev.com/gateway.do',
    timeout: 5000,
    camelCase: true,
  };

  return new AlipaySdk(config);
}

/**
 * Process successful payment and update user subscription
 */
async function processPaymentSuccess(env, paymentData) {
  try {
    const userId = paymentData.passback_params; // User ID passed in payment creation
    const orderId = paymentData.out_trade_no;
    const amount = parseFloat(paymentData.total_amount);
    const tradeNo = paymentData.trade_no;

    console.log('💰 Processing successful payment:', {
      userId,
      orderId,
      amount,
      tradeNo
    });

    // Update payment record in KV
    const paymentKey = `payment:alipay:${orderId}`;
    const existingRecord = await WORDMATE.get(paymentKey);
    
    if (existingRecord) {
      const record = JSON.parse(existingRecord);
      record.status = 'completed';
      record.tradeNo = tradeNo;
      record.completedAt = new Date().toISOString();
      record.notificationProcessed = true;
      
      await WORDMATE.put(
        paymentKey,
        JSON.stringify(record),
        { expirationTtl: 3600 * 24 * 30 } // 30 days for completed payments
      );
    }

    // Update user subscription status
    if (userId) {
      try {
        const userKey = `user:${userId}`;
        console.log('👤 Looking up user in KV:', userKey);
        
        const userData = await WORDMATE.get(userKey);
        console.log('📊 User data from KV:', userData ? 'found' : 'not found');
        
        let user;
        if (userData) {
          user = JSON.parse(userData);
          console.log('📊 Existing user:', { id: user.id, email: user.email || 'none' });
        } else {
          // Create new user record if not exists
          console.log('👤 Creating new user record for:', userId);
          user = {
            id: userId,
            createdAt: new Date().toISOString(),
            createdVia: 'payment_webhook'
          };
        }
        
        // Determine subscription plan based on amount
        let planType = 'basic';
        let durationDays = 30; // Default 30 days
        
        if (amount >= 38) {
          planType = 'premium';
          durationDays = 30;
        } else if (amount >= 98) {
          planType = 'premium';
          durationDays = 90;
        } else if (amount >= 298) {
          planType = 'premium';
          durationDays = 365;
        }
        
        console.log('💳 Payment amount:', amount, '-> Plan:', planType, 'Duration:', durationDays, 'days');
        
        const now = new Date();
        const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        
        // Update user subscription
        user.subscription = {
          plan: planType,
          status: 'active',
          startDate: now.toISOString(),
          expiryDate: expiryDate.toISOString(),
          paymentMethod: 'alipay',
          lastPayment: {
            orderId,
            amount,
            tradeNo,
            processedAt: now.toISOString()
          }
        };
        
        // Update user timestamps
        user.updatedAt = now.toISOString();
        user.lastPaymentAt = now.toISOString();
        
        // Store updated user data
        console.log('💾 Storing user data to KV:', userKey);
        await WORDMATE.put(userKey, JSON.stringify(user));
        console.log('💾 User data stored successfully');
        
        console.log('✅ User subscription updated successfully:', {
          userId,
          plan: planType,
          expiryDate: expiryDate.toISOString(),
          userExists: !!userData
        });
        
      } catch (userError) {
        console.error('❌ Failed to update user subscription:', userError);
        console.error('❌ User error stack:', userError.stack);
        // Don't fail the webhook if user update fails, but log extensively
      }
    } else {
      console.error('❌ No userId found in payment data - passback_params missing or empty');
      console.error('❌ Payment data keys:', Object.keys(paymentData));
      console.error('❌ passback_params value:', paymentData.passback_params);
    }

    return { success: true, userId, orderId, amount };
    
  } catch (error) {
    console.error('❌ Failed to process payment success:', error);
    throw error;
  }
}

/**
 * Handle POST requests for Alipay notifications
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('🔔 Received Alipay notification');

    // Parse form data from Alipay notification
    const formData = await request.formData();
    const notificationData = {};
    
    for (const [key, value] of formData.entries()) {
      notificationData[key] = value;
    }

    console.log('📋 Alipay notification data:', notificationData);

    // Verify notification signature
    const isProduction = env.APP_ENV === 'production';
    
    if (isProduction) {
      // Production: Verify signature using Alipay public key
      try {
        const alipayConfig = await loadAlipayConfig(env, true);
        const alipay = createAlipaySDK(alipayConfig, true);
        
        const isValid = alipay.checkNotifySign(notificationData);
        if (!isValid) {
          console.error('❌ Invalid notification signature');
          return new Response('fail', { status: 400 });
        }
        console.log('✅ Notification signature verified');
      } catch (signError) {
        console.error('❌ Signature verification failed:', signError);
        return new Response('fail', { status: 400 });
      }
    } else {
      // Development: Skip signature verification
      console.log('🧪 Development mode: Skipping signature verification');
    }

    // Check trade status
    const tradeStatus = notificationData.trade_status;
    const outTradeNo = notificationData.out_trade_no;

    if (!tradeStatus || !outTradeNo) {
      console.error('❌ Missing required notification fields');
      return new Response('fail', { status: 400 });
    }

    // Process payment based on status
    switch (tradeStatus) {
      case 'TRADE_SUCCESS':
      case 'TRADE_FINISHED':
        try {
          const result = await processPaymentSuccess(env, notificationData);
          console.log('✅ Payment notification processed successfully:', result);
          
          // Respond with 'success' to acknowledge the notification
          return new Response('success', {
            headers: { 'Content-Type': 'text/plain' }
          });
          
        } catch (processError) {
          console.error('❌ Failed to process successful payment:', processError);
          return new Response('fail', { status: 500 });
        }
        
      case 'WAIT_BUYER_PAY':
        console.log('⏳ Payment pending:', outTradeNo);
        return new Response('success', {
          headers: { 'Content-Type': 'text/plain' }
        });
        
      case 'TRADE_CLOSED':
        console.log('❌ Payment closed:', outTradeNo);
        
        // Update payment record to failed
        try {
          const paymentKey = `payment:alipay:${outTradeNo}`;
          const existingRecord = await WORDMATE.get(paymentKey);
          
          if (existingRecord) {
            const record = JSON.parse(existingRecord);
            record.status = 'failed';
            record.failedAt = new Date().toISOString();
            record.failReason = 'Trade closed';
            
            await WORDMATE.put(paymentKey, JSON.stringify(record));
          }
        } catch (updateError) {
          console.warn('⚠️ Failed to update failed payment record:', updateError);
        }
        
        return new Response('success', {
          headers: { 'Content-Type': 'text/plain' }
        });
        
      default:
        console.warn('⚠️ Unknown trade status:', tradeStatus);
        return new Response('success', {
          headers: { 'Content-Type': 'text/plain' }
        });
    }

  } catch (error) {
    console.error('❌ Notification processing error:', error);
    return new Response('fail', { status: 500 });
  }
}

/**
 * Handle GET requests (for testing)
 */
export async function onRequestGet() {
  return new Response(JSON.stringify({
    message: 'Alipay notification endpoint',
    method: 'POST',
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
