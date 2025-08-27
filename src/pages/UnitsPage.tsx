import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { 
  BookOpen, 
  Play, 
  CheckCircle,
  BarChart3
} from 'lucide-react';

import { Card, Button, Container } from '../styles/theme';
import { DatabaseService } from '../services/database';
import { ProgressService } from '../services/progressService';
import type { VocabularyData, ProgressStats } from '../types';

const PageHeader = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing['2xl']};
  
  h1 {
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }
  
  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.lg};
  }
`;

const UnitsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`;

const UnitCard = styled(Card)`
  position: relative;
  padding: ${({ theme }) => theme.spacing.xl};
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: ${({ theme }) => theme.shadows.lg};
  }
`;

const UnitHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const UnitInfo = styled.div`
  flex: 1;
  
  h3 {
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
    color: ${({ theme }) => theme.colors.textPrimary};
    margin-bottom: ${({ theme }) => theme.spacing.xs};
  }
  
  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: ${({ theme }) => theme.spacing.md};
    line-height: ${({ theme }) => theme.lineHeights.relaxed};
  }
`;

const UnitIcon = styled.div<{ $completed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ $completed, theme }) => 
    $completed ? theme.colors.success : theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  flex-shrink: 0;
  
  svg {
    width: 24px;
    height: 24px;
  }
`;

const UnitStats = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  
  > div {
    text-align: center;
    flex: 1;
  }
  
  span {
    display: block;
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
  
  small {
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  }
`;

const ProgressBar = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const ProgressTrack = styled.div`
  width: 100%;
  height: 8px;
  background: ${({ theme }) => theme.colors.gray200};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $progress: number }>`
  height: 100%;
  width: ${({ $progress }) => $progress}%;
  background: linear-gradient(90deg, ${({ theme }) => theme.colors.primary}, ${({ theme }) => theme.colors.primaryLight});
  transition: width ${({ theme }) => theme.transitions.normal};
`;

const ProgressText = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing['3xl']};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const UnitsPage: React.FC = () => {
  const [vocabularyData, setVocabularyData] = useState<VocabularyData | null>(null);
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vocabData, stats] = await Promise.all([
        DatabaseService.getVocabularyData(),
        ProgressService.calculateProgressStats('default-user')
      ]);
      
      if (vocabData) {
        setVocabularyData(vocabData);
      }
      
      setProgressStats(stats);
    } catch (error) {
      console.error('加载单元数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState>正在加载单元数据...</LoadingState>;
  }

  if (!vocabularyData) {
    return (
      <Container>
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <h2>暂无词汇数据</h2>
          <p>请检查数据文件是否正确加载</p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader>
        <h1>单元学习</h1>
        <p>选择一个单元开始学习，系统性地掌握每个单元的重点词汇</p>
      </PageHeader>

      <UnitsGrid>
        {vocabularyData.units.map((unit) => {
          // Find unit progress from ProgressStats
          const unitProgress = progressStats?.unitProgress.find(p => p.unitId === unit.id);
          const completionRate = unitProgress?.completionRate || 0;
          const isCompleted = completionRate >= 90;
          const masteredWords = unitProgress?.masteredWords || 0;

          return (
            <UnitCard key={unit.id}>
              <UnitHeader>
                <UnitInfo>
                  <h3>单元 {unit.id}: {unit.name}</h3>
                  <p>{unit.description}</p>
                </UnitInfo>
                <UnitIcon $completed={isCompleted}>
                  {isCompleted ? <CheckCircle /> : <BookOpen />}
                </UnitIcon>
              </UnitHeader>

              <UnitStats>
                <div>
                  <span>{unit.words.length}</span>
                  <small>总词汇</small>
                </div>
                <div>
                  <span>{masteredWords}</span>
                  <small>已掌握</small>
                </div>
                <div>
                  <span>{Math.round(completionRate)}%</span>
                  <small>完成度</small>
                </div>
              </UnitStats>

              <ProgressBar>
                <ProgressText>
                  <span>学习进度</span>
                  <span>{Math.round(completionRate)}%</span>
                </ProgressText>
                <ProgressTrack>
                  <ProgressFill $progress={completionRate} />
                </ProgressTrack>
              </ProgressBar>

              <ActionButtons>
                <Button 
                  as={Link} 
                  to={`/practice/${unit.id}`} 
                  $fullWidth
                  variant={isCompleted ? "secondary" : "primary"}
                >
                  <Play size={16} />
                  {isCompleted ? '复习单元' : '开始学习'}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  style={{ minWidth: '40px', padding: '12px' }}
                  title="查看统计"
                >
                  <BarChart3 size={16} />
                </Button>
              </ActionButtons>
            </UnitCard>
          );
        })}
      </UnitsGrid>

      <div style={{ 
        marginTop: '48px', 
        padding: '24px', 
        background: '#f9fafb', 
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <h3>学习建议</h3>
        <p>
          建议按顺序完成每个单元的学习。每个单元建议学习时间15-20分钟，
          可以根据个人情况调整学习节奏。完成一个单元后，系统会自动安排复习时间。
        </p>
      </div>
    </Container>
  );
};

export default UnitsPage;
