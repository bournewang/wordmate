import React from 'react';
import styled from 'styled-components';
import { 
  Flame, 
  TrendingDown, 
  Calendar,
  Target
} from 'lucide-react';
import { Card } from '../../styles/theme';
import type { ProgressStats } from '../../services/progressService';

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.lg};
  }
`;

const StreakCard = styled(Card)`
  padding: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.lg};
  }
`;

const WeakWordsCard = styled(Card)`
  padding: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.lg};
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  h3 {
    margin: 0;
    color: ${({ theme }) => theme.colors.textPrimary};
    font-size: ${({ theme }) => theme.fontSizes.xl};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    h3 {
      font-size: ${({ theme }) => theme.fontSizes.lg};
    }
  }
`;

const IconWrapper = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: ${({ $color }) => $color};
  color: ${({ theme }) => theme.colors.white};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    width: 35px;
    height: 35px;
    
    svg {
      width: 18px;
      height: 18px;
    }
  }
`;

const StreakStats = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    gap: ${({ theme }) => theme.spacing.lg};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

const StreakStat = styled.div`
  text-align: center;

  h4 {
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
    color: ${({ theme }) => theme.colors.textPrimary};
    margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
  }

  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    h4 {
      font-size: ${({ theme }) => theme.fontSizes.xl};
    }
    
    p {
      font-size: ${({ theme }) => theme.fontSizes.xs};
    }
  }
`;

const StreakCalendar = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    gap: 2px;
  }
`;

const DayCell = styled.div<{ $active: boolean; $isToday?: boolean }>`
  width: 100%;
  aspect-ratio: 1;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ $active, theme }) => 
    $active ? theme.colors.success : theme.colors.gray100
  };
  
  ${({ $isToday, theme }) => $isToday && `
    border-color: ${theme.colors.primary};
    border-width: 2px;
  `}

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    border-radius: 2px;
  }
`;

const WeekLabels = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: ${({ theme }) => theme.spacing.xs};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  text-align: center;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    gap: 2px;
    font-size: 10px;
  }
`;

const WeakWordsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  max-height: 400px;
  overflow-y: auto;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    gap: ${({ theme }) => theme.spacing.sm};
    max-height: 300px;
  }
`;

const WeakWordItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.gray50};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.gray100};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.sm};
    flex-direction: column;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.xs};
  }
`;

const WordInfo = styled.div`
  flex: 1;

  h4 {
    font-size: ${({ theme }) => theme.fontSizes.base};
    font-weight: ${({ theme }) => theme.fontWeights.medium};
    color: ${({ theme }) => theme.colors.textPrimary};
    margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
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

const WeakWordStats = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  align-items: center;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    gap: ${({ theme }) => theme.spacing.md};
    width: 100%;
    justify-content: space-between;
  }
`;

const StatBadge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  background: ${({ $color }) => $color}20;
  color: ${({ $color }) => $color};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};

  svg {
    width: 12px;
    height: 12px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: 2px ${({ theme }) => theme.spacing.xs};
    font-size: 10px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.textMuted};
  
  svg {
    margin-bottom: ${({ theme }) => theme.spacing.md};
    opacity: 0.5;
  }
`;

interface StreakAndWeakWordsProps {
  streakData: ProgressStats['streakData'];
  weakWords: ProgressStats['weakWords'];
}

const StreakAndWeakWords: React.FC<StreakAndWeakWordsProps> = ({ streakData, weakWords }) => {
  const today = new Date().toISOString().split('T')[0];
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <Container>
      <StreakCard>
        <CardHeader>
          <IconWrapper $color="#f59e0b">
            <Flame size={20} />
          </IconWrapper>
          <h3>学习连续性</h3>
        </CardHeader>

        <StreakStats>
          <StreakStat>
            <h4>{streakData.currentStreak}</h4>
            <p>当前连续天数</p>
          </StreakStat>
          <StreakStat>
            <h4>{streakData.maxStreak}</h4>
            <p>最长连续天数</p>
          </StreakStat>
        </StreakStats>

        <WeekLabels>
          {weekdays.map(day => (
            <div key={day}>{day}</div>
          ))}
        </WeekLabels>

        <StreakCalendar>
          {streakData.streakHistory.map((day) => (
            <DayCell
              key={day.date}
              $active={day.active}
              $isToday={day.date === today}
              title={`${day.date} ${day.active ? '已学习' : '未学习'}`}
            />
          ))}
        </StreakCalendar>
      </StreakCard>

      <WeakWordsCard>
        <CardHeader>
          <IconWrapper $color="#ef4444">
            <TrendingDown size={20} />
          </IconWrapper>
          <h3>需要加强的词汇</h3>
        </CardHeader>

        {weakWords.length === 0 ? (
          <EmptyState>
            <Target size={48} />
            <p>太棒了！暂时没有需要特别加强的词汇</p>
          </EmptyState>
        ) : (
          <WeakWordsList>
            {weakWords.map((item) => (
              <WeakWordItem key={item.word.id}>
                <WordInfo>
                  <h4>{item.word.word}</h4>
                  <p>{item.word.definition}</p>
                </WordInfo>
                <WeakWordStats>
                  <StatBadge $color="#ef4444">
                    <Target />
                    {item.accuracy.toFixed(1)}%
                  </StatBadge>
                  <StatBadge $color="#6b7280">
                    <Calendar />
                    {item.attempts}次
                  </StatBadge>
                </WeakWordStats>
              </WeakWordItem>
            ))}
          </WeakWordsList>
        )}
      </WeakWordsCard>
    </Container>
  );
};

export default StreakAndWeakWords;
