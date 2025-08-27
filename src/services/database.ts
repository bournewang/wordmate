import Dexie from 'dexie';
import type {
  VocabularyData,
  Word,
  User,
  PracticeSession,
  UserProgress,
  UnitProgress,
  StudySettings
} from '../types';

export class WordMateDB extends Dexie {
  // 词汇数据表
  vocabularyData!: Dexie.Table<VocabularyData, number>;
  words!: Dexie.Table<Word, string>;
  
  // 用户相关表
  users!: Dexie.Table<User, string>;
  userProgress!: Dexie.Table<UserProgress, string>;
  unitProgress!: Dexie.Table<UnitProgress, string>;
  practiceSessions!: Dexie.Table<PracticeSession, string>;
  studySettings!: Dexie.Table<StudySettings, string>;

  constructor() {
    super('WordMateDB');
    
    this.version(1).stores({
      vocabularyData: '++id, grade, metadata.version',
      words: 'id, word, unit, difficulty, masteryLevel, lastReviewed, nextReview',
      users: 'id, username, email, grade',
      userProgress: 'userId, lastActiveDate, currentStreak',
      unitProgress: 'userId, unitId, lastStudied, completionRate',
      practiceSessions: 'id, userId, unitId, practiceType, startTime, completed',
      studySettings: 'userId, practiceTypes, adaptiveDifficulty'
    });

    // 添加钩子来自动处理日期字符串
    this.words.hook('creating', (_primaryKey, obj) => {
      if (!obj.lastReviewed) obj.lastReviewed = null;
      if (!obj.nextReview) obj.nextReview = null;
    });

    this.practiceSessions.hook('creating', (_primaryKey, obj) => {
      obj.startTime = obj.startTime || new Date().toISOString();
    });
  }
}

export const db = new WordMateDB();

// 数据库初始化和管理类
export class DatabaseService {
  static async initializeVocabularyData(vocabularyData: VocabularyData): Promise<void> {
    try {
      // 检查是否已经存在数据
      const existingData = await db.vocabularyData.toArray();
      const existingWords = await db.words.count();
      
      if (existingData.length === 0 && existingWords === 0) {
        // 插入词汇数据
        await db.vocabularyData.add(vocabularyData);
        
        // 插入所有单词
        const allWords: Word[] = [];
        vocabularyData.units.forEach(unit => {
          allWords.push(...unit.words);
        });
        
        // 使用 bulkPut 而不是 bulkAdd 来避免重复键错误
        await db.words.bulkPut(allWords);
        console.log('词汇数据初始化完成');
      } else {
        console.log('词汇数据已存在，跳过初始化');
      }
    } catch (error) {
      console.error('初始化词汇数据失败:', error);
      // 如果是重复键错误，尝试清除数据后重新初始化
      if ((error as any).name === 'ConstraintError' && (error as any).message?.includes('Key already exists')) {
        console.log('检测到重复键错误，清除现有数据后重新初始化');
        try {
          await this.clearAndReinitializeVocabulary();
          return;
        } catch (retryError) {
          console.error('重新初始化失败:', retryError);
          throw retryError;
        }
      }
      throw error;
    }
  }

  static async getVocabularyData(): Promise<VocabularyData | null> {
    try {
      const data = await db.vocabularyData.toCollection().first();
      return data || null;
    } catch (error) {
      console.error('获取词汇数据失败:', error);
      return null;
    }
  }

  static async getWordsByUnit(unitId: string): Promise<Word[]> {
    try {
      return await db.words.where('unit').equals(parseInt(unitId)).toArray();
    } catch (error) {
      console.error('获取单元词汇失败:', error);
      return [];
    }
  }

  static async getWordsForPractice(): Promise<Word[]> {
    try {
      return await db.words.toArray();
    } catch (error) {
      console.error('获取练习单词失败:', error);
      return [];
    }
  }

  static async initializeVocabulary(): Promise<void> {
    try {
      const response = await fetch('/grade6_B_enhanced.json');
      const vocabularyData = await response.json() as VocabularyData;
      await this.initializeVocabularyData(vocabularyData);
    } catch (error) {
      console.error('初始化词汇失败:', error);
      throw error;
    }
  }

  static async clearAndReinitializeVocabulary(): Promise<void> {
    try {
      // Clear existing vocabulary data
      await db.vocabularyData.clear();
      await db.words.clear();
      console.log('清除现有词汇数据');
      
      // Fetch and initialize data directly without calling initializeVocabulary to avoid recursion
      const response = await fetch('/grade6_B_enhanced.json');
      if (!response.ok) {
        throw new Error('无法加载词汇数据');
      }
      const vocabularyData = await response.json() as VocabularyData;
      
      // Insert vocabulary data
      await db.vocabularyData.add(vocabularyData);
      
      // Insert all words
      const allWords: Word[] = [];
      vocabularyData.units.forEach(unit => {
        allWords.push(...unit.words);
      });
      
      await db.words.bulkPut(allWords);
      console.log('重新初始化词汇数据完成');
    } catch (error) {
      console.error('重新初始化词汇失败:', error);
      throw error;
    }
  }

