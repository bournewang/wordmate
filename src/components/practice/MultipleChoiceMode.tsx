import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Check, X } from 'lucide-react';
import type { Word } from '../../types';
import { AudioService } from '../../services/audioService';

const MultipleChoiceContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 1rem;
  max-width: 700px;
  margin: 0 auto;
  box-sizing: border-box;
  width: 100%;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    gap: 1.25rem;
    padding: 0.75rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    gap: 0.75rem;
    padding: 0.5rem;
  }
`;

const QuestionSection = styled.div`
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 16px;
  width: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 1.5rem;
    border-radius: 12px;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 1.25rem;
    border-radius: 8px;
  }
`;

const WordDisplay = styled.h2`
  font-size: 3rem;
  font-weight: bold;
  margin: 0 0 1rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  word-break: break-word;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 2.5rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 2rem;
    margin: 0 0 0.75rem 0;
  }
`;

const AudioButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  padding: 1rem;
  color: white;
  cursor: pointer;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 0.875rem;
    margin: 0 auto 0.75rem;
    
    svg {
      width: 22px;
      height: 22px;
    }
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 0.75rem;
    margin: 0 auto 0.5rem;
    
    svg {
      width: 20px;
      height: 20px;
    }
  }
`;

const Phonetic = styled.p`
  font-size: 1.2rem;
  font-style: italic;
  opacity: 0.9;
  margin: 0;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 1.1rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 1rem;
  }
`;

const Instructions = styled.p`
  text-align: center;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 1rem;
  margin-bottom: 1.5rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 0.9rem;
    margin-bottom: 1.25rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }
`;

const OptionsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  width: 100%;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    gap: 0.75rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const OptionButton = styled(motion.button)<{ 
  $isSelected: boolean;
  $isCorrect?: boolean;
  $isIncorrect?: boolean;
  $disabled: boolean;
}>`
  padding: 1.5rem;
  border: 2px solid transparent;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  text-align: center;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 1.25rem;
    font-size: 1rem;
    min-height: 70px;
    border-radius: 10px;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 1rem;
    font-size: 0.9rem;
    min-height: 60px;
    border-radius: 8px;
  }
  
  ${props => {
    if (props.$isCorrect) {
      return `
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        border-color: #4CAF50;
      `;
    }
    if (props.$isIncorrect) {
      return `
        background: linear-gradient(135deg, #f44336, #da190b);
        color: white;
        border-color: #f44336;
      `;
    }
    if (props.$isSelected) {
      return `
        background: ${props.theme.colors.primary};
        color: white;
        border-color: ${props.theme.colors.primary};
      `;
    }
    return `
      background: ${props.theme.colors.background};
      color: ${props.theme.colors.text};
      border-color: ${props.theme.colors.border};
      
      &:hover:not(:disabled) {
        border-color: ${props.theme.colors.primary};
        background: ${props.theme.colors.secondary};
      }
    `;
  }}
  
  &:disabled {
    opacity: ${props => props.$isCorrect || props.$isIncorrect ? 1 : 0.5};
  }
`;

const OptionIcon = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
`;

const NextButton = styled(motion.button)`
  padding: 1rem 2rem;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  min-width: 150px;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const FeedbackMessage = styled(motion.div)<{ $isCorrect: boolean }>`
  text-align: center;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 500;
  
  ${props => props.$isCorrect ? `
    background: rgba(76, 175, 80, 0.1);
    color: #4CAF50;
    border: 1px solid rgba(76, 175, 80, 0.3);
  ` : `
    background: rgba(244, 67, 54, 0.1);
    color: #f44336;
    border: 1px solid rgba(244, 67, 54, 0.3);
  `}
`;

const ProgressIndicator = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const ProgressDot = styled.div<{ $active: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$active 
    ? props.theme.colors.primary 
    : props.theme.colors.border
  };
  transition: all 0.2s ease;
`;

interface MultipleChoiceModeProps {
  word: Word;
  allWords: Word[]; // Used to generate distractors
  onAnswer: (userAnswer: string | boolean) => void;
  onPlayAudio?: () => void;
  progress?: {
    current: number;
    total: number;
  };
}

export const MultipleChoiceMode: React.FC<MultipleChoiceModeProps> = ({
  word,
  allWords,
  onAnswer,
  onPlayAudio,
  progress
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Generate options for this word
  const options = useMemo(() => {
    const correctAnswer = word.definition;
    const distractors = allWords
      .filter(w => w.id !== word.id && w.definition !== correctAnswer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => w.definition);

    const allOptions = [correctAnswer, ...distractors];
    return allOptions.sort(() => Math.random() - 0.5);
  }, [word, allWords]);

  // Reset state when word changes and auto-play audio
  useEffect(() => {
    setSelectedOption(null);
    setHasAnswered(false);
    setShowFeedback(false);
    
    // Auto-play audio when switching to a new word
    const playAudio = async () => {
      try {
        await AudioService.playWordAudio(word);
        onPlayAudio?.();
      } catch (error) {
        console.error('Failed to auto-play audio:', error);
      }
    };
    
    // Small delay to ensure the component is ready
    setTimeout(playAudio, 300);
  }, [word.id, onPlayAudio]);

  const handlePlayAudio = async () => {
    if (isAudioPlaying) return;
    
    setIsAudioPlaying(true);
    try {
      await AudioService.playWordAudio(word);
      onPlayAudio?.();
    } catch (error) {
      console.error('Failed to play audio:', error);
    } finally {
      setIsAudioPlaying(false);
    }
  };

  const handleOptionSelect = (option: string) => {
    if (hasAnswered) return;
    
    setSelectedOption(option);
    setHasAnswered(true);
    setShowFeedback(true);
    
    const isCorrect = option === word.definition;
    onAnswer(option); // Pass the actual user selection
  };

  const getOptionState = (option: string) => {
    if (!hasAnswered) {
      return {
        isSelected: selectedOption === option,
        isCorrect: false,
        isIncorrect: false
      };
    }
    
    return {
      isSelected: selectedOption === option,
      isCorrect: option === word.definition,
      isIncorrect: selectedOption === option && option !== word.definition
    };
  };

  return (
    <MultipleChoiceContainer>
      {progress && (
        <ProgressIndicator>
          {Array.from({ length: progress.total }, (_, i) => (
            <ProgressDot key={i} $active={i < progress.current} />
          ))}
        </ProgressIndicator>
      )}

      <Instructions>
        选择下面单词的正确中文翻译
      </Instructions>

      <QuestionSection>
        <WordDisplay>{word.word}</WordDisplay>
        <AudioButton
          onClick={handlePlayAudio}
          disabled={isAudioPlaying}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Volume2 size={24} />
        </AudioButton>
        {word.phonetic && (
          <Phonetic>/{word.phonetic}/</Phonetic>
        )}
      </QuestionSection>

      <OptionsGrid>
        {options.map((option, index) => {
          const { isSelected, isCorrect, isIncorrect } = getOptionState(option);
          
          return (
            <OptionButton
              key={`${word.id}-${option}-${index}`}
              onClick={() => handleOptionSelect(option)}
              $isSelected={isSelected}
              $isCorrect={isCorrect}
              $isIncorrect={isIncorrect}
              $disabled={hasAnswered}
              whileHover={hasAnswered ? {} : { scale: 1.02 }}
              whileTap={hasAnswered ? {} : { scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {option}
              {hasAnswered && (
                <OptionIcon>
                  {isCorrect ? (
                    <Check size={16} color="white" />
                  ) : isIncorrect ? (
                    <X size={16} color="white" />
                  ) : null}
                </OptionIcon>
              )}
            </OptionButton>
          );
        })}
      </OptionsGrid>

      <AnimatePresence>
        {showFeedback && (
          <FeedbackMessage
            $isCorrect={selectedOption === word.definition}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {selectedOption === word.definition 
              ? `太好了！"${word.word}" 的意思确实是 "${word.definition}"`
              : `不对哦，"${word.word}" 的正确翻译是 "${word.definition}"`
            }
          </FeedbackMessage>
        )}
      </AnimatePresence>
    </MultipleChoiceContainer>
  );
};
