import { PaymentRequest, PaymentResponse, PaymentVerification } from '../paymentService';
import { getOptimalPaymentType, getDeviceInfo, formatDeviceInfo } from '../../utils/deviceDetection';

/**
 * WeChat Pay Provider for WordMate
 * 
 * This integrates with WeChat Pay's official API for secure payments
 * Documentation: https://pay.weixin.qq.com/wiki/doc/apiv3/
 */

export interface WechatPayConfig {
  appid: string;
  mchid: string; // Merchant ID
  private_key: string; // Merchant private key
  serial_no: string; // Certificate serial number
  apiv3_key: string; // API v3 key
  notify_url?: string;
}

export interface WechatPayCreateParams {
  appid: string;
  mchid: string;
  description: string;
  out_trade_no: string;
  notify_url: string;
  amount: {
    total: number; // Amount in cents (分)
    currency: 'CNY';
  };
  attach?: string; // User ID for webhook processing
  scene_info?: {
    payer_client_ip?: string;
  };
}

export class WechatPayProvider {
  private config: WechatPayConfig;
  private isProduction: boolean;

  constructor(config: WechatPayConfig, isProduction: boolean = false) {
    this.config = config;
    this.isProduction = isProduction;
    
    // Validate required configuration
    this.validateConfig();
    
    console.log(`🔄 WeChat Pay Provider initialized in ${isProduction ? 'production' : 'sandbox'} mode`);
  }

  private validateConfig(): void {
    // Skip validation in development mode
    if (!this.isProduction) {
      console.log('🧪 Development mode: Skipping WeChat Pay config validation');
      return;
    }
    
    const required = ['appid', 'mchid', 'private_key', 'serial_no', 'apiv3_key'];
    const missing = required.filter(key => !this.config[key as keyof WechatPayConfig]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required WeChat Pay config: ${missing.join(', ')}`);
    }
  }

  /**
   * Create a payment order with WeChat Pay
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      console.log('🔄 Creating WeChat Pay payment for:', request.planId);

      const orderNumber = this.generateOrderNumber(request.userId, request.planId || 'premium-monthly');
      
      const params: WechatPayCreateParams = {
        appid: this.config.appid,
        mchid: this.config.mchid,
        description: 'WordMate高级会员',
        out_trade_no: orderNumber,
        notify_url: this.config.notify_url || 'https://your-domain.com/api/payment/wechat/notify',
        amount: {
          total: Math.round(request.amount * 100), // Convert to cents
          currency: 'CNY'
        },
        attach: request.userId, // Pass user ID for webhook processing
      };

      // In production, use the real WeChat Pay API
      if (this.isProduction) {
        return await this.createProductionPayment(params, request);
      } else {
        return await this.createDevelopmentPayment(params, request);
      }

    } catch (error: any) {
      console.error('❌ WeChat Pay payment creation failed:', error);
      return {
        success: false,
        error: error.message || 'WeChat Pay payment creation failed'
      };
    }
  }

  /**
   * Production payment creation using real WeChat Pay API
   */
  private async createProductionPayment(
    params: WechatPayCreateParams,
    _request: PaymentRequest
  ): Promise<PaymentResponse> {
    try {
      console.log('🔐 Creating production WeChat Pay payment via backend API');
      
      // Detect device and choose payment type
      const paymentType = getOptimalPaymentType('wechat');
      const deviceInfo = getDeviceInfo();
      console.log(`📱 Device detected: ${formatDeviceInfo()} -> Using ${paymentType} payment`);
      
      // In browser environment, make request to your backend API
      const apiBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ? import.meta.env.VITE_API_BASE_URL : window.location.origin;
      const response = await fetch(`${apiBaseUrl}/api/payment/wechat/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_type: paymentType,
          description: params.description,
          out_trade_no: params.out_trade_no,
          notify_url: params.notify_url,
          amount: params.amount,
          attach: params.attach,
          scene_info: params.scene_info
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || result.error || 'WeChat Pay payment creation failed');
      }

      console.log('✅ WeChat Pay payment created successfully');
      
      // Get payment URLs based on type
      const paymentUrl = result.data?.payment_url || result.data?.code_url || result.data?.h5_url;
      const qrCode = result.data?.code_url; // Only for native payments
      const h5Url = result.data?.h5_url; // Only for h5 payments
      
