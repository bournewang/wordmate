import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/apiClient';
import type { FrontendUser } from '../types/backendTypes';

// Re-export FrontendUser as User for compatibility
export type User = FrontendUser;

export interface LoginParams {
  email?: string;
  username?: string;
  password?: string;
}

export interface RegisterParams {
  username: string;
  email: string;
  password?: string; // Optional for passwordless auth
  grade: 'grade3' | 'grade4' | 'grade5' | 'grade6' | 'junior' | 'senior';
  trialData?: any; // Local progress data from trial mode
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  expires_in?: number;
  error?: {
    code: string;
    message: string;
  };
}

export interface LoginResult extends AuthResult {}
export interface RegisterResult extends AuthResult {}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  deviceId: string | null;
}

interface AuthContextType extends AuthState {
  login: (params: LoginParams) => Promise<LoginResult>;
  register: (params: RegisterParams) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  updateUserProfile: (updates: Partial<User>) => Promise<boolean>;
  linkDevice: (email: string) => Promise<{success: boolean; message: string}>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    deviceId: null
  });

  // Initialize auth state on app startup
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      console.log('🔐 Initializing authentication...');
      
      // Get or create device ID
      const deviceId = apiClient.currentDeviceId;
      if (!deviceId) {
        console.warn('No device ID found, this should not happen');
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Check for stored credentials - use same keys as apiClient
      const authData = localStorage.getItem('wordmate_auth');
      let storedToken = null;
      let storedUserId = localStorage.getItem('wordmate_user_id');
      let storedUserData = localStorage.getItem('wordmate_user_data');
      
      console.log('🔍 Checking stored auth data:', {
        hasAuthData: !!authData,
        hasUserId: !!storedUserId,
        hasUserData: !!storedUserData,
        authDataLength: authData?.length
      });
      
      // Extract token from apiClient format if available
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          storedToken = parsed.token;
          console.log('📋 Extracted token from stored auth:', {
            tokenLength: storedToken?.length,
            tokenPreview: storedToken?.substring(0, 20) + '...'
          });
        } catch (error) {
          console.warn('Failed to parse stored auth data:', error);
        }
      }
      
      // Fallback to individual token storage
      if (!storedToken) {
        storedToken = localStorage.getItem('wordmate_auth_token');
        if (storedToken) {
          console.log('📋 Using fallback token storage:', {
            tokenLength: storedToken.length,
            tokenPreview: storedToken.substring(0, 20) + '...'
          });
        }
      }

      if (storedToken && storedUserId && storedUserData) {
        try {
          const userData = JSON.parse(storedUserData) as User;
          
          console.log('🔧 Setting token in API client...', {
            tokenLength: storedToken.length,
            currentApiToken: apiClient.currentToken ? 'exists' : 'null'
          });
          
          // Set API client token
          apiClient.setAuthToken(storedToken);
          
          // Verify the token was set correctly
          const apiClientToken = apiClient.currentToken;
          console.log('🔍 Token after setting:', {
            apiClientHasToken: !!apiClientToken,
            tokensMatch: apiClientToken === storedToken,
            apiClientTokenLength: apiClientToken?.length
          });
          
          // Verify token is still valid - pass the storedToken directly to avoid race conditions
          const isValid = await verifyToken(storedToken);
          
          if (isValid) {
            console.log('✅ Restored authentication for user:', userData.username);
            setAuthState({
              user: userData,
              token: storedToken,
              isAuthenticated: true,
              isLoading: false,
              deviceId
            });
            return;
          } else {
            console.log('⚠️ Stored token is invalid, clearing auth');
            await clearStoredAuth();
          }
        } catch (error) {
          console.error('❌ Error parsing stored auth data:', error);
          await clearStoredAuth();
        }
      } else {
        console.log('📋 Missing required auth data:', {
          hasToken: !!storedToken,
          hasUserId: !!storedUserId, 
          hasUserData: !!storedUserData
        });
      }

      // No valid stored auth, ready for login
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        deviceId
      });

      console.log('📱 Ready for authentication with device:', deviceId);
      
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false 
      }));
    }
  };

  const verifyToken = async (tokenToVerify?: string): Promise<boolean> => {
    try {
      console.log('🔍 Verifying token...');
      
      // Use provided token or get from apiClient
      const token = tokenToVerify || apiClient.currentToken;
      
      console.log('🔍 Token verification details:', {
        hasProvidedToken: !!tokenToVerify,
        hasApiClientToken: !!apiClient.currentToken,
        usingToken: token ? 'found' : 'null',
        tokenLength: token?.length,
        tokenType: typeof token
      });
      
      if (!token || typeof token !== 'string') {
        console.warn('⚠️ No token found or token is not a string:', {
          token: token,
          type: typeof token
        });
        return false;
      }
      
      const trimmedToken = token.trim();
      if (trimmedToken.length === 0) {
        console.warn('⚠️ Token is empty or only whitespace');
        return false;
      }
      
      // Check if token is too short to be meaningful
      if (trimmedToken.length < 10) {
        console.warn('⚠️ Token too short to be valid:', {
          tokenLength: trimmedToken.length,
          token: trimmedToken
        });
        return false;
      }
      
      // Check for JWT format (basic validation)
      const jwtParts = trimmedToken.split('.');
      if (jwtParts.length === 3) {
        console.log('✅ Token appears to be JWT format');
      } else {
        console.log('🔍 Token is not JWT format, but may still be valid');
      }
      
      // In a real app, you would make an API call here:
      // try {
      //   const response = await apiClient.get('/auth/verify');
      //   return response.success;
      // } catch (error) {
      //   console.warn('API verification failed:', error);
      //   return false;
      // }
      
      // For demo mode, consider the token valid if it exists and has reasonable content
      console.log('✅ Token verification passed (demo mode)', {
        tokenLength: trimmedToken.length,
        tokenPreview: trimmedToken.substring(0, 20) + '...',
        isJWT: jwtParts.length === 3
      });
      return true;
    } catch (error) {
      console.warn('❌ Token verification failed:', error);
      return false;
    }
  };

  const clearStoredAuth = async () => {
    // Clear all possible auth storage keys
    localStorage.removeItem('wordmate_auth'); // apiClient format
    localStorage.removeItem('wordmate_auth_token');
    localStorage.removeItem('wordmate_user_id');
    localStorage.removeItem('wordmate_user_data');
    localStorage.removeItem('wordmate_user_email');
    localStorage.removeItem('wordmate_user_name');
    localStorage.removeItem('wordmate_device_id');
    apiClient.clearAuthData();
  };

  const login = async (params: LoginParams) => {
    try {
      console.log('🔑 Attempting login with email:', params.email ? '[REDACTED]' : 'no email');
      
      setAuthState(prev => ({ ...prev, isLoading: true }));

      // Call the login API with new backend structure (passwordless)
      const response = await apiClient.login(params.email, params.username, params.password);

      if (response.success && response.data) {
        const { user, token, expires_in } = response.data;
        
        // Store auth data - use same format as apiClient
        const deviceId = apiClient.currentDeviceId || user.deviceId;
        localStorage.setItem('wordmate_auth', JSON.stringify({ token, deviceId }));
        localStorage.setItem('wordmate_auth_token', token); // Keep for backward compatibility
        localStorage.setItem('wordmate_user_id', user.id);
        localStorage.setItem('wordmate_user_data', JSON.stringify(user));
        
        if (user.email) {
          localStorage.setItem('wordmate_user_email', user.email);
        }
        if (user.username) {
          localStorage.setItem('wordmate_user_name', user.username);
        }

        // Update auth state
        setAuthState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          deviceId
        });

        console.log('✅ Login successful:', {
          userId: user.id,
          hasEmail: !!user.email,
          expiresIn: expires_in
        });

        return {
          success: true,
          user,
          token,
          expires_in
        };
      } else {
        const error = (response as any).error || { code: 'LOGIN_FAILED', message: 'Login failed' };
        throw new Error(error.message);
      }
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false 
      }));

      return {
        success: false,
        error: {
          code: error.code || 'LOGIN_ERROR',
          message: error.message || 'Authentication failed'
        }
      };
    }
  };

  const register = async (params: RegisterParams) => {
    try {
      console.log('📝 Attempting registration for user:', params.username);
      
      setAuthState(prev => ({ ...prev, isLoading: true }));

      // Call the registration API with new backend structure (passwordless)
      const response = await apiClient.register(
        params.username,
        params.email,
        params.password, // Now optional
        params.grade,
        params.trialData
      );

      if (response.success && response.data) {
        const { user, token, expires_in } = response.data;
        
        // Store auth data - use same format as apiClient
        const deviceId = apiClient.currentDeviceId || user.deviceId;
        localStorage.setItem('wordmate_auth', JSON.stringify({ token, deviceId }));
        localStorage.setItem('wordmate_auth_token', token); // Keep for backward compatibility
        localStorage.setItem('wordmate_user_id', user.id);
        localStorage.setItem('wordmate_user_data', JSON.stringify(user));
        
        if (user.email) {
          localStorage.setItem('wordmate_user_email', user.email);
        }
        if (user.username) {
          localStorage.setItem('wordmate_user_name', user.username);
        }

        // Update auth state
        setAuthState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          deviceId
        });

        console.log('✅ Registration successful:', {
          userId: user.id,
          hasEmail: !!user.email,
          registeredFromTrial: user.registeredFromTrial,
          expiresIn: expires_in
        });

        return {
          success: true,
          user,
          token,
          expires_in
        };
      } else {
        const error = (response as any).error || { code: 'REGISTER_FAILED', message: 'Registration failed' };
        throw new Error(error.message);
      }
    } catch (error: any) {
      console.error('❌ Registration failed:', error);
      
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false 
      }));

      return {
        success: false,
        error: {
          code: error.code || 'REGISTER_ERROR',
          message: error.message || 'Registration failed'
        }
      };
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out user');
      
      // Clear stored data
      await clearStoredAuth();
      
      // Reset auth state
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        deviceId: apiClient.currentDeviceId
      });

      console.log('✅ Logout completed');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const refreshAuth = async (): Promise<boolean> => {
    try {
      if (!authState.token || !authState.user) {
        return false;
      }

      // Refresh user data from server
      const response = await apiClient.getCurrentUser();
      
      if (response.success && response.data) {
        const updatedUser = response.data;
        
        // Update stored data
        localStorage.setItem('wordmate_user_data', JSON.stringify(updatedUser));
        
        // Update state
        setAuthState(prev => ({
          ...prev,
          user: updatedUser
        }));

        console.log('🔄 Auth refreshed successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Auth refresh failed:', error);
      return false;
    }
  };

  const updateUserProfile = async (updates: Partial<User>): Promise<boolean> => {
    try {
      if (!authState.user || !authState.token) {
        throw new Error('Not authenticated');
      }

      const response = await apiClient.updateUser(updates);
      
      if (response.success && response.data) {
        const updatedUser = { ...authState.user, ...response.data };
        
        // Update stored data
        localStorage.setItem('wordmate_user_data', JSON.stringify(updatedUser));
        
        // Update state
        setAuthState(prev => ({
          ...prev,
          user: updatedUser
        }));

        console.log('✅ Profile updated successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Profile update failed:', error);
      return false;
    }
  };

  const linkDevice = async (email: string): Promise<{success: boolean; message: string}> => {
    try {
      if (!authState.deviceId) {
        throw new Error('Device ID not available');
      }

      const response = await apiClient.linkDevice({
        existingDeviceId: authState.deviceId,
        existingToken: authState.token!,
        newDeviceId: authState.deviceId,
        linkCode: email.trim()
      });

      if (response.success) {
        // Refresh auth data after linking
        await refreshAuth();
        
        return {
          success: true,
          message: '设备链接成功！您的学习数据已同步'
        };
      } else {
        throw new Error('Device linking failed');
      }
    } catch (error: any) {
      console.error('❌ Device linking failed:', error);
      return {
        success: false,
        message: error.message || '设备链接失败'
      };
    }
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    refreshAuth,
    updateUserProfile,
    linkDevice
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Additional utility hooks

export const useAuthStatus = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  return {
    isAuthenticated,
    isLoading,
    isReady: !isLoading,
    hasUser: !!user,
    hasEmail: !!user?.email,
    username: user?.username || 'Unknown User',
    grade: user?.grade || 'grade6'
  };
};

export const useRequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  return {
    isAuthenticated: isAuthenticated && !isLoading,
    needsAuth: !isAuthenticated && !isLoading,
    isLoading
  };
};
