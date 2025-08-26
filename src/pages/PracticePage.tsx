import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Play, Book, Target, Settings, ArrowRight } from 'lucide-react';
import type { Word, PracticeType } from '../types';
import { DatabaseService } from '../services/database';
import { SpacedRepetitionService } from '../services/spacedRepetition';
import { PracticeSessionManager } from '../components/practice/PracticeSessionManager';

const PracticeContainer = styled.div`
  min-height: 100vh;
  background: ${props => props.theme.colors.background};
  padding: 2rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 1rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 0.5rem;
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 3rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    margin-bottom: 2rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    margin-bottom: 1.5rem;
  }
`;

const Title = styled.h1`
  color: ${props => props.theme.colors.text};
  font-size: 2.5rem;
  margin: 0 0 1rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 2rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 1.75rem;
    margin: 0 0 0.5rem;
  }
`;

const Subtitle = styled.p`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 1.1rem;
  margin: 0;
  padding: 0 1rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 1rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 0.9rem;
    padding: 0 0.5rem;
  }
`;

const ModeSelector = styled.div`
  max-width: 800px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
`;

const ModeCard = styled(motion.div)<{ $featured?: boolean }>`
  background: ${props => props.$featured 
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    : props.theme.colors.background
  };
  color: ${props => props.$featured ? 'white' : props.theme.colors.text};
  border: 2px solid ${props => props.$featured 
    ? 'transparent'
    : props.theme.colors.border
  };
  border-radius: 16px;
  padding: 2rem;
  cursor: pointer;
  text-align: center;
  position: relative;
  overflow: hidden;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 1.5rem;
    border-radius: 12px;
    
    &:hover {
      transform: translateY(-2px);
    }
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 1.25rem;
    border-radius: 8px;
    
    &:hover {
      transform: none;
    }
  }
`;

const ModeIcon = styled.div`
  width: 60px;
  height: 60px;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    width: 50px;
    height: 50px;
    margin: 0 auto 0.75rem;
    border-radius: 10px;
    
    svg {
      width: 26px;
      height: 26px;
    }
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    width: 45px;
    height: 45px;
    margin: 0 auto 0.5rem;
    border-radius: 8px;
    
    svg {
      width: 24px;
      height: 24px;
    }
  }
`;

const ModeTitle = styled.h3`
  font-size: 1.5rem;
  margin: 0 0 0.5rem;
  font-weight: 600;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 1.25rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 1.125rem;
    margin: 0 0 0.25rem;
  }
`;

const ModeDescription = styled.p`
  opacity: 0.9;
  margin: 0 0 1.5rem;
  line-height: 1.5;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 0.9rem;
    margin: 0 0 1.25rem;
    line-height: 1.4;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 0.85rem;
    margin: 0 0 1rem;
    line-height: 1.35;
  }
`;

const ModeStats = styled.div`
  display: flex;
  justify-content: space-around;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
  }
`;

const StatItem = styled.div`
  text-align: center;
  flex: 1;
`;

const StatValue = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 1.1rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 1rem;
    margin-bottom: 0.125rem;
  }
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  opacity: 0.8;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 0.75rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 0.7rem;
  }
`;

const QuickStartSection = styled.div`
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
`;

const SectionTitle = styled.h2`
  color: ${props => props.theme.colors.text};
  margin: 0 0 1.5rem;
`;

const QuickStartCard = styled(motion.div)`
  background: ${props => props.theme.colors.secondary};
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 1rem;
`;

const StartButton = styled(motion.button)`
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 12px;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem auto 0;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const LoadingMessage = styled.div`
  text-align: center;
  color: ${props => props.theme.colors.textSecondary};
  padding: 2rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 1.5rem;
    font-size: 0.9rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 1rem;
    font-size: 0.85rem;
  }
`;

interface PracticeMode {
  type: PracticeType;
  title: string;
  description: string;
  icon: React.ReactNode;
  featured?: boolean;
}

const PRACTICE_MODES: PracticeMode[] = [
  {
    type: 'flashcard',
    title: '闪卡记忆',
    description: '经典的单词卡片，帮助你建立单词与释义的联系',
    icon: <Book size={32} />
  },
  {
    type: 'multipleChoice',
    title: '选择题',
    description: '从多个选项中选择正确答案，加深记忆印象',
    icon: <Target size={32} />
  },
  {
    type: 'typing',
    title: '拼写练习',
    description: '根据中文释义输入英文单词，提高拼写能力',
    icon: <Settings size={32} />
  }
];