  static async updateWordProgress(wordId: string, updates: Partial<Word>): Promise<void> {
    try {
      await db.words.update(wordId, {
        ...updates,
        lastReviewed: new Date().toISOString()
      });
    } catch (error) {
      console.error('更新单词进度失败:', error);
      throw error;
    }
  }

  static async getWordsForReview(limit: number = 20): Promise<Word[]> {
    try {
      const now = new Date().toISOString();
      
      // Get words that are due for review (nextReview <= now) and not mastered (masteryLevel <= 4)
      const dueWords = await db.words
        .where('nextReview')
        .belowOrEqual(now)
        .and(word => word.masteryLevel <= 4)
        .toArray();
      
      // Get words that have never been reviewed (nextReview is null) and not mastered
      const newWords = await db.words
        .where('nextReview')
        .equals(null as unknown as string)
        .and(word => word.masteryLevel <= 4)
        .toArray();
      
      // Combine both arrays and limit the results
      const allReviewWords = [...dueWords, ...newWords];
      return allReviewWords.slice(0, limit);
    } catch (error) {
      console.error('获取复习单词失败:', error);
      return [];
    }
  }

  static async saveUser(user: User): Promise<void> {
    try {
      await db.users.put(user);
      await db.userProgress.put(user.progress);
      await db.studySettings.put({ ...user.settings, userId: user.id });
    } catch (error) {
      console.error('保存用户数据失败:', error);
      throw error;
    }
  }

  static async getUser(userId: string): Promise<User | null> {
    try {
      const user = await db.users.get(userId);
      if (!user) return null;

      const progress = await db.userProgress.get(userId);
      const settings = await db.studySettings.get(userId);

      return {
        ...user,
        progress: progress || this.getDefaultUserProgress(userId),
        settings: settings || this.getDefaultStudySettings(userId)
      };
    } catch (error) {
      console.error('获取用户数据失败:', error);
      return null;
    }
  }

  static async updateUserProgress(userId: string, progress: Partial<UserProgress>): Promise<void> {
    try {
      await db.userProgress.update(userId, progress);
    } catch (error) {
      console.error('更新用户进度失败:', error);
      throw error;
    }
  }

  static async updateUnitProgress(userId: string, unitId: number, progress: Partial<UnitProgress>): Promise<void> {
    try {
      const key = `${userId}-${unitId}`;
      const existingProgress = await db.unitProgress.get(key);
      
      if (existingProgress) {
        await db.unitProgress.update(key, progress);
      } else {
        await db.unitProgress.add({
          userId,
          unitId,
          completionRate: 0,
          totalWords: 0,
          masteredWords: 0,
          avgMasteryLevel: 0,
          lastStudied: new Date().toISOString(),
          ...progress
        });
      }
    } catch (error) {
      console.error('更新单元进度失败:', error);
      throw error;
    }
  }

  static async savePracticeSession(session: PracticeSession): Promise<void> {
    try {
      await db.practiceSessions.add(session);
    } catch (error) {
      console.error('保存练习记录失败:', error);
      throw error;
    }
  }

  static async getUserStats(userId: string): Promise<{
    totalWords: number;
    masteredWords: number;
    weakWords: Word[];
    recentSessions: PracticeSession[];
  }> {
    try {
      const totalWords = await db.words.count();
      const masteredWords = await db.words.where('masteryLevel').aboveOrEqual(4).count();
      const weakWords = await db.words
        .where('masteryLevel')
        .below(2)
        .and(word => word.repetitionCount > 2)
        .limit(10)
        .toArray();

      const recentSessions = await db.practiceSessions
        .where('userId')
        .equals(userId)
        .reverse()
        .limit(10)
        .toArray();

      return {
        totalWords,
        masteredWords,
        weakWords,
        recentSessions
      };
    } catch (error) {
      console.error('获取用户统计失败:', error);
      return {
        totalWords: 0,
        masteredWords: 0,
        weakWords: [],
        recentSessions: []
      };
    }
  }

  private static getDefaultUserProgress(userId: string): UserProgress {
    return {
      userId,
      totalWordsLearned: 0,
      currentStreak: 0,
      maxStreak: 0,
      totalPracticeTime: 0,
      lastActiveDate: new Date().toISOString(),
      unitsProgress: []
    };
  }

  private static getDefaultStudySettings(userId: string = 'default-user'): StudySettings {
    return {
      userId,
      practiceTypes: ['flashcard', 'typing', 'multipleChoice'],
      questionsPerSession: 20,
      timeLimit: 30,
      soundEnabled: true,
      adaptiveDifficulty: true,
      reviewMode: false,
      autoplay: true
    };
  }

  static async clearAllData(): Promise<void> {
    try {
      await db.delete();
      console.log('所有数据已清除');
    } catch (error) {
      console.error('清除数据失败:', error);
      throw error;
    }
  }
}
