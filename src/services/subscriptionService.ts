/**
 * Subscription Service - Backend API Integration
 * Handles subscription status synchronization with backend KV storage
 */

interface BackendSubscriptionData {
  hasSubscription: boolean;
  status: 'active' | 'expired' | 'trial';
  plan: string;
  startDate?: string;
  expiryDate?: string;
  paymentMethod?: string;
  daysRemaining: number;
  lastPayment?: {
    orderId: string;
    amount: number;
    tradeNo: string;
    processedAt: string;
  };
}

interface SubscriptionResponse {
  success: boolean;
  data?: BackendSubscriptionData;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

class SubscriptionService {
  private baseUrl: string;

  constructor() {
    // Use current domain for API calls
    this.baseUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}`
      : '';
  }

  /**
   * Fetch user subscription status from backend
   */
  async fetchSubscriptionStatus(userId: string, authToken: string): Promise<BackendSubscriptionData | null> {
    try {
      console.log('🔄 Fetching subscription status from backend for:', userId);
      
      // Try to make the actual API request first
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/user/${userId}/subscription`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        // Check if we got HTML instead of JSON (Vite dev server response)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Got HTML response instead of JSON - API server not available');
        }
        
      } catch (fetchError) {
        console.warn('💻 API server not available, using mock data for development:', fetchError);
        
        // In development mode, return mock data based on user ID
        if (process.env.NODE_ENV === 'development') {
          console.log('💻 Development mode: Using mock subscription data for', userId);
          
          // Check localStorage to see if user should have premium (e.g., after mock payment)
          const hasStoredPremium = localStorage.getItem(`wordmate_subscription_${userId}`);
          let hasPremiumStatus = false;
          
          if (hasStoredPremium) {
            try {
              const stored = JSON.parse(hasStoredPremium);
              hasPremiumStatus = stored.status === 'active' && (stored.planId === 'premium-monthly' || stored.planId === 'premium-test');
            } catch (e) {
              console.warn('Failed to parse stored subscription:', e);
            }
          }
          
          // Also check if userId suggests premium (for testing different states)
          const shouldHavePremium = hasPremiumStatus || userId.includes('premium') || userId.includes('paid');
          
          const mockData: BackendSubscriptionData = {
            hasSubscription: shouldHavePremium,
            status: shouldHavePremium ? 'active' : 'trial',
            plan: shouldHavePremium ? 'premium' : 'free-trial',
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
            expiryDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(), // 23 days from now
            paymentMethod: 'alipay',
            daysRemaining: 23,
            lastPayment: shouldHavePremium ? {
              orderId: 'mock_order_123',
              amount: 38,
              tradeNo: 'mock_trade_456',
              processedAt: new Date().toISOString()
            } : undefined
          };
          
          console.log('✅ Mock subscription data:', mockData);
          return mockData;
        }
        
        // In production, re-throw the error
        throw fetchError;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('❌ Failed to fetch subscription status:', response.status, errorData);
        
        if (response.status === 404) {
          // User not found, return null
          return null;
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData?.error?.message || 'Unknown error'}`);
      }

      const data: SubscriptionResponse = await response.json();
      
      if (!data.success) {
        console.error('❌ Backend returned error:', data.error);
        throw new Error(data.error?.message || 'Unknown backend error');
      }

      console.log('✅ Successfully fetched subscription status:', data.data);
      return data.data || null;

    } catch (error) {
      console.error('❌ Subscription service error:', error);
      throw error;
    }
  }

  /**
   * Check if backend subscription status indicates premium access
   */
  isBackendPremium(subscriptionData: BackendSubscriptionData | null): boolean {
    if (!subscriptionData) return false;
    
    return subscriptionData.hasSubscription && 
           subscriptionData.status === 'active' && 
           subscriptionData.plan === 'premium' &&
           subscriptionData.daysRemaining > 0;
  }

  /**
   * Convert backend subscription data to frontend format
   */
  convertToFrontendFormat(backendData: BackendSubscriptionData, userId: string): any {
    if (!backendData || !backendData.hasSubscription) {
      return null;
    }

    const isPremium = this.isBackendPremium(backendData);
    const planId = isPremium ? 'premium-monthly' : 'free-trial';

    return {
      userId,
      planId,
      status: backendData.status,
      currentPeriodStart: backendData.startDate,
      currentPeriodEnd: backendData.expiryDate,
      createdAt: backendData.startDate,
      updatedAt: new Date().toISOString(),
      backendSynced: true // Flag to indicate this came from backend
    };
  }
}

export const subscriptionService = new SubscriptionService();
