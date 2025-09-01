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
import type {
  UserSubscription,
  PaymentRecord,
  UsageStats
} from '../types/subscription';

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
  
  // 订阅相关表
  subscriptions!: Dexie.Table<UserSubscription, string>;
  payments!: Dexie.Table<PaymentRecord, string>;
  usageStats!: Dexie.Table<UsageStats & { id: string }, string>;

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
    
    // Version 2: Add subscription tables
    this.version(2).stores({
      vocabularyData: '++id, grade, metadata.version',
      words: 'id, word, unit, difficulty, masteryLevel, lastReviewed, nextReview',
      users: 'id, username, email, grade',
      userProgress: 'userId, lastActiveDate, currentStreak',
      unitProgress: 'userId, unitId, lastStudied, completionRate',
      practiceSessions: 'id, userId, unitId, practiceType, startTime, completed',
      studySettings: 'userId, practiceTypes, adaptiveDifficulty',
      subscriptions: 'id, userId, planId, status, currentPeriodStart, currentPeriodEnd',
      payments: 'id, userId, subscriptionId, status, paymentMethod, createdAt',
      usageStats: 'id, userId, lastResetDate'
    });

    // 添加钩子来自动处理日期字符串
    this.words.hook('creating', (_primaryKey, obj) => {
      if (!obj.lastReviewed) obj.lastReviewed = null;
      if (!obj.nextReview) obj.nextReview = null;
    });

    this.practiceSessions.hook('creating', (_primaryKey, obj) => {
      obj.startTime = obj.startTime || new Date().toISOString();
    });
    
    // Subscription hooks
    this.subscriptions.hook('creating', (_primaryKey, obj) => {
      const now = new Date().toISOString();
      if (!obj.createdAt) obj.createdAt = now;
      if (!obj.updatedAt) obj.updatedAt = now;
      if (!obj.id) obj.id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    });
    
    this.subscriptions.hook('updating', (_modifications, _primaryKey, obj) => {
      obj.updatedAt = new Date().toISOString();
    });
    
    this.payments.hook('creating', (_primaryKey, obj) => {
      const now = new Date().toISOString();
      if (!obj.createdAt) obj.createdAt = now;
      if (!obj.id) obj.id = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  // Subscription Management Methods
  static async saveSubscription(subscription: UserSubscription): Promise<void> {
    try {
      await db.subscriptions.put(subscription);
      console.log('订阅数据已保存:', subscription.id);
    } catch (error) {
      console.error('保存订阅数据失败:', error);
      throw error;
    }
  }

  static async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      return await db.subscriptions.where('userId').equals(userId).first() || null;
    } catch (error) {
      console.error('获取用户订阅失败:', error);
      return null;
    }
  }

  static async updateSubscription(subscriptionId: string, updates: Partial<UserSubscription>): Promise<void> {
    try {
      await db.subscriptions.update(subscriptionId, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      console.log('订阅已更新:', subscriptionId);
    } catch (error) {
      console.error('更新订阅失败:', error);
      throw error;
    }
  }

  static async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await db.subscriptions.update(subscriptionId, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('订阅已取消:', subscriptionId);
    } catch (error) {
      console.error('取消订阅失败:', error);
      throw error;
    }
  }

  static async savePaymentRecord(payment: PaymentRecord): Promise<void> {
    try {
      await db.payments.put(payment);
      console.log('支付记录已保存:', payment.id);
    } catch (error) {
      console.error('保存支付记录失败:', error);
      throw error;
    }
  }

  static async getUserPayments(userId: string, limit: number = 10): Promise<PaymentRecord[]> {
    try {
      return await db.payments
        .where('userId')
        .equals(userId)
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('获取支付记录失败:', error);
      return [];
    }
  }

  static async updatePaymentStatus(paymentId: string, status: PaymentRecord['status'], transactionId?: string): Promise<void> {
    try {
      const updates: Partial<PaymentRecord> = { status };
      if (transactionId) {
        updates.transactionId = transactionId;
      }
      if (status === 'completed') {
        updates.completedAt = new Date().toISOString();
      }
      
      await db.payments.update(paymentId, updates);
      console.log('支付状态已更新:', paymentId, status);
    } catch (error) {
      console.error('更新支付状态失败:', error);
      throw error;
    }
  }

  static async saveUsageStats(userId: string, stats: UsageStats): Promise<void> {
    try {
      const usageRecord = {
        id: userId,
        userId,
        ...stats
      };
      await db.usageStats.put(usageRecord);
    } catch (error) {
      console.error('保存使用统计失败:', error);
      throw error;
    }
  }

  static async getUserUsageStats(userId: string): Promise<UsageStats | null> {
    try {
      const record = await db.usageStats.get(userId);
      if (!record) return null;
      
      const { id, ...stats } = record;
      // Note: userId property removed from UsageStats interface
      return stats;
    } catch (error) {
      console.error('获取使用统计失败:', error);
      return null;
    }
  }

  static async getExpiredTrials(): Promise<UserSubscription[]> {
    try {
      const now = new Date().toISOString();
      return await db.subscriptions
        .where('status')
        .equals('trial')
        .and(sub => sub.currentPeriodEnd <= now)
        .toArray();
    } catch (error) {
      console.error('获取过期试用失败:', error);
      return [];
    }
  }

  static async getActiveSubscriptions(): Promise<UserSubscription[]> {
    try {
      return await db.subscriptions
        .where('status')
        .equals('active')
        .toArray();
    } catch (error) {
      console.error('获取活跃订阅失败:', error);
      return [];
    }
  }

  static async getSubscriptionsByStatus(status: UserSubscription['status']): Promise<UserSubscription[]> {
    try {
      return await db.subscriptions
        .where('status')
        .equals(status)
        .toArray();
    } catch (error) {
      console.error('获取订阅失败:', error);
      return [];
    }
  }

  // Cleanup expired data
  static async cleanupExpiredData(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString();

      // Clean up old practice sessions
      await db.practiceSessions
        .where('startTime')
        .below(cutoffDate)
        .delete();

      // Clean up old payment records (keep completed ones)
      await db.payments
        .where('createdAt')
        .below(cutoffDate)
        .and(payment => payment.status === 'failed')
        .delete();

      console.log('过期数据清理完成');
    } catch (error) {
      console.error('清理过期数据失败:', error);
    }
  }
}
