// Practice type enumeration
export type PracticeType = 
  | 'flashcard'
  | 'typing'
  | 'multipleChoice'
  | 'fillInBlank'
  | 'matching';

// Word interface
export interface Word {
  id: string;
  word: string;
  definition: string;
  phonetic?: string;
  audioUrl?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  unit: number;
  difficulty: number;
  masteryLevel: number;
  repetitionCount: number;
  easeFactor: number;
  lastReviewed: string | null;
  nextReview: string | null;
  tags?: string[];
  practiceHistory?: {
    practiceType: PracticeType;
    isCorrect: boolean;
    responseTime: number;
    timestamp: string;
  }[];
}

// Vocabulary unit interface
export interface VocabularyUnit {
  id: number;
  name: string;
  description: string;
  words: Word[];
}

// Vocabulary data interface
export interface VocabularyData {
  grade: number;
  units: VocabularyUnit[];
  metadata: {
    totalWords: number;
    totalUnits: number;
    lastUpdated: string;
    version: string;
  };
}

// Unit progress interface
export interface UnitProgress {
  userId: string;
  unitId: number;
  completionRate: number;
  totalWords: number;
  masteredWords: number;
  avgMasteryLevel: number;
  lastStudied: string;
}

// User progress interface
export interface UserProgress {
  userId: string;
  totalWordsLearned: number;
  currentStreak: number;
  maxStreak: number;
  totalPracticeTime: number;
  lastActiveDate: string;
  unitsProgress: UnitProgress[];
}

// Practice session interface
export interface PracticeSession {
  id: string;
  userId?: string;
  unitId?: number;
  practiceType: PracticeType;
  words: string[]; // Array of word IDs
  answers: {
    wordId: string;
    word: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    responseTime: number;
    quality: number;
    timestamp: Date;
  }[];
  startTime: string;
  endTime: string;
  accuracy: number;
  averageResponseTime: number;
  totalWords: number;
  correctWords: number;
}

// Practice question interface
export interface PracticeQuestion {
  id: string;
  word: Word;
  questionType: PracticeType;
  question: string;
  options?: string[];
  correctAnswer: string;
  userAnswer?: string;
  responseTime?: number;
  isCorrect?: boolean;
}

// Study settings interface  
export interface StudySettings {
  userId: string;
  practiceTypes: PracticeType[];
  questionsPerSession: number;
  timeLimit: number;
  soundEnabled: boolean;
  adaptiveDifficulty: boolean;
  reviewMode: boolean;
  autoplay: boolean;
}

// User interface
export interface User {
  id: string;
  username: string;
  email: string;
  grade: number;
  createdAt: string;
  lastLoginAt: string;
  settings: StudySettings;
  progress: UserProgress;
}
