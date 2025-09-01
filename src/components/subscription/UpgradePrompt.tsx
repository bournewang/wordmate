import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, Crown, Check, AlertTriangle, Star, Smartphone, Monitor } from 'lucide-react';
import { Button, Card } from '../../styles/theme';
import { usePayment } from '../../hooks/useSubscription';
import { useAuth } from '../../hooks/useAuth';
import { SUBSCRIPTION_PLANS } from '../../types/subscription';
import { subscriptionAnalytics } from '../../services/analytics/subscriptionAnalytics';
import { getDeviceInfo, getPaymentFlowDescription, getPaymentMethodRecommendations } from '../../utils/deviceDetection';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: ${({ theme }) => theme.spacing.lg};
`;

const Modal = styled(Card)`
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  padding: 0;
`;

const Header = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray200};
  text-align: center;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary} 0%, ${({ theme }) => theme.colors.primaryDark} 100%);
  color: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg} ${({ theme }) => theme.borderRadius.lg} 0 0;
  
  .close-button {
    position: absolute;
    top: ${({ theme }) => theme.spacing.md};
    right: ${({ theme }) => theme.spacing.md};
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    transition: background-color ${({ theme }) => theme.transitions.normal};
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
  
  h2 {
    margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.sm};
  }
  
  p {
    margin: 0;
    opacity: 0.9;
    font-size: ${({ theme }) => theme.fontSizes.lg};
  }
`;

const Content = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
`;

const TrialWarning = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.warning + '15'};
  border: 1px solid ${({ theme }) => theme.colors.warning + '40'};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  
  .icon {
    color: ${({ theme }) => theme.colors.warning};
    flex-shrink: 0;
  }
  
  .content {
    flex: 1;
    
    h4 {
      margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
      color: ${({ theme }) => theme.colors.textPrimary};
      font-weight: ${({ theme }) => theme.fontWeights.semibold};
    }
    
    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.textSecondary};
      font-size: ${({ theme }) => theme.fontSizes.sm};
    }
  }
`;

