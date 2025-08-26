import { db } from './database';
import type { Word, PracticeSession, UnitProgress } from '../types';

export interface ProgressStats {
  overall: {
    totalWords: number;
    masteredWords: number;
    learningWords: number;
    newWords: number;
    masteryRate: number;
    averageMasteryLevel: number;
  };
  daily: {
    date: string;
    wordsStudied: number;
    accuracy: number;
    timeSpent: number;
    sessionsCompleted: number;
  }[];
  weekly: {
    week: string;
    wordsLearned: number;
    accuracy: number;
    timeSpent: number;
    sessionsCompleted: number;
  }[];
  monthly: {
    month: string;
    wordsLearned: number;
    accuracy: number;
    timeSpent: number;
    sessionsCompleted: number;
  }[];
  masteryDistribution: {
    level: number;
    count: number;
    percentage: number;
  }[];
  unitProgress: {
    unitId: number;
    unitName: string;
    totalWords: number;
    masteredWords: number;
    completionRate: number;
    averageMasteryLevel: number;
  }[];
  weakWords: {
    word: Word;
    attempts: number;
    accuracy: number;
    lastPracticed: string;
  }[];
  streakData: {
    currentStreak: number;
    maxStreak: number;
    streakHistory: { date: string; active: boolean }[];
  };
  practiceTypeStats: {
    type: string;
    totalSessions: number;
    averageAccuracy: number;
    averageTime: number;
    totalWords: number;
  }[];
}

export class ProgressService {
  static async calculateProgressStats(userId: string = 'default-user'): Promise<ProgressStats> {
    try {
      const [words, sessions, units] = await Promise.all([
        db.words.toArray(),
        db.practiceSessions.where('userId').equals(userId).toArray(),
        db.vocabularyData.toCollection().first()
      ]);

      const unitProgressData = await db.unitProgress.where('userId').equals(userId).toArray();

      // Calculate overall stats
      const overall = this.calculateOverallStats(words);
      
      // Calculate time-based progress
      const daily = this.calculateDailyProgress(sessions);
      const weekly = this.calculateWeeklyProgress(sessions);
      const monthly = this.calculateMonthlyProgress(sessions);
      
      // Calculate mastery distribution
      const masteryDistribution = this.calculateMasteryDistribution(words);
      
      // Calculate unit progress
      const unitProgress = this.calculateUnitProgress(words, units?.units || [], unitProgressData);
      
      // Find weak words
      const weakWords = this.calculateWeakWords(words, sessions);
      
      // Calculate streak data
      const streakData = this.calculateStreakData(sessions);
      
      // Calculate practice type statistics
      const practiceTypeStats = this.calculatePracticeTypeStats(sessions);

      return {
        overall,
        daily,
        weekly,
        monthly,
        masteryDistribution,
        unitProgress,
        weakWords,
        streakData,
        practiceTypeStats
      };
    } catch (error) {
      console.error('计算进度统计失败:', error);
      throw error;
    }
  }

  private static calculateOverallStats(words: Word[]) {
    const totalWords = words.length;
    const masteredWords = words.filter(w => w.masteryLevel >= 4).length;
    const learningWords = words.filter(w => w.masteryLevel > 0 && w.masteryLevel < 4).length;
    const newWords = words.filter(w => w.masteryLevel === 0).length;
    
    const masteryRate = totalWords > 0 ? (masteredWords / totalWords) * 100 : 0;
    const averageMasteryLevel = totalWords > 0 
      ? words.reduce((sum, w) => sum + w.masteryLevel, 0) / totalWords 
      : 0;

    return {
      totalWords,
      masteredWords,
      learningWords,
      newWords,
      masteryRate,
      averageMasteryLevel
    };
  }

  private static calculateDailyProgress(sessions: PracticeSession[]) {
    const dailyData = new Map<string, {
      wordsStudied: Set<string>;
      totalAnswers: number;
      correctAnswers: number;
      sessionCount: number;
      timeSpent: number;
    }>();

    sessions.forEach(session => {
      const date = new Date(session.startTime).toISOString().split('T')[0];
      
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          wordsStudied: new Set(),
          totalAnswers: 0,
          correctAnswers: 0,
          sessionCount: 0,
          timeSpent: 0
        });
      }

      const dayData = dailyData.get(date)!;
      session.words.forEach(wordId => dayData.wordsStudied.add(wordId));
      
      // Calculate accuracy from individual answers for more precision
      if (session.answers && session.answers.length > 0) {
        dayData.totalAnswers += session.answers.length;
        dayData.correctAnswers += session.answers.filter(answer => answer.isCorrect).length;
      } else {
        // Fallback to session-level data if answers are not available
        dayData.totalAnswers += session.totalWords;
        dayData.correctAnswers += session.correctWords;
      }
      
