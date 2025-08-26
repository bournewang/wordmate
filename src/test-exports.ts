// Test file to verify exports from vocabulary.ts
import { 
  VocabularyData,
  Word,
  VocabularyUnit,
  UnitProgress,
  PracticeType 
} from './types/vocabulary';

// This should compile without errors if exports are working
const testWord: Word = {
  id: 'test',
  word: 'test',
  definition: 'test',
  phonetic: 'test',
  audioUrl: 'test',
  unit: 1,
  difficulty: 1,
  masteryLevel: 1,
  repetitionCount: 1,
  easeFactor: 1,
  lastReviewed: null,
  nextReview: null,
  tags: []
};

const testVocabData: VocabularyData = {
  grade: 6,
  units: [],
  metadata: {
    totalWords: 0,
    totalUnits: 0,
    lastUpdated: '',
    version: ''
  }
};

console.log('Exports test passed:', { testWord, testVocabData });
