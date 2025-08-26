import React, { useState } from 'react';
import styled from 'styled-components';
import { 
  BookOpen, 
  Award, 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  Users,
  Target,
  BarChart
} from 'lucide-react';
import { Card, Button } from '../../styles/theme';
import type { ProgressStats } from '../../services/progressService';

const Container = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const UnitCard = styled(Card)`
  padding: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => theme.spacing.lg};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};

  h3 {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
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

const ViewToggle = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    gap: ${({ theme }) => theme.spacing.xs};
  }
`;

const ToggleButton = styled(Button)<{ $active?: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  
  ${({ $active, theme }) => $active && `
    background: ${theme.colors.primary};
    color: ${theme.colors.white};
  `}

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  }
`;

const UnitsGrid = styled.div<{ $viewMode: string }>`
  display: grid;
  grid-template-columns: ${({ $viewMode }) => 
    $viewMode === 'compact' ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr'};
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: ${({ $viewMode }) => 
      $viewMode === 'compact' ? 'repeat(auto-fit, minmax(180px, 1fr))' : '1fr'};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`;

const UnitItem = styled.div<{ $viewMode: string }>`
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.gray50};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  transition: all ${({ theme }) => theme.transitions.normal};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.white};
    box-shadow: ${({ theme }) => theme.shadows.md};
    transform: translateY(-2px);
  }

  ${({ $viewMode }) => $viewMode === 'detailed' && `
    display: flex;
    align-items: center;
    gap: 24px;
    
    @media (max-width: 640px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }
  `}

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const UnitHeader = styled.div<{ $viewMode: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ $viewMode }) => $viewMode === 'compact' ? '12px' : '8px'};

  ${({ $viewMode }) => $viewMode === 'detailed' && `
    flex: 1;
    margin-bottom: 0;
  `}

  h4 {
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
    color: ${({ theme }) => theme.colors.textPrimary};
    margin: 0;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    h4 {
      font-size: ${({ theme }) => theme.fontSizes.base};
    }
  }
`;

const UnitIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: ${({ $color }) => $color}20;
  color: ${({ $color }) => $color};
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    width: 35px;
    height: 35px;
    
    svg {
      width: 18px;
      height: 18px;
    }
  }
`;

const CompletionBadge = styled.span<{ $percentage: number }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  background: ${({ $percentage, theme }) => 
    $percentage >= 80 ? theme.colors.success :
    $percentage >= 50 ? theme.colors.warning : theme.colors.error
  }20;
  color: ${({ $percentage, theme }) => 
    $percentage >= 80 ? theme.colors.success :
    $percentage >= 50 ? theme.colors.warning : theme.colors.error
  };
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: ${({ theme }) => theme.fontWeights.medium};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: 2px ${({ theme }) => theme.spacing.xs};
    font-size: 10px;
  }
`;

const UnitStats = styled.div<{ $viewMode: string }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  
  ${({ $viewMode }) => $viewMode === 'compact' && `
    flex-direction: column;
    gap: 8px;
  `}

  ${({ $viewMode }) => $viewMode === 'detailed' && `
    align-items: center;
    min-width: 0;
  `}

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

const StatItem = styled.div<{ $viewMode: string }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  
  ${({ $viewMode }) => $viewMode === 'compact' && `
    justify-content: space-between;
  `}

  span {
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  }

  strong {
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: ${({ theme }) => theme.fontWeights.medium};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    span, strong {
      font-size: ${({ theme }) => theme.fontSizes.xs};
    }
  }
`;

const ProgressBar = styled.div<{ $viewMode: string }>`
  margin-top: ${({ $viewMode }) => $viewMode === 'compact' ? '12px' : '8px'};
  width: 100%;
  height: 6px;
  background: ${({ theme }) => theme.colors.gray200};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  overflow: hidden;

  ${({ $viewMode }) => $viewMode === 'detailed' && `
    margin-top: 0;
    max-width: 120px;
  `}

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    height: 4px;
    
    ${({ $viewMode }) => $viewMode === 'detailed' && `
      max-width: 100px;
    `}
  }
`;

