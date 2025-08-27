import React from 'react';
import styled from 'styled-components';
import { 
  BookOpen, 
  TrendingUp, 
  Star
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


interface ProgressStatsCardProps {
  stats: ProgressStats['overall'];
}

const ProgressStatsCard: React.FC<ProgressStatsCardProps> = ({ stats }) => {

  return (
    <>
      {/* Level-based Progress Cards */}
      {/* <StatsGrid>
        <StatCard>
          <StatIcon $color="#ef4444">
            <Clock />
          </StatIcon>
          <StatInfo>
            <h3>{stats.newWords.toLocaleString()}</h3>
            <p>🔴 新词汇 (Level 0)</p>
          </StatInfo>
        </StatCard>

        <StatCard>
          <StatIcon $color="#f97316">
            <Zap />
          </StatIcon>
          <StatInfo>
            <h3>{stats.attemptedWords.toLocaleString()}</h3>
            <p>🟠 已尝试 (Level 1)</p>
          </StatInfo>
        </StatCard>

        <StatCard>
          <StatIcon $color="#f59e0b">
            <Brain />
          </StatIcon>
          <StatInfo>
            <h3>{stats.learningWords.toLocaleString()}</h3>
            <p>🟡 学习中 (Level 2)</p>
          </StatInfo>
        </StatCard>

        <StatCard>
          <StatIcon $color="#84cc16">
            <Users />
          </StatIcon>
          <StatInfo>
            <h3>{stats.familiarWords.toLocaleString()}</h3>
            <p>🟢 熟悉 (Level 3)</p>
          </StatInfo>
        </StatCard>

        <StatCard>
          <StatIcon $color="#10b981">
            <Award />
          </StatIcon>
          <StatInfo>
            <h3>{stats.masteredWords.toLocaleString()}</h3>
            <p>🔵 掌握 (Level 4)</p>
            <ProgressBar>
              <ProgressFill 
                $percentage={stats.masteryRate} 
                $color="#10b981"
              />
            </ProgressBar>
          </StatInfo>
        </StatCard>

        <StatCard>
          <StatIcon $color="#8b5cf6">
            <Sparkles />
          </StatIcon>
          <StatInfo>
            <h3>{stats.expertWords.toLocaleString()}</h3>
            <p>🟣 专家 (Level 5)</p>
          </StatInfo>
        </StatCard>
      </StatsGrid> */}

      {/* Recent Progress Cards */}
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
          <StatIcon $color="#06b6d4">
            <Star />
          </StatIcon>
          <StatInfo>
            <h3>{stats.wordsAttemptedToday.toLocaleString()}</h3>
            <p>今日练习词汇</p>
          </StatInfo>
        </StatCard>

        <StatCard>
          <StatIcon $color="#8b5cf6">
            <TrendingUp />
          </StatIcon>
          <StatInfo>
            <h3>{stats.wordsImprovedThisWeek.toLocaleString()}</h3>
            <p>本周进步词汇</p>
          </StatInfo>
        </StatCard>

        {/* <StatCard>
          <StatIcon $color={getTrendColor()}>
            {getTrendIcon()}
          </StatIcon>
          <StatInfo>
            <h3>{stats.currentAccuracy.toFixed(1)}%</h3>
            <p>当前准确率 
              {stats.improvementTrend === 'improving' && ' 📈'}
              {stats.improvementTrend === 'declining' && ' 📉'}
              {stats.improvementTrend === 'stable' && ' ➡️'}
            </p>
          </StatInfo>
        </StatCard> */}

        {/* <StatCard>
          <StatIcon $color={masteryLevelColor}>
            <Brain />
          </StatIcon>
          <StatInfo>
            <h3>{formatMasteryLevel(stats.averageMasteryLevel)}</h3>
            <p>平均掌握水平</p>
            <ProgressBar>
              <ProgressFill 
                $percentage={(stats.averageMasteryLevel / 5) * 100} 
                $color={masteryLevelColor}
              />
            </ProgressBar>
          </StatInfo>
        </StatCard> */}

        {/* <StatCard>
          <StatIcon $color="#10b981">
            <Award />
          </StatIcon>
          <StatInfo>
            <h3>{stats.masteryRate.toFixed(1)}%</h3>
            <p>整体掌握率</p>
            <ProgressBar>
              <ProgressFill 
                $percentage={stats.masteryRate} 
                $color="#10b981"
              />
            </ProgressBar>
          </StatInfo>
        </StatCard> */}
      </StatsGrid>
    </>
  );
};

export default ProgressStatsCard;
