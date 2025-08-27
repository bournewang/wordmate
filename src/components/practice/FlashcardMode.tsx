import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Check, X } from 'lucide-react';
import type { Word } from '../../types';
import { AudioService } from '../../services/audioService';

const FlashcardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 1rem;
  max-width: 600px;
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

const Card = styled(motion.div)<{ $isFlipped: boolean }>`
  width: 100%;
  height: 300px;
  perspective: 1000px;
  cursor: pointer;
  position: relative;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    height: 250px;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    height: 200px;
  }
`;

const CardFace = styled(motion.div)<{ $isBack?: boolean }>`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 16px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  background: ${props => props.$isBack 
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  };
  color: white;
  
  ${props => props.$isBack && `
    transform: rotateY(180deg);
  `}
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 1.5rem;
    border-radius: 12px;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 1rem;
    border-radius: 8px;
  }
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
`;

const Word = styled.h2`
  font-size: 2.5rem;
  font-weight: bold;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  word-break: break-word;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 2rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 1.75rem;
  }
`;

const Translation = styled.h3`
  font-size: 2rem;
  font-weight: 500;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  text-align: center;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 1.75rem;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 1.5rem;
  }
`;

const ExampleSentence = styled.p`
  font-size: 1.1rem;
  margin: 1rem 0 0;
  font-style: italic;
  opacity: 0.9;
  line-height: 1.4;
  text-align: center;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    font-size: 1rem;
    margin: 0.75rem 0 0;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    font-size: 0.9rem;
    margin: 0.5rem 0 0;
    line-height: 1.3;
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
  margin-top: 1rem;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 0.875rem;
    margin-top: 0.75rem;
    
    svg {
      width: 22px;
      height: 22px;
    }
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 0.75rem;
    margin-top: 0.5rem;
    
    svg {
      width: 20px;
      height: 20px;
    }
  }
`;

const Controls = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  width: 100%;
  justify-content: center;
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const ControlButton = styled(motion.button)<{ $variant?: 'correct' | 'incorrect' | 'reset' }>`
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
  justify-content: center;
  
  @media (max-width: ${props => props.theme.breakpoints.md}) {
    padding: 0.875rem 1.5rem;
    font-size: 0.9rem;
    min-width: 110px;
  }
  
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    padding: 0.75rem 1.25rem;
    font-size: 0.875rem;
    min-width: 100px;
    width: 100%;
    max-width: 200px;
  }
  
  ${props => {
    switch (props.$variant) {
      case 'correct':
        return `
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
        `;
      case 'incorrect':
        return `
          background: linear-gradient(135deg, #f44336, #da190b);
          color: white;
        `;
      case 'reset':
        return `
          background: ${props.theme.colors.secondary};
          color: ${props.theme.colors.text};
          border: 2px solid ${props.theme.colors.border};
        `;
      default:
        return `
          background: ${props.theme.colors.primary};
          color: white;
        `;
    }
  }}
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const Instructions = styled.p`
  text-align: center;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.95rem;
  margin-bottom: 1rem;
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

interface FlashcardModeProps {
  word: Word;
  onAnswer: (userAnswer: string | boolean) => void;
  onPlayAudio?: () => void;
  progress?: {
    current: number;
    total: number;
  };
}

export const FlashcardMode: React.FC<FlashcardModeProps> = ({
  word,
  onAnswer,
  onPlayAudio,
  progress
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Reset state when word changes and auto-play audio
  useEffect(() => {
    setIsFlipped(false);
    setHasAnswered(false);
    
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
  }, [word, onPlayAudio]);

  const handleCardClick = () => {
    if (!hasAnswered) {
      setIsFlipped(!isFlipped);
    }
  };

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

  const handleAnswer = (isCorrect: boolean) => {
    setHasAnswered(true);
    onAnswer(isCorrect);
  };


  return (
    <FlashcardContainer>
      {progress && (
        <ProgressIndicator>
          {Array.from({ length: progress.total }, (_, i) => (
            <ProgressDot key={i} $active={i < progress.current} />
          ))}
        </ProgressIndicator>
      )}

      <Instructions>
        {!isFlipped 
          ? "点击卡片查看中文翻译" 
          : hasAnswered 
            ? "你的答案如何？" 
            : "看到翻译后，你记起这个单词了吗？"
        }
      </Instructions>

      <Card $isFlipped={isFlipped} onClick={handleCardClick}>
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <CardFace
              key="front"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: 90 }}
              transition={{ duration: 0.3, ease: "easeIn" }}
            >
              <CardContent>
                <Word>{word.word}</Word>
                <AudioButton
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayAudio();
                  }}
                  disabled={isAudioPlaying}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Volume2 size={24} />
                </AudioButton>
                {word.phonetic && (
                  <ExampleSentence>/{word.phonetic}/</ExampleSentence>
                )}
              </CardContent>
            </CardFace>
          ) : (
            <CardFace
              key="back"
              $isBack
              initial={{ rotateY: -90 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: -90 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <CardContent>
                <Translation>{word.definition}</Translation>
                {word.exampleSentence && (
                  <ExampleSentence>
                    {word.exampleSentence}
                  </ExampleSentence>
                )}
                {word.exampleTranslation && (
                  <ExampleSentence>
                    {word.exampleTranslation}
                  </ExampleSentence>
                )}
              </CardContent>
            </CardFace>
          )}
        </AnimatePresence>
      </Card>

      <Controls>
        {!isFlipped ? (
          <ControlButton
            onClick={handleCardClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            翻看答案
          </ControlButton>
        ) : !hasAnswered ? (
          <>
            <ControlButton
              $variant="incorrect"
              onClick={() => handleAnswer(false)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <X size={20} />
              不记得
            </ControlButton>
            <ControlButton
              $variant="correct"
              onClick={() => handleAnswer(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Check size={20} />
              记得
            </ControlButton>
          </>
        ) : (
          <div style={{ 
            color: '#718096', 
            fontSize: '0.9rem', 
            textAlign: 'center',
            padding: '1rem 0'
          }}>
            答案已提交，等待下一个单词...
          </div>
        )}
      </Controls>
    </FlashcardContainer>
  );
};
