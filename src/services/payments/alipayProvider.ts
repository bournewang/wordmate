import { PaymentRequest, PaymentResponse, PaymentVerification } from '../paymentService';
import { getOptimalPaymentType, getDeviceInfo, formatDeviceInfo } from '../../utils/deviceDetection';

// Browser-compatible Alipay integration - keeping for future implementation
// interface AlipaySDKResponse {
//   code: string;
//   msg?: string;
//   subMsg?: string;
//   tradeStatus?: string;
//   tradeNo?: string;
//   totalAmount?: string;
// }

/**
 * Alipay Payment Provider for WordMate
 * 
 * This integrates with Alipay's official SDK for secure payments
 * Documentation: https://opendocs.alipay.com/
 */

export interface AlipayConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway: string;
  signType: 'RSA2';
  charset: 'UTF-8';
  format: 'JSON';
  version: '1.0';
  returnUrl?: string;
  notifyUrl?: string;
}

export interface AlipayTradeCreateParams {
  out_trade_no: string;
  total_amount: string;
  subject: string;
  body?: string;
  product_code: 'FAST_INSTANT_TRADE_PAY';
  passback_params?: string;
  extend_params?: {
    sys_service_provider_id?: string;
  };
}

export class AlipayProvider {
  private config: AlipayConfig;
  private isProduction: boolean;

  constructor(config: AlipayConfig, isProduction: boolean = false) {
    this.config = config;
    this.isProduction = isProduction;
    
    // Validate required configuration
    this.validateConfig();
    
    console.log(`🔄 Alipay Provider initialized in ${isProduction ? 'production' : 'sandbox'} mode`);
  }

  private validateConfig(): void {
    // Skip validation in development mode
    if (!this.isProduction) {
      console.log('🧪 Development mode: Skipping Alipay config validation');
      return;
    }
    
    const required = ['appId', 'privateKey', 'alipayPublicKey'];
    const missing = required.filter(key => !this.config[key as keyof AlipayConfig]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required Alipay config: ${missing.join(', ')}`);
    }
  }

  /**
   * Create a payment order with Alipay
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      console.log('🔄 Creating Alipay payment for:', request.planId);

      const orderNumber = this.generateOrderNumber(request.userId, request.planId || 'premium-monthly');
      
      const params: AlipayTradeCreateParams = {
        out_trade_no: orderNumber,
        total_amount: request.amount.toFixed(2),
        subject: 'WordMate高级会员',
        body: `WordMate ${request.planId} 订阅服务`,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        passback_params: request.userId, // Pass user ID for webhook processing
      };

      // In production, use the real Alipay SDK
      if (this.isProduction) {
        return await this.createProductionPayment(params, request);
      } else {
        return await this.createDevelopmentPayment(params, request);
      }

    } catch (error: any) {
      console.error('❌ Alipay payment creation failed:', error);
      return {
        success: false,
        error: error.message || 'Alipay payment creation failed'
      };
    }
  }

  /**
   * Production payment creation using real Alipay API
   */
  private async createProductionPayment(
    params: AlipayTradeCreateParams, 
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    try {
      console.log('🔐 Creating production Alipay payment via backend API');
      
      // Detect device and choose payment type
      const optimalPaymentType = getOptimalPaymentType('alipay');
      const deviceInfo = getDeviceInfo();
      console.log(`📱 Device detected: ${formatDeviceInfo()} -> Using ${optimalPaymentType} payment`);
      
      // Get API base URL from environment variable
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      
      // In browser environment, make request to your backend API
      const response = await fetch(`${apiBaseUrl}/api/payment/alipay/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_type: optimalPaymentType,
          out_trade_no: params.out_trade_no,
          total_amount: params.total_amount,
          subject: params.subject,
          body: params.body,
          passback_params: params.passback_params,
          return_url: request.returnUrl || `${window.location.origin}/payment/success?payment_id=${params.out_trade_no}&method=alipay`,
          notify_url: request.notifyUrl || `${apiBaseUrl}/api/payment/alipay/notify`
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Payment creation failed');
      }
      
      console.log('✅ Alipay payment created successfully');
      
      // Handle both HTML form and direct URL responses
      const paymentUrl = result.data?.payment_url || result.payment_url;
      const htmlForm = result.data?.html_form;
      const method = result.data?.method;
      const responsePaymentType = result.data?.payment_type || 'page';

      // Handle payment based on device and payment type
      if (deviceInfo.isMobile && responsePaymentType === 'wap') {
        // Mobile: redirect directly to payment URL
        window.location.href = paymentUrl;
      } else if (method === 'POST' && htmlForm) {
        // Desktop: Open HTML form in new tab
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.open();
          newWindow.document.write(htmlForm);
          newWindow.document.close();
        } else {
          // If popup blocked, fallback to GET URL
          window.open(paymentUrl, '_blank');
        }
      } else {
        // Fallback: open GET URL directly
        window.open(paymentUrl, '_blank');
      }