const PlanComparison = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const PlanCard = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isRecommended', 'isSelected'].includes(prop)
})<{ isRecommended?: boolean; isSelected?: boolean }>`
  padding: ${({ theme }) => theme.spacing.lg};
  border: 2px solid ${({ isSelected, isRecommended, theme }) => 
    isSelected ? theme.colors.primary : 
    isRecommended ? theme.colors.primary + '60' : theme.colors.gray300};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  position: relative;
  background: ${({ isSelected, isRecommended, theme }) => 
    isSelected ? theme.colors.primary + '10' :
    isRecommended ? theme.colors.primary + '05' : 'white'};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.lg};
  }
  
  ${({ isRecommended }) => isRecommended && `
    &::before {
      content: '推荐';
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 16px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
  `}
  
  .plan-header {
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    
    h3 {
      margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
      color: ${({ theme }) => theme.colors.textPrimary};
    }
    
    .price {
      font-size: ${({ theme }) => theme.fontSizes['2xl']};
      font-weight: ${({ theme }) => theme.fontWeights.bold};
      color: ${({ theme }) => theme.colors.primary};
      
      .currency {
        font-size: ${({ theme }) => theme.fontSizes.lg};
        margin-right: ${({ theme }) => theme.spacing.xs};
      }
      
      .period {
        font-size: ${({ theme }) => theme.fontSizes.sm};
        color: ${({ theme }) => theme.colors.textSecondary};
        font-weight: normal;
      }
    }
  }
  
  .features {
    list-style: none;
    margin: 0;
    padding: 0;
    
    li {
      display: flex;
      align-items: center;
      gap: ${({ theme }) => theme.spacing.sm};
      margin-bottom: ${({ theme }) => theme.spacing.sm};
      font-size: ${({ theme }) => theme.fontSizes.sm};
      color: ${({ theme }) => theme.colors.textPrimary};
      
      .check {
        color: ${({ theme }) => theme.colors.success};
        flex-shrink: 0;
      }
    }
  }
`;

const PaymentMethods = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  
  .header {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-bottom: ${({ theme }) => theme.spacing.md};
    
    h4 {
      margin: 0;
      color: ${({ theme }) => theme.colors.textPrimary};
    }
    
    .device-info {
      display: flex;
      align-items: center;
      gap: ${({ theme }) => theme.spacing.xs};
      padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
      background: ${({ theme }) => theme.colors.gray100};
      border-radius: ${({ theme }) => theme.borderRadius.md};
      font-size: ${({ theme }) => theme.fontSizes.xs};
      color: ${({ theme }) => theme.colors.textSecondary};
      
      .icon {
        color: ${({ theme }) => theme.colors.primary};
      }
    }
  }
  
  .methods {
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }
  
  .method {
    flex: 1;
    padding: ${({ theme }) => theme.spacing.md};
    border: 2px solid transparent;
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.gray100};
    cursor: pointer;
    transition: all ${({ theme }) => theme.transitions.normal};
    text-align: center;
    
    &:hover {
      background: ${({ theme }) => theme.colors.gray200};
    }
    
    &.selected {
      border-color: ${({ theme }) => theme.colors.primary};
      background: ${({ theme }) => theme.colors.primary + '10'};
    }
    
    .icon {
      width: 32px;
      height: 32px;
      margin: 0 auto ${({ theme }) => theme.spacing.sm} auto;
      background: ${({ theme }) => theme.colors.primary};
      border-radius: ${({ theme }) => theme.borderRadius.md};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
    
    .name {
      font-size: ${({ theme }) => theme.fontSizes.sm};
      color: ${({ theme }) => theme.colors.textPrimary};
      font-weight: ${({ theme }) => theme.fontWeights.medium};
      margin-bottom: ${({ theme }) => theme.spacing.xs};
    }
    
    .description {
      font-size: ${({ theme }) => theme.fontSizes.xs};
      color: ${({ theme }) => theme.colors.textSecondary};
      line-height: ${({ theme }) => theme.lineHeights.tight};
    }
  }
  
  .flow-description {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.info + '10'};
    border: 1px solid ${({ theme }) => theme.colors.info + '30'};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    margin-bottom: ${({ theme }) => theme.spacing.md};
    
    .flow-icon {
      font-size: ${({ theme }) => theme.fontSizes.lg};
      flex-shrink: 0;
    }
    
    .flow-text {
      font-size: ${({ theme }) => theme.fontSizes.sm};
      color: ${({ theme }) => theme.colors.textPrimary};
      line-height: ${({ theme }) => theme.lineHeights.normal};
    }
  }
  
  .user-info {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.gray50};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    
    .label {
      font-weight: ${({ theme }) => theme.fontWeights.medium};
    }
    
    .email {
      color: ${({ theme }) => theme.colors.textPrimary};
      font-weight: ${({ theme }) => theme.fontWeights.semibold};
    }
    
    .not-logged-in {
      color: ${({ theme }) => theme.colors.warning};
      font-style: italic;
    }
  }
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  justify-content: flex-end;
`;

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'trial_expired' | 'limit_reached' | 'feature_locked' | 'manual';
  featureName?: string;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  isOpen,
  onClose,
  reason = 'manual',
  featureName
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'alipay' | 'wechat'>('alipay');
  const [selectedPlan, setSelectedPlan] = useState<string>('premium-monthly'); // Add plan selection state
  const { handleUpgrade, isProcessing } = usePayment();
  const { user } = useAuth();
  
  // Track modal show when opened
  useEffect(() => {
    if (isOpen && user) {
      subscriptionAnalytics.trackUpgradePromptShow(user.id, 'upgrade-modal', reason);
    }
  }, [isOpen, user, reason]);

  if (!isOpen) return null;

  const handleUpgradeClick = async () => {
    // Track upgrade attempt
    if (user) {
      await subscriptionAnalytics.trackPaymentStart(user.id, `payment_${Date.now()}`, selectedPaymentMethod);
    }
    
    try {
      const result = await handleUpgrade(selectedPaymentMethod, selectedPlan);
      
        if (result.success) {
        // Both development and production should open payment URL in new tab
        if (result.paymentUrl) {
          console.log('🎯 Opening payment URL in new tab:', result.paymentUrl);
          
          // Mark that payment is in progress
          sessionStorage.setItem('wordmate_payment_in_progress', 'true');
          
          // Close modal first
          onClose();
          
          // Check if it's a demo URL (contains demo-payment)
          if (result.paymentUrl.includes('demo-payment')) {
            // For demo URLs, show a message and open in new tab after delay
            alert('🧩 正在跳转到演示支付页面...');
            setTimeout(() => {
              window.open(result.paymentUrl!, '_blank', 'noopener,noreferrer');
            }, 1000);
          } else {
            // For real payment URLs, open in new tab immediately
            window.open(result.paymentUrl, '_blank', 'noopener,noreferrer');
          }
        } else {
          onClose();
          alert('支付初始化成功，但未获取到支付链接。请稍后重试。');
        }
      } else {
        // Handle error - show error message
        alert(result.error || '升级失败，请重试');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('升级过程中发生错误，请重试');
    }
  };
  
  const handleClose = async () => {
    // Track dismissal
    if (user) {
      await subscriptionAnalytics.trackUpgradePromptDismiss(user.id, 'upgrade-modal');
    }
    onClose();
  };

  const getPromptMessage = () => {
    switch (reason) {
      case 'trial_expired':
        return {
          title: '试用期已结束',
          message: '感谢您体验WordMate！升级到高级版继续享受完整功能。'
        };
      case 'limit_reached':
        return {
          title: '今日使用次数已达上限',
          message: '升级到高级版解锁无限制学习。'
        };
      case 'feature_locked':
        return {
          title: `${featureName || '该功能'}需要高级版`,
          message: '升级到高级版解锁全部高级功能。'
        };
      default:
        return {
          title: '升级到高级版',
          message: '解锁全部功能，享受无限制学习体验。'
        };
    }
  };

  const promptMessage = getPromptMessage();
  const plans = SUBSCRIPTION_PLANS;
  const deviceInfo = getDeviceInfo();
  const paymentRecommendations = getPaymentMethodRecommendations();

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <Modal>
        <Header>
          <button className="close-button" onClick={handleClose}>
            <X size={18} />
          </button>
          <h2>
            <Crown size={24} />
            {promptMessage.title}
          </h2>
          <p>{promptMessage.message}</p>
        </Header>

        <Content>
          {reason === 'trial_expired' && (
            <TrialWarning>
              <AlertTriangle className="icon" size={24} />
              <div className="content">
                <h4>试用期已结束</h4>
                <p>感谢您使用WordMate 3天免费试用！现在升级即可继续享受完整学习体验。</p>
              </div>
            </TrialWarning>
          )}

          <PlanComparison>
            {plans.filter(plan => plan.id !== 'free-trial').map((plan) => (
              <PlanCard 
                key={plan.id} 
                isRecommended={plan.isPopular}
                isSelected={selectedPlan === plan.id}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <div className="price">
                    {plan.price > 0 ? (
                      <>
                        <span className="currency">¥</span>
                        {plan.price}
                        <span className="period">/月</span>
                      </>
                    ) : (
                      '免费'
                    )}
                  </div>
                </div>
                
                <ul className="features">
                  {plan.features.map((feature, index) => (
                    <li key={index}>
                      <Check className="check" size={16} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </PlanCard>
            ))}
          </PlanComparison>

          <PaymentMethods>
            <div className="header">
              <h4>选择支付方式</h4>
              <div className="device-info">
                {deviceInfo.isMobile ? (
                  <>
                    <Smartphone className="icon" size={14} />
                    <span>手机版</span>
                  </>
                ) : (
                  <>
                    <Monitor className="icon" size={14} />
                    <span>桌面版</span>
                  </>
                )}
              </div>
            </div>
            <div className="methods">
              <div 
                className={`method ${selectedPaymentMethod === 'alipay' ? 'selected' : ''}`}
                onClick={() => setSelectedPaymentMethod('alipay')}
              >
                <div className="icon">支</div>
                <div className="name">{paymentRecommendations.alipay.name}</div>
                <div className="description">{paymentRecommendations.alipay.description}</div>
              </div>
              <div 
                className={`method ${selectedPaymentMethod === 'wechat' ? 'selected' : ''}`}
                onClick={() => setSelectedPaymentMethod('wechat')}
              >
                <div className="icon">微</div>
                <div className="name">{paymentRecommendations.wechat.name}</div>
                <div className="description">{paymentRecommendations.wechat.description}</div>
              </div>
            </div>
            
            {/* Show payment flow instructions */}
            <div className="flow-description">
              <div className="flow-icon">
                {deviceInfo.isMobile ? '📱' : '💻'}
              </div>
              <div className="flow-text">
                {getPaymentFlowDescription(selectedPaymentMethod)}
              </div>
            </div>
            
            {/* Show user email below payment methods */}
            <div className="user-info">
              <span className="label">账号：</span>
              {user && user.email ? (
                <span className="email">{user.email}</span>
              ) : (
                <span className="not-logged-in">未登录（请先注册账号）</span>
              )}
            </div>
          </PaymentMethods>

          <Actions>
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              稍后再说
            </Button>
            <Button 
              variant="primary" 
              onClick={handleUpgradeClick}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Star className="animate-spin" size={16} />
                  {process.env.NODE_ENV === 'development' ? '模拟支付中...' : '创建支付订单...'}
                </>
              ) : (
                `立即升级 ¥${plans.find(p => p.id === selectedPlan)?.price}/月`
              )}
            </Button>
          </Actions>
        </Content>
      </Modal>
    </Overlay>
  );
};
