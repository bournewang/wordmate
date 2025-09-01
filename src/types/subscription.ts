export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in yuan
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  isPopular?: boolean;
}

export interface TrialStatus {
  isActive: boolean;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  hasExpired: boolean;
}

export interface UsageStats {
  practiceSessionsToday: number;
  wordsLearnedToday: number;
  totalPracticeSessions: number;
  lastResetDate: string;
}

export interface SubscriptionLimits {
  maxPracticeSessionsPerDay: number;
  maxWordsPerDay: number;
  canAccessAdvancedStats: boolean;
  canSyncAcrossDevices: boolean;
  hasCloudBackup: boolean;
  hasPrioritySupport: boolean;
}

export interface UserSubscription {
  id?: string;
  userId: string;
  planId: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'past_due';
  trialStatus?: TrialStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'alipay' | 'wechat' | 'other';
  transactionId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface SubscriptionFeatures {
  unlimitedPractice: boolean;
  advancedAnalytics: boolean;
  cloudSync: boolean;
  prioritySupport: boolean;
  offlineMode: boolean;
  customStudyPlans: boolean;
}

// Predefined subscription plans
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free-trial',
    name: '免费试用',
    price: 0,
    currency: 'CNY',
    interval: 'month',
    features: [
      '3天免费试用',
      '基础词汇练习',
      '简单进度统计',
      '离线学习'
    ]
  },
  {
    id: 'premium-test',
    name: '测试会员',
    price: 0.1,
    currency: 'CNY',
    interval: 'month',
    features: [
      '🧪 测试专用优惠',
      '无限制练习',
      '高级进度分析',
      '多设备同步',
      '云端备份',
      '测试环境专享'
    ]
  },
  {
    id: 'premium-monthly',
    name: '高级会员',
    price: 38,
    currency: 'CNY',
    interval: 'month',
    features: [
      '无限制练习',
      '高级进度分析',
      '多设备同步',
      '云端备份',
      '优先客服支持',
      '个性化学习计划'
    ],
    isPopular: true
  }
];

export const FREE_TRIAL_LIMITS: SubscriptionLimits = {
  maxPracticeSessionsPerDay: 5,
  maxWordsPerDay: 50,
  canAccessAdvancedStats: false,
  canSyncAcrossDevices: false,
  hasCloudBackup: false,
  hasPrioritySupport: false
};

export const PREMIUM_LIMITS: SubscriptionLimits = {
  maxPracticeSessionsPerDay: -1, // unlimited
  maxWordsPerDay: -1, // unlimited
  canAccessAdvancedStats: true,
  canSyncAcrossDevices: true,
  hasCloudBackup: true,
  hasPrioritySupport: true
};

export const TRIAL_DURATION_DAYS = 3;