      dayData.sessionCount += 1;
      
      if (session.endTime) {
        const duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
        dayData.timeSpent += duration / 1000 / 60; // Convert to minutes
      }
    });

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        wordsStudied: data.wordsStudied.size,
        accuracy: data.totalAnswers > 0 ? (data.correctAnswers / data.totalAnswers) * 100 : 0,
        timeSpent: Math.round(data.timeSpent),
        sessionsCompleted: data.sessionCount
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }

  private static calculateWeeklyProgress(sessions: PracticeSession[]) {
    const weeklyData = new Map<string, {
      wordsLearned: Set<string>;
      totalAnswers: number;
      correctAnswers: number;
      sessionCount: number;
      timeSpent: number;
    }>();

    sessions.forEach(session => {
      const date = new Date(session.startTime);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          wordsLearned: new Set(),
          totalAnswers: 0,
          correctAnswers: 0,
          sessionCount: 0,
          timeSpent: 0
        });
      }

      const weekData = weeklyData.get(weekKey)!;
      session.words.forEach(wordId => weekData.wordsLearned.add(wordId));
      
      // Calculate accuracy from individual answers for more precision
      if (session.answers && session.answers.length > 0) {
        weekData.totalAnswers += session.answers.length;
        weekData.correctAnswers += session.answers.filter(answer => answer.isCorrect).length;
      } else {
        // Fallback to session-level data if answers are not available
        weekData.totalAnswers += session.totalWords;
        weekData.correctAnswers += session.correctWords;
      }
      
      weekData.sessionCount += 1;
      
      if (session.endTime) {
        const duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
        weekData.timeSpent += duration / 1000 / 60;
      }
    });

    return Array.from(weeklyData.entries())
      .map(([week, data]) => ({
        week,
        wordsLearned: data.wordsLearned.size,
        accuracy: data.totalAnswers > 0 ? (data.correctAnswers / data.totalAnswers) * 100 : 0,
        timeSpent: Math.round(data.timeSpent),
        sessionsCompleted: data.sessionCount
      }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12); // Last 12 weeks
  }

  private static calculateMonthlyProgress(sessions: PracticeSession[]) {
    const monthlyData = new Map<string, {
      wordsLearned: Set<string>;
      totalAnswers: number;
      correctAnswers: number;
      sessionCount: number;
      timeSpent: number;
    }>();

    sessions.forEach(session => {
      const date = new Date(session.startTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          wordsLearned: new Set(),
          totalAnswers: 0,
          correctAnswers: 0,
          sessionCount: 0,
          timeSpent: 0
        });
      }

      const monthData = monthlyData.get(monthKey)!;
      session.words.forEach(wordId => monthData.wordsLearned.add(wordId));
      
      // Calculate accuracy from individual answers for more precision
      if (session.answers && session.answers.length > 0) {
        monthData.totalAnswers += session.answers.length;
        monthData.correctAnswers += session.answers.filter(answer => answer.isCorrect).length;
      } else {
        // Fallback to session-level data if answers are not available
        monthData.totalAnswers += session.totalWords;
        monthData.correctAnswers += session.correctWords;
      }
      
      monthData.sessionCount += 1;
      
      if (session.endTime) {
        const duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
        monthData.timeSpent += duration / 1000 / 60;
      }
    });

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        wordsLearned: data.wordsLearned.size,
        accuracy: data.totalAnswers > 0 ? (data.correctAnswers / data.totalAnswers) * 100 : 0,
        timeSpent: Math.round(data.timeSpent),
        sessionsCompleted: data.sessionCount
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months
  }

  private static calculateMasteryDistribution(words: Word[]) {
    const distribution = Array(6).fill(0).map((_, i) => ({ level: i, count: 0, percentage: 0 }));
    
    words.forEach(word => {
      const level = Math.min(Math.floor(word.masteryLevel), 5);
      distribution[level].count++;
    });

    const total = words.length;
    distribution.forEach(item => {
      item.percentage = total > 0 ? (item.count / total) * 100 : 0;
    });

    return distribution;
  }

  private static calculateUnitProgress(words: Word[], units: any[], unitProgressData: UnitProgress[]) {
    return units.map(unit => {
      const unitWords = words.filter(w => w.unit === unit.id);
      const masteredWords = unitWords.filter(w => w.masteryLevel >= 4).length;
      const totalWords = unitWords.length;
      const completionRate = totalWords > 0 ? (masteredWords / totalWords) * 100 : 0;
      const averageMasteryLevel = totalWords > 0 
        ? unitWords.reduce((sum, w) => sum + w.masteryLevel, 0) / totalWords 
        : 0;

      return {
        unitId: unit.id,
        unitName: unit.name,
        totalWords,
        masteredWords,
        completionRate,
        averageMasteryLevel
      };
    });
  }

  private static calculateWeakWords(words: Word[], sessions: PracticeSession[]) {
    const wordStats = new Map<string, {
      word: Word;
      attempts: number;
      correct: number;
      lastPracticed: string;
    }>();

    // Initialize with all words
    words.forEach(word => {
      wordStats.set(word.id, {
        word,
        attempts: 0,
        correct: 0,
        lastPracticed: word.lastReviewed || ''
      });
    });

    // Calculate stats from sessions
    sessions.forEach(session => {
      session.answers.forEach(answer => {
        const stats = wordStats.get(answer.wordId);
        if (stats) {
          stats.attempts++;
          if (answer.isCorrect) {
            stats.correct++;
          }
          stats.lastPracticed = answer.timestamp.toString();
        }
      });
    });

    return Array.from(wordStats.values())
      .filter(stats => stats.attempts > 0)
      .map(stats => ({
        word: stats.word,
        attempts: stats.attempts,
        accuracy: stats.correct / stats.attempts * 100,
        lastPracticed: stats.lastPracticed
      }))
      .filter(item => item.accuracy < 60 && item.attempts >= 3) // Words with < 60% accuracy and at least 3 attempts
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 10); // Top 10 weak words
  }

  private static calculateStreakData(sessions: PracticeSession[]) {
    // Sort sessions by date
    const sortedSessions = sessions
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    if (sortedSessions.length === 0) {
      return {
        currentStreak: 0,
        maxStreak: 0,
        streakHistory: []
      };
    }

    // Get unique practice dates
    const practiceDates = new Set(
      sortedSessions.map(session => 
        new Date(session.startTime).toISOString().split('T')[0]
      )
    );

    const practiceArray = Array.from(practiceDates).sort();
    
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    // Calculate streaks
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Check if today or yesterday has practice
    const hasRecentPractice = practiceArray.includes(today) || practiceArray.includes(yesterday);

    if (hasRecentPractice) {
      // Calculate current streak backwards from today/yesterday
      const startDate = practiceArray.includes(today) ? today : yesterday;
      let checkDate = new Date(startDate);
      
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (practiceArray.includes(dateStr)) {
          currentStreak++;
        } else {
          break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    // Calculate max streak
    for (let i = 0; i < practiceArray.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDate = new Date(practiceArray[i - 1]);
        const currDate = new Date(practiceArray[i]);
        const daysDiff = (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000);
        
        if (daysDiff === 1) {
          tempStreak++;
        } else {
          maxStreak = Math.max(maxStreak, tempStreak);
          tempStreak = 1;
        }
      }
    }
    maxStreak = Math.max(maxStreak, tempStreak);

    // Generate streak history for last 30 days
    const streakHistory = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      streakHistory.push({
        date: dateStr,
        active: practiceArray.includes(dateStr)
      });
    }

    return {
      currentStreak,
      maxStreak,
      streakHistory
    };
  }

  private static calculatePracticeTypeStats(sessions: PracticeSession[]) {
    const typeStats = new Map<string, {
      totalSessions: number;
      totalAnswers: number;
      correctAnswers: number;
      totalTime: number;
      totalWords: number;
    }>();

    sessions.forEach(session => {
      const type = session.practiceType;
      
      if (!typeStats.has(type)) {
        typeStats.set(type, {
          totalSessions: 0,
          totalAnswers: 0,
          correctAnswers: 0,
          totalTime: 0,
          totalWords: 0
        });
      }

      const stats = typeStats.get(type)!;
      stats.totalSessions++;
      
      // Calculate accuracy from individual answers for more precision
      if (session.answers && session.answers.length > 0) {
        stats.totalAnswers += session.answers.length;
        stats.correctAnswers += session.answers.filter(answer => answer.isCorrect).length;
      } else {
        // Fallback to session-level data if answers are not available
        stats.totalAnswers += session.totalWords;
        stats.correctAnswers += session.correctWords;
      }
      
      stats.totalWords += session.totalWords;
      
      if (session.endTime) {
        const duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
        stats.totalTime += duration / 1000; // Convert to seconds
      }
    });

    return Array.from(typeStats.entries()).map(([type, stats]) => ({
      type,
      totalSessions: stats.totalSessions,
      averageAccuracy: stats.totalAnswers > 0 ? (stats.correctAnswers / stats.totalAnswers) * 100 : 0,
      averageTime: stats.totalSessions > 0 ? stats.totalTime / stats.totalSessions : 0,
      totalWords: stats.totalWords
    }));
  }
}
