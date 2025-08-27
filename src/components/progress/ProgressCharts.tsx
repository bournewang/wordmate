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
    font-size: ${({ theme }) => theme.fontSizes.sm};
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
  box-shadow: ${({ theme }) => theme.shadows.lg};
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


interface ProgressChartsProps {
  stats: ProgressStats;
}

type TimeFilter = 'daily' | 'weekly' | 'monthly' | 'sessions';

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

  const getMasteryLevelName = (level: number) => {
    switch (level) {
      case 0: return '新词汇';
      case 1: return '初步接触';
      case 2: return '正在学习';
      case 3: return '比较熟悉';
      case 4: return '基本掌握';
      case 5: return '完全掌握';
      default: return `级别 ${level}`;
    }
  };

  const masteryData = stats.masteryDistribution.map((item) => ({
    name: getMasteryLevelName(item.level),
    value: item.count,
    percentage: item.percentage
  }));

  const practiceTypeData = stats.practiceTypeStats.map((item) => ({
    name: item.type === 'flashcard' ? '卡片练习' :
          item.type === 'typing' ? '拼写练习' :
          item.type === 'multipleChoice' ? '选择题' : item.type,
    sessions: item.totalSessions,
    accuracy: item.averageAccuracy,
    avgTime: item.averageTime
  }));

  const CustomProgressTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; dataKey: string; value: unknown }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <CustomTooltip>
          <p><strong>{label}</strong></p>
          {payload.map((entry, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey}: {String(entry.value)}
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

      {/* Individual Sessions Chart */}
      <ChartCard>
        <ChartHeader>
          <h3>个人练习记录 (最近50次)</h3>
        </ChartHeader>
        
        <ChartContainer>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={stats.sessions.map((session, index) => ({
                session: `#${stats.sessions.length - index}`,
                准确率: session.accuracy,
                学习时间: session.timeSpent,
                学习词汇: session.wordsStudied,
                练习类型: session.practiceType === 'flashcard' ? '卡片练习' :
                         session.practiceType === 'typing' ? '拼写练习' :
                         session.practiceType === 'multipleChoice' ? '选择题' : session.practiceType,
                时间: new Date(session.startTime).toLocaleDateString('zh-CN', { 
                  month: '2-digit', 
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              })).reverse()}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="session" 
                stroke="#6b7280"
                fontSize={12}
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                yAxisId="left"
                stroke="#6b7280"
                fontSize={12}
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
                label={{ value: '准确率 (%)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                stroke="#6b7280"
                fontSize={12}
                tick={{ fontSize: 12 }}
                label={{ value: '学习时间 (分钟)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip 
                content={({ active, payload, label }: { active?: boolean; payload?: Array<{ payload?: Record<string, unknown> }>; label?: string | number }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    return (
                      <CustomTooltip>
                        <p><strong>{label}</strong></p>
                        <p>时间: {data?.时间 as string}</p>
                        <p>练习类型: {data?.练习类型 as string}</p>
                        <p style={{ color: '#f59e0b' }}>准确率: {data?.准确率 as number}%</p>
                        <p style={{ color: '#8b5cf6' }}>学习时间: {data?.学习时间 as number}分钟</p>
                        <p style={{ color: '#10b981' }}>学习词汇: {data?.学习词汇 as number}个</p>
                      </CustomTooltip>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '14px' }} />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="准确率" 
                stroke="#f59e0b" 
                strokeWidth={3}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: '#f59e0b', strokeWidth: 2 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="学习时间" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2 }}
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
                  {masteryData.map((_, index) => (
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
                  formatter={(value: unknown, name: string) => [
                    String(value),
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
