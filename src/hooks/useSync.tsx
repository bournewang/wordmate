import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getDataUsageStats, manualSync } from '../utils/simpleSync';
import { useAuth } from './useAuth';

export interface SyncState {
  isOnline: boolean;
  lastSync: Date | null;
  queueLength: number;
  isSyncing: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastError: string | null;
  syncHistory: SyncHistoryItem[];
}

export interface SyncHistoryItem {
  id: string;
  timestamp: Date;
  status: 'success' | 'error';
  message: string;
  wordsUpdated?: number;
  dataSaved?: number;
  conflicts?: number;
}

interface SyncContextType extends SyncState {
  performManualSync: () => Promise<{ success: boolean; message: string; conflicts?: number; dataSaved?: string }>;
  getDataUsageStats: () => Promise<any>;
  clearSyncHistory: () => void;
  enableAutoSync: (enabled: boolean) => void;
  triggerSync: (delay?: number) => void;
  isAutoSyncEnabled: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: navigator.onLine,
    lastSync: null,
    queueLength: 0,
    isSyncing: false,
    syncStatus: 'idle',
    lastError: null,
    syncHistory: []
  });

  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
  const [syncTimeouts, setSyncTimeouts] = useState<Set<NodeJS.Timeout>>(new Set());

  // Initialize sync state
  useEffect(() => {
    initializeSyncState();
    setupNetworkMonitoring();
    
    if (isAuthenticated && isAutoSyncEnabled) {
      setupAutoSync();
    }

    return () => {
      // Cleanup timeouts
      syncTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isAuthenticated, isAutoSyncEnabled]);

  // Update sync state periodically
  useEffect(() => {
    const interval = setInterval(updateSyncState, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const initializeSyncState = () => {
    // Initialize with current sync manager state
    updateSyncState();
    
    // Load sync history from localStorage
    const storedHistory = localStorage.getItem('wordmate_sync_history');
    if (storedHistory) {
      try {
        const history = JSON.parse(storedHistory).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setSyncState(prev => ({ ...prev, syncHistory: history }));
      } catch (error) {
        console.warn('Failed to load sync history:', error);
      }
    }
  };

  const updateSyncState = () => {
    setSyncState(prev => ({
      ...prev,
      isOnline: navigator.onLine,
      // For simplified version, we'll track these in state
    }));
  };

  const setupNetworkMonitoring = () => {
    const handleOnline = () => {
      setSyncState(prev => ({ ...prev, isOnline: true }));
      console.log('🌐 Network online - sync will resume');
    };

    const handleOffline = () => {
      setSyncState(prev => ({ ...prev, isOnline: false }));
      console.log('📴 Network offline - sync will queue');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  };

  const setupAutoSync = () => {
    if (!isAuthenticated) return;

    // Sync on app startup (after auth)
    triggerSync(1000);

    // Sync on app visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden && navigator.onLine) {
        const lastSync = syncState.lastSync;
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (!lastSync || lastSync < fiveMinutesAgo) {
          triggerSync(2000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic sync every 30 minutes
    const periodicSync = () => {
      if (navigator.onLine && isAuthenticated) {
        const lastSync = syncState.lastSync;
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        if (!lastSync || lastSync < thirtyMinutesAgo) {
          triggerSync();
        }
      }
    };

    const periodicInterval = setInterval(periodicSync, 30 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(periodicInterval);
    };
  };

  const addToSyncHistory = (item: Omit<SyncHistoryItem, 'id' | 'timestamp'>) => {
    const historyItem: SyncHistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...item
    };

    setSyncState(prev => {
      const newHistory = [historyItem, ...prev.syncHistory].slice(0, 20); // Keep last 20 items
      
      // Save to localStorage
      try {
        localStorage.setItem('wordmate_sync_history', JSON.stringify(newHistory));
      } catch (error) {
        console.warn('Failed to save sync history:', error);
      }
      
      return { ...prev, syncHistory: newHistory };
    });
  };

  const performManualSync = useCallback(async () => {
    if (syncState.isSyncing || !isAuthenticated) {
      return { success: false, message: '同步已在进行中或未认证' };
    }

    setSyncState(prev => ({ 
      ...prev, 
      isSyncing: true, 
      syncStatus: 'syncing',
      lastError: null
    }));

    try {
      console.log('🔄 Manual sync triggered');
      const result = await manualSync();
      
      setSyncState(prev => ({ 
        ...prev, 
        isSyncing: false, 
        syncStatus: result.success ? 'success' : 'error',
        lastError: result.success ? null : result.message,
        lastSync: result.success ? new Date() : prev.lastSync
      }));

      // Add to history
      addToSyncHistory({
        status: result.success ? 'success' : 'error',
        message: result.message,
        conflicts: result.conflicts,
        dataSaved: result.dataSaved ? parseInt(result.dataSaved.replace('KB', '')) * 1024 : undefined
      });

      // Update overall sync state
      updateSyncState();

      return result;
    } catch (error: any) {
      console.error('❌ Manual sync failed:', error);
      
      const errorMessage = `同步失败: ${error.message}`;
      
      setSyncState(prev => ({ 
        ...prev, 
        isSyncing: false, 
        syncStatus: 'error',
        lastError: errorMessage
      }));

      addToSyncHistory({
        status: 'error',
        message: errorMessage
      });

      return { success: false, message: errorMessage };
    }
  }, [syncState.isSyncing, isAuthenticated]);

  const triggerSync = useCallback((delay: number = 0) => {
    if (!isAuthenticated || syncState.isSyncing) return;

    const timeout = setTimeout(async () => {
      if (navigator.onLine) {
        await performManualSync();
      }
    }, delay);

    setSyncTimeouts(prev => new Set([...prev, timeout]));

    // Clean up timeout after execution
    setTimeout(() => {
      setSyncTimeouts(prev => {
        const newSet = new Set(prev);
        newSet.delete(timeout);
        return newSet;
      });
    }, delay + 1000);
  }, [isAuthenticated, syncState.isSyncing, performManualSync]);

  const clearSyncHistory = () => {
    setSyncState(prev => ({ ...prev, syncHistory: [] }));
    localStorage.removeItem('wordmate_sync_history');
  };

  const enableAutoSync = (enabled: boolean) => {
    setIsAutoSyncEnabled(enabled);
    
    // Save preference
    localStorage.setItem('wordmate_auto_sync_enabled', enabled.toString());
    
    if (enabled && isAuthenticated) {
      // Trigger immediate sync when enabling
      triggerSync(1000);
    }
  };

  // Load auto sync preference on mount
  useEffect(() => {
    const storedPreference = localStorage.getItem('wordmate_auto_sync_enabled');
    if (storedPreference !== null) {
      setIsAutoSyncEnabled(storedPreference === 'true');
    }
  }, []);

  const contextValue: SyncContextType = {
    ...syncState,
    performManualSync,
    getDataUsageStats,
    clearSyncHistory,
    enableAutoSync,
    triggerSync,
    isAutoSyncEnabled
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

// Utility hooks for specific sync scenarios

export const usePracticeSync = () => {
  const { triggerSync, isOnline, isAutoSyncEnabled } = useSync();
  const { isAuthenticated } = useAuth();

  const syncAfterPractice = useCallback(() => {
    if (isAuthenticated && isAutoSyncEnabled && isOnline) {
      console.log('📝 Practice completed, scheduling sync...');
      triggerSync(3000); // 3 second delay after practice
    }
  }, [isAuthenticated, isAutoSyncEnabled, isOnline, triggerSync]);

  return { syncAfterPractice };
};

export const useSyncStatus = () => {
  const { isOnline, isSyncing, syncStatus, lastSync, lastError, queueLength } = useSync();

  const getStatusText = () => {
    if (isSyncing) return '正在同步...';
    if (!isOnline && queueLength > 0) return `离线 (${queueLength} 个待同步)`;
    if (!isOnline) return '离线';
    if (lastError) return '同步出错';
    if (lastSync) {
      const now = new Date();
      const diffMs = now.getTime() - lastSync.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      
      if (diffMinutes < 1) return '刚刚同步';
      if (diffMinutes < 60) return `${diffMinutes} 分钟前同步`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours} 小时前同步`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} 天前同步`;
    }
    return '未同步';
  };

  const getStatusColor = (): 'online' | 'offline' | 'syncing' | 'error' => {
    if (isSyncing) return 'syncing';
    if (!isOnline) return 'offline';
    if (lastError) return 'error';
    return 'online';
  };

  const getStatusIcon = () => {
    if (isSyncing) return '🔄';
    if (!isOnline) return '📴';
    if (queueLength > 0) return '📤';
    if (lastError) return '❌';
    if (syncStatus === 'success') return '✅';
    return '🔄';
  };

  return {
    statusText: getStatusText(),
    statusColor: getStatusColor(),
    statusIcon: getStatusIcon(),
    isHealthy: !lastError && isOnline,
    needsAttention: !!lastError || (queueLength > 0 && !isOnline)
  };
};

export const useAutoSync = (options: {
  triggerOnPractice?: boolean;
  triggerOnVisibility?: boolean;
  periodicInterval?: number; // minutes
} = {}) => {
  const { triggerSync, isAutoSyncEnabled, enableAutoSync } = useSync();
  const { isAuthenticated } = useAuth();
  
  const {
    triggerOnVisibility = true,
    periodicInterval = 30
  } = options;

  useEffect(() => {
    if (!isAuthenticated || !isAutoSyncEnabled) return;

    let visibilityHandler: (() => void) | undefined;
    let periodicTimer: NodeJS.Timeout | undefined;

    // Setup visibility change handler
    if (triggerOnVisibility) {
      visibilityHandler = () => {
        if (!document.hidden && navigator.onLine) {
          triggerSync(2000);
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    // Setup periodic sync
    if (periodicInterval > 0) {
      periodicTimer = setInterval(() => {
        if (navigator.onLine) {
          triggerSync();
        }
      }, periodicInterval * 60 * 1000);
    }

    return () => {
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
      if (periodicTimer) {
        clearInterval(periodicTimer);
      }
    };
  }, [isAuthenticated, isAutoSyncEnabled, triggerSync, triggerOnVisibility, periodicInterval]);

  return {
    isEnabled: isAutoSyncEnabled,
    enable: () => enableAutoSync(true),
    disable: () => enableAutoSync(false),
    toggle: () => enableAutoSync(!isAutoSyncEnabled),
    triggerManual: () => triggerSync(500)
  };
};
