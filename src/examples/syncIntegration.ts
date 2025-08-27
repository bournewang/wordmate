/**
 * Integration Example: Adding Sync to WordMate
 * 
 * This example shows how to integrate the minimal server sync
 * with your existing WordMate application
 */

import { syncManager } from '../services/syncManager';
import { apiClient } from '../services/apiClient';
// import { ProgressService } from '../services/progressService';

// 1. Initialize sync on app startup
export async function initializeSync() {
  console.log('🚀 Initializing WordMate with server sync...');
  
  try {
    // Check if user has account
    const deviceId = apiClient.currentDeviceId;
    if (!deviceId) {
      console.log('📱 No device ID found, generating new one');
    }

    // Try to authenticate with stored credentials
    if (!apiClient.isAuthenticated) {
      console.log('🔐 No auth found, creating/logging in user');
      await createOrLoginUser();
    }

    // Perform initial sync if online
    if (navigator.onLine) {
      console.log('🌐 Online - performing initial sync');
      const syncResult = await syncManager.performFullSync();
      
      if (syncResult.success) {
        console.log('✅ Initial sync completed');
        if (syncResult.dataSaved) {
          console.log(`💾 Data savings: ${syncResult.dataSaved} bytes`);
        }
      } else {
        console.log('⚠️ Initial sync failed:', syncResult.error);
      }
    } else {
      console.log('📴 Offline - sync will happen when online');
    }

    // Setup automatic sync triggers
    setupAutoSync();
    
  } catch (error) {
    console.error('❌ Sync initialization failed:', error);
  }
}

// 2. Create or login user with minimal data
async function createOrLoginUser() {
  const deviceId = apiClient.currentDeviceId;
  if (!deviceId) {
    throw new Error('No device ID available');
  }

  // Try to login with device ID (and optional email)
  const storedEmail = localStorage.getItem('wordmate_user_email');
  const storedUsername = localStorage.getItem('wordmate_user_name');

  const authResult = await apiClient.login({
    deviceId,
    email: storedEmail || undefined,
    username: storedUsername || 'WordMate User',
    grade: 'grade6' // Default or from user preferences
  });

  if (authResult.success && authResult.data.user) {
    console.log('👤 User authenticated:', {
      id: authResult.data.user.id,
      isNew: authResult.data.isNewUser,
      deviceId: authResult.data.user.deviceId
    });

    // Store user info locally
    if (authResult.data.user.email) {
      localStorage.setItem('wordmate_user_email', authResult.data.user.email);
    }
    if (authResult.data.user.username) {
      localStorage.setItem('wordmate_user_name', authResult.data.user.username);
    }
    localStorage.setItem('wordmate_user_id', authResult.data.user.id);

  } else {
    throw new Error('Authentication failed');
  }
}

// 3. Setup automatic sync triggers
function setupAutoSync() {
  // Sync after practice sessions - commented out as ProgressService.savePracticeSession doesn't exist
  // const originalSavePracticeSession = ProgressService.prototype.savePracticeSession;
  // if (originalSavePracticeSession) {
  //   ProgressService.prototype.savePracticeSession = async function(session: any) {
  //     // Call original method
  //     const result = await originalSavePracticeSession.call(this, session);
  //     
  //     // Trigger sync after successful save (with delay)
  //     setTimeout(async () => {
  //       if (navigator.onLine) {
  //         console.log('📝 Practice session saved, syncing progress...');
  //         const syncResult = await syncManager.performFullSync();
  //         if (syncResult.success) {
  //           console.log('✅ Post-session sync completed');
  //         }
  //       }
  //     }, 2000); // 2 second delay to avoid frequent syncs
  //     
  //     return result;
  //   };
  // }

  // Periodic sync (every 30 minutes if online)
  setInterval(async () => {
    if (navigator.onLine) {
      console.log('⏰ Periodic sync check...');
      const lastSync = syncManager.lastSync;
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      if (!lastSync || lastSync < thirtyMinutesAgo) {
        const syncResult = await syncManager.performFullSync();
        console.log('🔄 Periodic sync:', syncResult.success ? 'completed' : 'failed');
      }
    }
  }, 30 * 60 * 1000);

  // Sync when app becomes visible
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && navigator.onLine) {
      console.log('👀 App visible, checking for sync...');
      const lastSync = syncManager.lastSync;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      if (!lastSync || lastSync < fiveMinutesAgo) {
        await syncManager.performFullSync();
      }
    }
  });

  // Sync when coming back online
  window.addEventListener('online', async () => {
    console.log('🌐 Back online, processing queued syncs...');
    // syncManager automatically processes queue when online
  });
}

