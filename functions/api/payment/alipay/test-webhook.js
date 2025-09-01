/**
 * Test Webhook for Alipay Notifications - FOR TESTING ONLY
 * 
 * File path: /functions/api/payment/alipay/test-webhook.js
 * Routes to: example.com/api/payment/alipay/test-webhook
 * 
 * Simulates Alipay webhook notifications for testing purposes
 */

export async function onRequestPost(context) {
  const { request } = context;
  
  try {
    const body = await request.json();
    const { userId, orderId, amount, tradeNo } = body;
    
    // Validate required fields
    if (!userId || !orderId || !amount) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, orderId, amount'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('🧪 Test webhook triggered for:', { userId, orderId, amount });
    
    // Create mock Alipay notification data
    const mockNotificationData = {
      app_id: 'test_app_id',
      auth_app_id: 'test_app_id',
      charset: 'UTF-8',
      gmt_create: new Date().toISOString().replace('T', ' ').substring(0, 19),
      gmt_payment: new Date().toISOString().replace('T', ' ').substring(0, 19),
      notify_id: `test_notify_${Date.now()}`,
      notify_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      notify_type: 'trade_status_sync',
      out_trade_no: orderId,
      passback_params: userId, // This is crucial - the user ID!
      seller_email: 'test@example.com',
      seller_id: '2088123456789012',
      sign: 'mock_signature_for_testing',
      sign_type: 'RSA2',
      total_amount: amount.toString(),
      trade_no: tradeNo || `test_trade_${Date.now()}`,
      trade_status: 'TRADE_SUCCESS',
      version: '1.0'
    };
    
    console.log('🔔 Simulating Alipay notification with data:', mockNotificationData);
    
    // Create FormData for the webhook (Alipay sends form data, not JSON)
    const formData = new FormData();
    Object.keys(mockNotificationData).forEach(key => {
      formData.append(key, mockNotificationData[key]);
    });
    
    // Call the actual webhook handler
    const webhookUrl = `${new URL(request.url).origin}/api/payment/alipay/notify`;
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      body: formData
    });
    
    const webhookResult = await webhookResponse.text();
    
    console.log('📋 Webhook response:', {
      status: webhookResponse.status,
      result: webhookResult
    });
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Test webhook notification sent',
      mockData: mockNotificationData,
      webhookResponse: {
        status: webhookResponse.status,
        result: webhookResult
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Test webhook error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    message: 'Test webhook for Alipay notifications',
    usage: 'POST with { userId, orderId, amount, tradeNo? }',
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
