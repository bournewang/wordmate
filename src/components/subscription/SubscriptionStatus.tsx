import React from 'react';
import styled from 'styled-components';
import { Crown, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useSubscriptionStatus, useFeatureAccess } from '../../hooks/useSubscription';
import { Button } from '../../styles/theme';

const StatusContainer = styled.div<{ variant: 'premium' | 'trial' | 'expired' | 'none' }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: ${({ variant, theme }) => {
    switch (variant) {
      case 'premium':
        return theme.colors.success + '15';
      case 'trial':
        return theme.colors.warning + '15';
      case 'expired':
        return theme.colors.error + '15';
      default:
        return theme.colors.gray100;
    }
  }};
  border: 1px solid ${({ variant, theme }) => {
    switch (variant) {
      case 'premium':
        return theme.colors.success + '40';
      case 'trial':
        return theme.colors.warning + '40';
      case 'expired':
        return theme.colors.error + '40';
      default:
        return theme.colors.gray200;
    }
  }};
`;

const StatusIcon = styled.div<{ variant: 'premium' | 'trial' | 'expired' | 'none' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ variant, theme }) => {
    switch (variant) {
      case 'premium':
        return theme.colors.success;
      case 'trial':
        return theme.colors.warning;
      case 'expired':
        return theme.colors.error;
      default:
        return theme.colors.gray500;
    }
  }};
  color: white;
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

const StatusContent = styled.div`
  flex: 1;
  
  h4 {
    margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
  
  p {
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: ${({ theme }) => theme.lineHeights.relaxed};
  }
`;

const UsageLimits = styled.div`
  margin-top: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  
  .limit-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${({ theme }) => theme.spacing.xs} 0;
    
    .limit-value {
      font-weight: ${({ theme }) => theme.fontWeights.medium};
      color: ${({ theme }) => theme.colors.primary};
    }
    
    .limit-unlimited {
      color: ${({ theme }) => theme.colors.success};
      font-weight: ${({ theme }) => theme.fontWeights.medium};
    }
  }
`;

interface SubscriptionStatusProps {
  showUpgradeButton?: boolean;
  onUpgrade?: () => void;
  compact?: boolean;
}

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  showUpgradeButton = true,
  onUpgrade,
  compact = false
}) => {
  const { 
    isPremium, 
    isTrialActive, 
    isTrialExpired, 
    daysRemaining, 
    // subscriptionStatus - keeping for potential future use
  } = useSubscriptionStatus();
  
  const { 
    dailyPracticeRemaining, 
    dailyWordsRemaining 
  } = useFeatureAccess();

  const getStatusInfo = () => {
    if (isPremium) {
      return {
        variant: 'premium' as const,
        icon: <Crown />,
        title: '高级会员',
        description: '享受完整功能，无限制学习'
      };
    } else if (isTrialActive) {
      return {
        variant: 'trial' as const,
        icon: <Clock />,
        title: `免费试用 (还剩${daysRemaining}天)`,
        description: '试用期内可享受完整功能'
      };
    } else if (isTrialExpired) {
      return {
        variant: 'expired' as const,
        icon: <AlertTriangle />,
        title: '试用已过期',
        description: '升级到高级会员以继续使用完整功能'
      };
    } else {
      return {
        variant: 'none' as const,
        icon: <CheckCircle />,
        title: '开始免费试用',
        description: '3天免费试用，体验完整功能'
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <StatusContainer variant={statusInfo.variant}>
      <StatusIcon variant={statusInfo.variant}>
        {statusInfo.icon}
      </StatusIcon>
      
      <StatusContent>
        <h4>{statusInfo.title}</h4>
        <p>{statusInfo.description}</p>
        
        {!compact && !isPremium && (
          <UsageLimits>
            <div className="limit-item">
              <span>今日练习次数：</span>
              <span className={dailyPracticeRemaining === -1 ? 'limit-unlimited' : 'limit-value'}>
                {dailyPracticeRemaining === -1 ? '无限制' : `${dailyPracticeRemaining} 次剩余`}
              </span>
            </div>
            <div className="limit-item">
              <span>今日学习单词：</span>
              <span className={dailyWordsRemaining === -1 ? 'limit-unlimited' : 'limit-value'}>
                {dailyWordsRemaining === -1 ? '无限制' : `${dailyWordsRemaining} 个剩余`}
              </span>
            </div>
          </UsageLimits>
        )}
      </StatusContent>
      
      {showUpgradeButton && !isPremium && (
        <Button 
          variant={isTrialExpired ? 'primary' : 'outline'}
          size="sm"
          onClick={onUpgrade}
        >
          {isTrialExpired ? '立即升级' : '升级高级版'}
        </Button>
      )}
    </StatusContainer>
  );
};

// Compact version for header/navigation
export const CompactSubscriptionStatus: React.FC<{ onUpgrade?: () => void }> = ({ onUpgrade }) => {
  return <SubscriptionStatus compact showUpgradeButton={false} onUpgrade={onUpgrade} />;
};
