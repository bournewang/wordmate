import { useState, useCallback, useEffect } from 'react';
import type { Word, PracticeSession, PracticeType } from '../types';
import { SpacedRepetitionService } from '../services/spacedRepetition';
import { DatabaseService } from '../services/database';

export interface PracticeSessionState {
  words: Word[];
  currentWordIndex: number;
  currentWord: Word | null;
  answers: PracticeAnswer[];
  startTime: Date;
  endTime?: Date;
  practiceType: PracticeType;
  isComplete: boolean;
  sessionStats: SessionStats;
}

export interface PracticeAnswer {
  wordId: string;
  word: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  responseTime: number;
  quality: number; // 0-5 quality score for spaced repetition
  timestamp: Date;
}

export interface SessionStats {
  totalWords: number;
  correctAnswers: number;
  totalResponseTime: number;
  averageResponseTime: number;
  accuracy: number;
  wordsPerMinute: number;
}

export function usePracticeSession(initialWords: Word[], practiceType: PracticeType) {
  const [sessionState, setSessionState] = useState<PracticeSessionState>(() => ({
    words: [...initialWords],
    currentWordIndex: 0,
    currentWord: initialWords[0] || null,
    answers: [],
    startTime: new Date(),
    practiceType,
    isComplete: false,
    sessionStats: {
      totalWords: initialWords.length,
      correctAnswers: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      accuracy: 0,
      wordsPerMinute: 0
    }
  }));

  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date());

  // Calculate session statistics
  const calculateStats = useCallback((answers: PracticeAnswer[]): SessionStats => {
    const totalWords = sessionState.words.length;
    const correctAnswers = answers.filter(a => a.isCorrect).length;
    const totalResponseTime = answers.reduce((sum, a) => sum + a.responseTime, 0);
    const averageResponseTime = answers.length > 0 ? totalResponseTime / answers.length : 0;
    const accuracy = answers.length > 0 ? correctAnswers / answers.length : 0;
    
    const sessionDuration = (Date.now() - sessionState.startTime.getTime()) / 1000 / 60; // minutes
    const wordsPerMinute = sessionDuration > 0 ? answers.length / sessionDuration : 0;

    return {
      totalWords,
      correctAnswers,
      totalResponseTime,
      averageResponseTime,
      accuracy,
      wordsPerMinute
    };
  }, [sessionState.words.length, sessionState.startTime]);

  // Submit an answer for the current word
  const submitAnswer = useCallback(async (userAnswer: string) => {
    if (!sessionState.currentWord) return;

    const responseTime = (Date.now() - questionStartTime.getTime()) / 1000;
    const correctAnswer = getCorrectAnswer(sessionState.currentWord, practiceType);
    const isCorrect = checkAnswer(userAnswer, correctAnswer, practiceType);
    const quality = SpacedRepetitionService.assessQuality(isCorrect, responseTime);

    const answer: PracticeAnswer = {
      wordId: sessionState.currentWord.id,
      word: sessionState.currentWord.word,
      userAnswer: userAnswer.trim(),
      correctAnswer,
      isCorrect,
      responseTime,
      quality,
      timestamp: new Date()
    };

    const newAnswers = [...sessionState.answers, answer];
    const newStats = calculateStats(newAnswers);

    // Update word's spaced repetition data
    const updatedWordData = SpacedRepetitionService.updateWordScheduling(
      sessionState.currentWord,
      quality,
      responseTime
    );

    // Save progress to database
    try {
      await DatabaseService.updateWordProgress(sessionState.currentWord.id, {
        ...updatedWordData,
        practiceHistory: [
          ...(sessionState.currentWord.practiceHistory || []),
          {
            practiceType,
            isCorrect,
            responseTime,
            timestamp: new Date().toISOString()
          }
        ]
      });
    } catch (error) {
      console.error('Failed to update word progress:', error);
    }

    setSessionState(prev => ({
      ...prev,
      answers: newAnswers,
      sessionStats: newStats
    }));

    return answer;
  }, [sessionState.currentWord, sessionState.answers, practiceType, questionStartTime, calculateStats]);

  // Move to next word
  const nextWord = useCallback(() => {
    setSessionState(prev => {
      const nextIndex = prev.currentWordIndex + 1;
      const isComplete = nextIndex >= prev.words.length;
      
      return {
        ...prev,
        currentWordIndex: nextIndex,
        currentWord: isComplete ? null : prev.words[nextIndex],
        isComplete,
        endTime: isComplete ? new Date() : prev.endTime
      };
    });
    
    setQuestionStartTime(new Date());
  }, []);

  // Skip current word
  const skipWord = useCallback(() => {
    if (sessionState.currentWord) {
      const skipAnswer: PracticeAnswer = {
        wordId: sessionState.currentWord.id,
        word: sessionState.currentWord.word,
        userAnswer: '',
        correctAnswer: getCorrectAnswer(sessionState.currentWord, practiceType),
        isCorrect: false,
        responseTime: (Date.now() - questionStartTime.getTime()) / 1000,
        quality: 0,
        timestamp: new Date()
      };

      setSessionState(prev => ({
        ...prev,
        answers: [...prev.answers, skipAnswer],
        sessionStats: calculateStats([...prev.answers, skipAnswer])
      }));
    }
    
    nextWord();
  }, [sessionState.currentWord, practiceType, questionStartTime, nextWord, calculateStats]);

  // Reset session
  const resetSession = useCallback(() => {
    setSessionState(prev => ({
      ...prev,
      currentWordIndex: 0,
      currentWord: prev.words[0] || null,
      answers: [],
      startTime: new Date(),
      endTime: undefined,
      isComplete: false,
      sessionStats: {
        totalWords: prev.words.length,
        correctAnswers: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        accuracy: 0,
        wordsPerMinute: 0
      }
    }));
    setQuestionStartTime(new Date());
  }, []);

  // Save session to database when completed
  useEffect(() => {
    if (sessionState.isComplete && sessionState.endTime) {
      const practiceSessionData: PracticeSession = {
        id: `session_${Date.now()}`,
        practiceType,
        words: sessionState.words.map(w => w.id),
        answers: sessionState.answers,
        startTime: sessionState.startTime.toISOString(),
        endTime: sessionState.endTime.toISOString(),
        accuracy: sessionState.sessionStats.accuracy,
        averageResponseTime: sessionState.sessionStats.averageResponseTime,
        totalWords: sessionState.sessionStats.totalWords,
        correctWords: sessionState.sessionStats.correctAnswers
      };

      DatabaseService.savePracticeSession(practiceSessionData).catch(error => {
        console.error('Failed to save practice session:', error);
      });
    }
  }, [sessionState.isComplete, sessionState.endTime, practiceType, sessionState.words, sessionState.answers, sessionState.sessionStats]);

  return {
    sessionState,
    submitAnswer,
    nextWord,
    skipWord,
    resetSession,
    progress: {
      current: sessionState.currentWordIndex + 1,
      total: sessionState.words.length,
      percentage: sessionState.words.length > 0 
        ? ((sessionState.currentWordIndex + 1) / sessionState.words.length) * 100 
        : 0
    }
  };
}

