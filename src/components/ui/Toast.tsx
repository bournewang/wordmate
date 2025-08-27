import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import './Toast.css';

interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  type,
  message,
  duration = 5000,
  position = 'top-right',
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration > 0) {
      // Progress bar animation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (duration / 100));
          return newProgress <= 0 ? 0 : newProgress;
        });
      }, 100);

      // Auto close timer
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
      }, duration);

      return () => {
        clearTimeout(timer);
        clearInterval(progressInterval);
      };
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  const getPositionStyles = () => {
    const positions = {
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' },
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' }
    };
    return positions[position];
  };

  return (
    <motion.div
      className={`toast toast-${type}`}
      style={{
        position: 'fixed',
        zIndex: 9999,
        ...getPositionStyles()
      }}
      initial={{ opacity: 0, y: position.includes('top') ? -50 : 50, scale: 0.9 }}
      animate={{ 
        opacity: isVisible ? 1 : 0, 
        y: isVisible ? 0 : (position.includes('top') ? -50 : 50),
        scale: isVisible ? 1 : 0.9
      }}
      exit={{ opacity: 0, y: position.includes('top') ? -50 : 50, scale: 0.9 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="toast-content">
        <span className="toast-icon">{getIcon()}</span>
        <span className="toast-message">{message}</span>
        <button 
          className="toast-close"
          onClick={handleClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      
      {duration > 0 && (
        <div className="toast-progress">
          <div 
            className="toast-progress-bar"
            style={{ 
              width: `${progress}%`,
              transition: 'width 0.1s linear'
            }}
          />
        </div>
      )}
    </motion.div>
  );
};

// Toast Manager for multiple toasts
export const ToastManager: React.FC = () => {
  // This would typically be managed by a global state or context
  // For now, it's just a placeholder structure
  return (
    <div id="toast-container">
      {/* Toasts would be rendered here */}
    </div>
  );
};