const PracticePage: React.FC = () => {
  const { unitId } = useParams<{ unitId: string }>();
  const [selectedMode, setSelectedMode] = useState<PracticeType | null>(null);
  const [practiceWords, setPracticeWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [showPracticeSession, setShowPracticeSession] = useState(false);

  // Load initial data and recommendations
  useEffect(() => {
    const loadPracticeData = async () => {
      setIsLoading(true);
      try {
        // Get words for the specific unit if unitId is provided
        const allWords = unitId 
          ? await DatabaseService.getWordsByUnit(unitId)
          : await DatabaseService.getWordsForPractice();
        
        if (allWords.length === 0) {
          console.log('No words found, initializing vocabulary...');
          await DatabaseService.initializeVocabulary();
          const wordsAfterInit = await DatabaseService.getWordsForPractice();
          const recs = SpacedRepetitionService.getStudyRecommendations(wordsAfterInit);
          setRecommendations(recs);
          
          // Use DatabaseService method for consistency
          const reviewWords = await DatabaseService.getWordsForReview(20);
          setPracticeWords(reviewWords);
        } else {
          const recs = SpacedRepetitionService.getStudyRecommendations(allWords);
          setRecommendations(recs);
          
          // Use DatabaseService method for consistency
          const reviewWords = unitId 
            ? allWords.slice(0, 20) // For specific units, just take first 20
            : await DatabaseService.getWordsForReview(20); // For general, use review logic
          setPracticeWords(reviewWords);
        }
      } catch (error) {
        console.error('Failed to load practice data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPracticeData();
  }, [unitId]);

  const handleModeSelect = async (mode: PracticeType) => {
    setSelectedMode(mode);
    setIsLoading(true);
    
    try {
      // Use DatabaseService to get words for review directly (it handles null nextReview values correctly)
      const wordsToUse = unitId 
        ? (await DatabaseService.getWordsByUnit(unitId)).slice(0, 15) // For specific units, just take first 15
        : await DatabaseService.getWordsForReview(15); // For general practice, use review logic
      
      if (wordsToUse.length === 0) {
        alert('没有需要复习的单词，请先学习一些单词！');
        setIsLoading(false);
        return;
      }
      
      setPracticeWords(wordsToUse);
      setShowPracticeSession(true);
    } catch (error) {
      console.error('Failed to start practice:', error);
      alert('启动练习失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePracticeComplete = (results: any) => {
    console.log('Practice completed with results:', results);
    setShowPracticeSession(false);
    setSelectedMode(null);
    // Could show a completion screen here
  };

  const handleExitPractice = () => {
    setShowPracticeSession(false);
    setSelectedMode(null);
  };

  if (showPracticeSession && selectedMode) {
    return (
      <PracticeSessionManager
        words={practiceWords}
        initialPracticeType={selectedMode}
        onExit={handleExitPractice}
        onComplete={handlePracticeComplete}
      />
    );
  }

  if (isLoading && !recommendations) {
    return (
      <PracticeContainer>
        <LoadingMessage>
          正在加载练习数据...
        </LoadingMessage>
      </PracticeContainer>
    );
  }

  return (
    <PracticeContainer>
      <Header>
        <Title>开始练习{unitId ? ` - 单元 ${unitId}` : ''}</Title>
        <Subtitle>选择适合你的练习方式，提升词汇掌握水平</Subtitle>
      </Header>

      <ModeSelector>
        {PRACTICE_MODES.map((mode) => (
          <ModeCard
            key={mode.type}
            $featured={mode.featured}
            onClick={() => handleModeSelect(mode.type)}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            animate={{
              scale: selectedMode === mode.type ? 1.02 : 1,
              boxShadow: selectedMode === mode.type 
                ? '0 8px 32px rgba(0, 0, 0, 0.15)' 
                : '0 0 0 rgba(0, 0, 0, 0)'
            }}
          >
            <ModeIcon>{mode.icon}</ModeIcon>
            <ModeTitle>{mode.title}</ModeTitle>
            <ModeDescription>{mode.description}</ModeDescription>
            
            {recommendations && (
              <ModeStats>
                <StatItem>
                  <StatValue>{recommendations.reviewWords}</StatValue>
                  <StatLabel>待复习</StatLabel>
                </StatItem>
                <StatItem>
                  <StatValue>{recommendations.newWords}</StatValue>
                  <StatLabel>新单词</StatLabel>
                </StatItem>
                <StatItem>
                  <StatValue>{recommendations.dailyGoal}</StatValue>
                  <StatLabel>建议目标</StatLabel>
                </StatItem>
              </ModeStats>
            )}
          </ModeCard>
        ))}
      </ModeSelector>

      {isLoading && (
        <QuickStartSection>
          <LoadingMessage>
            正在启动{PRACTICE_MODES.find(m => m.type === selectedMode)?.title}练习...
          </LoadingMessage>
        </QuickStartSection>
      )}
    </PracticeContainer>
  );
};

export default PracticePage;
