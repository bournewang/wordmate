import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth, useRequireAuth } from '../hooks/useAuth';
import { SyncProvider, useSync, usePracticeSync } from '../hooks/useSync';
import { LoginPage } from './auth/LoginPage';
import { SyncStatus } from './sync/SyncStatus';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { initializeSync } from '../examples/syncIntegration';
import './App.css';

// Main App Content (after authentication)
const MainAppContent: React.FC = () => {
  const { user, logout } = useAuth();
  const { syncAfterPractice } = usePracticeSync();
  const [currentView, setCurrentView] = useState<'home' | 'practice' | 'progress' | 'settings'>('home');

  // Simulate practice completion for demo
  const handlePracticeComplete = () => {
    console.log('Practice session completed!');
    syncAfterPractice();
    setCurrentView('progress');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="main-app">
      {/* Header with sync status */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">📚 WordMate</h1>
          <span className="user-greeting">
            你好, {user?.username || 'User'}!
          </span>
        </div>
        
        <div className="header-right">
          <SyncStatus compact />
          <button 
            className="logout-btn"
            onClick={handleLogout}
            title="退出登录"
          >
            🚪
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="main-nav">
        <button 
          className={`nav-btn ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => setCurrentView('home')}
        >
          🏠 主页
        </button>
        <button 
          className={`nav-btn ${currentView === 'practice' ? 'active' : ''}`}
          onClick={() => setCurrentView('practice')}
        >
          📝 练习
        </button>
        <button 
          className={`nav-btn ${currentView === 'progress' ? 'active' : ''}`}
          onClick={() => setCurrentView('progress')}
        >
          📊 进度
        </button>
        <button 
          className={`nav-btn ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentView('settings')}
        >
          ⚙️ 设置
        </button>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <HomeView key="home" onStartPractice={() => setCurrentView('practice')} />
          )}
          {currentView === 'practice' && (
            <PracticeView key="practice" onComplete={handlePracticeComplete} />
          )}
          {currentView === 'progress' && (
            <ProgressView key="progress" />
          )}
          {currentView === 'settings' && (
            <SettingsView key="settings" />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

// Home View
const HomeView: React.FC<{ onStartPractice: () => void }> = ({ onStartPractice }) => {
  const { user } = useAuth();
  
  return (
    <motion.div
      className="view home-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="welcome-section">
        <h2>欢迎回来，{user?.username}！</h2>
        <p>继续您的英语学习之旅</p>
      </div>

      <div className="quick-actions">
        <button className="action-card primary" onClick={onStartPractice}>
          <span className="action-icon">🚀</span>
          <div className="action-content">
            <h3>开始练习</h3>
            <p>学习新单词或复习已学内容</p>
          </div>
        </button>

        <div className="action-card">
          <span className="action-icon">🏆</span>
          <div className="action-content">
            <h3>今日目标</h3>
            <p>完成 20 个单词练习</p>
          </div>
        </div>

        <div className="action-card">
          <span className="action-icon">🔥</span>
          <div className="action-content">
            <h3>学习连击</h3>
            <p>已坚持 3 天</p>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>最近活动</h3>
        <div className="activity-list">
          <div className="activity-item">
            <span className="activity-icon">✅</span>
            <span className="activity-text">完成了 15 个单词练习</span>
            <span className="activity-time">2 小时前</span>
          </div>
          <div className="activity-item">
            <span className="activity-icon">🎯</span>
            <span className="activity-text">达成每日目标</span>
            <span className="activity-time">昨天</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Practice View
const PracticeView: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [isCompleted, setIsCompleted] = useState(false);

  const handleComplete = () => {
    setIsCompleted(true);
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  return (
    <motion.div
      className="view practice-view"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {!isCompleted ? (
        <>
          <h2>单词练习</h2>
          <div className="practice-content">
            <div className="practice-card">
              <h3>练习模拟器</h3>
              <p>这里是您的练习界面</p>
              <button className="complete-btn" onClick={handleComplete}>
                完成练习 (演示)
              </button>
            </div>
          </div>
        </>
      ) : (
        <motion.div
          className="completion-screen"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="completion-icon">🎉</div>
          <h2>练习完成！</h2>
          <p>您的进度正在同步中...</p>
          <LoadingSpinner size="small" />
        </motion.div>
      )}
    </motion.div>
  );
};

// Progress View with Sync Status
const ProgressView: React.FC = () => {
  
  return (
    <motion.div
      className="view progress-view"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2>学习进度</h2>
      
      {/* Detailed Sync Status */}
      <div className="sync-section">
        <SyncStatus showManualSync />
      </div>

      {/* Progress Stats */}
      <div className="progress-stats">
        <div className="stat-card">
          <span className="stat-icon">📚</span>
          <div className="stat-content">
            <h3>已学单词</h3>
            <span className="stat-value">127</span>
          </div>
        </div>
        
        <div className="stat-card">
          <span className="stat-icon">🎯</span>
          <div className="stat-content">
            <h3>掌握程度</h3>
            <span className="stat-value">78%</span>
          </div>
        </div>
        
        <div className="stat-card">
          <span className="stat-icon">🔥</span>
          <div className="stat-content">
            <h3>连续天数</h3>
            <span className="stat-value">3 天</span>
          </div>
        </div>
      </div>

      {/* Learning Chart Placeholder */}
      <div className="chart-section">
        <h3>学习趋势</h3>
        <div className="chart-placeholder">
          📈 学习进度图表
        </div>
      </div>
    </motion.div>
  );
};

// Settings View
const SettingsView: React.FC = () => {
  const { user, linkDevice } = useAuth();
  const { isAutoSyncEnabled, enableAutoSync, clearSyncHistory } = useSync();
  const [linkEmail, setLinkEmail] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const handleLinkDevice = async () => {
    if (!linkEmail.trim()) return;
    
    setIsLinking(true);
    try {
      const result = await linkDevice(linkEmail);
      if (result.success) {
        alert(result.message);
        setLinkEmail('');
      } else {
        alert(result.message);
      }
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <motion.div
      className="view settings-view"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2>设置</h2>
      
      {/* User Profile */}
      <div className="settings-section">
        <h3>用户信息</h3>
        <div className="setting-item">
          <label>用户名</label>
          <span>{user?.username || 'N/A'}</span>
        </div>
        <div className="setting-item">
          <label>邮箱</label>
          <span>{user?.email || '未设置'}</span>
        </div>
        <div className="setting-item">
          <label>年级</label>
          <span>{user?.grade || 'N/A'}</span>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="settings-section">
        <h3>同步设置</h3>
        <div className="setting-item toggle">
          <label>自动同步</label>
          <button 
            className={`toggle-btn ${isAutoSyncEnabled ? 'on' : 'off'}`}
            onClick={() => enableAutoSync(!isAutoSyncEnabled)}
          >
            {isAutoSyncEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="setting-item">
          <button 
            className="secondary-button"
            onClick={clearSyncHistory}
          >
            清除同步历史
          </button>
        </div>
      </div>

      {/* Device Linking */}
      {!user?.email && (
        <div className="settings-section">
          <h3>设备关联</h3>
          <p>添加邮箱以启用跨设备同步</p>
          <div className="link-device-form">
            <input
              type="email"
              placeholder="输入邮箱地址"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              disabled={isLinking}
            />
            <button 
              className="primary-button"
              onClick={handleLinkDevice}
              disabled={isLinking || !linkEmail.trim()}
            >
              {isLinking ? <LoadingSpinner size="small" /> : '关联'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Authentication Gate Component
const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, needsAuth, isLoading } = useRequireAuth();
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    // Initialize sync when authenticated
    if (isAuthenticated) {
      initializeSync()
        .then(() => {
          console.log('✅ App initialization completed');
        })
        .catch((error) => {
          console.error('❌ App initialization failed:', error);
        })
        .finally(() => {
          setAppLoading(false);
        });
    } else {
      setAppLoading(false);
    }
  }, [isAuthenticated]);

  // Show loading during auth initialization
  if (isLoading || (isAuthenticated && appLoading)) {
    return (
      <div className="app-loading">
        <LoadingSpinner size="large" />
        <h2>WordMate</h2>
        <p>{isAuthenticated ? '正在加载您的学习数据...' : '正在初始化...'}</p>
      </div>
    );
  }

  // Show login page if not authenticated
  if (needsAuth) {
    return (
      <LoginPage 
        onLogin={() => {
          // This will trigger the useEffect above
          setAppLoading(true);
        }} 
      />
    );
  }

  // Show main app
  return <>{children}</>;
};

// Main App Component
export const App: React.FC = () => {
  return (
    <div className="wordmate-app">
      <AuthProvider>
        <SyncProvider>
          <AuthGate>
            <MainAppContent />
          </AuthGate>
        </SyncProvider>
      </AuthProvider>
    </div>
  );
};

export default App;
