import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { 
  BarChart3, 
  RefreshCw,
  Calendar,
  AlertCircle
} from 'lucide-react';

import { Container, Button } from '../styles/theme';
import { ProgressService, type ProgressStats } from '../services/progressService';
import ProgressStatsCard from '../components/progress/ProgressStatsCard';
import ProgressCharts from '../components/progress/ProgressCharts';
import StreakAndWeakWords from '../components/progress/StreakAndWeakWords';
import UnitProgressOverview from '../components/progress/UnitProgressOverview';

const PageContainer = styled(Container)`
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  max-width: 100vw;
  box-sizing: border-box;
  overflow-x: hidden;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing['2xl']};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.lg};

  h1 {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    margin: 0;
    color: ${({ theme }) => theme.colors.textPrimary};
    font-size: ${({ theme }) => theme.fontSizes['3xl']};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.md};
    
    h1 {
      font-size: ${({ theme }) => theme.fontSizes['2xl']};
    }
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    margin-bottom: ${({ theme }) => theme.spacing.xl};
    
    h1 {
      font-size: ${({ theme }) => theme.fontSizes.xl};
    }
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: center;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    justify-content: flex-start;
  }
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing['3xl']};
  color: ${({ theme }) => theme.colors.textSecondary};
  gap: ${({ theme }) => theme.spacing.lg};

  svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing['2xl']};
  }
`;

const ErrorState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing['3xl']};
  color: ${({ theme }) => theme.colors.error};
  gap: ${({ theme }) => theme.spacing.lg};
  text-align: center;

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.textSecondary};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing['2xl']};
  }
`;

const LastUpdated = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};

  svg {
    width: 14px;
    height: 14px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    font-size: ${({ theme }) => theme.fontSizes.xs};
  }
`;

const ProgressPage: React.FC = () => {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadProgressStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const progressStats = await ProgressService.calculateProgressStats();
      setStats(progressStats);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('加载进度数据失败:', error);
      setError('无法加载进度数据，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgressStats();
  }, []);

  const handleRefresh = () => {
    loadProgressStats();
  };

  if (loading) {
    return (
      <PageContainer>
        <LoadingState>
          <RefreshCw size={48} />
          <h2>正在分析学习数据...</h2>
          <p>请稍候，我们正在计算您的学习进度</p>
        </LoadingState>
      </PageContainer>
    );
  }

  if (error || !stats) {
    return (
      <PageContainer>
        <ErrorState>
          <AlertCircle size={48} />
          <h2>加载失败</h2>
          <p>{error || '无法获取进度数据'}</p>
          <Button onClick={handleRefresh}>
            <RefreshCw size={16} />
            重新加载
          </Button>
        </ErrorState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Header>
        <h1>
          <BarChart3 size={32} />
          学习进度
        </h1>
        <HeaderActions>
          {lastUpdated && (
            <LastUpdated>
              <Calendar size={14} />
              更新时间：{lastUpdated.toLocaleString('zh-CN')}
            </LastUpdated>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} />
            刷新
          </Button>
        </HeaderActions>
      </Header>

      {/* Overall Statistics */}
      <ProgressStatsCard stats={stats.overall} />

      {/* Progress Charts */}
      <ProgressCharts stats={stats} />

      {/* Unit Progress Overview */}
      <UnitProgressOverview unitProgress={stats.unitProgress} />

      {/* Streak and Weak Words */}
      <StreakAndWeakWords 
        streakData={stats.streakData} 
        weakWords={stats.weakWords} 
      />
    </PageContainer>
  );
};

export default ProgressPage;