// 4. Manual sync function for UI
export async function manualSync(): Promise<{
  success: boolean;
  message: string;
  conflicts?: number;
  dataSaved?: string;
}> {
  if (!navigator.onLine) {
    return {
      success: false,
      message: '当前离线，同步已加入队列'
    };
  }

  try {
    const result = await syncManager.performFullSync();
    
    if (result.success) {
      let message = '同步完成';
      if (result.conflicts && result.conflicts.length > 0) {
        message += `，解决了 ${result.conflicts.length} 个冲突`;
      }
      if (result.dataSaved) {
        const savedKB = (result.dataSaved / 1024).toFixed(1);
        message += `，节省 ${savedKB}KB 流量`;
      }
      
      return {
        success: true,
        message,
        conflicts: result.conflicts?.length,
        dataSaved: result.dataSaved ? `${(result.dataSaved / 1024).toFixed(1)}KB` : undefined
      };
    } else {
      return {
        success: false,
        message: `同步失败: ${result.error}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `同步错误: ${error.message}`
    };
  }
}

// 5. Get sync status for UI
export function getSyncStatus() {
  return {
    isOnline: !syncManager.isOffline,
    lastSync: syncManager.lastSync,
    queueLength: syncManager.queueLength,
    hasAuth: apiClient.isAuthenticated,
    deviceId: apiClient.currentDeviceId
  };
}

// 6. Link new device (for multi-device access)
export async function linkNewDevice(linkCode?: string): Promise<{
  success: boolean;
  message: string;
  linkedDevices?: string[];
}> {
  const currentDeviceId = apiClient.currentDeviceId;
  const currentToken = apiClient.currentToken;
  
  if (!currentDeviceId || !currentToken) {
    return {
      success: false,
      message: '当前设备未认证'
    };
  }

  try {
    // Generate new device ID for the new device
    const newDeviceId = generateNewDeviceId();
    
    const result = await apiClient.linkDevice({
      existingDeviceId: currentDeviceId,
      existingToken: currentToken,
      newDeviceId,
      linkCode
    });

    if (result.success) {
      return {
        success: true,
        message: '设备链接成功',
        linkedDevices: result.data.linkedDevices
      };
    } else {
      return {
        success: false,
        message: result.error?.message || '设备链接失败'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `链接错误: ${error.message}`
    };
  }
}

// 7. Show data usage statistics
export async function getDataUsageStats(): Promise<{
  localStorageSize: string;
  serverStorageEstimate: string;
  compressionRatio: string;
  totalWords: number;
  syncedWords: number;
}> {
  try {
    // Get local data size
    // Get local data size - using public method instead of private getAllLocalData
    const localData = {
      words: [], // This would come from your actual data service
      sessions: []
    };
    
    const localSize = JSON.stringify(localData).length;
    const syncedWords = (localData.words as any[])?.filter((w: any) => w.masteryLevel > 0 || w.repetitionCount > 0).length || 0;
    const serverSize = syncedWords * 80; // Estimated minimal server storage per word
    
    const compressionRatio = localSize > 0 ? ((1 - serverSize / localSize) * 100).toFixed(1) : '0';
    
    return {
      localStorageSize: formatBytes(localSize),
      serverStorageEstimate: formatBytes(serverSize),
      compressionRatio: `${compressionRatio}%`,
      totalWords: localData.words?.length || 0,
      syncedWords
    };
  } catch (error) {
    console.error('Failed to calculate data usage:', error);
    return {
      localStorageSize: '未知',
      serverStorageEstimate: '未知',
      compressionRatio: '未知',
      totalWords: 0,
      syncedWords: 0
    };
  }
}

// Helper functions

function generateNewDeviceId(): string {
  return 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export everything for easy integration
export {
  syncManager,
  apiClient
};

// Example usage in React component:
/*
import { initializeSync, manualSync, getSyncStatus } from './syncIntegration';

function App() {
  useEffect(() => {
    initializeSync();
  }, []);

  const handleManualSync = async () => {
    const result = await manualSync();
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const syncStatus = getSyncStatus();

  return (
    <div>
      <button onClick={handleManualSync} disabled={!syncStatus.isOnline}>
        {syncStatus.isOnline ? '同步' : '离线'}
      </button>
      {syncStatus.lastSync && (
        <p>最后同步: {syncStatus.lastSync.toLocaleString()}</p>
      )}
    </div>
  );
}
*/
