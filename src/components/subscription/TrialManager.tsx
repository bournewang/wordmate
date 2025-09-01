import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Gift, Clock, AlertTriangle } from 'lucide-react';
import { Button, Card } from '../../styles/theme';
import { useSubscription, useSubscriptionStatus } from '../../hooks/useSubscription';
import { useAuth } from '../../hooks/useAuth';
import { UpgradePrompt } from './UpgradePrompt';
import { subscriptionAnalytics } from '../../services/analytics/subscriptionAnalytics';

const TrialCard = styled(Card)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  
  .icon {
    margin: 0 auto ${({ theme }) => theme.spacing.md} auto;
    width: 64px;
    height: 64px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: ${({ theme }) => theme.borderRadius.full};
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  h2 {
    margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
    color: white;
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
  }
  
  p {
    margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
    opacity: 0.9;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    line-height: ${({ theme }) => theme.lineHeights.relaxed};
  }
`;

const BenefitsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
  
  li {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.base};
    
    &:last-child {
      margin-bottom: 0;
    }
  }
`;

const WarningCard = styled(Card)`
  background: ${({ theme }) => theme.colors.warning + '10'};
  border: 2px solid ${({ theme }) => theme.colors.warning + '40'};
  padding: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  
  .header {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    margin-bottom: ${({ theme }) => theme.spacing.md};
    
    .icon {
      color: ${({ theme }) => theme.colors.warning};
    }
    
    h3 {
      margin: 0;
      color: ${({ theme }) => theme.colors.textPrimary};
    }
  }
  
  .message {
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    line-height: ${({ theme }) => theme.lineHeights.relaxed};
  }
  
  .actions {
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    justify-content: center;
  }
`;

interface TrialManagerProps {
  autoStartTrial?: boolean;
}

export const TrialManager: React.FC<TrialManagerProps> = ({ autoStartTrial = false }) => {
  const { initializeTrial, isLoading } = useSubscription();
  const { isPremium, isTrialActive, isTrialExpired, needsUpgrade } = useSubscriptionStatus();
  const { user } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  useEffect(() => {
    // Auto-start trial for first-time users if enabled (but not if already premium)
    if (autoStartTrial && !hasAutoStarted && !isTrialActive && !isTrialExpired && !isLoading && !isPremium) {
      handleStartTrial();
      setHasAutoStarted(true);
    }
  }, [autoStartTrial, hasAutoStarted, isTrialActive, isTrialExpired, isLoading, isPremium]);

  const handleStartTrial = async () => {
    try {
      await initializeTrial();
      console.log('✅ Trial started successfully');
    } catch (error) {
      console.error('❌ Failed to start trial:', error);
      alert('启动试用失败，请重试');
    }
  };
  
  const handleUpgradeClick = async () => {
    setShowUpgradeModal(true);
    
    // Track upgrade prompt click
    if (user) {
      await subscriptionAnalytics.trackUpgradePromptClick(user.id, 'trial-manager');
    }
  };
  
  const handleUpgradeClose = async () => {
    setShowUpgradeModal(false);
    
    // Track upgrade prompt dismissal
    if (user) {
      await subscriptionAnalytics.trackUpgradePromptDismiss(user.id, 'trial-manager');
    }
  };

  // Show trial expired warning
  if (isTrialExpired || needsUpgrade) {
    return (
      <>
        <WarningCard>
          <div className="header">
            <AlertTriangle className="icon" size={24} />
            <h3>试用期已结束</h3>
          </div>
          <div className="message">
            您的3天免费试用已结束。现在每天只能练习1次，学习10个单词。
            升级到高级会员即可解锁无限制学习！
          </div>
          <div className="actions">
            <Button variant="primary" onClick={handleUpgradeClick}>
              <Gift size={16} />
              立即升级 ¥38/月
            </Button>
          </div>
        </WarningCard>
        
        <UpgradePrompt
          isOpen={showUpgradeModal}
          onClose={handleUpgradeClose}
          reason="trial_expired"
        />
      </>
    );
  }

  // Show trial start prompt for new users (but not if already premium)
  if (!isTrialActive && !isTrialExpired && !isPremium) {
    return (
      <TrialCard>
        <div className="icon">
          <Gift size={32} />
        </div>
        <h2>开始3天免费试用</h2>
        <p>
          体验WordMate的完整功能，包括无限制练习、
          高级统计分析和云端同步
        </p>
        
        <BenefitsList>
          <li>
            <Clock size={16} />
            3天完全免费
          </li>
          <li>
            <Gift size={16} />
            无限制词汇练习
          </li>
          <li>
            <AlertTriangle size={16} />
            高级进度分析
          </li>
        </BenefitsList>
        
        <Button 
          variant="outline" 
          size="lg" 
          onClick={handleStartTrial}
          disabled={isLoading}
          style={{ 
            background: 'rgba(255, 255, 255, 0.2)',
            border: '2px solid rgba(255, 255, 255, 0.5)',
            color: 'white'
          }}
        >
          {isLoading ? '启动中...' : '立即开始试用'}
        </Button>
      </TrialCard>
    );
  }

  return null;
};
