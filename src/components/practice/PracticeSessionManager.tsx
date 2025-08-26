import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Settings, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle,
  Trophy,
  Target,
  Clock
} from 'lucide-react';
import type { Word, PracticeType } from '../../types';
import { usePracticeSession } from '../../hooks/usePracticeSession';
import { FlashcardMode } from './FlashcardMode';
import { MultipleChoiceMode } from './MultipleChoiceMode';
import { TypingMode } from './TypingMode';

const SessionContainer = styled.div`
  min-height: 100vh;
  background: ${props => props.theme.colors.background};
  padding: 1rem;
  box-sizing: border-box;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 0.75rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 0.5rem;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 800px;
  margin: 0 auto 2rem;
  padding: 0 1rem;
  box-sizing: border-box;
  width: 100%;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    margin: 0 auto 1.5rem;
    padding: 0 0.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    margin: 0 auto 1rem;
    padding: 0 0.25rem;
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const BackButton = styled(motion.button)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: ${props => props.theme.colors.text};
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
    background: ${props => props.theme.colors.secondary};
  }
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
    align-self: stretch;
    justify-content: center;
  }
`;

const SessionInfo = styled.div`
  flex: 1;
  text-align: center;
  margin: 0 2rem;
  
  h3 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    margin: 0 1rem;
    
    h3 {
      font-size: 1.125rem;
    }
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    margin: 0;
    order: -1;
    
    h3 {
      font-size: 1rem;
    }
  }
`;

const ModeSelector = styled.div`
  display: flex;
  gap: 0.5rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    gap: 0.375rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    gap: 0.25rem;
    flex-wrap: wrap;
    justify-content: center;
  }
`;

const ModeButton = styled(motion.button)<{ $active: boolean }>`
  padding: 0.5rem 1rem;
  background: ${props => props.$active 
    ? props.theme.colors.primary 
    : 'transparent'
  };
  color: ${props => props.$active 
    ? 'white' 
    : props.theme.colors.text
  };
  border: 2px solid ${props => props.$active 
    ? props.theme.colors.primary 
    : props.theme.colors.border
  };
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
  }
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 0.425rem 0.875rem;
    font-size: 0.8rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    flex: 1;
  }
`;

const ProgressSection = styled.div`
  max-width: 800px;
  margin: 0 auto 2rem;
  padding: 0 1rem;
  box-sizing: border-box;
  width: 100%;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    margin: 0 auto 1.5rem;
    padding: 0 0.5rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    margin: 0 auto 1rem;
    padding: 0 0.25rem;
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: ${props => props.theme.colors.border};
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    height: 6px;
    margin-bottom: 0.75rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    height: 5px;
    margin-bottom: 0.5rem;
  }
`;

const ProgressFill = styled(motion.div)`
  height: 100%;
  background: linear-gradient(90deg, ${props => props.theme.colors.primary}, #4CAF50);
`;

const ProgressStats = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: ${props => props.theme.colors.textSecondary};
  flex-wrap: wrap;
  gap: 0.5rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 0.85rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 0.8rem;
    justify-content: center;
    text-align: center;
    
    span {
      flex: 1;
      min-width: 80px;
    }
  }
`;

const PracticeArea = styled.div`
  max-width: 800px;
  margin: 0 auto;
  box-sizing: border-box;
  width: 100%;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: ${props => props.theme.colors.textSecondary};
`;

const ResultsModal = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ResultsContent = styled(motion.div)`
  background: ${props => props.theme.colors.background};
  padding: 2rem;
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  text-align: center;
`;

const ResultsTitle = styled.h2`
  color: ${props => props.theme.colors.text};
  margin: 0 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const ResultsStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
`;

const StatCard = styled.div<{ $type?: 'correct' | 'accuracy' | 'time' | 'speed' }>`
  padding: 1.5rem 1rem;
  background: #ffffff;
  border-radius: 12px;
  text-align: center;
  border: 2px solid #e2e8f0;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => {
      switch (props.$type) {
        case 'correct':
          return '#4CAF50';
        case 'accuracy':
          return '#FF9800';
        case 'time':
          return '#2196F3';
        case 'speed':
          return '#9C27B0';
        default:
          return '#667eea';
      }
    }};
  }
  
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    border-color: #cbd5e0;
  }
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 800;
  color: #1a365d;
  margin-bottom: 0.5rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const StatLabel = styled.div`
  font-size: 0.85rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
`;

