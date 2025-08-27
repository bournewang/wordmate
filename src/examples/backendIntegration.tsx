/**
 * Backend Integration Example for WordMate
 * 
 * Shows how to integrate the new EdgeOne backend with your existing React app
 */

import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { syncManager } from '../services/syncManager';

// Example: Settings page with sync functionality
export function SettingsPage() {
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    lastSync: null as Date | null,
    isAuthenticated: false,
    isSyncing: false
  });

  const [userInfo, setUserInfo] = useState({
    username: '',
    email: '',
    grade: 'grade6'
  });

  const [dataStats, setDataStats] = useState({
    localSize: '0 KB',
    serverSize: '0 KB',
    compressionRatio: '0%',
    syncedWords: 0
  });

  useEffect(() => {
    loadSyncStatus();
    loadUserInfo();
    loadDataStats();
  }, []);

  const loadSyncStatus = () => {
    setSyncStatus({
      isOnline: !syncManager.isOffline,
      lastSync: syncManager.lastSync,
      isAuthenticated: apiClient.isAuthenticated,
      isSyncing: false
    });
  };

  const loadUserInfo = async () => {
    if (apiClient.isAuthenticated) {
      try {
        const userId = localStorage.getItem('wordmate_user_id');
        if (userId) {
          const response = await apiClient.getUser(userId);
          if (response.success) {
            setUserInfo({
              username: response.data.username || '',
              email: response.data.email || '',
              grade: response.data.grade || 'grade6'
            });
          }
        }
      } catch (error) {
        console.error('Failed to load user info:', error);
      }
    }
  };

  const loadDataStats = async () => {
    try {
      // This would integrate with your existing data service
      const words: any[] = await getAllWords(); // Your existing method
      const localSize = JSON.stringify(words).length;
      const syncedWords = words.filter(w => w.masteryLevel > 0 || w.repetitionCount > 0).length;
      const serverSize = syncedWords * 80; // Estimated minimal server storage

      setDataStats({
        localSize: formatBytes(localSize),
        serverSize: formatBytes(serverSize),
        compressionRatio: localSize > 0 ? `${((1 - serverSize / localSize) * 100).toFixed(1)}%` : '0%',
        syncedWords
      });
    } catch (error) {
      console.error('Failed to calculate data stats:', error);
    }
  };

  const handleManualSync = async () => {
    if (!syncStatus.isOnline) {
      alert('当前离线，无法同步');
      return;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      const result = await syncManager.performFullSync();
      
      if (result.success) {
        let message = '同步完成！';
        if (result.conflicts && result.conflicts.length > 0) {
          message += `\n已解决 ${result.conflicts.length} 个冲突`;
        }
        if (result.dataSaved) {
          const savedKB = (result.dataSaved / 1024).toFixed(1);
          message += `\n节省流量 ${savedKB} KB`;
        }
        alert(message);
        
        loadSyncStatus();
        loadDataStats();
      } else {
        alert(`同步失败: ${result.error}`);
      }
    } catch (error: any) {
      alert(`同步错误: ${error.message}`);
    } finally {
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }
  };

  const handleUpdateProfile = async () => {
    if (!apiClient.isAuthenticated) {
      alert('请先登录');
      return;
    }

    try {
      const userId = localStorage.getItem('wordmate_user_id');
      if (!userId) {
        alert('未找到用户信息');
        return;
      }

      const response = await apiClient.updateUser(userId, {
        username: userInfo.username,
        email: userInfo.email,
        grade: userInfo.grade
      });

      if (response.success) {
        alert('个人信息更新成功！');
        
        // Update local storage
        if (userInfo.email) {
          localStorage.setItem('wordmate_user_email', userInfo.email);
        }
        if (userInfo.username) {
          localStorage.setItem('wordmate_user_name', userInfo.username);
        }
      } else {
        alert(`更新失败: ${response.error?.message}`);
      }
    } catch (error: any) {
      alert(`更新错误: ${error.message}`);
    }
  };

  const handleInitializeSync = async () => {
    try {
      const deviceId = apiClient.currentDeviceId;
      if (!deviceId) {
        alert('无法获取设备信息');
        return;
      }

      const response = await apiClient.login({
        deviceId,
        username: userInfo.username || undefined,
        email: userInfo.email || undefined,
        grade: userInfo.grade
      });

      if (response.success) {
        alert(response.data.isNewUser ? '账户创建成功！' : '登录成功！');
        
        // Store user info
        if (response.data.user) {
          localStorage.setItem('wordmate_user_id', response.data.user.id);
          if (response.data.user.email) {
            localStorage.setItem('wordmate_user_email', response.data.user.email);
          }
          if (response.data.user.username) {
            localStorage.setItem('wordmate_user_name', response.data.user.username);
          }
        }

        loadSyncStatus();
        loadUserInfo();

        // Perform initial sync
        await handleManualSync();
      } else {
        alert(`初始化失败: ${response.error?.message}`);
      }
    } catch (error: any) {
      alert(`初始化错误: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>设置与同步</h2>

      {/* Sync Status Section */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>同步状态</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div>状态: {syncStatus.isOnline ? '🟢 在线' : '🔴 离线'}</div>
          <div>认证: {syncStatus.isAuthenticated ? '✅ 已登录' : '❌ 未登录'}</div>
          <div>
            最后同步: {syncStatus.lastSync 
              ? syncStatus.lastSync.toLocaleString('zh-CN') 
              : '从未同步'}
          </div>
          <div>队列中的同步: {syncManager.queueLength}</div>
        </div>

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleManualSync}
            disabled={!syncStatus.isOnline || syncStatus.isSyncing}
            style={{
              padding: '8px 16px',
              backgroundColor: syncStatus.isOnline ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: syncStatus.isOnline ? 'pointer' : 'not-allowed'
            }}
          >
            {syncStatus.isSyncing ? '同步中...' : '手动同步'}
          </button>

          {!syncStatus.isAuthenticated && (
            <button 
              onClick={handleInitializeSync}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              启用云同步
            </button>
          )}
        </div>
      </section>

      {/* User Profile Section */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>个人信息</h3>
        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label>用户名:</label>
            <input 
              type="text"
              value={userInfo.username}
              onChange={(e) => setUserInfo(prev => ({ ...prev, username: e.target.value }))}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              placeholder="输入用户名"
            />
          </div>

          <div>
            <label>邮箱 (可选):</label>
            <input 
              type="email"
              value={userInfo.email}
              onChange={(e) => setUserInfo(prev => ({ ...prev, email: e.target.value }))}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              placeholder="输入邮箱地址"
            />
          </div>

          <div>
            <label>年级:</label>
            <select 
              value={userInfo.grade}
              onChange={(e) => setUserInfo(prev => ({ ...prev, grade: e.target.value }))}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              <option value="grade1">一年级</option>
              <option value="grade2">二年级</option>
              <option value="grade3">三年级</option>
              <option value="grade4">四年级</option>
              <option value="grade5">五年级</option>
              <option value="grade6">六年级</option>
              <option value="grade7">七年级</option>
              <option value="grade8">八年级</option>
              <option value="grade9">九年级</option>
            </select>
          </div>

          <button 
            onClick={handleUpdateProfile}
            disabled={!syncStatus.isAuthenticated}
            style={{
              padding: '10px 20px',
              backgroundColor: syncStatus.isAuthenticated ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: syncStatus.isAuthenticated ? 'pointer' : 'not-allowed'
            }}
          >
            更新个人信息
          </button>
        </div>
      </section>

      {/* Data Usage Section */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>数据使用情况</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div>本地存储大小: {dataStats.localSize}</div>
          <div>服务器存储大小: {dataStats.serverSize}</div>
          <div>压缩率: {dataStats.compressionRatio}</div>
          <div>已同步词汇: {dataStats.syncedWords} 个</div>
        </div>

        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          💡 我们只在服务器上存储您的学习进度，不存储完整的词汇内容，大大节省了存储空间和网络流量。
        </div>
      </section>

      {/* Device Info Section */}
      <section style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>设备信息</h3>
        <div style={{ display: 'grid', gap: '10px', fontSize: '14px', color: '#666' }}>
          <div>设备ID: {apiClient.currentDeviceId?.slice(-12) || '未知'}</div>
          <div>平台: Web</div>
          <div>浏览器: {navigator.userAgent.split(' ').slice(-2).join(' ')}</div>
        </div>
      </section>
    </div>
  );
}

// Utility functions
async function getAllWords() {
  // This would integrate with your existing database service
  // For example: return await DatabaseService.getWordsForPractice();
  return []; // Placeholder
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Example: Auto-sync hook for practice sessions
export function useAutoSync() {
  useEffect(() => {
    // Setup automatic sync after practice sessions
    // const handleSessionComplete = async () => {
    //   if (navigator.onLine && apiClient.isAuthenticated) {
    //     console.log('📝 Practice session completed, triggering sync...');
    //     
    //     // Wait a bit to avoid frequent syncs
    //     setTimeout(async () => {
    //       try {
    //         const result = await syncManager.performFullSync();
    //         if (result.success) {
    //           console.log('✅ Auto-sync completed');
    //         } else {
    //           console.log('⚠️ Auto-sync failed:', result.error);
    //         }
    //       } catch (error) {
    //         console.error('❌ Auto-sync error:', error);
    //       }
    //     }, 3000);
    //   }
    // };

    // You would integrate this with your existing practice session system
    // For example: practiceSessionManager.on('complete', handleSessionComplete);

    return () => {
      // Cleanup event listeners
    };
  }, []);
}

// Example: Network status component
export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueLength, setQueueLength] = useState(0);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      setQueueLength(syncManager.queueLength);
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Update queue length periodically
    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);

  if (!isOnline) {
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '10px 15px',
        backgroundColor: '#dc3545',
        color: 'white',
        borderRadius: '4px',
        zIndex: 1000
      }}>
        📴 离线模式 {queueLength > 0 && `(${queueLength} 个待同步)`}
      </div>
    );
  }

  if (queueLength > 0) {
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        padding: '10px 15px',
        backgroundColor: '#ffc107',
        color: '#212529',
        borderRadius: '4px',
        zIndex: 1000
      }}>
        🔄 同步队列: {queueLength}
      </div>
    );
  }

  return null;
}
