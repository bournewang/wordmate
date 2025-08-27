import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/apiClient';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Toast } from '../ui/Toast';
import './LoginPage.css';

interface LoginPageProps {
  onLogin: (user: any) => void;
  isLoading?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isLoading = false }) => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    grade: 'grade6'
  });
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [authState, setAuthState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<string>('');

  const { login } = useAuth();

  useEffect(() => {
    // Load saved email if exists
    const savedEmail = localStorage.getItem('wordmate_user_email');
    const savedUsername = localStorage.getItem('wordmate_user_name');
    if (savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail }));
      setShowEmailInput(true);
    }
    if (savedUsername) {
      setFormData(prev => ({ ...prev, username: savedUsername }));
    }

    // Get device info for display
    const deviceId = apiClient.currentDeviceId;
    if (deviceId) {
      const shortId = deviceId.split('_').pop()?.substring(0, 8) || 'unknown';
      setDeviceInfo(`设备 ${shortId}`);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear errors when user types
    if (errorMessage) setErrorMessage('');
  };

  const handleQuickStart = async () => {
    if (authState === 'loading') return;

    setAuthState('loading');
    setErrorMessage('');
    
    try {
      const result = await login({
        username: formData.username || '单词达人',
        grade: formData.grade as any
      });

      if (result.success) {
        setAuthState('success');
        setSuccessMessage(result.isNewUser ? '欢迎使用 WordMate！' : '欢迎回来！');
        setTimeout(() => onLogin(result.user), 1000);
      } else {
        throw new Error(result.error?.message || '登录失败');
      }
    } catch (error: any) {
      setAuthState('error');
      setErrorMessage(error.message);
      setTimeout(() => setAuthState('idle'), 3000);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authState === 'loading') return;

    if (!formData.email.trim()) {
      setErrorMessage('请输入邮箱地址');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrorMessage('请输入有效的邮箱地址');
      return;
    }

    setAuthState('loading');
    setErrorMessage('');

    try {
      const result = await login({
        email: formData.email.trim(),
        username: formData.username.trim() || '单词达人',
        grade: formData.grade as any
      });

      if (result.success) {
        setAuthState('success');
        
        if (result.isNewUser) {
          setSuccessMessage('账户创建成功！欢迎使用 WordMate！');
        } else if (result.isNewDevice) {
          setSuccessMessage('新设备已关联！您的学习记录已同步');
        } else {
          setSuccessMessage('登录成功！欢迎回来！');
        }

        setTimeout(() => onLogin(result.user), 1500);
      } else {
        throw new Error(result.error?.message || '登录失败');
      }
    } catch (error: any) {
      setAuthState('error');
      setErrorMessage(error.message);
      setTimeout(() => setAuthState('idle'), 3000);
    }
  };

  const toggleEmailMode = () => {
    setShowEmailInput(!showEmailInput);
    setErrorMessage('');
    setAuthState('idle');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Header */}
        <motion.div 
          className="login-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="app-icon">📚</div>
          <h1 className="app-title">WordMate</h1>
          <p className="app-subtitle">智能英语单词学习助手</p>
          {deviceInfo && <p className="device-info">{deviceInfo}</p>}
        </motion.div>

        {/* Login Form */}
        <motion.div 
          className="login-form-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {!showEmailInput ? (
              // Quick Start Mode
              <motion.div
                key="quick-start"
                className="quick-start-mode"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <h2>快速开始</h2>
                <p className="mode-description">
                  立即开始学习，数据仅保存在本设备
                </p>
                
                <div className="form-group">
                  <label htmlFor="username">显示名称（可选）</label>
                  <input
                    id="username"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="设置您的显示名称"
                    disabled={authState === 'loading'}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="grade">学习年级</label>
                  <select
                    id="grade"
                    name="grade"
                    value={formData.grade}
                    onChange={handleInputChange}
                    disabled={authState === 'loading'}
                  >
                    <option value="grade3">三年级</option>
                    <option value="grade4">四年级</option>
                    <option value="grade5">五年级</option>
                    <option value="grade6">六年级</option>
                    <option value="junior">初中</option>
                    <option value="senior">高中</option>
                  </select>
                </div>

                <button 
                  className="primary-button"
                  onClick={handleQuickStart}
                  disabled={authState === 'loading'}
                >
                  {authState === 'loading' ? (
                    <>
                      <LoadingSpinner size="small" />
                      <span>正在初始化...</span>
                    </>
                  ) : (
                    '试用'
                  )}
                </button>

                <div className="divider">
                  <span>或</span>
                </div>
                
                <button 
                  className="secondary-button"
                  onClick={toggleEmailMode}
                  disabled={authState === 'loading'}
                >
                  📧 注册/登录
                </button>
                
                <p className="note">
                  💡 试用：无需注册，立即体验<br/>
                  📱 注册/登录：数据云端同步，多设备共享
                </p>
              </motion.div>
            ) : (
              // Email Login Mode
              <motion.div
                key="email-login"
                className="email-login-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2>邮箱注册/登录</h2>
                <p className="mode-description">
                  使用邮箱注册账户，支持多设备数据同步
                </p>

                <form onSubmit={handleEmailLogin}>
                  <div className="form-group">
                    <label htmlFor="email">邮箱地址 *</label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="your@email.com"
                      disabled={authState === 'loading'}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="username-email">显示名称（可选）</label>
                    <input
                      id="username-email"
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder="设置您的显示名称"
                      disabled={authState === 'loading'}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="grade-email">学习年级</label>
                    <select
                      id="grade-email"
                      name="grade"
                      value={formData.grade}
                      onChange={handleInputChange}
                      disabled={authState === 'loading'}
                    >
                      <option value="grade3">三年级</option>
                      <option value="grade4">四年级</option>
                      <option value="grade5">五年级</option>
                      <option value="grade6">六年级</option>
                      <option value="junior">初中</option>
                      <option value="senior">高中</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="primary-button"
                    disabled={authState === 'loading'}
                  >
                    {authState === 'loading' ? (
                      <>
                        <LoadingSpinner size="small" />
                        <span>处理中...</span>
                      </>
                    ) : (
                      '注册/登录'
                    )}
                  </button>
                </form>

                <div className="divider">
                  <span>或</span>
                </div>
                
                <button 
                  className="secondary-button"
                  onClick={toggleEmailMode}
                  disabled={authState === 'loading'}
                >
                  ⚡ 试用（无需注册）
                </button>
                
                <p className="note">
                  📧 注册/登录：数据安全，多设备同步<br/>
                  ⚡ 试用：立即体验，本地存储
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Features */}
        <motion.div 
          className="features-section"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-icon">🧠</span>
              <span className="feature-text">智能记忆算法</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📱</span>
              <span className="feature-text">离线学习</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔄</span>
              <span className="feature-text">云端同步</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🏆</span>
              <span className="feature-text">学习记录</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Toast Notifications */}
      <AnimatePresence>
        {errorMessage && (
          <Toast 
            type="error" 
            message={errorMessage}
            onClose={() => setErrorMessage('')}
          />
        )}
        {successMessage && (
          <Toast 
            type="success" 
            message={successMessage}
            onClose={() => setSuccessMessage('')}
          />
        )}
      </AnimatePresence>

      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <LoadingSpinner size="large" />
          <p>正在加载您的学习数据...</p>
        </div>
      )}
    </div>
  );
};