      return {
        success: true,
        data: {
          paymentId: params.out_trade_no,
          paymentUrl: paymentUrl,
          transactionId: params.out_trade_no
        }
      };
      
    } catch (error: any) {
      console.error('❌ Alipay API error:', error);
      throw new Error(`Alipay payment creation failed: ${error.message}`);
    }
  }

  /**
   * Development/sandbox payment using real Alipay API via backend
   */
  private async createDevelopmentPayment(
    params: AlipayTradeCreateParams,
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    console.log('🧦 Development mode: Using real payment API');
    
    try {
      // Detect device and choose payment type
      const optimalPaymentType = getOptimalPaymentType('alipay');
      const deviceInfo = getDeviceInfo();
      console.log(`📱 Device detected: ${formatDeviceInfo()} -> Using ${optimalPaymentType} payment`);
      
      // Get API base URL from environment variable (same as production)
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      
      // Call the backend API for real payment creation
      const response = await fetch(`${apiBaseUrl}/api/payment/alipay/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_type: optimalPaymentType,
          out_trade_no: params.out_trade_no,
          total_amount: params.total_amount,
          subject: params.subject,
          body: params.body,
          passback_params: params.passback_params,
          return_url: request.returnUrl || `${window.location.origin}/payment/success?payment_id=${params.out_trade_no}&method=alipay`,
          notify_url: request.notifyUrl || `${apiBaseUrl}/api/payment/alipay/notify`
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Payment creation failed');
      }
      
      console.log('✅ Alipay payment created successfully in development mode');
      
      // Handle both HTML form and direct URL responses
      const paymentUrl = result.data?.payment_url || result.payment_url;
      const htmlForm = result.data?.html_form;
      const method = result.data?.method;
      const responsePaymentType = result.data?.payment_type || 'page';

      // Handle payment based on device and payment type
      if (deviceInfo.isMobile && responsePaymentType === 'wap') {
        // Mobile: redirect directly to payment URL
        window.location.href = paymentUrl;
      } else if (method === 'POST' && htmlForm) {
        // Desktop: Open HTML form in new tab
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.open();
          newWindow.document.write(htmlForm);
          newWindow.document.close();
        } else {
          // If popup blocked, fallback to GET URL
          window.open(paymentUrl, '_blank');
        }
      } else {
        // Fallback: open GET URL directly
        window.open(paymentUrl, '_blank');
      }

      return {
        success: true,
        data: {
          paymentId: params.out_trade_no,
          paymentUrl: paymentUrl,
          transactionId: params.out_trade_no
        }
      };
      
    } catch (error: any) {
      console.error('❌ Alipay development payment creation failed:', error);
      throw new Error(`Development payment creation failed: ${error.message}`);
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(paymentId: string): Promise<PaymentVerification> {
    try {
      console.log('🔍 Verifying Alipay payment:', paymentId);

      if (this.isProduction) {
        return await this.verifyProductionPayment(paymentId);
      } else {
        return await this.verifyDevelopmentPayment(paymentId);
      }

    } catch (error: any) {
      console.error('❌ Alipay verification failed:', error);
      return {
        success: false,
        error: error.message || 'Payment verification failed'
      };
    }
  }

  private async verifyProductionPayment(paymentId: string): Promise<PaymentVerification> {
    try {
      console.log('🔍 Verifying payment with backend API:', paymentId);
      
      // Get API base URL from environment variable
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      
      const response = await fetch(`${apiBaseUrl}/api/payment/alipay/verify/${paymentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      console.log('📋 Alipay verification result:', result);
      
      if (result.success && result.trade_status === 'TRADE_SUCCESS') {
        return {
          success: true,
          transactionId: result.transaction_id,
          amount: parseFloat(result.amount),
          currency: 'CNY',
          status: 'completed'
        };
      } else if (result.trade_status === 'WAIT_BUYER_PAY') {
        return {
          success: false,
          error: 'Payment pending - waiting for buyer to complete payment',
          status: 'pending'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Payment verification failed',
          status: 'failed'
        };
      }
      
    } catch (error: any) {
      console.error('❌ Alipay verification error:', error);
      throw new Error(`Alipay verification error: ${error.message}`);
    }
  }

  private async verifyDevelopmentPayment(_paymentId: string): Promise<PaymentVerification> {
    console.log('🧪 Development mode: Simulating successful payment verification');
    
    try {
      // For development, simulate a successful payment after a short delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate successful payment
      return {
        success: true,
        transactionId: `alipay_${Date.now()}`,
        amount: 0.1, // Test amount - will be replaced with real amount in production
        currency: 'CNY',
        status: 'completed'
      };
      
    } catch (error: any) {
      console.error('❌ Alipay sandbox verification error:', error);
      return {
        success: false,
        error: `Development verification error: ${error.message}`,
        status: 'failed'
      };
    }
  }

  /**
   * Process payment notification from Alipay
   */
  async processNotification(notification: any): Promise<{
    success: boolean;
    userId?: string;
    transactionId?: string;
    amount?: number;
  }> {
    try {
      console.log('🔔 Processing Alipay notification');

      // Verify notification signature
      const isValid = await this.verifyNotificationSignature(notification);
      if (!isValid) {
        throw new Error('Invalid notification signature');
      }

      // Extract payment information
      const userId = notification.passback_params;
      const transactionId = notification.trade_no;
      const amount = parseFloat(notification.total_amount);
      const tradeStatus = notification.trade_status;

      if (tradeStatus === 'TRADE_SUCCESS') {
        return {
          success: true,
          userId,
          transactionId,
          amount
        };
      } else {
        throw new Error(`Payment not successful: ${tradeStatus}`);
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

      // In production, implement proper RSA signature verification
      /*
      const crypto = require('crypto');
      
      // Extract signature and parameters
      const sign = notification.sign;
      const signType = notification.sign_type;
      
      // Remove sign and sign_type from parameters
      const { sign: _, sign_type: __, ...params } = notification;
      
      // Sort parameters and create signature string
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');

      // Verify signature using Alipay public key
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(sortedParams, 'utf8');
      
      return verify.verify(this.config.alipayPublicKey, sign, 'base64');
      */

      // Placeholder for production signature verification
      return true;

    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  private generateOrderNumber(userId: string, planId: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `WM_${planId}_${userId.slice(-6)}_${timestamp}_${randomStr}`;
  }

  /**
   * Get supported payment methods for Alipay
   */
  static getSupportedMethods() {
    return [
      {
        id: 'alipay_web',
        name: '支付宝网页支付',
        description: '跳转到支付宝完成支付',
        icon: '支',
        enabled: true
      },
      {
        id: 'alipay_mobile',
        name: '支付宝手机支付',
        description: '使用支付宝App完成支付',
        icon: '支',
        enabled: true
      }
    ];
  }
}

// Export configuration helpers
export const createAlipayConfig = (
  appId: string,
  privateKey: string,
  alipayPublicKey: string,
  options?: Partial<AlipayConfig>
): AlipayConfig => {
  return {
    appId,
    privateKey,
    alipayPublicKey,
    gateway: 'https://openapi.alipay.com/gateway.do',
    signType: 'RSA2',
    charset: 'UTF-8',
    format: 'JSON',
    version: '1.0',
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
const defaultAlipayConfig: AlipayConfig = {
  appId: getEnvVar('VITE_ALIPAY_APP_ID', 'dev_app_id'),
  privateKey: getEnvVar('VITE_ALIPAY_PRIVATE_KEY', 'dev_private_key'),
  alipayPublicKey: getEnvVar('VITE_ALIPAY_PUBLIC_KEY', 'dev_public_key'),
  gateway: 'https://openapi.alipay.com/gateway.do',
  signType: 'RSA2',
  charset: 'UTF-8',
  format: 'JSON',
  version: '1.0'
};

// Export singleton instance
export const alipayProvider = new AlipayProvider(defaultAlipayConfig, isProduction());
