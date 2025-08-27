import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/apiClient';

export interface User {
  id: string;
  email?: string;
  username: string;
  grade: string;
  deviceId: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface LoginParams {
  email?: string;
  username?: string;
  grade?: 'grade3' | 'grade4' | 'grade5' | 'grade6' | 'junior' | 'senior';
}

export interface LoginResult {
  success: boolean;
  user?: User;
  token?: string;
  isNewUser?: boolean;
  isNewDevice?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  deviceId: string | null;
}

interface AuthContextType extends AuthState {
  login: (params: LoginParams) => Promise<LoginResult>;
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

      // Check for stored credentials
      const storedToken = localStorage.getItem('wordmate_auth_token');
      const storedUserId = localStorage.getItem('wordmate_user_id');
      const storedUserData = localStorage.getItem('wordmate_user_data');

      if (storedToken && storedUserId && storedUserData) {
        try {
          const userData = JSON.parse(storedUserData) as User;
          
          // Set API client token
          apiClient.setAuthToken(storedToken);
          
          // Verify token is still valid by making a test request
          const isValid = await verifyToken();
          
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

  const verifyToken = async (): Promise<boolean> => {
    try {
      // Try to make a simple API call to verify token
      const response = await apiClient.get('/auth/verify');
      return response.success;
    } catch (error) {
      console.warn('Token verification failed:', error);
      return false;
    }
  };

  const clearStoredAuth = async () => {
    localStorage.removeItem('wordmate_auth_token');
    localStorage.removeItem('wordmate_user_id');
    localStorage.removeItem('wordmate_user_data');
    localStorage.removeItem('wordmate_user_email');
    localStorage.removeItem('wordmate_user_name');
    apiClient.clearAuthData();
  };

  const login = async (params: LoginParams): Promise<LoginResult> => {
    try {
      console.log('🔑 Attempting login with params:', { ...params, email: params.email ? '[REDACTED]' : undefined });
      
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const deviceId = apiClient.currentDeviceId;
      if (!deviceId) {
        throw new Error('Device ID not available');
      }

      // Call the login API
      const response = await apiClient.login({
        deviceId,
        email: params.email,
        username: params.username || '单词达人',
        grade: params.grade || 'grade6'
      });

      if (response.success && response.data) {
        const { user, token, isNewUser, isNewDevice } = response.data;
        
        // Store auth data
        localStorage.setItem('wordmate_auth_token', token);
        localStorage.setItem('wordmate_user_id', user.id);
        localStorage.setItem('wordmate_user_data', JSON.stringify(user));
        
        if (user.email) {
          localStorage.setItem('wordmate_user_email', user.email);
        }
        if (user.username) {
          localStorage.setItem('wordmate_user_name', user.username);
        }

        // Set API client token
        apiClient.setAuthToken(token);

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
          isNewUser,
          isNewDevice,
          hasEmail: !!user.email
        });

        return {
          success: true,
          user,
          token,
          isNewUser,
          isNewDevice
        };
      } else {
        throw new Error('Login failed');
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
          code: error.code || 'AUTH_ERROR',
          message: error.message || 'Authentication failed'
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
      const response = await apiClient.get(`/users/${authState.user.id}`);
      
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

      const response = await apiClient.put(`/users/${authState.user.id}`, updates);
      
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
