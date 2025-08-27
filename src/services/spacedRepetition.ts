import type { Word } from '../types';

/**
 * 间隔重复算法 (基于SM-2算法的改进版本)
 * 用于计算单词的下次复习时间和难度调整
 */
export class SpacedRepetitionService {
  /**
   * 根据用户答题表现更新单词的学习数据
   * @param word 要更新的单词
   * @param quality 答题质量 (0-5): 0=完全忘记, 1=错误但有印象, 2=错误但简单, 3=正确但困难, 4=正确, 5=完全掌握
   * @param responseTime 响应时间 (秒)
   * @returns 更新后的单词数据
   */
  static updateWordScheduling(
    word: Word, 
    quality: number, 
    responseTime: number = 0
  ): Partial<Word> {
    let { 
      repetitionCount, 
      easeFactor, 
      masteryLevel 
    } = word;

    // 确保质量评分在有效范围内
    quality = Math.max(0, Math.min(5, quality));

    // 更新重复次数
    if (quality >= 3) {
      repetitionCount += 1;
    } else {
      repetitionCount = 0; // 答错了重新开始
    }

    // 更新难度因子 (SM-2算法)
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor); // 最小难度因子

    // 更新掌握水平
    masteryLevel = this.calculateMasteryLevel(word, quality, responseTime);

    // 计算下次复习间隔 (天)
    const interval = this.calculateInterval(repetitionCount, easeFactor, quality);

    // 计算下次复习时间
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return {
      repetitionCount,
      easeFactor,
      masteryLevel,
      lastReviewed: new Date().toISOString(),
      nextReview: nextReview.toISOString()
    };
  }

  /**
   * 计算复习间隔
   * @param repetitionCount 重复次数
   * @param easeFactor 难度因子
   * @param quality 答题质量
   * @returns 间隔天数
   */
  private static calculateInterval(
    repetitionCount: number, 
    easeFactor: number, 
    quality: number
  ): number {
    if (repetitionCount === 0) {
      return 1; // 第一次复习，明天
    } else if (repetitionCount === 1) {
      return 6; // 第二次复习，6天后
    } else {
      // 使用SM-2算法计算间隔
      const baseInterval = repetitionCount === 2 ? 6 : Math.ceil(6 * Math.pow(easeFactor, repetitionCount - 2));
      
      // 根据答题质量调整
      const qualityMultiplier = quality < 3 ? 0.5 : 1;
      
      return Math.max(1, Math.ceil(baseInterval * qualityMultiplier));
    }
  }

  /**
   * 计算掌握水平 (0-5)
   * @param word 单词
   * @param quality 答题质量
   * @param responseTime 响应时间
   * @returns 掌握水平
   */
  private static calculateMasteryLevel(
    word: Word, 
    quality: number, 
    responseTime: number
  ): number {
    let masteryLevel = word.masteryLevel;

    // 基于答题质量调整
    if (quality >= 4) {
      masteryLevel += 0.7;
    } else if (quality === 3) {
      masteryLevel += 0.4;
    } else if (quality === 2) {
      masteryLevel -= 0.4;
    } else {
      masteryLevel -= 0.9;
    }

    // 基于响应时间调整 (响应越快，掌握越好)
    if (responseTime > 0) {
      const timeBonus = responseTime < 3 ? 0.1 : responseTime < 5 ? 0.05 : -0.05;
      masteryLevel += timeBonus;
    }

    // 基于历史表现调整
    if (word.repetitionCount >= 3 && quality >= 4) {
      masteryLevel += 0.1; // 连续正确的奖励
    }

    // 确保在有效范围内
    return Math.max(0, Math.min(5, masteryLevel));
  }

  /**
   * 根据用户表现评估答题质量
   * @param isCorrect 是否正确
   * @param responseTime 响应时间(秒)
   * @param previousAttempts 之前的尝试次数
   * @returns 质量评分 (0-5)
   */
  static assessQuality(
    isCorrect: boolean, 
    responseTime: number, 
    previousAttempts: number = 0
  ): number {
    if (!isCorrect) {
      return previousAttempts === 0 ? 1 : 0; // 第一次错误给1分，重复错误给0分
    }

    // 正确答案的质量评估
    if (responseTime < 2) {
      return 5; // 非常快速且正确
    } else if (responseTime < 5) {
      return 4; // 快速正确
    } else if (responseTime < 10) {
      return 3; // 正确但需要思考
    } else {
      return 2; // 正确但很困难
    }
  }

  /**
   * 获取需要复习的单词
   * @param words 所有单词
   * @param limit 限制数量
   * @returns 需要复习的单词列表
   */
  static getWordsForReview(words: Word[], limit: number = 20): Word[] {
    const now = new Date();
    
    const reviewWords = words.filter(word => {
      // 过滤掉已经完全掌握的单词 (masteryLevel > 4)
      if (word.masteryLevel > 4) return false;
      
      if (!word.nextReview) return true; // 从未学习过的单词
      
      const nextReviewDate = new Date(word.nextReview);
      return nextReviewDate <= now; // 到达复习时间的单词
    });

    // 按优先级排序：掌握水平低的优先，然后是最久没复习的
    reviewWords.sort((a, b) => {
      if (a.masteryLevel !== b.masteryLevel) {
        return a.masteryLevel - b.masteryLevel;
      }
      
      const aLastReviewed = new Date(a.lastReviewed || '1970-01-01');
      const bLastReviewed = new Date(b.lastReviewed || '1970-01-01');
      return aLastReviewed.getTime() - bLastReviewed.getTime();
    });

    return reviewWords.slice(0, limit);
  }

  /**
   * 计算学习建议
   * @param words 单词列表
   * @returns 学习建议
   */
  static getStudyRecommendations(words: Word[]): {
    newWords: number;
    reviewWords: number;
    difficultWords: number;
    dailyGoal: number;
  } {
    const newWords = words.filter(w => w.repetitionCount === 0).length;
    const reviewWords = this.getWordsForReview(words).length;
    const difficultWords = words.filter(w => w.masteryLevel < 2 && w.repetitionCount > 2).length;
    
    // 建议每日学习目标
    const dailyGoal = Math.min(20, Math.max(5, reviewWords + Math.ceil(newWords * 0.1)));

    return {
      newWords,
      reviewWords,
      difficultWords,
      dailyGoal
    };
  }

  /**
   * 自适应难度调整
   * @param sessionAccuracy 会话准确率
   * @param averageResponseTime 平均响应时间
   * @param currentDifficulty 当前难度等级
   * @returns 建议的难度等级
   */
  static adjustDifficulty(
    sessionAccuracy: number,
    averageResponseTime: number,
    currentDifficulty: number
  ): number {
    let newDifficulty = currentDifficulty;

    // 基于准确率调整
    if (sessionAccuracy > 0.85 && averageResponseTime < 4) {
      newDifficulty += 0.5; // 表现很好，增加难度
    } else if (sessionAccuracy > 0.75) {
      newDifficulty += 0.2; // 表现良好，略微增加难度
    } else if (sessionAccuracy < 0.6) {
      newDifficulty -= 0.5; // 表现不佳，降低难度
    } else if (sessionAccuracy < 0.7) {
      newDifficulty -= 0.2; // 表现一般，略微降低难度
    }

    // 基于响应时间调整
    if (averageResponseTime > 8) {
      newDifficulty -= 0.3; // 响应太慢，降低难度
    } else if (averageResponseTime < 3) {
      newDifficulty += 0.2; // 响应很快，可以增加难度
    }

    // 确保难度在合理范围内
    return Math.max(1, Math.min(5, newDifficulty));
  }
}
