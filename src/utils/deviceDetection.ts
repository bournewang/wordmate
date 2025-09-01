/**
 * Device Detection Utilities for Payment Method Selection
 * 
 * Determines appropriate payment methods based on device type and browser
 */

export interface DeviceInfo {
  isMobile: boolean;
  isDesktop: boolean;
  isWeChat: boolean;
  isAlipay: boolean;
  userAgent: string;
  screenWidth: number;
  touchSupported: boolean;
}

export interface PaymentMethodRecommendation {
  alipay: {
    type: 'page' | 'wap';
    name: string;
    description: string;
  };
  wechat: {
    type: 'native' | 'h5' | 'jsapi';
    name: string;
    description: string;
  };
}

/**
 * Detect device information
 */
export function getDeviceInfo(): DeviceInfo {
  const userAgent = navigator.userAgent;
  const screenWidth = window.screen.width;
  
  // Mobile device detection
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const isMobile = mobileRegex.test(userAgent) || screenWidth < 768;
  
  // WeChat browser detection
  const isWeChat = /MicroMessenger/i.test(userAgent);
  
  // Alipay browser detection  
  const isAlipay = /AlipayClient/i.test(userAgent);
  
  // Touch support detection
  const touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return {
    isMobile,
    isDesktop: !isMobile,
    isWeChat,
    isAlipay,
    userAgent,
    screenWidth,
    touchSupported
  };
}

/**
 * Get recommended payment methods based on device
 */
export function getPaymentMethodRecommendations(): PaymentMethodRecommendation {
  const deviceInfo = getDeviceInfo();
  
  if (deviceInfo.isWeChat) {
    // Inside WeChat browser - use JSAPI for seamless experience
    return {
      alipay: {
        type: 'wap',
        name: '支付宝',
        description: '将跳转到支付宝完成支付'
      },
      wechat: {
        type: 'jsapi',
        name: '微信支付',
        description: '在微信内直接完成支付'
      }
    };
  } else if (deviceInfo.isAlipay) {
    // Inside Alipay browser - optimize for Alipay
    return {
      alipay: {
        type: 'wap',
        name: '支付宝',
        description: '在支付宝内直接完成支付'
      },
      wechat: {
        type: 'h5',
        name: '微信支付',
        description: '将跳转到微信完成支付'
      }
    };
  } else if (deviceInfo.isMobile) {
    // Mobile browser - use redirect-based payments
    return {
      alipay: {
        type: 'wap',
        name: '支付宝',
        description: '跳转到支付宝App或网页版完成支付'
      },
      wechat: {
        type: 'h5',
        name: '微信支付',
        description: '跳转到微信App或网页版完成支付'
      }
    };
  } else {
    // Desktop browser - use QR code based payments
    return {
      alipay: {
        type: 'page',
        name: '支付宝',
        description: '跳转到支付宝网页版完成支付'
      },
      wechat: {
        type: 'native',
        name: '微信支付',
        description: '扫描二维码，用手机微信完成支付'
      }
    };
  }
}

/**
 * Get user-friendly payment flow description
 */
export function getPaymentFlowDescription(method: 'alipay' | 'wechat'): string {
  const deviceInfo = getDeviceInfo();
  
  if (deviceInfo.isMobile) {
    switch (method) {
      case 'alipay':
        return deviceInfo.isAlipay 
          ? '在支付宝内直接完成支付' 
          : '点击后将跳转到支付宝App或网页版完成支付';
      case 'wechat':
        return deviceInfo.isWeChat 
          ? '在微信内直接完成支付' 
          : '点击后将跳转到微信App或网页版完成支付';
    }
  } else {
    switch (method) {
      case 'alipay':
        return '点击后将跳转到支付宝网页版完成支付';
      case 'wechat':
        return '显示二维码，请用手机微信扫码完成支付';
    }
  }
  
  return '选择支付方式完成升级';
}

/**
 * Check if device supports QR code display
 */
export function supportsQRCodeDisplay(): boolean {
  const deviceInfo = getDeviceInfo();
  return deviceInfo.isDesktop;
}

/**
 * Check if device can handle redirect payments
 */
export function supportsRedirectPayments(): boolean {
  return true; // All browsers support redirects
}

/**
 * Get optimal payment type for backend API
 */
export function getOptimalPaymentType(method: 'alipay' | 'wechat'): string {
  const recommendations = getPaymentMethodRecommendations();
  return recommendations[method].type;
}

/**
 * Format device info for logging/debugging
 */
export function formatDeviceInfo(): string {
  const info = getDeviceInfo();
  return `${info.isMobile ? 'Mobile' : 'Desktop'} | ${info.screenWidth}px | ${info.isWeChat ? 'WeChat' : info.isAlipay ? 'Alipay' : 'Browser'} | Touch: ${info.touchSupported}`;
}
