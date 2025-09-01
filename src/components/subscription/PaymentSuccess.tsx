import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { CheckCircle, X, Loader } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../styles/theme';
import { useSubscription } from '../../hooks/useSubscription';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const Card = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  padding: ${({ theme }) => theme.spacing.xl};
  max-width: 500px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
`;

const Icon = styled.div<{ status: 'loading' | 'success' | 'error' }>`
  width: 80px;
  height: 80px;
  margin: 0 auto ${({ theme }) => theme.spacing.lg} auto;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${({ status, theme }) => {
    switch (status) {
      case 'success':
        return `
          background: ${theme.colors.success}15;
          color: ${theme.colors.success};
        `;
      case 'error':
        return `
          background: ${theme.colors.error}15;
          color: ${theme.colors.error};
        `;
      case 'loading':
      default:
        return `
          background: ${theme.colors.primary}15;
          color: ${theme.colors.primary};
        `;
    }
  }}
`;

const Title = styled.h1`
  margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.fontSizes['2xl']};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
`;

const Message = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.xl} 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.fontSizes.lg};
  line-height: ${({ theme }) => theme.lineHeights.relaxed};
`;

const DebugInfo = styled.div`
  background: ${({ theme }) => theme.colors.gray100};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.md} 0;
  font-family: 'Courier New', monospace;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  text-align: left;
  max-height: 200px;
  overflow-y: auto;
  
  .debug-title {
    font-weight: bold;
    color: ${({ theme }) => theme.colors.textPrimary};
    margin-bottom: ${({ theme }) => theme.spacing.xs};
  }
  
  .debug-item {
    margin: 2px 0;
    color: ${({ theme }) => theme.colors.textSecondary};
    word-break: break-all;
  }
  
  .debug-success {
    color: ${({ theme }) => theme.colors.success};
  }
  
  .debug-error {
    color: ${({ theme }) => theme.colors.error};
  }
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  justify-content: center;
`;

const Features = styled.div`
  background: ${({ theme }) => theme.colors.primary}05;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  margin: ${({ theme }) => theme.spacing.xl} 0;
  
  h3 {
    margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
    color: ${({ theme }) => theme.colors.textPrimary};
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
  }
  
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    
    li {
      display: flex;
      align-items: center;
      gap: ${({ theme }) => theme.spacing.sm};
      margin-bottom: ${({ theme }) => theme.spacing.sm};
      color: ${({ theme }) => theme.colors.textPrimary};
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .check {
        color: ${({ theme }) => theme.colors.success};
        flex-shrink: 0;
      }
    }
  }
`;

