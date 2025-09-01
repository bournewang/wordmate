import React, { useState } from 'react';
import styled from 'styled-components';
import { 
  Crown, 
  Settings as SettingsIcon, 
  // CreditCard, // Keeping import for potential future use
  Clock, 
  User,
  Bell,
  Globe,
  Shield,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { Container, Card, Button } from '../styles/theme';
import { SubscriptionStatus, UpgradePrompt } from '../components/subscription';
import { useSubscription, useSubscriptionStatus, usePayment } from '../hooks/useSubscription';
import { useAuth } from '../hooks/useAuth';

const SettingsContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const SettingsSection = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  
  h2 {
    margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
    color: ${({ theme }) => theme.colors.textPrimary};
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

const SettingsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const SettingItem = styled(Card)<{ clickable?: boolean }>`
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  cursor: ${({ clickable }) => clickable ? 'pointer' : 'default'};
  transition: all ${({ theme }) => theme.transitions.normal};
  
  ${({ clickable, theme }) => clickable && `
    &:hover {
      background: ${theme.colors.gray50};
      transform: translateY(-1px);
    }
  `}
  
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.gray100};
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
  }
  
  .content {
    flex: 1;
    
    h3 {
      margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
      color: ${({ theme }) => theme.colors.textPrimary};
      font-size: ${({ theme }) => theme.fontSizes.base};
      font-weight: ${({ theme }) => theme.fontWeights.medium};
    }
    
    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.textSecondary};
      font-size: ${({ theme }) => theme.fontSizes.sm};
      line-height: ${({ theme }) => theme.lineHeights.relaxed};
    }
  }
  
  .action {
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
  }
`;

const UserInfo = styled(Card)`
  padding: ${({ theme }) => theme.spacing.xl};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary} 0%, ${({ theme }) => theme.colors.primaryDark} 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
  }
  
  .info {
    flex: 1;
    
    h2 {
      margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
      color: ${({ theme }) => theme.colors.textPrimary};
    }
    
    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.textSecondary};
      font-size: ${({ theme }) => theme.fontSizes.sm};
    }
  }
`;

const CancelButton = styled(Button)`
  background: ${({ theme }) => theme.colors.error + '10'};
  color: ${({ theme }) => theme.colors.error};
  border: 1px solid ${({ theme }) => theme.colors.error + '30'};
  
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.error + '15'};
    border-color: ${({ theme }) => theme.colors.error + '50'};
  }
`;

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { subscription, isPremium } = useSubscription();
  const { subscriptionStatus } = useSubscriptionStatus();
  const { handleCancel, isProcessing } = usePayment();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // const [showCancelDialog, setShowCancelDialog] = useState(false); // Keeping for future implementation

  const handleCancelSubscription = async () => {
    if (window.confirm('确定要取消订阅吗？取消后将无法使用高级功能。')) {
      const result = await handleCancel();
      if (result.success) {
        alert('订阅已成功取消');
      } else {
        alert(result.error || '取消失败，请重试');
      }
    }
  };

  return (
    <Container>
      <SettingsContainer>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>设置</h1>
        
        {/* User Information */}
        {user && (
          <UserInfo>
            <div className="avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="info">
              <h2>{user.username}</h2>
              <p>{user.email || '未设置邮箱'} • {user.grade === 'grade6' ? '六年级' : user.grade}</p>
            </div>
          </UserInfo>
        )}
        
        {/* Subscription Management */}
        <SettingsSection>
          <h2>
            <Crown size={24} />
            会员管理
          </h2>
          
          <SubscriptionStatus 
            showUpgradeButton={!isPremium}
            onUpgrade={() => setShowUpgradeModal(true)}
          />
          
          {subscription && (
            <SettingsList>
              <SettingItem>
                <div className="icon">
                  <Calendar size={20} />
                </div>
                <div className="content">
                  <h3>订阅状态</h3>
                  <p>
                    {
                      subscriptionStatus === 'active' ? '已激活' :
                      subscriptionStatus === 'trial' ? `试用期（还剩3天）` :
                      subscriptionStatus === 'expired' ? '已过期' :
                      subscriptionStatus === 'cancelled' ? '已取消' :
                      '未知状态'
                    }
                  </p>
                </div>
              </SettingItem>
              
              {subscription.currentPeriodEnd && (
                <SettingItem>
                  <div className="icon">
                    <Clock size={20} />
                  </div>
                  <div className="content">
                    <h3>{
                      subscriptionStatus === 'active' ? '下次续费' :
                      subscriptionStatus === 'trial' ? '试用期结束' :
                      '期限'
                    }</h3>
                    <p>{new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-CN')}</p>
                  </div>
                </SettingItem>
              )}
              
              {isPremium && (
                <SettingItem>
                  <div className="content" style={{ marginLeft: 0 }}>
                    <CancelButton 
                      variant="outline" 
                      size="sm"
                      onClick={handleCancelSubscription}
                      disabled={isProcessing}
                    >
                      取消订阅
                    </CancelButton>
                  </div>
                </SettingItem>
              )}
            </SettingsList>
          )}
        </SettingsSection>
        
        {/* General Settings */}
        <SettingsSection>
          <h2>
            <SettingsIcon size={24} />
            常规设置
          </h2>
          
          <SettingsList>
            <SettingItem clickable>
              <div className="icon">
                <User size={20} />
              </div>
              <div className="content">
                <h3>个人信息</h3>
                <p>管理个人资料和学习设置</p>
              </div>
              <div className="action">
                <ChevronRight size={20} />
              </div>
            </SettingItem>
            
            <SettingItem clickable>
              <div className="icon">
                <Bell size={20} />
              </div>
              <div className="content">
                <h3>通知设置</h3>
                <p>管理学习提醒和通知</p>
              </div>
              <div className="action">
                <ChevronRight size={20} />
              </div>
            </SettingItem>
            
            <SettingItem clickable>
              <div className="icon">
                <Globe size={20} />
              </div>
              <div className="content">
                <h3>语言和区域</h3>
                <p>设置显示语言和时区</p>
              </div>
              <div className="action">
                <ChevronRight size={20} />
              </div>
            </SettingItem>
            
            <SettingItem clickable>
              <div className="icon">
                <Shield size={20} />
              </div>
              <div className="content">
                <h3>隐私与安全</h3>
                <p>管理数据隐私和账户安全</p>
              </div>
              <div className="action">
                <ChevronRight size={20} />
              </div>
            </SettingItem>
          </SettingsList>
        </SettingsSection>
        
        <div style={{ textAlign: 'center', padding: '2rem 0', color: '#666' }}>
          <p>更多设置功能正在开发中...</p>
        </div>
        
        <UpgradePrompt
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          reason="manual"
        />
      </SettingsContainer>
    </Container>
  );
};

export default SettingsPage;
