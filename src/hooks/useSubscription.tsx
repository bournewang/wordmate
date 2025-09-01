import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { 
  UserSubscription, 
  TrialStatus, 
  UsageStats, 
  SubscriptionLimits,
  SubscriptionFeatures,
  FREE_TRIAL_LIMITS,
  PREMIUM_LIMITS,
  TRIAL_DURATION_DAYS,
  SUBSCRIPTION_PLANS 
} from '../types/subscription';
import { subscriptionAnalytics } from '../services/analytics/subscriptionAnalytics';
import { alipayProvider } from '../services/payments/alipayProvider';
import { wechatProvider } from '../services/payments/wechatProvider';
import { subscriptionService } from '../services/subscriptionService';

interface SubscriptionState {
  subscription: UserSubscription | null;
  trialStatus: TrialStatus | null;
  usageStats: UsageStats;
  currentLimits: SubscriptionLimits;
  features: SubscriptionFeatures;
  isLoading: boolean;
  isPremium: boolean;
  isTrialActive: boolean;
  canUpgrade: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
  initializeTrial: () => Promise<void>;
  upgradeToPremium: (paymentMethod: 'alipay' | 'wechat', planId?: string) => Promise<{ success: boolean; paymentUrl?: string; paymentId?: string; error?: string }>;
  cancelSubscription: () => Promise<{ success: boolean; error?: string }>;
  checkUsageLimit: (action: 'practice' | 'word_learn') => boolean;
  recordUsage: (action: 'practice' | 'word_learn', count?: number) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  verifyPayment: (paymentId: string) => Promise<{ success: boolean; error?: string }>;
  syncWithBackend: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

// Helper functions
const getDeviceKey = (deviceId: string) => `wordmate_trial_${deviceId}`;
const getUserKey = (userId: string) => `wordmate_subscription_${userId}`;
const getUsageKey = (deviceId: string, userId?: string) => 
  userId ? `wordmate_usage_${userId}` : `wordmate_usage_device_${deviceId}`;

// Check if a plan ID is a premium plan
const isPremiumPlan = (planId: string): boolean => {
  return ['premium-monthly', 'premium-test'].includes(planId);
};

const calculateTrialStatus = (startDate: string): TrialStatus => {
  const start = new Date(startDate);
  const now = new Date();
  const end = new Date(start.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  
  const timeRemaining = end.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (24 * 60 * 60 * 1000)));
  
  return {
    isActive: daysRemaining > 0,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    daysRemaining,
    hasExpired: daysRemaining <= 0
  };
};

const getInitialUsageStats = (): UsageStats => ({
  practiceSessionsToday: 0,
  wordsLearnedToday: 0,
  totalPracticeSessions: 0,
  lastResetDate: new Date().toISOString().split('T')[0]
});