// Helper functions
function getCorrectAnswer(word: Word, practiceType: PracticeType): string {
  switch (practiceType) {
    case 'flashcard':
      return word.definition || '';
    case 'multipleChoice':
      return word.definition || '';
    case 'typing':
      return word.word || '';
    case 'fillInBlank':
      return word.word || '';
    case 'matching':
      return word.definition || '';
    default:
      return word.definition || '';
  }
}

function checkAnswer(userAnswer: string, correctAnswer: string, practiceType: PracticeType): boolean {
  // Handle null/undefined values
  if (!userAnswer || !correctAnswer) {
    return false;
  }
  
  const userAnswerClean = userAnswer.toString().toLowerCase().trim();
  const correctAnswerClean = correctAnswer.toString().toLowerCase().trim();
  
  // Handle empty strings
  if (!userAnswerClean || !correctAnswerClean) {
    return false;
  }

  switch (practiceType) {
    case 'typing':
    case 'fillInBlank':
      // Exact match for typing exercises
      return userAnswerClean === correctAnswerClean;
    
    case 'flashcard':
    case 'multipleChoice':
    case 'matching':
      // More flexible matching for translation exercises
      return userAnswerClean === correctAnswerClean || 
             userAnswerClean.includes(correctAnswerClean) ||
             correctAnswerClean.includes(userAnswerClean);
    
    default:
      return userAnswerClean === correctAnswerClean;
  }
}
