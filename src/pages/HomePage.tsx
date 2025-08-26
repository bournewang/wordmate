import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { 
  BookOpen, 
  TrendingUp, 
  Clock, 
  Award,
  Play,
  BarChart3
} from 'lucide-react';

import { Card, Button, Container } from '../styles/theme';
import { DatabaseService } from '../services/database';
import type { VocabularyData } from '../types';

const Hero = styled.section`
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary} 0%, ${({ theme }) => theme.colors.primaryDark} 100%);
  color: ${({ theme }) => theme.colors.white};
  padding: ${({ theme }) => theme.spacing['3xl']} 0;
  margin: -${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing['2xl']};
  text-align: center;
  
  h1 {
    font-size: ${({ theme }) => theme.fontSizes['4xl']};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
    margin-bottom: ${({ theme }) => theme.spacing.md};
    color: inherit;
  }
  
  p {
    font-size: ${({ theme }) => theme.fontSizes.xl};
    opacity: 0.9;
    max-width: 600px;
    margin: 0 auto ${({ theme }) => theme.spacing.xl};
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing['2xl']} 0;
    margin: -${({ theme }) => theme.spacing.md};
    margin-bottom: ${({ theme }) => theme.spacing.xl};
    
    h1 {
      font-size: ${({ theme }) => theme.fontSizes['3xl']};
    }
    
    p {
      font-size: ${({ theme }) => theme.fontSizes.lg};
    }
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing['2xl']};
`;

const StatCard = styled(Card)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: ${({ theme }) => theme.shadows.lg};
  }
`;

const StatIcon = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ color }) => color};
  color: ${({ theme }) => theme.colors.white};
  flex-shrink: 0;
  
  svg {
    width: 28px;
    height: 28px;
  }
`;

const StatInfo = styled.div`
  flex: 1;
  
  h3 {
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
    color: ${({ theme }) => theme.colors.textPrimary};
    margin-bottom: ${({ theme }) => theme.spacing.xs};
  }
  
  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.base};
  }
`;

const QuickActions = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing['2xl']};
  
  h2 {
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    text-align: center;
  }
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

const ActionCard = styled(Card)`
  text-align: center;
  padding: ${({ theme }) => theme.spacing['2xl']};
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: ${({ theme }) => theme.shadows.lg};
  }
  
  h3 {
    margin-bottom: ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
  
  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    line-height: ${({ theme }) => theme.lineHeights.relaxed};
  }
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing['3xl']};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const HomePage: React.FC = () => {
  const [vocabularyData, setVocabularyData] = useState<VocabularyData | null>(null);
  const [stats, setStats] = useState({
    totalWords: 0,
    masteredWords: 0,
    weakWords: [],
    recentSessions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vocabData, userStats] = await Promise.all([
        DatabaseService.getVocabularyData(),
        DatabaseService.getUserStats('default-user') // 使用默认用户ID
      ]);

      if (vocabData) {
        setVocabularyData(vocabData);
      }

      setStats(userStats);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState>正在加载数据...</LoadingState>;
  }

  const masteryRate = stats.totalWords > 0 
    ? Math.round((stats.masteredWords / stats.totalWords) * 100) 
    : 0;

  const weakWordsCount = stats.weakWords.length;

  return (
    <Container>
      <Hero>
        <h1>欢迎来到词汇练习</h1>
        <p>通过科学的间隔重复算法，让英语学习更高效</p>
        <Button as={Link} to="/units" size="lg">
          <Play size={20} />
          开始学习
        </Button>
      </Hero>

      <StatsGrid>
        <StatCard>
          <StatIcon color="#3b82f6">
            <BookOpen />
          </StatIcon>
          <StatInfo>
            <h3>{stats.totalWords}</h3>
            <p>总词汇量</p>
          </StatInfo>
        </StatCard>

        <StatCard>
          <StatIcon color="#10b981">
            <Award />
          </StatIcon>
          <StatInfo>
            <h3>{stats.masteredWords}</h3>
            <p>已掌握词汇</p>
          </StatInfo>
        </StatCard>

        <StatCard>
          <StatIcon color="#f59e0b">
            <TrendingUp />
          </StatIcon>
          <StatInfo>
            <h3>{masteryRate}%</h3>
            <p>掌握率</p>
          </StatInfo>
        </StatCard>

        <StatCard>
          <StatIcon color="#ef4444">
            <Clock />
          </StatIcon>
          <StatInfo>
            <h3>{weakWordsCount}</h3>
            <p>需要复习</p>
          </StatInfo>
        </StatCard>
      </StatsGrid>

      <QuickActions>
        <h2>快速开始</h2>
        <ActionGrid>
          <ActionCard>
            <BookOpen size={48} color="#3b82f6" style={{ margin: '0 auto 16px' }} />
            <h3>单元学习</h3>
            <p>按照教材单元系统学习词汇，每个单元包含精选的重点词汇</p>
            <Button as={Link} to="/units" fullWidth>
              开始学习
            </Button>
          </ActionCard>

          <ActionCard>
            <BarChart3 size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h3>学习进度</h3>
            <p>查看详细的学习统计，了解你的进步情况和薄弱环节</p>
            <Button as={Link} to="/progress" variant="outline" fullWidth>
              查看进度
            </Button>
          </ActionCard>
        </ActionGrid>
      </QuickActions>

      {vocabularyData && (
        <Card>
          <h3>学习内容概览</h3>
          <p>
            当前教材：<strong>六年级下册</strong>
            <br />
            包含 <strong>{vocabularyData.metadata.totalUnits}</strong> 个单元，
            共 <strong>{vocabularyData.metadata.totalWords}</strong> 个词汇
          </p>
          
          <div style={{ marginTop: '16px' }}>
            {vocabularyData.units.map((unit) => (
              <div key={unit.id} style={{ 
                display: 'inline-block', 
                margin: '4px',
                padding: '8px 12px',
                background: '#f3f4f6',
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                {unit.name} ({unit.words.length}词)
              </div>
            ))}
          </div>
        </Card>
      )}
    </Container>
  );
};

export default HomePage;