const shouldResetUsageStats = (lastResetDate: string): boolean => {
  const lastReset = new Date(lastResetDate);
  const today = new Date();
  return lastReset.toDateString() !== today.toDateString();
};

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, deviceId, isAuthenticated, token } = useAuth();
  
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>({
    subscription: null,
    trialStatus: null,
    usageStats: getInitialUsageStats(),
    currentLimits: FREE_TRIAL_LIMITS,
    features: {
      unlimitedPractice: false,
      advancedAnalytics: false,
      cloudSync: false,
      prioritySupport: false,
      offlineMode: true, // Always available
      customStudyPlans: false
    },
    isLoading: true,
    isPremium: false,
    isTrialActive: false,
    canUpgrade: true
  });

  useEffect(() => {
    if (deviceId) {
      initializeSubscription();
    }
  }, [deviceId, user?.id]);
  
  // Check for pending payment completions on app initialization
  useEffect(() => {
    if (isAuthenticated && user && deviceId) {
      checkPendingPayments();
    }
  }, [isAuthenticated, user, deviceId]);

  const initializeSubscription = async () => {
    try {
      console.log('🔄 Initializing subscription state...');
      setSubscriptionState(prev => ({ ...prev, isLoading: true }));

      // Load usage stats
      const usageStats = loadUsageStats();
      
      // For authenticated users, try to load subscription from backend first, then localStorage
      if (isAuthenticated && user) {
        try {
          // Try to sync with backend first
          await syncWithBackendInternal();
          
          // After backend sync, load the updated localStorage data
          const storedSubscription = localStorage.getItem(getUserKey(user.id));
          if (storedSubscription) {
            const subscription: UserSubscription = JSON.parse(storedSubscription);
            const isPremium = subscription.status === 'active' && isPremiumPlan(subscription.planId);
            
            setSubscriptionState(prev => ({
              ...prev,
              subscription,
              usageStats,
              currentLimits: isPremium ? PREMIUM_LIMITS : FREE_TRIAL_LIMITS,
              features: calculateFeatures(isPremium, subscription.trialStatus),
              isPremium,
              isTrialActive: subscription.trialStatus?.isActive || false,
              canUpgrade: !isPremium,
              isLoading: false
            }));
            
            console.log('✅ Loaded user subscription after backend sync:', subscription.status);
            return;
          }
        } catch (backendError) {
          console.warn('⚠️ Backend sync failed, falling back to localStorage:', backendError);
          
          // Fallback to localStorage if backend fails
          const storedSubscription = localStorage.getItem(getUserKey(user.id));
          if (storedSubscription) {
            try {
              const subscription: UserSubscription = JSON.parse(storedSubscription);
              const isPremium = subscription.status === 'active' && isPremiumPlan(subscription.planId);
              
              setSubscriptionState(prev => ({
                ...prev,
                subscription,
                usageStats,
                currentLimits: isPremium ? PREMIUM_LIMITS : FREE_TRIAL_LIMITS,
                features: calculateFeatures(isPremium, subscription.trialStatus),
                isPremium,
                isTrialActive: subscription.trialStatus?.isActive || false,
                canUpgrade: !isPremium,
                isLoading: false
              }));
              
              console.log('✅ Loaded user subscription from localStorage:', subscription.status);
              return;
            } catch (error) {
              console.warn('Failed to parse stored subscription:', error);
            }
          }
        }
      }

      // Check for device-based trial (for anonymous users or new registered users)
      const deviceKey = getDeviceKey(deviceId!);
      const trialStartDate = localStorage.getItem(deviceKey);
      
      if (trialStartDate) {
        const trialStatus = calculateTrialStatus(trialStartDate);
        
        setSubscriptionState(prev => ({
          ...prev,
          trialStatus,
          usageStats,
          isTrialActive: trialStatus.isActive,
          features: calculateFeatures(false, trialStatus),
          currentLimits: trialStatus.isActive ? FREE_TRIAL_LIMITS : {
            ...FREE_TRIAL_LIMITS,
            maxPracticeSessionsPerDay: 1,
            maxWordsPerDay: 10
          },
          canUpgrade: true,
          isLoading: false
        }));
        
        console.log(`📱 Device trial status: ${trialStatus.isActive ? 'active' : 'expired'}, ${trialStatus.daysRemaining} days remaining`);
      } else {
        // New user/device - ready to start trial
        setSubscriptionState(prev => ({
          ...prev,
          usageStats,
          canUpgrade: true,
          isLoading: false
        }));
        
        console.log('🆕 New user/device - ready to start trial');
      }

    } catch (error) {
      console.error('❌ Subscription initialization failed:', error);
      setSubscriptionState(prev => ({ 
        ...prev, 
        isLoading: false 
      }));
    }
  };

  const loadUsageStats = (): UsageStats => {
    try {
      const usageKey = getUsageKey(deviceId!, user?.id);
      const stored = localStorage.getItem(usageKey);
      
      if (stored) {
        const stats: UsageStats = JSON.parse(stored);
        
        // Reset daily stats if it's a new day
        if (shouldResetUsageStats(stats.lastResetDate)) {
          const resetStats: UsageStats = {
            ...stats,
            practiceSessionsToday: 0,
            wordsLearnedToday: 0,
            lastResetDate: new Date().toISOString().split('T')[0]
          };
          
          localStorage.setItem(usageKey, JSON.stringify(resetStats));
          return resetStats;
        }
        
        return stats;
      }
    } catch (error) {
      console.warn('Failed to load usage stats:', error);
    }
    
    return getInitialUsageStats();
  };

  const saveUsageStats = (stats: UsageStats) => {
    try {
      const usageKey = getUsageKey(deviceId!, user?.id);
      localStorage.setItem(usageKey, JSON.stringify(stats));
    } catch (error) {
      console.warn('Failed to save usage stats:', error);
    }
  };

  const calculateFeatures = (isPremium: boolean, trialStatus?: TrialStatus): SubscriptionFeatures => {
    const hasActiveAccess = isPremium || (trialStatus?.isActive || false);
    
    return {
      unlimitedPractice: isPremium,
      advancedAnalytics: hasActiveAccess,
      cloudSync: isPremium,
      prioritySupport: isPremium,
      offlineMode: true, // Always available
      customStudyPlans: hasActiveAccess
    };
  };

  // Check for payments that might have completed while app was closed
  const checkPendingPayments = async () => {
    if (!user) return;
    
    try {
      console.log('🔍 Checking for pending payment completions...');
      
      // Check if there are any pending payment IDs stored
      const pendingPayments = localStorage.getItem(`wordmate_pending_payments_${user.id}`);
      if (pendingPayments) {
        const paymentIds: string[] = JSON.parse(pendingPayments);
        
        for (const paymentId of paymentIds) {
          console.log(`🔍 Verifying payment: ${paymentId}`);
          
          const result = await verifyPayment(paymentId);
          if (result.success) {
            console.log(`✅ Payment ${paymentId} completed successfully`);
            // Remove from pending payments
            const remaining = paymentIds.filter(id => id !== paymentId);
            if (remaining.length > 0) {
              localStorage.setItem(`wordmate_pending_payments_${user.id}`, JSON.stringify(remaining));
            } else {
              localStorage.removeItem(`wordmate_pending_payments_${user.id}`);
            }
            
            // Show success notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('WordMate', {
                body: '🎉 支付成功！您已成功升级到高级会员！',
                icon: '/icon-192.png'
              });
            }
          }
        }
      }
      
      // Always refresh subscription status on app start
      await refreshSubscription();
      
    } catch (error) {
      console.error('❌ Failed to check pending payments:', error);
    }
  };

  const initializeTrial = async () => {
    if (!deviceId) {
      throw new Error('Device ID not available');
    }

    try {
      console.log('🎯 Starting free trial...');
      
      const startDate = new Date().toISOString();
      const deviceKey = getDeviceKey(deviceId);
      
      // Store trial start date
      localStorage.setItem(deviceKey, startDate);
      
      const trialStatus = calculateTrialStatus(startDate);
      
      // For authenticated users, create subscription record
      if (isAuthenticated && user) {
        const trialSubscription: UserSubscription = {
          userId: user.id,
          planId: 'free-trial',
          status: 'trial',
          trialStatus,
          currentPeriodStart: startDate,
          currentPeriodEnd: trialStatus.endDate,
          createdAt: startDate,
          updatedAt: startDate
        };
        
        localStorage.setItem(getUserKey(user.id), JSON.stringify(trialSubscription));
        
        setSubscriptionState(prev => ({
          ...prev,
          subscription: trialSubscription,
          trialStatus,
          isTrialActive: true,
          features: calculateFeatures(false, trialStatus)
        }));
      } else {
        // Anonymous user trial
        setSubscriptionState(prev => ({
          ...prev,
          trialStatus,
          isTrialActive: true,
          features: calculateFeatures(false, trialStatus)
        }));
      }
      
      console.log('✅ Trial initialized successfully');
      
      // Track trial start for analytics
      if (user) {
        await subscriptionAnalytics.trackTrialStart(user.id, deviceId, 'organic');
      }
    } catch (error) {
      console.error('❌ Trial initialization failed:', error);
      throw error;
    }
  };

  const upgradeToPremium = async (paymentMethod: 'alipay' | 'wechat', planId: string = 'premium-monthly') => {
    try {
      if (!user) {
        return { 
          success: false, 
          error: '请先注册账号以升级到高级会员' 
        };
      }

      // Find the selected plan
      const selectedPlan = SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
      if (!selectedPlan) {
        return {
          success: false,
          error: '未找到指定的订阅计划'
        };
      }

      console.log(`💳 Initiating premium upgrade for plan: ${selectedPlan.name} (¥${selectedPlan.price})`);
      
      // Create payment with the selected provider
      const provider = paymentMethod === 'alipay' ? alipayProvider : wechatProvider;
      const orderId = `order_${user.id}_${Date.now()}`;
      
      // Create payment order
      const paymentResult = await provider.createPayment({
        // orderId, // Remove if not needed or add to PaymentRequest interface
        amount: selectedPlan.price,
        currency: selectedPlan.currency,
        description: `WordMate ${selectedPlan.name} - 月费`,
        userId: user.id,
        planId: selectedPlan.id, // Add planId to payment request
        returnUrl: `${window.location.origin}/payment/success`,
        notifyUrl: `${window.location.origin}/api/payment/notify`
      });
      
      if (paymentResult.success && paymentResult.data) {
        const { paymentId, paymentUrl } = paymentResult.data;
        
        // Track payment start for analytics
        await subscriptionAnalytics.trackPaymentStart(user.id, paymentId, paymentMethod);
        
        // Store payment ID for later verification
        const pendingPayments = localStorage.getItem(`wordmate_pending_payments_${user.id}`);
        const currentPending: string[] = pendingPayments ? JSON.parse(pendingPayments) : [];
        if (!currentPending.includes(paymentId)) {
          currentPending.push(paymentId);
          localStorage.setItem(`wordmate_pending_payments_${user.id}`, JSON.stringify(currentPending));
        }
        
        // Return payment URL for opening in new tab (both dev and prod)
        return { 
          success: true, 
          paymentUrl,
          paymentId 
        };
      } else {
        // Track payment failure for analytics
        if (user) {
          await subscriptionAnalytics.trackPaymentFailed(user.id, orderId, paymentResult.error || 'Payment creation failed');
        }
        return { 
          success: false, 
          error: paymentResult.error || '支付创建失败，请重试' 
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '升级失败，请重试';
      console.error('❌ Premium upgrade failed:', error);
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  };

  // Handle successful payment (called after payment verification)
  const handlePaymentSuccess = async (paymentId: string, userId: string) => {
    try {
      console.log('🎉 Processing payment success for:', paymentId, userId);
      
      // Extract plan ID from payment ID if it contains plan info
      let actualPlanId = 'premium-monthly'; // default fallback
      if (paymentId.includes('premium-test')) {
        actualPlanId = 'premium-test';
      } else if (paymentId.includes('premium-monthly')) {
        actualPlanId = 'premium-monthly';
      }
      
      console.log('🏦 Using plan ID:', actualPlanId);
      
      const now = new Date();
      const premiumSubscription: UserSubscription = {
        userId: userId,
        planId: actualPlanId, // Use the correct plan ID
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString(),
        createdAt: subscriptionState.subscription?.createdAt || now.toISOString(),
        updatedAt: now.toISOString()
      };
      
      // Save to localStorage (in real app, this would be saved to backend)
      localStorage.setItem(getUserKey(userId), JSON.stringify(premiumSubscription));
      console.log('💾 Saved subscription to localStorage:', getUserKey(userId));
      
      // Remove the payment from pending list
      const pendingPayments = localStorage.getItem(`wordmate_pending_payments_${userId}`);
      if (pendingPayments) {
        const paymentIds = JSON.parse(pendingPayments);
        const updatedPayments = paymentIds.filter((id: string) => id !== paymentId);
        if (updatedPayments.length > 0) {
          localStorage.setItem(`wordmate_pending_payments_${userId}`, JSON.stringify(updatedPayments));
        } else {
          localStorage.removeItem(`wordmate_pending_payments_${userId}`);
        }
        console.log('🗑️ Removed payment from pending list:', paymentId);
      }
      
      // Update subscription state
      setSubscriptionState(prev => {
        const newState = {
          ...prev,
          subscription: premiumSubscription,
          currentLimits: PREMIUM_LIMITS,
          features: calculateFeatures(true),
          isPremium: true,
          isTrialActive: false,
          canUpgrade: false
        };
        console.log('🔄 Updated subscription state:', {
          isPremium: newState.isPremium,
          planId: premiumSubscription.planId,
          status: premiumSubscription.status
        });
        return newState;
      });
      
      // Track successful payment for analytics
      await subscriptionAnalytics.trackPaymentComplete(userId, paymentId, 38);
      
      console.log('✅ Successfully upgraded to premium via payment:', paymentId);
      
      // Show success notification
      if (typeof window !== 'undefined' && 'Notification' in window) {
        new Notification('WordMate', {
          body: '🎉 升级成功！现在可以无限制使用所有功能了！',
          icon: '/icon-192.png'
        });
      }
    } catch (error) {
      console.error('❌ Failed to handle payment success:', error);
    }
  };

  // Verify payment status (called by payment success page)
  const verifyPayment = async (paymentId: string) => {
    try {
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // In development, simulate successful verification
      if (process.env.NODE_ENV === 'development') {
        await handlePaymentSuccess(paymentId, user.id);
        return { success: true };
      }

      // In production, verify with payment providers
      // Try both providers to find the payment
      const alipayResult = await alipayProvider.verifyPayment(paymentId);
      if (alipayResult.success) {
        await handlePaymentSuccess(paymentId, user.id);
        return { success: true };
      }

      const wechatResult = await wechatProvider.verifyPayment(paymentId);
      if (wechatResult.success) {
        await handlePaymentSuccess(paymentId, user.id);
        return { success: true };
      }

      return { success: false, error: '支付验证失败' };
    } catch (error) {
      console.error('❌ Payment verification failed:', error);
      return { 
        success: false, 
        error: '支付验证过程中出错' 
      };
    }
  };

  const cancelSubscription = async () => {
    try {
      if (!subscriptionState.subscription || !user) {
        return { success: false, error: '没有找到有效的订阅' };
      }

      const cancelledSubscription = {
        ...subscriptionState.subscription,
        status: 'cancelled' as const,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(getUserKey(user.id), JSON.stringify(cancelledSubscription));

      setSubscriptionState(prev => ({
        ...prev,
        subscription: cancelledSubscription,
        isPremium: false,
        currentLimits: FREE_TRIAL_LIMITS,
        features: calculateFeatures(false),
        canUpgrade: true
      }));

      console.log('✅ Subscription cancelled successfully');
      return { success: true };
    } catch (error: unknown) {
      console.error('❌ Subscription cancellation failed:', error);
      const errorMessage = error instanceof Error ? error.message : '取消订阅失败';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  };

  const checkUsageLimit = (action: 'practice' | 'word_learn'): boolean => {
    const { currentLimits, usageStats, isPremium } = subscriptionState;
    
    // Premium users have no limits
    if (isPremium) return true;
    
    switch (action) {
      case 'practice':
        return currentLimits.maxPracticeSessionsPerDay === -1 || 
               usageStats.practiceSessionsToday < currentLimits.maxPracticeSessionsPerDay;
      case 'word_learn':
        return currentLimits.maxWordsPerDay === -1 || 
               usageStats.wordsLearnedToday < currentLimits.maxWordsPerDay;
      default:
        return false;
    }
  };

  const recordUsage = async (action: 'practice' | 'word_learn', count: number = 1) => {
    try {
      const newStats = { ...subscriptionState.usageStats };
      
      // Reset stats if it's a new day
      if (shouldResetUsageStats(newStats.lastResetDate)) {
        newStats.practiceSessionsToday = 0;
        newStats.wordsLearnedToday = 0;
        newStats.lastResetDate = new Date().toISOString().split('T')[0];
      }
      
      switch (action) {
        case 'practice':
          newStats.practiceSessionsToday += count;
          newStats.totalPracticeSessions += count;
          break;
        case 'word_learn':
          newStats.wordsLearnedToday += count;
          break;
      }
      
      setSubscriptionState(prev => ({
        ...prev,
        usageStats: newStats
      }));
      
      saveUsageStats(newStats);
      
      console.log(`📊 Usage recorded: ${action} +${count}`);
      
      // Track usage for analytics
      if (user) {
        await subscriptionAnalytics.trackTrialUsage(user.id, action, count);
      }
    } catch (error) {
      console.error('❌ Failed to record usage:', error);
    }
  };

  const refreshSubscription = async () => {
    try {
      console.log('🔄 Refreshing subscription data...');
      
      // In a real app, this would fetch from your backend API
      // For now, we'll reload from localStorage and recalculate trial status
      
      if (subscriptionState.trialStatus && deviceId) {
        const deviceKey = getDeviceKey(deviceId);
        const trialStartDate = localStorage.getItem(deviceKey);
        
        if (trialStartDate) {
          const updatedTrialStatus = calculateTrialStatus(trialStartDate);
          
          setSubscriptionState(prev => ({
            ...prev,
            trialStatus: updatedTrialStatus,
            isTrialActive: updatedTrialStatus.isActive,
            currentLimits: updatedTrialStatus.isActive ? FREE_TRIAL_LIMITS : {
              ...FREE_TRIAL_LIMITS,
              maxPracticeSessionsPerDay: 1,
              maxWordsPerDay: 10
            },
            features: calculateFeatures(prev.isPremium, updatedTrialStatus)
          }));
        }
      }
      
      console.log('✅ Subscription refreshed');
    } catch (error) {
      console.error('❌ Subscription refresh failed:', error);
    }
  };

  // Force refresh - completely reinitialize subscription state
  const forceRefresh = async () => {
    try {
      console.log('🔄 Force refreshing subscription state...');
      await initializeSubscription();
      console.log('✅ Force refresh completed');
    } catch (error) {
      console.error('❌ Force refresh failed:', error);
    }
  };

  // Sync with backend - fetch subscription status from backend and update localStorage
  const syncWithBackendInternal = async () => {
    if (!isAuthenticated || !user) {
      console.log('🔍 Skipping backend sync: user not authenticated');
      return;
    }

    try {
      console.log('🔄 Syncing subscription with backend...');
      
      // Get auth token from useAuth hook (the proper way)
      const authToken = token;
      
      if (!authToken) {
        throw new Error('No authentication token found. User needs to log in.');
      }
      
      console.log('🔑 Using auth token for backend sync:', {
        tokenLength: authToken.length,
        tokenPreview: authToken.substring(0, 20) + '...',
        isJWT: authToken.split('.').length === 3
      });
      
      // Fetch subscription status from backend
      const backendData = await subscriptionService.fetchSubscriptionStatus(user.id, authToken);
      
      if (backendData && subscriptionService.isBackendPremium(backendData)) {
        // User has premium subscription in backend - update localStorage
        const frontendSubscription = subscriptionService.convertToFrontendFormat(backendData, user.id);
        
        if (frontendSubscription) {
          localStorage.setItem(getUserKey(user.id), JSON.stringify(frontendSubscription));
          console.log('✅ Updated localStorage with backend premium subscription');
        }
      } else {
        console.log('ℹ️ Backend shows no premium subscription');
      }
      
    } catch (error) {
      console.warn('⚠️ Backend sync failed:', error);
      throw error;
    }
  };

  // Public sync function
  const syncWithBackend = async () => {
    try {
      await syncWithBackendInternal();
      // Refresh the subscription state after syncing
      await forceRefresh();
    } catch (error) {
      console.error('❌ Backend sync failed:', error);
      throw error;
    }
  };

  const contextValue: SubscriptionContextType = {
    ...subscriptionState,
    initializeTrial,
    upgradeToPremium,
    cancelSubscription,
    checkUsageLimit,
    recordUsage,
    refreshSubscription,
    forceRefresh,
    verifyPayment,
    syncWithBackend
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

// Utility hooks
export const useSubscriptionStatus = () => {
  const { 
    isPremium, 
    isTrialActive, 
    trialStatus, 
    subscription,
    canUpgrade 
  } = useSubscription();
  
  return {
    isPremium,
    isTrialActive,
    isTrialExpired: trialStatus?.hasExpired || false,
    daysRemaining: trialStatus?.daysRemaining || 0,
    subscriptionStatus: subscription?.status || 'none',
    canUpgrade,
    needsUpgrade: !isPremium && (!isTrialActive || trialStatus?.hasExpired)
  };
};

export const useFeatureAccess = () => {
  const { features, currentLimits, usageStats } = useSubscription();
  
  return {
    features,
    limits: currentLimits,
    usage: usageStats,
    canAccessAdvancedStats: features.advancedAnalytics,
    canSyncDevices: features.cloudSync,
    hasUnlimitedPractice: features.unlimitedPractice,
    dailyPracticeRemaining: currentLimits.maxPracticeSessionsPerDay === -1 ? 
      -1 : Math.max(0, currentLimits.maxPracticeSessionsPerDay - usageStats.practiceSessionsToday),
    dailyWordsRemaining: currentLimits.maxWordsPerDay === -1 ? 
      -1 : Math.max(0, currentLimits.maxWordsPerDay - usageStats.wordsLearnedToday)
  };
};

export const usePayment = () => {
  const { upgradeToPremium, cancelSubscription } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleUpgrade = async (paymentMethod: 'alipay' | 'wechat', planId?: string) => {
    setIsProcessing(true);
    try {
      const result = await upgradeToPremium(paymentMethod, planId);
      return result;
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      const result = await cancelSubscription();
      return result;
    } finally {
      setIsProcessing(false);
    }
  };
  
  return {
    handleUpgrade,
    handleCancel,
    isProcessing
  };
};
