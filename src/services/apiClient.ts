/**
 * API Client for WordMate backend on Tencent EdgeOne
 * Handles authentication, progress sync, and data management
 */

import type {
  AuthRequest,
  AuthResponse,
  ProgressSyncRequest,
  ProgressSyncResponse,
  ServerUser,
  ServerUserProgress,
  APIResponse,
} from '../types/serverTypes';

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
                   'https://your-domain.edgeone.app/api';

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

  async login(authData: AuthRequest): Promise<APIResponse<AuthResponse>> {
    try {
      console.log('🔑 Making real API login request to:', this.config.baseURL + '/auth/login');
      
      const response = await this.makeRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: authData,
        requiresAuth: false
      });

      if (response.success && response.data.token) {
        this.authToken = response.data.token;
        this.deviceId = authData.deviceId;
        this.saveAuth(response.data.token, authData.deviceId);
      }

      return response;
    } catch (error: any) {
      return this.createErrorResponse('LOGIN_FAILED', error.message);
    }
  }


  async refreshToken(): Promise<APIResponse<{ token: string; expiresAt: string }>> {
    if (!this.authToken || !this.deviceId) {
      return this.createErrorResponse('NO_AUTH_DATA', 'No authentication data available');
    }

    try {
      const response = await this.makeRequest<{ token: string; expiresAt: string }>('/auth/refresh', {
        method: 'POST',
        body: {
          token: this.authToken,
          deviceId: this.deviceId
        },
        requiresAuth: false
      });

      if (response.success && response.data.token) {
        this.authToken = response.data.token;
        this.saveAuth(response.data.token, this.deviceId);
      }

      return response;
    } catch (error: any) {
      return this.createErrorResponse('REFRESH_FAILED', error.message);
    }
  }

  // Progress Management Methods

  async getProgress(userId: string): Promise<APIResponse<ServerUserProgress>> {
    return this.makeRequest<ServerUserProgress>(`/progress/${userId}`, {
      method: 'GET',
      requiresAuth: true
    });
  }

  async syncProgress(userId: string, syncData: ProgressSyncRequest): Promise<APIResponse<ProgressSyncResponse>> {
    return this.makeRequest<ProgressSyncResponse>(`/progress/${userId}/sync`, {
      method: 'POST',
      body: syncData,
      requiresAuth: true
    });
  }

  async createBackup(userId: string, backupData: {
    fullProgress: ServerUserProgress;
    backupType: 'manual' | 'automatic';
  }): Promise<APIResponse<{ backupId: string; timestamp: string; size: number }>> {
    return this.makeRequest(`/progress/${userId}/backup`, {
      method: 'POST',
      body: backupData,
      requiresAuth: true
    });
  }

  // User Management Methods

  async getUser(userId: string): Promise<APIResponse<ServerUser>> {
    return this.makeRequest<ServerUser>(`/user/${userId}`, {
      method: 'GET',
      requiresAuth: true
    });
  }

  async updateUser(userId: string, updates: Partial<ServerUser>): Promise<APIResponse<ServerUser>> {
    return this.makeRequest<ServerUser>(`/user/${userId}`, {
      method: 'PUT',
      body: updates,
      requiresAuth: true
    });
  }

  // Device Management Methods

  async linkDevice(linkData: {
    existingDeviceId: string;
    existingToken: string;
    newDeviceId: string;
    linkCode?: string;
  }): Promise<APIResponse<{ user: ServerUser; newToken: string; linkedDevices: string[] }>> {
    return this.makeRequest('/devices/link', {
      method: 'POST',
      body: linkData,
      requiresAuth: false
    });
  }

  // Health Check

  async healthCheck(): Promise<APIResponse<{
    status: string;
    version: string;
    timestamp: string;
    kvStatus: string;
    region: string;
  }>> {
    return this.makeRequest('/health', {
      method: 'GET',
      requiresAuth: false
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
    this.authToken = token;
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