const ProgressFill = styled.div<{ $percentage: number }>`
  height: 100%;
  width: ${({ $percentage }) => $percentage}%;
  background: ${({ $percentage, theme }) => 
    $percentage >= 80 ? theme.colors.success :
    $percentage >= 50 ? theme.colors.warning : theme.colors.error
  };
  transition: width ${({ theme }) => theme.transitions.normal};
  border-radius: ${({ theme }) => theme.borderRadius.full};
`;

interface UnitProgressOverviewProps {
  unitProgress: ProgressStats['unitProgress'];
}

type ViewMode = 'compact' | 'detailed';

const UnitProgressOverview: React.FC<UnitProgressOverviewProps> = ({ unitProgress }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [showAll, setShowAll] = useState(false);

  const sortedUnits = [...unitProgress].sort((a, b) => b.completionRate - a.completionRate);
  const displayedUnits = showAll ? sortedUnits : sortedUnits.slice(0, 6);

  const getUnitColor = (completionRate: number): string => {
    if (completionRate >= 80) return '#10b981';
    if (completionRate >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (unitProgress.length === 0) {
    return (
      <Container>
        <UnitCard>
          <CardHeader>
            <h3>
              <BookOpen size={20} />
              单元学习进度
            </h3>
          </CardHeader>
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280' }}>
            <BookOpen size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>暂无单元学习数据</p>
          </div>
        </UnitCard>
      </Container>
    );
  }

  return (
    <Container>
      <UnitCard>
        <CardHeader>
          <h3>
            <BookOpen size={20} />
            单元学习进度
          </h3>
          <ViewToggle>
            <ToggleButton
              variant="outline"
              size="sm"
              $active={viewMode === 'compact'}
              onClick={() => setViewMode('compact')}
            >
              紧凑视图
            </ToggleButton>
            <ToggleButton
              variant="outline"
              size="sm"
              $active={viewMode === 'detailed'}
              onClick={() => setViewMode('detailed')}
            >
              详细视图
            </ToggleButton>
          </ViewToggle>
        </CardHeader>

        <UnitsGrid $viewMode={viewMode}>
          {displayedUnits.map((unit) => {
            const unitColor = getUnitColor(unit.completionRate);
            
            return (
              <UnitItem key={unit.unitId} $viewMode={viewMode}>
                <UnitHeader $viewMode={viewMode}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <UnitIcon $color={unitColor}>
                      <BookOpen size={20} />
                    </UnitIcon>
                    <div>
                      <h4>{unit.unitName}</h4>
                      {viewMode === 'detailed' && (
                        <p style={{ 
                          margin: 0, 
                          fontSize: '14px', 
                          color: '#6b7280' 
                        }}>
                          共 {unit.totalWords} 个词汇
                        </p>
                      )}
                    </div>
                  </div>
                  <CompletionBadge $percentage={unit.completionRate}>
                    <Award size={12} />
                    {unit.completionRate.toFixed(0)}%
                  </CompletionBadge>
                </UnitHeader>

                <UnitStats $viewMode={viewMode}>
                  <StatItem $viewMode={viewMode}>
                    <Target size={16} style={{ color: unitColor }} />
                    <span>已掌握:</span>
                    <strong>{unit.masteredWords}/{unit.totalWords}</strong>
                  </StatItem>
                  
                  {viewMode === 'detailed' && (
                    <StatItem $viewMode={viewMode}>
                      <BarChart size={16} style={{ color: '#6b7280' }} />
                      <span>平均程度:</span>
                      <strong>{unit.averageMasteryLevel.toFixed(1)}</strong>
                    </StatItem>
                  )}
                </UnitStats>

                <ProgressBar $viewMode={viewMode}>
                  <ProgressFill $percentage={unit.completionRate} />
                </ProgressBar>
              </UnitItem>
            );
          })}
        </UnitsGrid>

        {sortedUnits.length > 6 && (
          <div style={{ 
            textAlign: 'center', 
            marginTop: '24px' 
          }}>
            <Button 
              variant="outline" 
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showAll ? '收起' : `查看更多 (${sortedUnits.length - 6})`}
            </Button>
          </div>
        )}
      </UnitCard>
    </Container>
  );
};

export default UnitProgressOverview;