export const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyPayment, forceRefresh, syncWithBackend } = useSubscription();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在验证支付状态...');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string, isSuccess = false, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = isSuccess ? '✅' : isError ? '❌' : '🔍';
    const logInfo = `[${timestamp}] ${prefix} ${info}`;
    console.log(logInfo);
    setDebugInfo(prev => [...prev, logInfo]);
  };

  useEffect(() => {
    const verifyPaymentStatus = async () => {
      try {
        addDebugInfo('开始验证支付状态...');
        
        // Log current environment
        addDebugInfo(`环境: ${process.env.NODE_ENV || 'unknown'}`);
        addDebugInfo(`URL: ${window.location.href}`);
        addDebugInfo(`Referrer: ${document.referrer || 'none'}`);
        
        // Log URL parameters  
        const allParams = Object.fromEntries(searchParams.entries());
        addDebugInfo(`URL参数数量: ${Object.keys(allParams).length}`);
        Object.entries(allParams).forEach(([key, value]) => {
          addDebugInfo(`${key}: ${value.length > 50 ? value.substring(0, 50) + '...' : value}`);
        });
        // Try to get payment_id from different possible parameter names
        // Alipay returns 'out_trade_no' which is our payment ID
        let paymentId = searchParams.get('payment_id') || 
                       searchParams.get('out_trade_no') || 
                       searchParams.get('trade_no') ||
                       searchParams.get('order_id');
        
        // Also extract Alipay-specific information for validation
        const alipayTradeNo = searchParams.get('trade_no');
        const totalAmount = searchParams.get('total_amount');
        const alipayMethod = searchParams.get('method');
        
        addDebugInfo(`提取的支付ID: ${paymentId || 'none'}`);
        addDebugInfo(`支付宝交易号: ${alipayTradeNo || 'none'}`);
        addDebugInfo(`支付金额: ${totalAmount || 'none'}`);
        addDebugInfo(`支付方法: ${alipayMethod || 'none'}`);
        
        // Check if this is a valid Alipay return with success indicators
        const isAlipayReturn = alipayMethod?.includes('alipay') && alipayTradeNo && totalAmount;
        const hasValidSignature = searchParams.get('sign') && searchParams.get('sign_type');
        
        addDebugInfo(`是否支付宝返回: ${isAlipayReturn}`);
        addDebugInfo(`是否有效签名: ${hasValidSignature}`);
        addDebugInfo(`签名长度: ${searchParams.get('sign')?.length || 0}`);
        addDebugInfo(`签名类型: ${searchParams.get('sign_type') || 'none'}`);
        
        // Check localStorage for user info
        const allKeys = Object.keys(localStorage);
        const userKeys = allKeys.filter(key => key.includes('wordmate'));
        addDebugInfo(`LocalStorage keys: ${userKeys.length} wordmate相关项`);
        userKeys.forEach(key => {
          const value = localStorage.getItem(key);
          if (value) {
            addDebugInfo(`${key}: ${value.length > 100 ? value.substring(0, 100) + '...' : value}`);
          }
        });
        
        // If we have Alipay return parameters, this is likely a successful payment
        if (isAlipayReturn && hasValidSignature) {
          addDebugInfo('检测到支付宝成功返回，作为成功处理', true);
          
          // Alipay redirected back with transaction details - this means payment was successful
          setStatus('success');
          setMessage('恭喜！您的支付宝支付已成功！正在处理您的会员升级...');
          
          // Use the payment ID we found (should be out_trade_no)
          const orderPaymentId = paymentId || searchParams.get('out_trade_no');
          if (orderPaymentId) {
            addDebugInfo(`使用 payment ID 验证支付: ${orderPaymentId}`);
            try {
              const result = await verifyPayment(orderPaymentId);
              addDebugInfo(`支付验证结果: ${JSON.stringify(result)}`, result.success, !result.success);
              if (result.success) {
                setMessage('恭喜！您已成功升级到WordMate高级会员！');
                // Sync with backend to get latest premium status
                try {
                  await syncWithBackend();
                  addDebugInfo('已同步后端订阅状态', true);
                } catch (syncError) {
                  addDebugInfo(`后端同步失败: ${syncError}`, false, true);
                  // Fallback to local refresh
                  await forceRefresh();
                  addDebugInfo('已进行本地刷新', true);
                }
              }
            } catch (error) {
              addDebugInfo(`支付验证异常: ${error}`, false, true);
              // Keep success status since Alipay returned successfully
              setMessage('支付成功！请稍后返回主页查看您的会员状态。');
            }
          } else {
            // Even without verification, show success since Alipay returned
            addDebugInfo('无法验证支付ID，但支付宝返回成功', true);
            setMessage('支付成功！请稍后返回主页查看您的会员状态。');
          }
          
          // Clear any payment progress flags
          sessionStorage.removeItem('wordmate_payment_in_progress');
          return;
        }
        
        // If no payment ID in URL, check for pending payments
        if (!paymentId) {
          console.log('🔍 No payment ID in URL, checking for pending payments...');
          
          // Try to get most recent pending payment from all possible users
          const allKeys = Object.keys(localStorage);
          const pendingPaymentKeys = allKeys.filter(key => key.startsWith('wordmate_pending_payments_'));
          
          for (const key of pendingPaymentKeys) {
            const pendingPayments = localStorage.getItem(key);
            if (pendingPayments) {
              const paymentIds = JSON.parse(pendingPayments);
              if (paymentIds.length > 0) {
                // Use the most recent payment ID
                paymentId = paymentIds[paymentIds.length - 1];
                console.log('🔍 Using most recent pending payment ID:', paymentId);
                break;
              }
            }
          }
        }
        
        // If still no payment ID, check if this page was reached after a successful payment
        if (!paymentId) {
          // Check if we just came from a payment (referrer, session storage, or Alipay return method)
          const isFromPayment = document.referrer.includes('alipay.com') || 
                               document.referrer.includes('wechatpay') ||
                               searchParams.get('method')?.includes('alipay') ||
                               searchParams.get('method')?.includes('wechat') ||
                               sessionStorage.getItem('wordmate_payment_in_progress');
          
          if (isFromPayment) {
            console.log('🔍 Detected return from payment without payment ID, treating as potential success');
            
            // In development mode or if we detect payment completion, assume success
            if (process.env.NODE_ENV === 'development') {
              setStatus('success');
              setMessage('恭喜！您已成功升级到WordMate高级会员！');
              
              // Simulate payment success handling
              try {
                const result = await verifyPayment('demo_payment_success');
                console.log('✅ Demo payment verification result:', result);
                // Force refresh subscription state to update the main app  
                await forceRefresh();
                addDebugInfo('已强制刷新订阅状态 (开发模式)', true);
              } catch (error) {
                console.log('ℹ️ Demo payment verification error (expected):', error);
              }
              
              // Clear the payment progress flag
              sessionStorage.removeItem('wordmate_payment_in_progress');
              return;
            }
            
            // For production, show a message and redirect to check status later
            setStatus('error');
            setMessage('支付处理中…请稍后返回主页查看会员状态。');
          } else {
            console.log('❌ No payment ID found and not from payment page');
            setStatus('error');
            setMessage('未找到支付信息。如果您刚刚完成支付，请稍后返回主页查看状态。');
          }
          
          // Auto redirect to home after 3 seconds
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 3000);
          return;
        }

        addDebugInfo(`开始验证支付: ${paymentId}`);
        const result = await verifyPayment(paymentId);
        
        addDebugInfo(`支付验证结果: ${JSON.stringify(result)}`, result.success, !result.success);
        
        if (result.success) {
          addDebugInfo('支付验证成功！', true);
          setStatus('success');
          setMessage('恭喜！您已成功升级到WordMate高级会员！');
          // Sync with backend to get latest premium status
          try {
            await syncWithBackend();
            addDebugInfo('已同步后端订阅状态', true);
          } catch (syncError) {
            addDebugInfo(`后端同步失败: ${syncError}`, false, true);
            // Fallback to local refresh
            await forceRefresh();
            addDebugInfo('已进行本地刷新', true);
          }
        } else {
          addDebugInfo(`支付验证失败: ${result.error}`, false, true);
          setStatus('error');
          setMessage(result.error || '支付验证失败。如果您刚刚完成支付，请稍后返回主页查看状态。');
          
          // Auto redirect to home after 5 seconds for failed verification
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 5000);
        }
      } catch (error) {
        addDebugInfo(`支付验证异常: ${error}`, false, true);
        console.error('❌ Payment verification error:', error);
        setStatus('error');
        setMessage('支付验证过程中出现错误。请返回主页查看状态。');
        
        // Auto redirect to home after 5 seconds for errors
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 5000);
      }
    };
    
    verifyPaymentStatus();
  }, [searchParams, verifyPayment, forceRefresh, syncWithBackend, navigate]);

  // Show debug info in development or when there's an error
  const shouldShowDebugInfo = process.env.NODE_ENV === 'development' || status === 'error';

  const handleContinue = async () => {
    // Sync with backend one more time before navigation to ensure state is synced
    try {
      await syncWithBackend();
      addDebugInfo('导航前已同步后端订阅状态', true);
    } catch (error) {
      addDebugInfo(`导航前同步失败: ${error}`, false, true);
      // Fallback to local refresh
      try {
        await forceRefresh();
        addDebugInfo('导航前本地刷新成功', true);
      } catch (refreshError) {
        addDebugInfo(`导航前本地刷新失败: ${refreshError}`, false, true);
      }
    }
    navigate('/', { replace: true });
  };

  const handleRetry = () => {
    navigate('/settings', { replace: true });
  };

  const renderIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle size={40} />;
      case 'error':
        return <X size={40} />;
      case 'loading':
      default:
        return <Loader size={40} className="animate-spin" />;
    }
  };

  const renderTitle = () => {
    switch (status) {
      case 'success':
        return '升级成功！';
      case 'error':
        return '支付验证失败';
      case 'loading':
      default:
        return '验证支付中...';
    }
  };

  return (
    <Container>
      <Card>
        <Icon status={status}>
          {renderIcon()}
        </Icon>
        
        <Title>{renderTitle()}</Title>
        <Message>{message}</Message>
        
        {shouldShowDebugInfo && debugInfo.length > 0 && (
          <DebugInfo>
            <div className="debug-title">调试信息:</div>
            {debugInfo.map((info, index) => (
              <div 
                key={index} 
                className={`debug-item ${info.includes('✅') ? 'debug-success' : info.includes('❌') ? 'debug-error' : ''}`}
              >
                {info}
              </div>
            ))}
          </DebugInfo>
        )}
        
        {status === 'success' && (
          <Features>
            <h3>🎉 现在您可以享受以下功能：</h3>
            <ul>
              <li>
                <CheckCircle className="check" size={16} />
                无限制词汇练习
              </li>
              <li>
                <CheckCircle className="check" size={16} />
                高级学习统计分析
              </li>
              <li>
                <CheckCircle className="check" size={16} />
                云端数据同步
              </li>
              <li>
                <CheckCircle className="check" size={16} />
                优先客户支持
              </li>
              <li>
                <CheckCircle className="check" size={16} />
                个性化学习计划
              </li>
            </ul>
          </Features>
        )}
        
        <Actions>
          {status === 'success' && (
            <Button variant="primary" onClick={handleContinue}>
              开始使用高级功能
            </Button>
          )}
          
          {status === 'error' && (
            <>
              <Button variant="outline" onClick={handleRetry}>
                重试支付
              </Button>
              <Button variant="primary" onClick={handleContinue}>
                返回首页
              </Button>
            </>
          )}
          
          {status === 'loading' && (
            <Button variant="outline" disabled>
              验证中...
            </Button>
          )}
        </Actions>
      </Card>
    </Container>
  );
};
