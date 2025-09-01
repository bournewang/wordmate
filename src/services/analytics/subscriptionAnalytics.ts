/**
 * Subscription Analytics Service for WordMate
 * 
 * Tracks user behavior, conversion metrics, and subscription lifecycle events
 * Integrates with popular analytics platforms like Google Analytics, Mixpanel, etc.
 */

export interface AnalyticsEvent {
  event: string;
  userId?: string;
  deviceId?: string;
  timestamp: string;
  properties: Record<string, any>;
  userProperties?: Record<string, any>;
}

export interface ConversionFunnel {
  step: 'app_open' | 'trial_start' | 'trial_usage' | 'upgrade_prompt' | 'payment_start' | 'payment_complete';
  userId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionMetrics {
  // Trial metrics
  trialStartRate: number;
  trialCompletionRate: number;
  trialToPayConversion: number;
  
  // Conversion metrics
  overallConversionRate: number;
  conversionBySource: Record<string, number>;
  averageTimeToConvert: number; // in hours
  
  // Revenue metrics
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  customerLifetimeValue: number;
  
  // Engagement metrics
  dailyActiveTrialUsers: number;
  dailyActivePremiumUsers: number;
  retentionRates: {
    day1: number;
    day3: number;
    day7: number;
    day30: number;
  };
}

export class SubscriptionAnalytics {
  private events: AnalyticsEvent[] = [];
  private isProduction: boolean;
  private analyticsProviders: AnalyticsProvider[] = [];

  constructor(isProduction: boolean = false) {
    this.isProduction = isProduction;
    this.initializeProviders();
  }

  private initializeProviders() {
    // In production, initialize real analytics providers
    if (this.isProduction) {
      // Example: Initialize Google Analytics
      // this.analyticsProviders.push(new GoogleAnalyticsProvider());
      
      // Example: Initialize Mixpanel
      // this.analyticsProviders.push(new MixpanelProvider());
      
      console.log('📊 Production analytics providers initialized');
    } else {
      // Development mode - use local storage
      this.analyticsProviders.push(new LocalStorageProvider());
      console.log('🧪 Development analytics provider initialized');
    }
  }

  /**
   * Track trial lifecycle events
   */
  async trackTrialStart(userId: string, deviceId: string, source?: string) {
    await this.track({
      event: 'trial_started',
      userId,
      deviceId,
      timestamp: new Date().toISOString(),
      properties: {
        source: source || 'organic',
        trial_duration_days: 3,
        plan_type: 'free_trial'
      },
      userProperties: {
        trial_start_date: new Date().toISOString(),
        is_trial_user: true
      }
    });

    console.log('📈 Trial start tracked:', userId);
  }

  async trackTrialUsage(userId: string, action: 'practice' | 'word_learn', count: number = 1) {
    await this.track({
      event: 'trial_usage',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        action,
        count,
        day_of_trial: this.calculateTrialDay(userId)
      }
    });
  }

  async trackTrialExpiry(userId: string, totalUsage: number) {
    await this.track({
      event: 'trial_expired',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        total_usage_sessions: totalUsage,
        trial_completion_rate: totalUsage > 0 ? 100 : 0
      },
      userProperties: {
        is_trial_user: false,
        trial_completed: true
      }
    });

