import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Check, X, Eye, EyeOff } from 'lucide-react';
import type { Word } from '../../types';
import { AudioService } from '../../services/audioService';

const TypingContainer = styled.div`
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

const TranslationDisplay = styled.h2`
  font-size: 2.5rem;
  font-weight: bold;
  margin: 0 0 1rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 2rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 1.75rem;
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

const TypingSection = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    gap: 0.875rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    gap: 0.75rem;
  }
`;

const InputContainer = styled.div<{ $hasError: boolean }>`
  position: relative;
  width: 100%;
`;

const TypingInput = styled.input<{ $hasError: boolean; $isComplete: boolean }>`
  width: 100%;
  padding: 1.5rem;
  border: 2px solid ${props => 
    props.$isComplete ? '#4CAF50' :
    props.$hasError ? '#f44336' : 
    props.theme.colors.border
  };
  border-radius: 12px;
  font-size: 1.5rem;
  text-align: center;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  
  &:focus {
    outline: none;
    border-color: ${props => 
      props.$isComplete ? '#4CAF50' :
      props.$hasError ? '#f44336' :
      props.theme.colors.primary
    };
    box-shadow: 0 0 0 3px ${props => 
      props.$isComplete ? 'rgba(76, 175, 80, 0.1)' :
      props.$hasError ? 'rgba(244, 67, 54, 0.1)' :
      `${props.theme.colors.primary}20`
    };
  }
  
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
    opacity: 0.7;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 1.25rem;
    font-size: 1.25rem;
    border-radius: 10px;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 1rem;
    font-size: 1.125rem;
    border-radius: 8px;
  }
`;

const HintSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const HintButton = styled(motion.button)`
  padding: 0.75rem 1.5rem;
  background: ${props => props.theme.colors.secondary};
  color: ${props => props.theme.colors.text};
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
  }
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 0.625rem 1.25rem;
    font-size: 0.85rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
    width: 100%;
    max-width: 200px;
    justify-content: center;
  }
`;

const HintText = styled(motion.div)`
  font-family: monospace;
  font-size: 1.2rem;
  background: ${props => props.theme.colors.secondary};
  color: ${props => props.theme.colors.text};
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  letter-spacing: 0.1em;
  text-align: center;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 1.1rem;
    padding: 0.625rem 1.25rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 1rem;
    padding: 0.5rem 1rem;
    letter-spacing: 0.05em;
  }
`;

const LetterHints = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    gap: 0.375rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    gap: 0.25rem;
    margin-top: 0.75rem;
  }
`;

const LetterHint = styled.div<{ $revealed: boolean }>`
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  font-family: monospace;
  font-size: 1.1rem;
  font-weight: bold;
  background: ${props => props.$revealed 
    ? props.theme.colors.primary 
    : props.theme.colors.background
  };
  color: ${props => props.$revealed 
    ? 'white' 
    : props.theme.colors.textSecondary
  };
  
  ${props => !props.$revealed && `
    &::after {
      content: '_';
    }
  `}
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    width: 1.75rem;
    height: 1.75rem;
    font-size: 1rem;
    border-radius: 5px;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.9rem;
    border-radius: 4px;
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

const SubmitButton = styled(motion.button)`
  padding: 1rem 2rem;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  min-width: 150px;
  
  &:hover:not(:disabled) {
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

interface TypingModeProps {
  word: Word;
  onAnswer: (userAnswer: string | boolean) => void;
  onPlayAudio?: () => void;
  progress?: {
    current: number;
    total: number;
  };
}

export const TypingMode: React.FC<TypingModeProps> = ({
  word,
  onAnswer,
  onPlayAudio,
  progress
}) => {
  const [userInput, setUserInput] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [revealedLetters, setRevealedLetters] = useState<number>(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when word changes and auto-play audio
  useEffect(() => {
    setUserInput('');
    setHasAnswered(false);
    setShowHint(false);
    setRevealedLetters(0);
    setShowFeedback(false);
    
    // Focus input when word changes
    setTimeout(() => inputRef.current?.focus(), 100);
    
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (hasAnswered) return;
    setUserInput(e.target.value);
  };

  const handleSubmit = () => {
    if (hasAnswered || !userInput.trim()) return;
    
    const isCorrect = userInput.toLowerCase().trim() === word.word.toLowerCase();
    setHasAnswered(true);
    setShowFeedback(true);
    onAnswer(userInput.trim()); // Pass the actual user input
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const toggleHint = () => {
    setShowHint(!showHint);
  };

  const revealNextLetter = () => {
    if (revealedLetters < word.word.length) {
      setRevealedLetters(prev => prev + 1);
    }
  };

  const isInputCorrect = userInput.toLowerCase().trim() === word.word.toLowerCase();
  const hasError = userInput.length > 0 && !hasAnswered && !word.word.toLowerCase().startsWith(userInput.toLowerCase());

  return (
    <TypingContainer>
      {progress && (
        <ProgressIndicator>
          {Array.from({ length: progress.total }, (_, i) => (
            <ProgressDot key={i} $active={i < progress.current} />
          ))}
        </ProgressIndicator>
      )}

      <Instructions>
        根据中文翻译，输入对应的英文单词
      </Instructions>

      <QuestionSection>
        <TranslationDisplay>{word.definition}</TranslationDisplay>
        <AudioButton
          onClick={handlePlayAudio}
          disabled={isAudioPlaying}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Volume2 size={24} />
        </AudioButton>
        {word.exampleSentence && (
          <p style={{ opacity: 0.9, fontSize: '1.1rem', fontStyle: 'italic' }}>
            {word.exampleSentence}
          </p>
        )}
      </QuestionSection>

      <TypingSection>
        <InputContainer $hasError={hasError}>
          <TypingInput
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="输入英文单词..."
            $hasError={hasError}
            $isComplete={isInputCorrect && hasAnswered}
            disabled={hasAnswered}
          />
        </InputContainer>

        <HintSection>
          <HintButton
            onClick={toggleHint}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {showHint ? <EyeOff size={16} /> : <Eye size={16} />}
            {showHint ? '隐藏提示' : '显示提示'}
          </HintButton>
          
          <HintButton
            onClick={revealNextLetter}
            disabled={revealedLetters >= word.word.length}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            显示一个字母
          </HintButton>
        </HintSection>

        <AnimatePresence>
          {showHint && (
            <HintText
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              单词长度: {word.word.length} 个字母
              {word.phonetic && ` | 读音: /${word.phonetic}/`}
            </HintText>
          )}
        </AnimatePresence>

        {revealedLetters > 0 && (
          <LetterHints>
            {word.word.split('').map((letter, index) => (
              <LetterHint
                key={index}
                $revealed={index < revealedLetters}
              >
                {index < revealedLetters ? letter : ''}
              </LetterHint>
            ))}
          </LetterHints>
        )}

        {!hasAnswered && (
          <SubmitButton
            onClick={handleSubmit}
            disabled={!userInput.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            提交答案
          </SubmitButton>
        )}
      </TypingSection>

      <AnimatePresence>
        {showFeedback && (
          <FeedbackMessage
            $isCorrect={isInputCorrect}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {isInputCorrect 
              ? `太棒了！正确答案就是 "${word.word}"`
              : `不对哦，正确答案是 "${word.word}"，你输入的是 "${userInput}"`
            }
          </FeedbackMessage>
        )}
      </AnimatePresence>
    </TypingContainer>
  );
};
