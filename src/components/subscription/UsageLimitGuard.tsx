import React, { ReactNode, useState } from 'react';
import styled from 'styled-components';
import { AlertTriangle, Lock, Crown, Gift } from 'lucide-react';
import { Button, Card } from '../../styles/theme';
import { useSubscription, useFeatureAccess } from '../../hooks/useSubscription';
import { UpgradePrompt } from './UpgradePrompt';

const LimitWarning = styled(Card)`
  background: ${({ theme }) => theme.colors.warning + '10'};
  border: 2px solid ${({ theme }) => theme.colors.warning + '40'};
  padding: ${({ theme }) => theme.spacing.xl};
  text-align: center;
  margin: ${({ theme }) => theme.spacing.lg} 0;
  
  .icon {
    margin: 0 auto ${({ theme }) => theme.spacing.md} auto;
    width: 48px;
    height: 48px;
    background: ${({ theme }) => theme.colors.warning};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }
  
  h3 {
    margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
    color: ${({ theme }) => theme.colors.textPrimary};
    font-size: ${({ theme }) => theme.fontSizes.xl};
  }
  
  p {
    margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: ${({ theme }) => theme.lineHeights.relaxed};
  }
  
  .actions {
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    justify-content: center;
    flex-wrap: wrap;
  }
`;

const FeatureLocked = styled(Card)`
  background: ${({ theme }) => theme.colors.gray50};
  border: 2px solid ${({ theme }) => theme.colors.gray300};
  padding: ${({ theme }) => theme.spacing.xl};
  text-align: center;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      ${({ theme }) => theme.colors.gray100} 10px,
      ${({ theme }) => theme.colors.gray100} 20px
    );
    pointer-events: none;
  }
  
  .content {
    position: relative;
    z-index: 1;
  }
  
  .icon {
    margin: 0 auto ${({ theme }) => theme.spacing.md} auto;
    width: 48px;
    height: 48px;
    background: ${({ theme }) => theme.colors.gray500};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }
  
  h3 {
    margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
    color: ${({ theme }) => theme.colors.textPrimary};
    font-size: ${({ theme }) => theme.fontSizes.xl};
  }
  
  p {
    margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: ${({ theme }) => theme.lineHeights.relaxed};
  }
`;

interface UsageLimitGuardProps {
  children: ReactNode;
  action: 'practice' | 'word_learn';
  fallback?: ReactNode;
  featureName?: string;
  showUpgradePrompt?: boolean;
}

export const UsageLimitGuard: React.FC<UsageLimitGuardProps> = ({
  children,
  action,
  fallback,
  featureName,
  showUpgradePrompt = true
}) => {
  const { checkUsageLimit, isPremium } = useSubscription();
  const { dailyPracticeRemaining, dailyWordsRemaining } = useFeatureAccess();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const canAccess = checkUsageLimit(action);

  if (isPremium || canAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const getLimitMessage = () => {
    switch (action) {
      case 'practice':
        return {
          title: '今日练习次数已用完',
          message: `您今天已经完成了所有练习。升级到高级版即可解锁无限制练习！`,
          remaining: dailyPracticeRemaining
        };
      case 'word_learn':
        return {
          title: '今日学习单词数已达上限',
          message: `您今天已经学习了足够多的单词。升级到高级版即可无限制学习！`,
          remaining: dailyWordsRemaining
        };
      default:
        return {
          title: '使用次数已达上限',
          message: '升级到高级版即可解锁无限制使用！',
          remaining: 0
        };
    }
  };

  const limitMessage = getLimitMessage();

  return (
    <>
      <LimitWarning>
        <div className="icon">
          <AlertTriangle size={24} />
        </div>
        <h3>{limitMessage.title}</h3>
        <p>{limitMessage.message}</p>
        <div className="actions">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            明天再来
          </Button>
          {showUpgradePrompt && (
            <Button variant="primary" onClick={() => setShowUpgradeModal(true)}>
              <Crown size={16} />
              立即升级 ¥38/月
            </Button>
          )}
        </div>
      </LimitWarning>

      {showUpgradePrompt && (
        <UpgradePrompt
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          reason="limit_reached"
          featureName={featureName}
        />
      )}
    </>
  );
};

interface FeatureGuardProps {
  children: ReactNode;
  feature: keyof import('../../types/subscription').SubscriptionFeatures;
  fallback?: ReactNode;
  featureName?: string;
  showUpgradePrompt?: boolean;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({
  children,
  feature,
  fallback,
  featureName,
  showUpgradePrompt = true
}) => {
  const { features } = useFeatureAccess();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const hasFeature = features[feature];

  if (hasFeature) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <>
      <FeatureLocked>
        <div className="content">
          <div className="icon">
            <Lock size={24} />
          </div>
          <h3>{featureName || '高级功能'}已锁定</h3>
          <p>
            这是高级会员专享功能。升级到高级版即可解锁包括{featureName || '此功能'}在内的所有高级功能！
          </p>
          {showUpgradePrompt && (
            <Button variant="primary" onClick={() => setShowUpgradeModal(true)}>
              <Gift size={16} />
              解锁高级功能 ¥38/月
            </Button>
          )}
        </div>
      </FeatureLocked>

      {showUpgradePrompt && (
        <UpgradePrompt
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          reason="feature_locked"
          featureName={featureName}
        />
      )}
    </>
  );
};

// Convenience hooks for common usage patterns
export const usePracticeGuard = () => {
  const { checkUsageLimit, recordUsage } = useSubscription();
  
  return {
    canPractice: () => checkUsageLimit('practice'),
    recordPracticeSession: (count = 1) => recordUsage('practice', count)
  };
};

export const useWordLearningGuard = () => {
  const { checkUsageLimit, recordUsage } = useSubscription();
  
  return {
    canLearnWords: () => checkUsageLimit('word_learn'),
    recordWordsLearned: (count = 1) => recordUsage('word_learn', count)
  };
};
