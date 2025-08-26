import React from 'react';
import styled from 'styled-components';
import { 
  BookOpen, 
  Award, 
  TrendingUp, 
  Clock,
  Target,
  Brain
} from 'lucide-react';
import { Card } from '../../styles/theme';
import type { ProgressStats } from '../../services/progressService';

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.md};
  }
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

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => theme.spacing.lg};
    gap: ${({ theme }) => theme.spacing.md};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.md};
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

const StatIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ $color }) => $color};
  color: ${({ theme }) => theme.colors.white};
  flex-shrink: 0;
  
  svg {
    width: 28px;
    height: 28px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    width: 50px;
    height: 50px;
    
    svg {
      width: 24px;
      height: 24px;
    }
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    width: 45px;
    height: 45px;
    
    svg {
      width: 22px;
      height: 22px;
    }
  }
`;

const StatInfo = styled.div`
  flex: 1;
  min-width: 0; // Prevents flex item from overflowing
  
  h3 {
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
    color: ${({ theme }) => theme.colors.textPrimary};
    margin-bottom: ${({ theme }) => theme.spacing.xs};
    line-height: 1.2;
  }
  
  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.base};
    line-height: 1.3;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    h3 {
      font-size: ${({ theme }) => theme.fontSizes.xl};
    }
    
    p {
      font-size: ${({ theme }) => theme.fontSizes.sm};
    }
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    h3 {
      font-size: ${({ theme }) => theme.fontSizes.lg};
    }
    
    p {
      font-size: ${({ theme }) => theme.fontSizes.xs};
    }
  }
`;

const ProgressBar = styled.div`
  margin-top: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  height: 6px;
  background: ${({ theme }) => theme.colors.gray200};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  overflow: hidden;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    height: 4px;
  }
`;

const ProgressFill = styled.div<{ $percentage: number; $color: string }>`
  height: 100%;
  width: ${({ $percentage }) => $percentage}%;
  background: ${({ $color }) => $color};
  transition: width ${({ theme }) => theme.transitions.normal};
  border-radius: ${({ theme }) => theme.borderRadius.full};
`;

interface ProgressStatsCardProps {
  stats: ProgressStats['overall'];
}

const ProgressStatsCard: React.FC<ProgressStatsCardProps> = ({ stats }) => {
  const formatMasteryLevel = (level: number): string => {
    return level.toFixed(1);
  };

  const getMasteryLevelColor = (level: number): string => {
    if (level >= 4) return '#10b981'; // Green for mastered
    if (level >= 2) return '#f59e0b'; // Orange for learning
    return '#ef4444'; // Red for new/difficult
  };

  const masteryLevelColor = getMasteryLevelColor(stats.averageMasteryLevel);

  return (
    <StatsGrid>
      <StatCard>
        <StatIcon $color="#3b82f6">
          <BookOpen />
        </StatIcon>
        <StatInfo>
          <h3>{stats.totalWords.toLocaleString()}</h3>
          <p>总词汇量</p>
        </StatInfo>
      </StatCard>

      <StatCard>
        <StatIcon $color="#10b981">
          <Award />
        </StatIcon>
        <StatInfo>
          <h3>{stats.masteredWords.toLocaleString()}</h3>
          <p>已掌握词汇</p>
          <ProgressBar>
            <ProgressFill 
              $percentage={stats.masteryRate} 
              $color="#10b981"
            />
          </ProgressBar>
        </StatInfo>
      </StatCard>

      <StatCard>
        <StatIcon $color="#f59e0b">
          <TrendingUp />
        </StatIcon>
        <StatInfo>
          <h3>{stats.masteryRate.toFixed(1)}%</h3>
          <p>掌握率</p>
        </StatInfo>
      </StatCard>

      <StatCard>
        <StatIcon $color="#ef4444">
          <Target />
        </StatIcon>
        <StatInfo>
          <h3>{stats.learningWords.toLocaleString()}</h3>
          <p>学习中的词汇</p>
        </StatInfo>
      </StatCard>

      <StatCard>
        <StatIcon $color="#8b5cf6">
          <Brain />
        </StatIcon>
        <StatInfo>
          <h3>{formatMasteryLevel(stats.averageMasteryLevel)}</h3>
          <p>平均掌握程度</p>
          <ProgressBar>
            <ProgressFill 
              $percentage={(stats.averageMasteryLevel / 5) * 100} 
              $color={masteryLevelColor}
            />
          </ProgressBar>
        </StatInfo>
      </StatCard>

      <StatCard>
        <StatIcon $color="#64748b">
          <Clock />
        </StatIcon>
        <StatInfo>
          <h3>{stats.newWords.toLocaleString()}</h3>
          <p>新词汇</p>
        </StatInfo>
      </StatCard>
    </StatsGrid>
  );
};

export default ProgressStatsCard;
