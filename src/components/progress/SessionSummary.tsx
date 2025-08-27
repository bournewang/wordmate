import React from 'react';
import styled, { keyframes } from 'styled-components';
import { 
  Award, 
  TrendingUp, 
  Zap, 
  Target,
  Clock,
  Star,
  Sparkles,
  CheckCircle,
  Trophy,
  Flame
} from 'lucide-react';
import { Card, Button } from '../../styles/theme';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
`;

const sparkle = keyframes`
  0%, 100% {
    transform: scale(0.8) rotate(0deg);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.2) rotate(180deg);
    opacity: 1;
  }
`;

const SummaryContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: ${fadeIn} 0.3s ease-out;
`;

const SummaryCard = styled(Card)`
  max-width: 500px;
  width: 90vw;
  padding: ${({ theme }) => theme.spacing['2xl']};
  text-align: center;
  animation: ${fadeIn} 0.5s ease-out;
  position: relative;
  overflow: hidden;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.xl};
    max-width: 95vw;
  }
`;

const CelebrationIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ $color }) => $color};
  color: ${({ theme }) => theme.colors.white};
  margin: 0 auto ${({ theme }) => theme.spacing.lg};
  animation: ${bounce} 1s ease-in-out;
  
  svg {
    width: 40px;
    height: 40px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    width: 60px;
    height: 60px;
    
    svg {
      width: 30px;
      height: 30px;
    }
  }
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes['3xl']};
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
  }
`;

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    font-size: ${({ theme }) => theme.fontSizes.base};
  }
`;

const AchievementsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

const Achievement = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.gray50};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  animation: ${fadeIn} 0.7s ease-out;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm};
  }
`;

const AchievementIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: ${({ $color }) => $color}20;
  color: ${({ $color }) => $color};
  flex-shrink: 0;
  
  svg {
    width: 20px;
    height: 20px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    width: 35px;
    height: 35px;
    
    svg {
      width: 18px;
      height: 18px;
    }
  }
`;

const AchievementInfo = styled.div`
  flex: 1;
  text-align: left;
  
  h4 {
    font-size: ${({ theme }) => theme.fontSizes.base};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
    color: ${({ theme }) => theme.colors.textPrimary};
    margin-bottom: ${({ theme }) => theme.spacing.xs};
  }
  
  p {
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    h4 {
      font-size: ${({ theme }) => theme.fontSizes.sm};
    }
    
    p {
      font-size: ${({ theme }) => theme.fontSizes.xs};
    }
  }
`;

const LevelUpBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-weight: ${({ theme }) => theme.fontWeights.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  animation: ${sparkle} 2s infinite;
  
  svg {
    width: 16px;
    height: 16px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    
    svg {
      width: 14px;
      height: 14px;
    }
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  justify-content: center;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

export interface SessionSummaryData {
  accuracy: number;
  totalWords: number;
  correctWords: number;
  responseTime: number;
  wordsLeveledUp: string[];
  newAchievements: string[];
  streakMaintained: boolean;
  streakCount: number;
}

interface SessionSummaryProps {
  data: SessionSummaryData;
  onContinue: () => void;
  onViewProgress: () => void;
}

const SessionSummary: React.FC<SessionSummaryProps> = ({ data, onContinue, onViewProgress }) => {
  const getMainIcon = () => {
    if (data.accuracy >= 90) return <Trophy />;
    if (data.accuracy >= 80) return <Award />;
    if (data.accuracy >= 70) return <Target />;
    return <Zap />;
  };

  const getMainColor = () => {
    if (data.accuracy >= 90) return '#f59e0b'; // Gold
    if (data.accuracy >= 80) return '#10b981'; // Green
    if (data.accuracy >= 70) return '#3b82f6'; // Blue
    return '#8b5cf6'; // Purple
  };

  const getEncouragementMessage = () => {
    if (data.accuracy >= 95) return "完美表现！你真是太棒了！🏆";
    if (data.accuracy >= 85) return "出色的表现！继续保持！🌟";
    if (data.accuracy >= 75) return "很好！你正在进步！📈";
    if (data.accuracy >= 60) return "不错的开始，继续努力！💪";
    return "每一次练习都是进步，坚持下去！🚀";
  };

  const achievements = [
    {
      icon: <CheckCircle />,
      color: '#10b981',
      title: `${data.correctWords}/${data.totalWords} 正确`,
      description: `准确率 ${data.accuracy.toFixed(1)}%`
    },
    {
      icon: <Clock />,
      color: '#3b82f6',
      title: `${data.responseTime.toFixed(1)}s 平均`,
      description: '响应时间'
    },
    ...(data.streakMaintained ? [{
      icon: <Flame />,
      color: '#f59e0b',
      title: `${data.streakCount} 天连续`,
      description: '学习打卡'
    }] : []),
    ...(data.wordsLeveledUp.length > 0 ? [{
      icon: <TrendingUp />,
      color: '#8b5cf6',
      title: `${data.wordsLeveledUp.length} 个词汇`,
      description: '等级提升'
    }] : [])
  ];

  return (
    <SummaryContainer onClick={(e) => e.target === e.currentTarget && onContinue()}>
      <SummaryCard>
        <CelebrationIcon $color={getMainColor()}>
          {getMainIcon()}
        </CelebrationIcon>
        
        <Title>🎉 练习完成！</Title>
        <Subtitle>{getEncouragementMessage()}</Subtitle>

        {data.wordsLeveledUp.length > 0 && (
          <LevelUpBadge>
            <Sparkles />
            有 {data.wordsLeveledUp.length} 个词汇升级了！
          </LevelUpBadge>
        )}

        <AchievementsGrid>
          {achievements.map((achievement, index) => (
            <Achievement key={index}>
              <AchievementIcon $color={achievement.color}>
                {achievement.icon}
              </AchievementIcon>
              <AchievementInfo>
                <h4>{achievement.title}</h4>
                <p>{achievement.description}</p>
              </AchievementInfo>
            </Achievement>
          ))}
        </AchievementsGrid>

        <ActionButtons>
          <Button variant="primary" onClick={onContinue}>
            继续练习
          </Button>
          <Button variant="outline" onClick={onViewProgress}>
            <Star size={16} />
            查看进度
          </Button>
        </ActionButtons>
      </SummaryCard>
    </SummaryContainer>
  );
};

export default SessionSummary;
