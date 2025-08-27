/**
 * Minimal server-side data structures for Tencent EdgeOne deployment
 * Designed to keep server data minimal while enabling cross-device sync
 */

export interface ServerUser {
  id: string;
  email?: string;
  username: string;
  deviceId: string; // Unique identifier for the device that created this user
  grade: string;
  createdAt: string;
  lastActiveAt: string;
  updatedAt?: string;
  lastSyncAt?: string;
}

export interface ServerWordProgress {
  wordId: string; // Reference to the word in the vocabulary data
  masteryLevel: number; // 0-5, core learning progress
  repetitionCount: number;
  lastReviewed?: string;
  nextReview?: string;
  easeFactor: number;
  // Optional: minimal practice history for advanced analytics
  practiceHistory?: {
    timestamp: string;
    isCorrect: boolean;
    responseTime?: number;
    practiceType?: string;
  }[];
}

export interface ServerUserProgress {
  userId: string;
  // Core progress metrics only
  totalWordsLearned: number;
  currentStreak: number;
  maxStreak: number;
  lastActiveDate: string;
  
  // Minimal word progress - only for words with significant progress
  wordProgress: ServerWordProgress[]; // Only store words with masteryLevel > 0 or repetitionCount > 0
  
  // Simplified session summary for streak tracking
  recentSessionDates: string[]; // Last 30 days of practice dates (YYYY-MM-DD format)
  
  // Version control for sync
  version: number;
  lastSyncAt: string;
  updatedAt: string;
}

export interface ServerSyncData {
  user: ServerUser;
  progress: ServerUserProgress;
  syncMetadata: {
    syncId: string;
    timestamp: string;
    clientVersion: string;
    serverVersion: string;
  };
}

// For KV storage optimization - store data in separate keys
export interface KVStorageSchema {
  // User account: `user:${userId}`
  [userKey: `user:${string}`]: ServerUser;
  
  // User progress: `progress:${userId}`
  [progressKey: `progress:${string}`]: ServerUserProgress;
  
  // Device mapping: `device:${deviceId}` -> userId (for device-based authentication)
  [deviceKey: `device:${string}`]: string;
  
  // Email mapping: `email:${email}` -> userId (for email-based authentication)
  [emailKey: `email:${string}`]: string;
}

// Minimal practice session data for server storage
export interface ServerPracticeSession {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  practiceType: string;
  wordsStudied: number;
  accuracy: number;
  timeSpent: number; // in minutes
  createdAt: string;
}

// Sync conflict resolution
export interface SyncConflict {
  field: string;
  clientValue: unknown;
  serverValue: unknown;
  resolvedValue: unknown;
  resolution: 'client' | 'server' | 'merged';
}

export interface SyncResult {
  success: boolean;
  conflicts?: SyncConflict[];
  updatedProgress?: ServerUserProgress;
  error?: string;
}

// Lightweight user authentication
export interface AuthRequest {
  deviceId: string;
  email?: string;
  username?: string;
  grade?: string;
}

export interface AuthResponse {
  user: ServerUser;
  token: string; // Simple JWT or session token
  isNewUser: boolean;
  isNewDevice: boolean;
  expiresAt: string;
}

// Progress sync request/response
export interface ProgressSyncRequest {
  userId: string;
  token: string;
  localProgress: Partial<ServerUserProgress>;
  lastSyncVersion?: number;
  deviceInfo?: {
    deviceId: string;
    platform: string;
    timestamp: string;
  };
}

export interface ProgressSyncResponse {
  success: boolean;
  serverProgress?: ServerUserProgress;
  conflicts?: SyncConflict[];
  syncResult?: SyncResult;
  error?: string;
}

// Data minimization utilities
export class DataMinimizer {
  /**
   * Extract only essential word progress for server storage
   * Only stores dynamic user-specific data, not static word content
   */
  static minimizeWordProgress(
    words: Array<{
      id: string;
      masteryLevel: number;
      repetitionCount: number;
      lastReviewed?: string;
      nextReview?: string;
      easeFactor: number;
      practiceHistory?: Array<{
        timestamp: string;
        isCorrect: boolean;
        responseTime?: number;
        practiceType?: string;
      }>;
    }>
  ): ServerWordProgress[] {
    return words
      .filter(word => word.masteryLevel > 0 || word.repetitionCount > 0)
      .map(word => {
        const serverWord: ServerWordProgress = {
          wordId: word.id, // Only store the ID reference
          masteryLevel: word.masteryLevel,
          repetitionCount: word.repetitionCount,
          lastReviewed: word.lastReviewed,
          nextReview: word.nextReview,
          easeFactor: word.easeFactor
        };

        // Optional: Include recent practice history (last 5 attempts) for analytics
        if (word.practiceHistory && word.practiceHistory.length > 0) {
          serverWord.practiceHistory = word.practiceHistory
            .slice(-5) // Keep only last 5 practice attempts
            .map(attempt => ({
              timestamp: attempt.timestamp,
              isCorrect: attempt.isCorrect,
              responseTime: attempt.responseTime,
              practiceType: attempt.practiceType
            }));
        }

        return serverWord;
      });
  }

  /**
   * Extract practice session dates for streak calculation
   */
  static extractSessionDates(sessions: Array<{ startTime: string }>): string[] {
    const dates = new Set(
      sessions.map(session => new Date(session.startTime).toISOString().split('T')[0])
    );
    return Array.from(dates)
      .sort()
      .slice(-30); // Keep only last 30 days
  }

  /**
   * Calculate storage size estimate in bytes
   */
  static estimateStorageSize(data: ServerUserProgress): number {
    return JSON.stringify(data).length;
  }
}

// Error types for API responses
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type APIResponse<T> = {
  success: true;
  data: T;
  timestamp: string;
} | {
  success: false;
  error: APIError;
  timestamp: string;
};