const ActionButton = styled(motion.button)<{ $variant?: 'primary' | 'secondary' }>`
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  ${props => props.$variant === 'primary' ? `
    background: ${props.theme.colors.primary};
    color: white;
  ` : `
    background: ${props.theme.colors.secondary};
    color: white;
    border: 2px solid ${props.theme.colors.border};
  `}
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

interface PracticeSessionManagerProps {
  words: Word[];
  initialPracticeType: PracticeType;
  onExit: () => void;
  onComplete?: (results: any) => void;
}

const PRACTICE_MODES = [
  { type: 'flashcard' as PracticeType, label: '闪卡' },
  { type: 'multipleChoice' as PracticeType, label: '选择题' },
  { type: 'typing' as PracticeType, label: '拼写' },
];

export const PracticeSessionManager: React.FC<PracticeSessionManagerProps> = ({
  words,
  initialPracticeType,
  onExit,
  onComplete
}) => {
  const [currentPracticeType, setCurrentPracticeType] = useState<PracticeType>(initialPracticeType);
  const [showResults, setShowResults] = useState(false);
  
  const {
    sessionState,
    submitAnswer,
    nextWord,
    skipWord,
    resetSession,
    progress
  } = usePracticeSession(words, currentPracticeType);

  // Show results when session is complete
  useEffect(() => {
    if (sessionState.isComplete) {
      setShowResults(true);
    }
  }, [sessionState.isComplete]);

  const handleAnswer = async (userAnswer: string | boolean) => {
    // Convert boolean answers (from flashcard mode) to appropriate string format
    let answerString: string;
    if (typeof userAnswer === 'boolean') {
      // For flashcard mode, use correct answer if true, empty string if false
      if (sessionState.currentWord) {
        answerString = userAnswer ? 
          (currentPracticeType === 'flashcard' ? sessionState.currentWord.definition || '' : sessionState.currentWord.word || '') : 
          '';
      } else {
        answerString = '';
      }
    } else {
      answerString = userAnswer;
    }
    
    const answer = await submitAnswer(answerString);
    
    // Auto-advance to next word after a short delay
    setTimeout(() => {
      if (!sessionState.isComplete) {
        nextWord();
      }
    }, 2000);
  };

  const handleModeChange = (newMode: PracticeType) => {
    setCurrentPracticeType(newMode);
    // Note: This would require reinitializing the session with the new mode
  };

  const handleRestart = () => {
    setShowResults(false);
    resetSession();
  };

  const handleContinue = () => {
    onComplete?.(sessionState.sessionStats);
    onExit();
  };

  const renderCurrentMode = () => {
    if (!sessionState.currentWord) {
      return (
        <LoadingState>
          <p>准备练习...</p>
        </LoadingState>
      );
    }

    switch (currentPracticeType) {
      case 'flashcard':
        return (
          <FlashcardMode
            word={sessionState.currentWord}
            onAnswer={handleAnswer}
            progress={progress}
          />
        );
      
      case 'multipleChoice':
        return (
          <MultipleChoiceMode
            word={sessionState.currentWord}
            allWords={words}
            onAnswer={handleAnswer}
            progress={progress}
          />
        );
      
      case 'typing':
        return (
          <TypingMode
            word={sessionState.currentWord}
            onAnswer={handleAnswer}
            progress={progress}
          />
        );
      
      default:
        return null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sessionDuration = sessionState.endTime 
    ? (new Date(sessionState.endTime).getTime() - sessionState.startTime.getTime()) / 1000
    : 0;

  return (
    <SessionContainer>
      <Header>
        <BackButton
          onClick={onExit}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft size={16} />
          退出练习
        </BackButton>
        
        <SessionInfo>
          <h3 style={{ margin: 0, color: 'inherit' }}>
            {PRACTICE_MODES.find(m => m.type === currentPracticeType)?.label}练习
          </h3>
        </SessionInfo>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ModeSelector>
            {PRACTICE_MODES.map(mode => (
              <ModeButton
                key={mode.type}
                $active={mode.type === currentPracticeType}
                onClick={() => handleModeChange(mode.type)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {mode.label}
              </ModeButton>
            ))}
          </ModeSelector>
          
          <motion.button
            onClick={handleRestart}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              color: '#718096'
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw size={14} />
            重置
          </motion.button>
        </div>
      </Header>

      <ProgressSection>
        <ProgressBar>
          <ProgressFill
            initial={{ width: 0 }}
            animate={{ width: `${progress.percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </ProgressBar>
        
        <ProgressStats>
          <span>进度: {progress.current} / {progress.total}</span>
          <span>正确率: {Math.round(sessionState.sessionStats.accuracy * 100)}%</span>
          <span>平均时间: {sessionState.sessionStats.averageResponseTime.toFixed(1)}s</span>
        </ProgressStats>
      </ProgressSection>

      <PracticeArea>
        <AnimatePresence mode="wait">
          {renderCurrentMode()}
        </AnimatePresence>
      </PracticeArea>

      <AnimatePresence>
        {showResults && (
          <ResultsModal
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ResultsContent
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <ResultsTitle>
                <Trophy size={24} />
                练习完成！
              </ResultsTitle>
              
              <ResultsStats>
                <StatCard $type="correct">
                  <StatValue>{sessionState.sessionStats.correctAnswers}</StatValue>
                  <StatLabel>正确回答</StatLabel>
                </StatCard>
                <StatCard $type="accuracy">
                  <StatValue>{Math.round(sessionState.sessionStats.accuracy * 100)}%</StatValue>
                  <StatLabel>正确率</StatLabel>
                </StatCard>
                <StatCard $type="time">
                  <StatValue>{formatTime(sessionDuration)}</StatValue>
                  <StatLabel>总用时</StatLabel>
                </StatCard>
                <StatCard $type="speed">
                  <StatValue>{sessionState.sessionStats.averageResponseTime.toFixed(1)}s</StatValue>
                  <StatLabel>平均时间</StatLabel>
                </StatCard>
              </ResultsStats>
              
              <ActionButtons>
                <ActionButton
                  $variant="secondary"
                  onClick={handleRestart}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <RotateCcw size={16} />
                  重新练习
                </ActionButton>
                <ActionButton
                  $variant="primary"
                  onClick={handleContinue}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <CheckCircle size={16} />
                  完成
                </ActionButton>
              </ActionButtons>
            </ResultsContent>
          </ResultsModal>
        )}
      </AnimatePresence>
    </SessionContainer>
  );
};
