/**
 * API Client for WordMate backend on Tencent EdgeOne
 * Handles authentication, progress sync, and data management
 */

import type {
  UserLogin,
  AuthResponse,
  UserCreate,
  ProgressSyncRequest,
  ProgressSyncResponse,
  UserResponse,
  WordProgressResponse,
  SessionStart,
  SessionComplete,
  SessionResponse,
  PaymentCreate,
  PaymentResponse as BackendPaymentResponse,
  HealthCheckResponse,
  APIResponse,
  FrontendUser,
} from '../types/backendTypes';
import { BackendTypeConverter } from '../types/backendTypes';
import type {
  UserSubscription,
  PaymentRecord,
  UsageStats
} from '../types/subscription';
import { PaymentService, PaymentRequest, PaymentResponse } from './paymentService';

export interface APIClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  requiresAuth?: boolean;
}

export class APIClient {
  private config: APIClientConfig;
  private authToken: string | null = null;
  private deviceId: string | null = null;
  private mockMode: boolean = false;

  constructor(config: Partial<APIClientConfig> = {}) {
    // Get base URL from environment variable or config
    const baseURL = config.baseURL || 
                   import.meta.env.VITE_API_BASE_URL || 
                   process.env.VITE_API_BASE_URL || 
                   'http://localhost:8000';

    this.config = {
      baseURL,
      timeout: config.timeout || 10000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
    };

    // Mock mode disabled - always use real API
    this.mockMode = false;
    
    // Console logging for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 API Client Configuration:', {
        baseURL: this.config.baseURL,
        mockMode: this.mockMode,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
        }
      });
    }
    
    // Load stored auth data
    this.loadStoredAuth();
  }

  // Authentication Methods

  async login(email?: string, username?: string, password?: string, deviceId?: string): Promise<APIResponse<{ user: FrontendUser; token: string; expires_in: number }>> {
    try {
      console.log('🔑 Making login request to:', this.config.baseURL + '/api/v1/auth/login');
      
      const loginData: UserLogin = {
        email,
        username,
        password,
        device_id: deviceId || this.currentDeviceId
      };
      
      // Remove undefined fields to avoid backend validation issues
      Object.keys(loginData).forEach(key => {
        if (loginData[key as keyof UserLogin] === undefined) {
          delete loginData[key as keyof UserLogin];
        }
      });
      
      const response = await this.makeRequest<{ user: UserResponse; token: string; expires_in: number }>('/api/v1/auth/login', {
        method: 'POST',
        body: loginData,
        requiresAuth: false
      });

      if (response.success && response.data.token) {
        this.authToken = response.data.token;
        this.deviceId = this.currentDeviceId || this.generateDeviceId();
        this.saveAuth(response.data.token, this.deviceId);
        
        // Convert backend user response to frontend user format
        const frontendUser = BackendTypeConverter.userResponseToFrontendUser(
          response.data.user,
          this.deviceId
        );
        
        return {
          success: true,
          data: {
            user: frontendUser,
            token: response.data.token,
            expires_in: response.data.expires_in
          },
          timestamp: new Date().toISOString()
        };
      }

      return response as APIResponse<{ user: FrontendUser; token: string; expires_in: number }>;
    } catch (error: any) {
      return this.createErrorResponse('LOGIN_FAILED', error.message);
    }
  }


  async register(
    username: string,
    email: string,
    password?: string,
    grade: string = 'grade6',
    trialData?: any
  ): Promise<APIResponse<{ user: FrontendUser; token: string; expires_in: number }>> {
    try {
      console.log('🔑 Making registration request to:', this.config.baseURL + '/api/v1/auth/register');
      
      const deviceId = this.currentDeviceId || this.generateDeviceId();
      
      const registerData: UserCreate = {
        username,
        email,
        password,
        device_id: deviceId,
        grade,
        trial_data: trialData ? BackendTypeConverter.convertTrialDataForBackend(trialData) : undefined
      };
      
      // Remove undefined fields to avoid backend validation issues
      Object.keys(registerData).forEach(key => {
        if (registerData[key as keyof UserCreate] === undefined) {
          delete registerData[key as keyof UserCreate];
        }
      });
      
      const response = await this.makeRequest<{ user: UserResponse; token: string; expires_in: number }>('/api/v1/auth/register', {
        method: 'POST',
        body: registerData,
        requiresAuth: false
      });

      if (response.success && response.data.token) {
        this.authToken = response.data.token;
        this.deviceId = deviceId;
        this.saveAuth(response.data.token, deviceId);
        
        // Convert backend user response to frontend user format
        const frontendUser = BackendTypeConverter.userResponseToFrontendUser(
          response.data.user,
          deviceId
        );
        
        return {
          success: true,
          data: {
            user: frontendUser,
            token: response.data.token,
            expires_in: response.data.expires_in
          },
          timestamp: new Date().toISOString()
        };
      }

      return response as APIResponse<{ user: FrontendUser; token: string; expires_in: number }>;
    } catch (error: any) {
      return this.createErrorResponse('REGISTER_FAILED', error.message);
    }
  }

  async refreshToken(): Promise<APIResponse<{ token: string; expires_in: number }>> {
    try {
      const response = await this.makeRequest<{ token: string; expires_in: number }>('/api/v1/auth/refresh', {
        method: 'POST',
        requiresAuth: true
      });

      if (response.success && response.data.token) {
        this.authToken = response.data.token;
        this.deviceId = this.deviceId || this.generateDeviceId();
        this.saveAuth(response.data.token, this.deviceId);
      }

      return response;
    } catch (error: any) {
      return this.createErrorResponse('REFRESH_FAILED', error.message);
    }
  }

  // Progress Management Methods

  async getWordProgress(wordId?: string): Promise<APIResponse<WordProgressResponse[]>> {
    const endpoint = wordId ? `/api/v1/progress/words/${wordId}` : '/api/v1/progress/words';
    return this.makeRequest<WordProgressResponse[]>(endpoint, {
      method: 'GET',
      requiresAuth: true
    });
  }

  async updateWordProgress(wordId: string, updateData: { is_correct: boolean; response_time_ms: number; quality_score: number }): Promise<APIResponse<WordProgressResponse>> {
    return this.makeRequest<WordProgressResponse>(`/api/v1/progress/words/${wordId}`, {
      method: 'POST',
      body: updateData,
      requiresAuth: true
    });
  }

  async syncProgress(syncData: ProgressSyncRequest): Promise<APIResponse<ProgressSyncResponse>> {
    return this.makeRequest<ProgressSyncResponse>('/api/v1/progress/sync', {
      method: 'POST',
      body: syncData,
      requiresAuth: true
    });
  }

  async createBackup(userId: string, backupData: {
    fullProgress: any; // Legacy method, consider removing
    backupType: 'manual' | 'automatic';
  }): Promise<APIResponse<{ backupId: string; timestamp: string; size: number }>> {
    return this.makeRequest(`/progress/${userId}/backup`, {
      method: 'POST',
      body: backupData,
      requiresAuth: true
    });
  }

  // User Management Methods

  async getCurrentUser(): Promise<APIResponse<FrontendUser>> {
    const response = await this.makeRequest<UserResponse>('/api/v1/auth/me', {
      method: 'GET',
      requiresAuth: true
    });
    
    if (response.success) {
      const frontendUser = BackendTypeConverter.userResponseToFrontendUser(
        response.data,
        this.deviceId || this.generateDeviceId()
      );
      
      return {
        success: true,
        data: frontendUser,
        timestamp: new Date().toISOString()
      };
    }
    
    return response as APIResponse<FrontendUser>;
  }

  async updateUser(updates: { username?: string; email?: string; grade?: string }): Promise<APIResponse<FrontendUser>> {
    const response = await this.makeRequest<UserResponse>('/api/v1/users/profile', {
      method: 'PUT',
      body: updates,
      requiresAuth: true
    });
    
    if (response.success) {
      const frontendUser = BackendTypeConverter.userResponseToFrontendUser(
        response.data,
        this.deviceId || this.generateDeviceId()
      );
      
      return {
        success: true,
        data: frontendUser,
        timestamp: new Date().toISOString()
      };
    }
    
    return response as APIResponse<FrontendUser>;
  }

  // Device Management Methods

  async linkDevice(linkData: {
    existingDeviceId: string;
    existingToken: string;
    newDeviceId: string;
    linkCode?: string;
  }): Promise<APIResponse<{ user: any; newToken: string; linkedDevices: string[] }>> {
    return this.makeRequest('/devices/link', {
      method: 'POST',
      body: linkData,
      requiresAuth: false
    });
  }

  // Session Management Methods

  async startSession(practiceType: 'flashcard' | 'typing' | 'choice'): Promise<APIResponse<SessionResponse>> {
    const sessionData: SessionStart = { practice_type: practiceType };
    return this.makeRequest<SessionResponse>('/api/v1/sessions/start', {
      method: 'POST',
      body: sessionData,
      requiresAuth: true
    });
  }

  async completeSession(
    sessionId: number,
    wordsCount: number,
    correctCount: number,
    durationSeconds: number,
    answers: Array<{ word_id: string; is_correct: boolean; response_time_ms: number; quality_score: number }>
  ): Promise<APIResponse<SessionResponse>> {
    const sessionData: SessionComplete = {
      words_count: wordsCount,
      correct_count: correctCount,
      duration_seconds: durationSeconds,
      answers
    };
    
    return this.makeRequest<SessionResponse>(`/api/v1/sessions/${sessionId}/complete`, {
      method: 'POST',
      body: sessionData,
      requiresAuth: true
    });
  }

  async getSessionHistory(limit: number = 10): Promise<APIResponse<SessionResponse[]>> {
    return this.makeRequest<SessionResponse[]>(`/api/v1/sessions?limit=${limit}`, {
      method: 'GET',
      requiresAuth: true
    });
  }

  // Payment Methods

  async createPayment(
    amount: number,
    method: 'alipay' | 'wechat',
    planId?: string
  ): Promise<APIResponse<BackendPaymentResponse>> {
    const paymentData: PaymentCreate = {
      amount,
      method,
      plan_id: planId
    };
    
    return this.makeRequest<BackendPaymentResponse>('/api/v1/payments', {
      method: 'POST',
      body: paymentData,
      requiresAuth: true
    });
  }

  async getBackendPaymentHistory(limit: number = 10): Promise<APIResponse<BackendPaymentResponse[]>> {
    return this.makeRequest<BackendPaymentResponse[]>(`/api/v1/payments?limit=${limit}`, {
      method: 'GET',
      requiresAuth: true
    });
  }

  // Health Check

  async healthCheck(): Promise<APIResponse<HealthCheckResponse>> {
    return this.makeRequest<HealthCheckResponse>('/health', {
      method: 'GET',
      requiresAuth: false
    });
  }

  // Subscription Management Methods

  async getSubscription(userId: string): Promise<APIResponse<UserSubscription>> {
    return this.makeRequest<UserSubscription>(`/subscription/${userId}`, {
      method: 'GET',
      requiresAuth: true
    });
  }

  async createSubscription(subscriptionData: Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<APIResponse<UserSubscription>> {
    return this.makeRequest<UserSubscription>('/subscription', {
      method: 'POST',
      body: subscriptionData,
      requiresAuth: true
    });
  }

  async updateSubscription(subscriptionId: string, updates: Partial<UserSubscription>): Promise<APIResponse<UserSubscription>> {
    return this.makeRequest<UserSubscription>(`/subscription/${subscriptionId}`, {
      method: 'PUT',
      body: updates,
      requiresAuth: true
    });
  }

  async cancelSubscription(subscriptionId: string, reason?: string): Promise<APIResponse<{ success: boolean; message: string }>> {
    return this.makeRequest(`/subscription/${subscriptionId}/cancel`, {
      method: 'POST',
      body: { reason },
      requiresAuth: true
    });
  }

  async initiatePayment(paymentRequest: PaymentRequest): Promise<APIResponse<PaymentResponse>> {
    // For now, use the local payment service
    // In production, this would make an API call to your backend
    // which then communicates with payment providers
    try {
      const result = await PaymentService.initiatePayment(paymentRequest);
      return {
        success: result.success as true,
        data: result as any,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return this.createErrorResponse('PAYMENT_INITIATION_FAILED', error.message);
    }
  }

  async verifyPayment(paymentId: string, method: 'alipay' | 'wechat'): Promise<APIResponse<{
    verified: boolean;
    transactionId?: string;
    amount?: number;
    status: 'completed' | 'failed' | 'pending';
  }>> {
    return this.makeRequest('/payment/verify', {
      method: 'POST',
      body: { paymentId, method },
      requiresAuth: true
    });
  }

  async getPaymentHistory(userId: string, limit: number = 10): Promise<APIResponse<PaymentRecord[]>> {
    return this.makeRequest<PaymentRecord[]>(`/payment/history/${userId}?limit=${limit}`, {
      method: 'GET',
      requiresAuth: true
    });
  }

  async processRefund(paymentId: string, amount?: number, reason?: string): Promise<APIResponse<{
    success: boolean;
    refundId?: string;
    message: string;
  }>> {
    return this.makeRequest('/payment/refund', {
      method: 'POST',
      body: { paymentId, amount, reason },
      requiresAuth: true
    });
  }

  // Usage Tracking Methods

  async recordUsage(userId: string, action: 'practice' | 'word_learn', count: number = 1): Promise<APIResponse<{ success: boolean }>> {
    return this.makeRequest('/usage/record', {
      method: 'POST',
      body: { userId, action, count, timestamp: new Date().toISOString() },
      requiresAuth: true
    });
  }

  async getUsageStats(userId: string): Promise<APIResponse<UsageStats>> {
    return this.makeRequest<UsageStats>(`/usage/${userId}`, {
      method: 'GET',
      requiresAuth: true
    });
  }

  async resetDailyUsage(userId: string): Promise<APIResponse<{ success: boolean }>> {
    return this.makeRequest(`/usage/${userId}/reset-daily`, {
      method: 'POST',
      requiresAuth: true
    });
  }

  // Core HTTP Methods

  private async makeRequest<T>(
    endpoint: string,
    config: RequestConfig
  ): Promise<APIResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    // Add auth header if required
    if (config.requiresAuth && this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const requestConfig: RequestInit = {
      method: config.method,
      headers,
      signal: AbortSignal.timeout(config.timeout || this.config.timeout)
    };

    if (config.body) {
      requestConfig.body = JSON.stringify(config.body);
    }

    let lastError: Error | undefined;

    // Retry logic
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, requestConfig);
        
        if (!response.ok) {
          if (response.status === 401) {
            // Token expired, try to refresh
            const refreshResult = await this.refreshToken();
            if (refreshResult.success && attempt === 0) {
              // Retry with new token
              continue;
            } else {
              this.clearAuth();
              return this.createErrorResponse('UNAUTHORIZED', 'Authentication failed');
            }
          }

          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data as APIResponse<T>;

      } catch (error) {
        lastError = error as Error;
        
        if ((error as Error).name === 'AbortError') {
          return this.createErrorResponse('TIMEOUT', 'Request timeout');
        }

        if (attempt < this.config.retryAttempts - 1) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    return this.createErrorResponse('NETWORK_ERROR', lastError?.message || 'Unknown network error');
  }

  // Utility Methods

  private createErrorResponse<T>(code: string, message: string): APIResponse<T> {
    return {
      success: false,
      error: {
        code,
        message
      },
      timestamp: new Date().toISOString()
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateDeviceId(): string {
    // Generate a unique device ID based on browser/device characteristics
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 10, 10);
    const canvasFingerprint = canvas.toDataURL();
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvasFingerprint.slice(0, 100)
    ].join('|');

    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return 'device_' + Math.abs(hash).toString(16) + '_' + Date.now().toString(36);
  }

  // Auth Storage Management

  private loadStoredAuth(): void {
    try {
      const stored = localStorage.getItem('wordmate_auth');
      if (stored) {
        const { token, deviceId } = JSON.parse(stored);
        if (process.env.NODE_ENV === 'development') {
          console.log('🔧 APIClient: Loading stored auth', {
            hasToken: !!token,
            hasDeviceId: !!deviceId,
            tokenLength: token?.length
          });
        }
        this.authToken = token;
        this.deviceId = deviceId;
      }
    } catch (error) {
      console.warn('Failed to load stored auth:', error);
    }

    // Generate device ID if not present
    if (!this.deviceId) {
      this.deviceId = this.generateDeviceId();
      localStorage.setItem('wordmate_device_id', this.deviceId);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 APIClient: Generated new device ID:', this.deviceId);
      }
    }
  }

  private saveAuth(token: string, deviceId: string): void {
    try {
      localStorage.setItem('wordmate_auth', JSON.stringify({ token, deviceId }));
      localStorage.setItem('wordmate_device_id', deviceId);
    } catch (error) {
      console.warn('Failed to save auth data:', error);
    }
  }

  private clearAuth(): void {
    this.authToken = null;
    try {
      localStorage.removeItem('wordmate_auth');
    } catch (error) {
      console.warn('Failed to clear auth data:', error);
    }
  }

  // Real API verification method
  async get(endpoint: string): Promise<APIResponse<any>> {
    return this.makeRequest(endpoint, { method: 'GET', requiresAuth: true });
  }

  async put(endpoint: string, data: any): Promise<APIResponse<any>> {
    return this.makeRequest(endpoint, { method: 'PUT', body: data, requiresAuth: true });
  }

  // Public clear auth method
  public clearAuthData(): void {
    this.clearAuth();
  }

  // Set auth token method
  setAuthToken(token: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 APIClient: Setting auth token', {
        tokenLength: token?.length,
        tokenPreview: token?.substring(0, 20) + '...',
        currentTokenExists: !!this.authToken
      });
    }
    
    this.authToken = token;
    
    // Verify the token was set correctly
    if (this.authToken !== token) {
      console.error('❌ APIClient: Failed to set auth token - tokens do not match!');
    } else if (process.env.NODE_ENV === 'development') {
      console.log('✅ APIClient: Auth token set successfully');
    }
  }

  // Public getters

  get isAuthenticated(): boolean {
    return !!this.authToken;
  }

  get currentDeviceId(): string | null {
    return this.deviceId;
  }

  get currentToken(): string | null {
    return this.authToken;
  }

  // Network status monitoring (commented out to remove unused warning)

  // private setupNetworkMonitoring(): void {
  //   window.addEventListener('online', () => {
  //     console.log('Network back online');
  //     // Could trigger a sync here
  //   });
  //
  //   window.addEventListener('offline', () => {
  //     console.log('Network went offline');
  //   });
  // }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export factory function for testing
export function createAPIClient(config?: Partial<APIClientConfig>): APIClient {
  return new APIClient(config);
}
