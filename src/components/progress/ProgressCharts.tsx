import React, { useState } from 'react';
import styled from 'styled-components';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, Button } from '../../styles/theme';
import type { ProgressStats } from '../../services/progressService';

const ChartsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    gap: ${({ theme }) => theme.spacing.lg};
  }
`;

const ChartCard = styled(Card)`
  padding: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => theme.spacing.lg};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};

  h3 {
    margin: 0;
    color: ${({ theme }) => theme.colors.textPrimary};
    font-size: ${({ theme }) => theme.fontSizes.xl};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;
    
    h3 {
      font-size: ${({ theme }) => theme.fontSizes.lg};
    }
  }
`;

const TimeFilter = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    gap: ${({ theme }) => theme.spacing.xs};
  }
`;

const FilterButton = styled(Button)<{ $active?: boolean }>`
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

const ChartContainer = styled.div`
  height: 300px;
  width: 100%;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    height: 250px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    height: 200px;
  }
`;

const DoublePieContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

const CustomTooltip = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  box-shadow: ${({ theme }) => theme.shadows.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const MASTERY_COLORS = [
  '#ef4444', // Level 0 - Red
  '#f97316', // Level 1 - Orange
  '#f59e0b', // Level 2 - Amber
  '#84cc16', // Level 3 - Lime
  '#10b981', // Level 4 - Emerald
  '#059669', // Level 5 - Green
];

const PRACTICE_TYPE_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#f59e0b', // Orange
  '#10b981', // Green
  '#ef4444', // Red
];

interface ProgressChartsProps {
  stats: ProgressStats;
}

type TimeFilter = 'daily' | 'weekly' | 'monthly';

const ProgressCharts: React.FC<ProgressChartsProps> = ({ stats }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('daily');

  const getProgressData = () => {
    switch (timeFilter) {
      case 'weekly':
        return stats.weekly.map(item => ({
          period: `第${item.week.split('-').slice(1).join('/')}周`,
          学习词汇: item.wordsLearned,
          准确率: item.accuracy,
          学习时间: item.timeSpent,
          完成练习: item.sessionsCompleted
        }));
      case 'monthly':
        return stats.monthly.map(item => ({
          period: item.month.replace('-', '年') + '月',
          学习词汇: item.wordsLearned,
          准确率: item.accuracy,
          学习时间: item.timeSpent,
          完成练习: item.sessionsCompleted
        }));
      default:
        return stats.daily.map(item => ({
          period: new Date(item.date).toLocaleDateString('zh-CN', { 
            month: '2-digit', 
            day: '2-digit' 
          }),
          学习词汇: item.wordsStudied,
          准确率: item.accuracy,
          学习时间: item.timeSpent,
          完成练习: item.sessionsCompleted
        }));
    }
  };

  const progressData = getProgressData();

  const masteryData = stats.masteryDistribution.map((item, index) => ({
    name: `级别 ${item.level}`,
    value: item.count,
    percentage: item.percentage
  }));

  const practiceTypeData = stats.practiceTypeStats.map((item, index) => ({
    name: item.type === 'flashcard' ? '卡片练习' :
          item.type === 'typing' ? '拼写练习' :
          item.type === 'multipleChoice' ? '选择题' : item.type,
    sessions: item.totalSessions,
    accuracy: item.averageAccuracy,
    avgTime: item.averageTime
  }));

  const CustomProgressTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <CustomTooltip>
          <p><strong>{label}</strong></p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value}
              {entry.dataKey === '准确率' && '%'}
              {entry.dataKey === '学习时间' && '分钟'}
            </p>
          ))}
        </CustomTooltip>
      );
    }
    return null;
  };

  return (
    <ChartsContainer>
      {/* Progress Over Time Chart */}
      <ChartCard>
        <ChartHeader>
          <h3>学习进度趋势</h3>
          <TimeFilter>
            <FilterButton
              variant="outline"
              size="sm"
              $active={timeFilter === 'daily'}
              onClick={() => setTimeFilter('daily')}
            >
              每日
            </FilterButton>
            <FilterButton
              variant="outline"
              size="sm"
              $active={timeFilter === 'weekly'}
              onClick={() => setTimeFilter('weekly')}
            >
              每周
            </FilterButton>
            <FilterButton
              variant="outline"
              size="sm"
              $active={timeFilter === 'monthly'}
              onClick={() => setTimeFilter('monthly')}
            >
              每月
            </FilterButton>
          </TimeFilter>
        </ChartHeader>
        
        <ChartContainer>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="period" 
                stroke="#6b7280"
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomProgressTooltip />} />
              <Legend wrapperStyle={{ fontSize: '14px' }} />
              <Area 
                type="monotone" 
                dataKey="学习词汇" 
                stackId="1"
                stroke="#3b82f6" 
                fill="#3b82f6" 
                fillOpacity={0.3}
              />
              <Area 
                type="monotone" 
                dataKey="完成练习" 
                stackId="2"
                stroke="#10b981" 
                fill="#10b981" 
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </ChartCard>

      {/* Accuracy and Time Chart */}
      <ChartCard>
        <ChartHeader>
          <h3>准确率与学习时间</h3>
        </ChartHeader>
        
        <ChartContainer>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="period" 
                stroke="#6b7280"
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="left"
                stroke="#6b7280"
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                stroke="#6b7280"
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomProgressTooltip />} />
              <Legend wrapperStyle={{ fontSize: '14px' }} />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="准确率" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="学习时间" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </ChartCard>

      {/* Mastery Distribution and Practice Types */}
      <DoublePieContainer>
        <ChartCard>
          <ChartHeader>
            <h3>掌握程度分布</h3>
          </ChartHeader>
          
          <ChartContainer>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={masteryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                  fontSize={12}
                >
                  {masteryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={MASTERY_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </ChartCard>

        <ChartCard>
          <ChartHeader>
            <h3>练习类型统计</h3>
          </ChartHeader>
          
          <ChartContainer>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={practiceTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  stroke="#6b7280"
                  fontSize={12}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="#6b7280"
                  fontSize={12}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    value,
                    name === 'sessions' ? '练习次数' :
                    name === 'accuracy' ? '平均准确率' : name
                  ]}
                />
                <Bar 
                  dataKey="sessions" 
                  fill="#3b82f6" 
                  name="练习次数"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </ChartCard>
      </DoublePieContainer>
    </ChartsContainer>
  );
};

export default ProgressCharts;
