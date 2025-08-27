import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSync } from '../../hooks/useSync';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Toast } from '../ui/Toast';
import './SyncStatus.css';

interface SyncStatusProps {
  compact?: boolean;
  showManualSync?: boolean;
  className?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ 
  compact = false, 
  showManualSync = true,
  className = ''
}) => {
  const {
    isOnline,
    lastSync,
    queueLength,
    isSyncing,
    syncStatus,
    performManualSync,
    getDataUsageStats
  } = useSync();

  const [showDetails, setShowDetails] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [dataStats, setDataStats] = useState<any>(null);

  useEffect(() => {
    // Update data stats periodically
    const updateStats = async () => {
      try {
        const stats = await getDataUsageStats();
        setDataStats(stats);
      } catch (error) {
        console.warn('Failed to get data stats:', error);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [getDataUsageStats]);

  const handleManualSync = async () => {
    if (isSyncing) return;

    try {
      const result = await performManualSync();
      
      if (result.success) {
        setSyncMessage(result.message);
        setTimeout(() => setSyncMessage(''), 3000);
      } else {
        setSyncMessage(`同步失败: ${result.message}`);
        setTimeout(() => setSyncMessage(''), 5000);
      }
    } catch (error: any) {
      setSyncMessage(`同步错误: ${error.message}`);
      setTimeout(() => setSyncMessage(''), 5000);
    }
  };

  const getStatusIcon = () => {
    if (isSyncing) return '🔄';
    if (!isOnline) return '📴';
    if (queueLength > 0) return '📤';
    if (syncStatus === 'success') return '✅';
    if (syncStatus === 'error') return '❌';
    return '🔄';
  };

  const getStatusText = () => {
    if (isSyncing) return '正在同步...';
    if (!isOnline && queueLength > 0) return `离线 (${queueLength} 个待同步)`;
    if (!isOnline) return '离线';
    if (lastSync) {
      const now = new Date();
      const syncTime = new Date(lastSync);
      const diffMs = now.getTime() - syncTime.getTime();
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

  const getStatusColor = () => {
    if (isSyncing) return 'syncing';
    if (!isOnline) return 'offline';
    if (syncStatus === 'error') return 'error';
    return 'online';
  };

  if (compact) {
    return (
      <div className={`sync-status-compact ${className}`}>
        <button 
          className={`sync-indicator ${getStatusColor()}`}
          onClick={() => setShowDetails(!showDetails)}
          title={getStatusText()}
        >
          <span className="status-icon">{getStatusIcon()}</span>
        </button>
        
        <AnimatePresence>
          {showDetails && (
            <motion.div
              className="sync-details-popup"
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="sync-detail-item">
                <span className="detail-label">状态:</span>
                <span className={`detail-value ${getStatusColor()}`}>
                  {getStatusText()}
                </span>
              </div>
              
              {dataStats && (
                <div className="sync-detail-item">
                  <span className="detail-label">已同步:</span>
                  <span className="detail-value">
                    {dataStats.syncedWords}/{dataStats.totalWords} 词
                  </span>
                </div>
              )}
              
              {showManualSync && isOnline && (
                <button 
                  className="sync-button-small"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? <LoadingSpinner size="tiny" /> : '同步'}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={`sync-status ${className}`}>
      <div className="sync-status-header">
        <div className="status-indicator">
          <span className={`status-dot ${getStatusColor()}`}></span>
          <div className="status-info">
            <h3 className="status-title">
              {getStatusIcon()} 同步状态
            </h3>
            <p className={`status-text ${getStatusColor()}`}>
              {getStatusText()}
            </p>
          </div>
        </div>
        
        {showManualSync && (
          <button 
            className={`sync-button ${isSyncing ? 'syncing' : ''}`}
            onClick={handleManualSync}
            disabled={isSyncing || !isOnline}
          >
            {isSyncing ? (
              <>
                <LoadingSpinner size="small" />
                <span>同步中</span>
              </>
            ) : (
              <>
                <span className="sync-icon">🔄</span>
                <span>手动同步</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Detailed Information */}
      <AnimatePresence>
        {(showDetails || !compact) && (
          <motion.div
            className="sync-details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="details-grid">
              {/* Network Status */}
              <div className="detail-card">
                <div className="detail-header">
                  <span className="detail-icon">🌐</span>
                  <span className="detail-title">网络状态</span>
                </div>
                <div className={`detail-value ${isOnline ? 'online' : 'offline'}`}>
                  {isOnline ? '在线' : '离线'}
                </div>
              </div>

              {/* Last Sync */}
              <div className="detail-card">
                <div className="detail-header">
                  <span className="detail-icon">⏱️</span>
                  <span className="detail-title">上次同步</span>
                </div>
                <div className="detail-value">
                  {lastSync ? new Date(lastSync).toLocaleString('zh-CN') : '从未同步'}
                </div>
              </div>

              {/* Queue Status */}
              {queueLength > 0 && (
                <div className="detail-card">
                  <div className="detail-header">
                    <span className="detail-icon">📤</span>
                    <span className="detail-title">待同步</span>
                  </div>
                  <div className="detail-value">
                    {queueLength} 个操作
                  </div>
                </div>
              )}

              {/* Data Stats */}
              {dataStats && (
                <>
                  <div className="detail-card">
                    <div className="detail-header">
                      <span className="detail-icon">📊</span>
                      <span className="detail-title">数据统计</span>
                    </div>
                    <div className="detail-value">
                      {dataStats.syncedWords}/{dataStats.totalWords} 单词已同步
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-header">
                      <span className="detail-icon">💾</span>
                      <span className="detail-title">存储优化</span>
                    </div>
                    <div className="detail-value">
                      节省 {dataStats.compressionRatio} 流量
                    </div>
                    <div className="detail-subtitle">
                      本地: {dataStats.localStorageSize} | 云端: {dataStats.serverStorageEstimate}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sync History */}
            <div className="sync-history">
              <h4>最近同步记录</h4>
              <div className="history-list">
                {/* This would be populated from actual sync history */}
                <div className="history-item">
                  <span className="history-time">
                    {lastSync ? new Date(lastSync).toLocaleTimeString('zh-CN') : '--:--'}
                  </span>
                  <span className="history-status success">
                    {syncStatus === 'success' ? '成功' : syncStatus === 'error' ? '失败' : '进行中'}
                  </span>
                  <span className="history-details">
                    {dataStats ? `${dataStats.syncedWords} 单词` : '无数据'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Details Button (for non-compact mode) */}
      {!compact && (
        <button 
          className="toggle-details-btn"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span>{showDetails ? '收起详情' : '显示详情'}</span>
          <span className={`chevron ${showDetails ? 'up' : 'down'}`}>▼</span>
        </button>
      )}

      {/* Toast for sync messages */}
      <AnimatePresence>
        {syncMessage && (
          <Toast 
            type={syncMessage.includes('失败') || syncMessage.includes('错误') ? 'error' : 'success'}
            message={syncMessage}
            onClose={() => setSyncMessage('')}
            position="top-right"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