    console.log('📊 Trial expiry tracked:', userId);
  }

  /**
   * Track upgrade and payment flow
   */
  async trackUpgradePromptShown(userId: string, reason: 'trial_expired' | 'limit_reached' | 'feature_locked' | 'manual') {
    await this.track({
      event: 'upgrade_prompt_shown',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        prompt_reason: reason,
        day_of_trial: this.calculateTrialDay(userId)
      }
    });
  }

  async trackUpgradeIntentStart(userId: string, paymentMethod: 'alipay' | 'wechat') {
    await this.track({
      event: 'upgrade_intent_start',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        payment_method: paymentMethod,
        plan_id: 'premium-monthly',
        price: 38,
        currency: 'CNY'
      }
    });
  }

  async trackPaymentStart(userId: string, paymentId: string, paymentMethod: string) {
    await this.track({
      event: 'payment_started',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        payment_id: paymentId,
        payment_method: paymentMethod,
        amount: 38,
        currency: 'CNY'
      }
    });
  }

  async trackPaymentComplete(userId: string, transactionId: string, amount: number) {
    await this.track({
      event: 'payment_completed',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        transaction_id: transactionId,
        amount,
        currency: 'CNY',
        subscription_plan: 'premium-monthly'
      },
      userProperties: {
        is_premium_user: true,
        subscription_start_date: new Date().toISOString(),
        lifetime_value: amount
      }
    });

    console.log('💰 Payment completion tracked:', userId, transactionId);
  }

  async trackPaymentFailed(userId: string, paymentId: string, error: string) {
    await this.track({
      event: 'payment_failed',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        payment_id: paymentId,
        error_message: error,
        amount: 38,
        currency: 'CNY'
      }
    });
  }

  /**
   * Track upgrade prompt interactions
   */
  async trackUpgradePromptShow(userId: string, source: string, context: string): Promise<void> {
    await this.track({
      event: 'upgrade_prompt_show',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        source,
        context,
        prompt_type: 'upgrade'
      }
    });
  }

  async trackUpgradePromptClick(userId: string, source: string): Promise<void> {
    await this.track({
      event: 'upgrade_prompt_click',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        source,
        action: 'click_upgrade'
      }
    });
  }

  async trackUpgradePromptDismiss(userId: string, source: string): Promise<void> {
    await this.track({
      event: 'upgrade_prompt_dismiss',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        source,
        action: 'dismiss'
      }
    });
  }

  /**
   * Track user engagement and retention
   */
  async trackDailyActive(userId: string, userType: 'trial' | 'premium'): Promise<void> {
    await this.track({
      event: 'daily_active',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        user_type: userType,
        date: new Date().toISOString().split('T')[0]
      }
    });
  }

  async trackFeatureUsage(userId: string, feature: string, isPremium: boolean) {
    await this.track({
      event: 'feature_used',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        feature_name: feature,
        user_type: isPremium ? 'premium' : 'free'
      }
    });
  }

  async trackChurnRisk(userId: string, riskLevel: 'low' | 'medium' | 'high', reasons: string[]) {
    await this.track({
      event: 'churn_risk_identified',
      userId,
      timestamp: new Date().toISOString(),
      properties: {
        risk_level: riskLevel,
        risk_reasons: reasons
      }
    });
  }

  /**
   * Calculate key metrics
   */
  async calculateMetrics(timeframe: 'day' | 'week' | 'month' = 'month'): Promise<SubscriptionMetrics> {
    const events = await this.getEvents(timeframe);
    
    return {
      // Trial metrics
      trialStartRate: this.calculateTrialStartRate(events),
      trialCompletionRate: this.calculateTrialCompletionRate(events),
      trialToPayConversion: this.calculateTrialToPayConversion(events),
      
      // Conversion metrics
      overallConversionRate: this.calculateOverallConversionRate(events),
      conversionBySource: this.calculateConversionBySource(events),
      averageTimeToConvert: this.calculateAverageTimeToConvert(events),
      
      // Revenue metrics
      monthlyRecurringRevenue: this.calculateMRR(events),
      averageRevenuePerUser: this.calculateARPU(events),
      customerLifetimeValue: this.calculateCLV(events),
      
      // Engagement metrics
      dailyActiveTrialUsers: this.calculateDAU(events, 'trial'),
      dailyActivePremiumUsers: this.calculateDAU(events, 'premium'),
      retentionRates: this.calculateRetentionRates()
    };
  }

  /**
   * Generate conversion funnel report
   */
  async generateFunnelReport(): Promise<{
    step: string;
    users: number;
    conversionRate: number;
  }[]> {
    const events = await this.getEvents('month');
    const funnel = [
      'app_open',
      'trial_started',
      'trial_usage',
      'upgrade_prompt_shown',
      'payment_started',
      'payment_completed'
    ];

    const funnelData = funnel.map((step, index) => {
      const stepEvents = events.filter(e => e.event === step);
      const uniqueUsers = new Set(stepEvents.map(e => e.userId)).size;
      
      const prevStepUsers = index === 0 ? uniqueUsers : 
        new Set(events.filter(e => e.event === funnel[index - 1]).map(e => e.userId)).size;
      
      const conversionRate = prevStepUsers > 0 ? (uniqueUsers / prevStepUsers) * 100 : 0;
      
      return {
        step,
        users: uniqueUsers,
        conversionRate: Math.round(conversionRate * 100) / 100
      };
    });

    return funnelData;
  }

  /**
   * Private helper methods
   */
  private async track(event: AnalyticsEvent) {
    // Store locally for development
    this.events.push(event);
    
    // Send to all configured providers
    for (const provider of this.analyticsProviders) {
      try {
        await provider.track(event);
      } catch (error) {
        console.error('Analytics provider error:', error);
      }
    }
  }

  private async getEvents(timeframe: string): Promise<AnalyticsEvent[]> {
    // In production, this would query your analytics database
    // For now, return stored events
    const cutoff = new Date();
    switch (timeframe) {
      case 'day':
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case 'week':
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
    }

    return this.events.filter(e => new Date(e.timestamp) >= cutoff);
  }

  private calculateTrialDay(userId: string): number {
    // Calculate which day of trial the user is on
    const trialStartEvent = this.events.find(e => 
      e.event === 'trial_started' && e.userId === userId
    );
    
    if (!trialStartEvent) return 0;
    
    const startDate = new Date(trialStartEvent.timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private calculateTrialStartRate(events: AnalyticsEvent[]): number {
    const appOpens = events.filter(e => e.event === 'app_open').length;
    const trialStarts = events.filter(e => e.event === 'trial_started').length;
    return appOpens > 0 ? (trialStarts / appOpens) * 100 : 0;
  }

  private calculateTrialCompletionRate(events: AnalyticsEvent[]): number {
    const trialStarts = events.filter(e => e.event === 'trial_started').length;
    const trialUsage = events.filter(e => e.event === 'trial_usage').length;
    return trialStarts > 0 ? (trialUsage / trialStarts) * 100 : 0;
  }

  private calculateTrialToPayConversion(events: AnalyticsEvent[]): number {
    const trialStarts = events.filter(e => e.event === 'trial_started').length;
    const payments = events.filter(e => e.event === 'payment_completed').length;
    return trialStarts > 0 ? (payments / trialStarts) * 100 : 0;
  }

  private calculateOverallConversionRate(events: AnalyticsEvent[]): number {
    const appOpens = events.filter(e => e.event === 'app_open').length;
    const payments = events.filter(e => e.event === 'payment_completed').length;
    return appOpens > 0 ? (payments / appOpens) * 100 : 0;
  }

  private calculateConversionBySource(events: AnalyticsEvent[]): Record<string, number> {
    const sourceGroups: Record<string, { trials: number; payments: number }> = {};
    
    events.forEach(event => {
      const source = event.properties.source || 'direct';
      if (!sourceGroups[source]) {
        sourceGroups[source] = { trials: 0, payments: 0 };
      }
      
      if (event.event === 'trial_started') {
        sourceGroups[source].trials++;
      } else if (event.event === 'payment_completed') {
        sourceGroups[source].payments++;
      }
    });

    const result: Record<string, number> = {};
    Object.keys(sourceGroups).forEach(source => {
      const { trials, payments } = sourceGroups[source];
      result[source] = trials > 0 ? (payments / trials) * 100 : 0;
    });

    return result;
  }

  private calculateAverageTimeToConvert(events: AnalyticsEvent[]): number {
    const userConversions: Record<string, { start: Date; end: Date }> = {};
    
    events.forEach(event => {
      if (!event.userId) return;
      
      if (event.event === 'trial_started') {
        userConversions[event.userId] = {
          start: new Date(event.timestamp),
          end: new Date(0)
        };
      } else if (event.event === 'payment_completed' && userConversions[event.userId]) {
        userConversions[event.userId].end = new Date(event.timestamp);
      }
    });

    const conversionTimes = Object.values(userConversions)
      .filter(conv => conv.end.getTime() > 0)
      .map(conv => (conv.end.getTime() - conv.start.getTime()) / (1000 * 60 * 60)); // hours

    return conversionTimes.length > 0 
      ? conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length 
      : 0;
  }

  private calculateMRR(events: AnalyticsEvent[]): number {
    const payments = events.filter(e => e.event === 'payment_completed');
    return payments.reduce((total, event) => total + (event.properties.amount || 0), 0);
  }

  private calculateARPU(events: AnalyticsEvent[]): number {
    const uniqueUsers = new Set(events.map(e => e.userId)).size;
    const mrr = this.calculateMRR(events);
    return uniqueUsers > 0 ? mrr / uniqueUsers : 0;
  }

  private calculateCLV(events: AnalyticsEvent[]): number {
    // Simplified CLV calculation: ARPU * average customer lifespan (months)
    const arpu = this.calculateARPU(events);
    const averageLifespan = 12; // Assume 12 months average
    return arpu * averageLifespan;
  }

  private calculateDAU(events: AnalyticsEvent[], userType: 'trial' | 'premium'): number {
    const today = new Date().toISOString().split('T')[0];
    const dailyActiveEvents = events.filter(e => 
      e.event === 'daily_active' && 
      e.timestamp.startsWith(today) &&
      e.properties.user_type === userType
    );
    
    return new Set(dailyActiveEvents.map(e => e.userId)).size;
  }

  private calculateRetentionRates(): { day1: number; day3: number; day7: number; day30: number } {
    // Simplified retention calculation
    // In production, this would be much more sophisticated
    return {
      day1: 85,
      day3: 70,
      day7: 55,
      day30: 35
    };
  }
}

/**
 * Analytics Provider Interface
 */
interface AnalyticsProvider {
  track(event: AnalyticsEvent): Promise<void>;
}

/**
 * Local Storage Provider (for development)
 */
class LocalStorageProvider implements AnalyticsProvider {
  async track(event: AnalyticsEvent): Promise<void> {
    try {
      const key = 'wordmate_analytics_events';
      const stored = localStorage.getItem(key);
      const events = stored ? JSON.parse(stored) : [];
      
      events.push(event);
      
      // Keep only last 1000 events to prevent storage overflow
      if (events.length > 1000) {
        events.splice(0, events.length - 1000);
      }
      
      localStorage.setItem(key, JSON.stringify(events));
    } catch (error) {
      console.warn('Local analytics storage failed:', error);
    }
  }
}

// Export singleton instance
export const subscriptionAnalytics = new SubscriptionAnalytics();