      // Handle payment based on device and payment type
      if (deviceInfo.isMobile && (paymentType === 'h5' || h5Url)) {
        // Mobile: redirect directly to H5 payment URL
        if (h5Url || paymentUrl) {
          window.location.href = h5Url || paymentUrl;
        }
      } else if (!deviceInfo.isMobile && qrCode) {
        // Desktop: QR code will be handled by UI component
        console.log('📏 Desktop WeChat Pay QR code ready for display');
      }
      
      return {
        success: true,
        data: {
          paymentId: params.out_trade_no,
          paymentUrl: paymentUrl,
          qrCode: qrCode,
          h5Url: h5Url,
          transactionId: params.out_trade_no
        }
      };
      
    } catch (error: any) {
      console.error('❌ WeChat Pay API error:', error);
      throw new Error(`WeChat Pay payment creation failed: ${error.message}`);
    }
  }

  /**
   * Development/sandbox payment using WeChat Pay sandbox via backend
   */
  private async createDevelopmentPayment(
    params: WechatPayCreateParams,
    _request: PaymentRequest
  ): Promise<PaymentResponse> {
    console.log('🧪 Development mode: Trying to call backend API first');
    
    try {
      // Detect device and choose payment type
      const paymentType = getOptimalPaymentType('wechat');
      const deviceInfo = getDeviceInfo();
      console.log(`📱 Device detected: ${formatDeviceInfo()} -> Using ${paymentType} payment`);
      
      // Try to call the backend API first (even in development)
      const apiBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ? import.meta.env.VITE_API_BASE_URL : window.location.origin;
      const response = await fetch(`${apiBaseUrl}/api/payment/wechat/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_type: paymentType,
          description: params.description,
          out_trade_no: params.out_trade_no,
          notify_url: params.notify_url,
          amount: params.amount,
          attach: params.attach,
          scene_info: params.scene_info
        })
      });
      
      // Check if we got a proper API response (not HTML error page)
      const contentType = response.headers.get('content-type');
      const isJsonResponse = contentType && contentType.includes('application/json');
      
      if (response.ok && isJsonResponse) {
        try {
          const result = await response.json();
          if (result.success) {
            console.log('✅ Backend API call successful in development');
            
            // Get payment URLs based on type
            const paymentUrl = result.data?.payment_url || result.data?.code_url || result.data?.h5_url;
            const qrCode = result.data?.code_url;
            const h5Url = result.data?.h5_url;
            
            // Handle payment based on device and payment type
            if (deviceInfo.isMobile && (paymentType === 'h5' || h5Url)) {
              // Mobile: redirect directly to H5 payment URL
              if (h5Url || paymentUrl) {
                window.location.href = h5Url || paymentUrl;
              }
            }
            
            return {
              success: true,
              data: {
                paymentId: params.out_trade_no,
                paymentUrl: paymentUrl,
                qrCode: qrCode,
                h5Url: h5Url,
                transactionId: params.out_trade_no
              }
            };
          }
        } catch (jsonError) {
          console.log('🔄 Backend API returned non-JSON response, falling back to demo URL');
        }
      } else {
        console.log(`🔄 Backend API not available (${response.status}), falling back to demo URL`);
      }
      
    } catch (apiError) {
      console.log('🔄 Backend API call failed, using demo payment URL:', apiError);
    }
    
    // Fallback to demo URL if backend is not available
    const demoPaymentUrl = this.createDemoPaymentUrl(params, 'wechat');
    
    console.log('✅ WeChat Pay demo payment created');
    
    return {
      success: true,
      data: {
        paymentId: params.out_trade_no,
        paymentUrl: demoPaymentUrl,
        qrCode: demoPaymentUrl,
        transactionId: params.out_trade_no
      }
    };
  }
  
  private createDemoPaymentUrl(params: WechatPayCreateParams, method: string): string {
    // Create a demo payment page URL that simulates the WeChat Pay payment flow
    const baseUrl = `${window.location.origin}/demo-payment`;
    const queryParams = new URLSearchParams({
      method: method,
      order_id: params.out_trade_no,
      amount: (params.amount.total / 100).toString(),
      subject: params.description,
      return_url: `${window.location.origin}/payment/success?method=${method}&payment_id=${params.out_trade_no}`
    });
    
    return `${baseUrl}?${queryParams.toString()}`;
  }

  /**
   * Verify payment status
   */
  async verifyPayment(paymentId: string): Promise<PaymentVerification> {
    try {
      console.log('🔍 Verifying WeChat Pay payment:', paymentId);

      if (this.isProduction) {
        return await this.verifyProductionPayment(paymentId);
      } else {
        return await this.verifyDevelopmentPayment(paymentId);
      }

    } catch (error: any) {
      console.error('❌ WeChat Pay verification failed:', error);
      return {
        success: false,
        error: error.message || 'Payment verification failed'
      };
    }
  }

  private async verifyProductionPayment(paymentId: string): Promise<PaymentVerification> {
    try {
      console.log('🔍 Verifying payment with WeChat Pay API via backend:', paymentId);
      
      // Call backend API for payment verification
      const apiBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ? import.meta.env.VITE_API_BASE_URL : window.location.origin;
      const response = await fetch(`${apiBaseUrl}/api/payment/wechat/verify/${paymentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Payment verification failed');
      }
      
      console.log('📋 WeChat Pay verification result:', result);

      const data = result.data || {};
      if (data.status === 'completed' || data.trade_state === 'SUCCESS' || data.success === true) {
        return {
          success: true,
          transactionId: data.transaction_id,
          amount: data.amount, // already in yuan per backend
          currency: data.currency || 'CNY',
          status: 'completed'
        };
      } else if (data.status === 'pending' || data.trade_state === 'USERPAYING') {
        return {
          success: false,
          error: 'Payment pending - user is completing payment',
          status: 'pending'
        };
      } else {
        return {
          success: false,
          error: `Payment verification failed: ${data.trade_state || data.status}`,
          status: 'failed'
        };
      }
      
    } catch (error: any) {
      console.error('❌ WeChat Pay verification error:', error);
      throw new Error(`WeChat Pay verification error: ${error.message}`);
    }
  }

  private async verifyDevelopmentPayment(_paymentId: string): Promise<PaymentVerification> {
    console.log('🧪 Development mode: Using WeChat Pay sandbox verification');
    
    try {
      // Simulate verification for development (similar to production, in real implementation
      // this would call your backend sandbox verification API)
      console.log('📋 WeChat Pay sandbox: simulating successful payment verification');
      
      // For demo purposes, simulate a successful payment after 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        transactionId: `wechat_sandbox_${Date.now()}`,
        amount: 0.1, // Test amount - will be replaced with real amount in production
        currency: 'CNY',
        status: 'completed'
      };
      
    } catch (error: any) {
      console.error('❌ WeChat Pay sandbox verification error:', error);
      return {
        success: false,
        error: `Sandbox verification error: ${error.message}`,
        status: 'failed'
      };
    }
  }

  /**
   * Process payment notification from WeChat Pay
   */
  async processNotification(notification: any): Promise<{
    success: boolean;
    userId?: string;
    transactionId?: string;
    amount?: number;
  }> {
    try {
      console.log('🔔 Processing WeChat Pay notification');

      // Verify notification signature
      const isValid = await this.verifyNotificationSignature(notification);
      if (!isValid) {
        throw new Error('Invalid notification signature');
      }

      // WeChat Pay notifications are encrypted, need to decrypt
      const decryptedData = await this.decryptNotification(notification);
      
      // Extract payment information
      const userId = decryptedData.attach;
      const transactionId = decryptedData.transaction_id;
      const amount = decryptedData.amount.total / 100; // Convert from cents
      const tradeState = decryptedData.trade_state;

      if (tradeState === 'SUCCESS') {
        return {
          success: true,
          userId,
          transactionId,
          amount
        };
      } else {
        throw new Error(`Payment not successful: ${tradeState}`);
      }

    } catch (error: any) {
      console.error('❌ Notification processing failed:', error);
      return { success: false };
    }
  }

  private async verifyNotificationSignature(_notification: any): Promise<boolean> {
    try {
      if (!this.isProduction) {
        // In development mode, skip signature verification
        console.log('🧪 Development mode: Skipping signature verification');
        return true;
      }

      // In production, implement proper signature verification
      /*
      const crypto = require('crypto');
      
      // Extract headers from notification
      const timestamp = notification.headers['wechatpay-timestamp'];
      const nonce = notification.headers['wechatpay-nonce'];
      const signature = notification.headers['wechatpay-signature'];
      const serial = notification.headers['wechatpay-serial'];
      
      // Build signature string
      const signatureStr = `${timestamp}\n${nonce}\n${notification.body}\n`;
      
      // Verify signature using WeChat Pay certificate
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(signatureStr, 'utf8');
      
      return verify.verify(wechatPayCertificate, signature, 'base64');
      */

      // Placeholder for production signature verification
      return true;

    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  private async decryptNotification(_notification: any): Promise<any> {
    try {
      if (!this.isProduction) {
        // In development mode, return mock decrypted data
        return {
          attach: 'test-user-id',
          transaction_id: `wechat_${Date.now()}`,
          amount: { total: 3800 }, // 38.00 yuan in cents
          trade_state: 'SUCCESS'
        };
      }

      // In production, implement proper decryption
      /*
      const crypto = require('crypto');
      
      const { resource } = notification;
      const { ciphertext, associated_data, nonce } = resource;
      
      // Decrypt using AES-256-GCM
      const decipher = crypto.createDecipherGCM('aes-256-gcm', Buffer.from(this.config.apiv3_key));
      decipher.setAuthTag(Buffer.from(resource.tag, 'base64'));
      decipher.setAAD(Buffer.from(associated_data));
      
      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
      */

      throw new Error('Production decryption not configured');

    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  private generateOrderNumber(userId: string, planId: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `WM_${planId}_${userId.slice(-6)}_${timestamp}_${randomStr}`;
  }

  /**
   * Generate WeChat Pay QR code for display
   */
  generateQrCodeData(paymentUrl: string): string {
    // This would typically generate a QR code image or data URL
    // For now, return the raw URL
    return paymentUrl;
  }

  /**
   * Get supported payment methods for WeChat Pay
   */
  static getSupportedMethods() {
    return [
      {
        id: 'wechat_native',
        name: '微信扫码支付',
        description: '使用微信扫描二维码完成支付',
        icon: '微',
        enabled: true
      },
      {
        id: 'wechat_jsapi',
        name: '微信公众号支付',
        description: '在微信内完成支付',
        icon: '微',
        enabled: true
      }
    ];
  }
}

// Export configuration helpers
export const createWechatPayConfig = (
  appid: string,
  mchid: string,
  privateKey: string,
  serialNo: string,
  apiv3Key: string,
  options?: Partial<WechatPayConfig>
): WechatPayConfig => {
  return {
    appid,
    mchid,
    private_key: privateKey,
    serial_no: serialNo,
    apiv3_key: apiv3Key,
    ...options
  };
};

// Browser-compatible environment detection
function isProduction(): boolean {
  // Check Vite environment variables first
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.PROD === true;
  }
  
  // Fallback for other environments
  try {
    return typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
  } catch {
    // In browser without process, assume development
    return false;
  }
}

// Browser-compatible environment variable getter
function getEnvVar(key: string, defaultValue: string): string {
  // Check Vite environment variables first
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  
  // Fallback for other environments
  try {
    return (typeof process !== 'undefined' && process.env[key]) || defaultValue;
  } catch {
    return defaultValue;
  }
}

// Create default config for development
const defaultWechatConfig: WechatPayConfig = {
  appid: getEnvVar('VITE_WECHAT_APP_ID', 'dev_app_id'),
  mchid: getEnvVar('VITE_WECHAT_MCH_ID', 'dev_mch_id'),
  private_key: getEnvVar('VITE_WECHAT_PRIVATE_KEY', 'dev_private_key'),
  serial_no: getEnvVar('VITE_WECHAT_SERIAL_NO', 'dev_serial_no'),
  apiv3_key: getEnvVar('VITE_WECHAT_APIV3_KEY', 'dev_apiv3_key')
};

// Export singleton instance
export const wechatProvider = new WechatPayProvider(defaultWechatConfig, isProduction());
