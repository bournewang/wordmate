/**
 * Sync Manager for WordMate
 * Handles offline-first sync with minimal server storage
 * Only syncs dynamic progress data, not static word content
 */

import type { Word, PracticeSession } from '../types';
import type {
  ServerUserProgress,
  ServerWordProgress,
  SyncConflict
} from '../types/serverTypes';
import { apiClient } from './apiClient';
import { DatabaseService } from './database';

export interface LocalProgressData {
  userId: string;
  words: Word[];
  sessions: PracticeSession[];
  totalWordsLearned: number;
  maxStreak: number;
  syncVersion: number;
  lastSyncAt?: string;
}

export interface SyncResult {
  success: boolean;
  conflicts?: SyncConflict[];
  syncedAt?: string;
  error?: string;
  dataSaved?: number; // bytes saved by minimal sync
}

export interface MergeResult {
  merged: LocalProgressData;
  conflicts: SyncConflict[];
  wordsUpdated: number;
  dataReceived: number; // bytes received
}

export class SyncManager {
  private userId: string = 'default-user';
  private isOnline: boolean = navigator.onLine;
  private syncQueue: Array<() => Promise<void>> = [];
  private lastSyncTime: Date | null = null;

  constructor() {
    this.setupNetworkMonitoring();
    this.loadLastSyncTime();
  }

  /**
   * Perform a full sync with the server
   */
  async performFullSync(userId: string = this.userId): Promise<SyncResult> {
    if (!this.isOnline) {
      return this.queueSyncForLater(userId);
    }

    try {
      console.log(`🔄 Starting sync for user ${userId}`);
      
      // 1. Get local data
      const localData = await this.getAllLocalData(userId);
      
      // 2. Prepare minimal server payload
      const syncPayload = this.prepareServerSyncData(localData);
      const originalSize = JSON.stringify(localData.words).length;
      const minimalSize = JSON.stringify(syncPayload.wordProgress).length;
      
      console.log(`📦 Data compression: ${originalSize} → ${minimalSize} bytes (${((1 - minimalSize/originalSize) * 100).toFixed(1)}% reduction)`);
      
      // 3. Send to server
      const response = await apiClient.syncProgress(userId, {
        userId,
        token: apiClient.currentToken || '',
        localProgress: syncPayload,
        lastSyncVersion: localData.syncVersion || 0,
        deviceInfo: {
          deviceId: apiClient.currentDeviceId || '',
          platform: 'web',
          timestamp: new Date().toISOString()
        }
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Sync failed');
      }

      // 4. Apply server data to local storage
      if (response.data.serverProgress) {
        const mergeResult = await this.mergeServerDataToLocal(localData, response.data.serverProgress);
        
        // 5. Save merged data locally
        await this.saveLocalData(userId, mergeResult.merged);
        
        this.lastSyncTime = new Date();
        this.saveLastSyncTime();
        
        console.log(`✅ Sync completed: ${mergeResult.wordsUpdated} words updated, ${mergeResult.conflicts.length} conflicts resolved`);
        
        return {
          success: true,
          conflicts: mergeResult.conflicts,
          syncedAt: new Date().toISOString(),
          dataSaved: originalSize - minimalSize
        };
      }

      return { success: false, error: 'No server response data' };

    } catch (error) {
      console.error('❌ Sync failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Convert local data to minimal server format
   * Only includes dynamic progress data, not static word content
   */
  private prepareServerSyncData(localData: LocalProgressData): ServerUserProgress {
    // Extract only words with progress (masteryLevel > 0 or repetitionCount > 0)
    const wordsWithProgress = localData.words.filter(word => 
      word.masteryLevel > 0 || word.repetitionCount > 0
    );

    const minimizedWords: ServerWordProgress[] = wordsWithProgress.map(word => ({
      wordId: word.id, // Only store the word ID reference
      masteryLevel: word.masteryLevel,
      repetitionCount: word.repetitionCount,
      lastReviewed: word.lastReviewed || undefined,
      nextReview: word.nextReview || undefined,
      easeFactor: word.easeFactor,
      // Include minimal practice history (last 3 attempts only)
      practiceHistory: word.practiceHistory?.slice(-3).map(attempt => ({
        timestamp: attempt.timestamp,
        isCorrect: attempt.isCorrect,
        responseTime: attempt.responseTime || 0,
        practiceType: (attempt.practiceType || 'flashcard') as any
      }))
    }));

    // Extract session dates for streak calculation
    const recentSessionDates = this.extractRecentSessionDates(localData.sessions);
    
    const currentStreak = this.calculateCurrentStreak(localData.sessions);

    return {
      userId: localData.userId,
      totalWordsLearned: localData.totalWordsLearned,
      currentStreak,
      maxStreak: Math.max(localData.maxStreak, currentStreak),
      lastActiveDate: this.getLastActiveDate(localData.sessions),
      wordProgress: minimizedWords,
      recentSessionDates,
      version: (localData.syncVersion || 0) + 1,
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Merge server data back into local storage
   * Reconstructs full word objects by combining server progress with local static data
   */
  private async mergeServerDataToLocal(
    localData: LocalProgressData,
    serverData: ServerUserProgress
  ): Promise<MergeResult> {
    const conflicts: SyncConflict[] = [];
    const merged = { ...localData };
    let wordsUpdated = 0;

    console.log(`🔄 Merging server data: ${serverData.wordProgress.length} words from server`);

    // Create a map for faster lookups
    const localWordsMap = new Map(merged.words.map(word => [word.id, word]));

    // Apply server word progress to local words
    for (const serverWord of serverData.wordProgress) {
      const localWord = localWordsMap.get(serverWord.wordId);
      
      if (localWord) {
        const resolution = this.resolveWordConflict(localWord, serverWord);
        
        if (resolution.hasConflict && resolution.conflict) {
          conflicts.push(resolution.conflict);
        }

        // Apply resolved progress data to local word (keeping all static fields intact)
        localWord.masteryLevel = resolution.resolved.masteryLevel;
        localWord.repetitionCount = resolution.resolved.repetitionCount;
        localWord.lastReviewed = resolution.resolved.lastReviewed || null;
        localWord.nextReview = resolution.resolved.nextReview || null;
        localWord.easeFactor = resolution.resolved.easeFactor;
        
        // Merge practice history if available
        if (resolution.resolved.practiceHistory) {
          localWord.practiceHistory = [
            ...(localWord.practiceHistory || []),
            ...resolution.resolved.practiceHistory.map(attempt => ({
              ...attempt,
              practiceType: attempt.practiceType as any,
              responseTime: attempt.responseTime || 0
            }))
          ].slice(-10); // Keep only last 10 attempts locally
        }

        wordsUpdated++;
      } else {
        console.warn(`⚠️  Server word ${serverWord.wordId} not found in local vocabulary`);
      }
    }

    // Apply server statistics with conflict resolution
    merged.totalWordsLearned = Math.max(localData.totalWordsLearned, serverData.totalWordsLearned);
    merged.maxStreak = Math.max(localData.maxStreak, serverData.maxStreak);
    merged.syncVersion = serverData.version;

    const dataReceived = JSON.stringify(serverData).length;

    return { 
      merged, 
      conflicts, 
      wordsUpdated,
      dataReceived
    };
  }

  /**
   * Resolve conflicts between local and server word progress
   */
  private resolveWordConflict(
    localWord: Word, 
    serverWord: ServerWordProgress
  ): {
    hasConflict: boolean;
    resolved: ServerWordProgress;
    conflict?: SyncConflict;
  } {
    const hasConflict = 
      Math.abs(localWord.masteryLevel - serverWord.masteryLevel) > 0.5 ||
      Math.abs(localWord.repetitionCount - serverWord.repetitionCount) > 2;

    if (!hasConflict) {
      return { hasConflict: false, resolved: serverWord };
    }

    // Resolution strategy: Take higher progress values (optimistic merge)
    const resolved: ServerWordProgress = {
      wordId: serverWord.wordId,
      masteryLevel: Math.max(localWord.masteryLevel, serverWord.masteryLevel),
      repetitionCount: Math.max(localWord.repetitionCount, serverWord.repetitionCount),
      lastReviewed: this.laterDate(localWord.lastReviewed || undefined, serverWord.lastReviewed),
      nextReview: this.earlierDate(localWord.nextReview || undefined, serverWord.nextReview),
      easeFactor: (localWord.easeFactor + serverWord.easeFactor) / 2, // Average ease factors
      practiceHistory: serverWord.practiceHistory // Use server history as it's more recent
    };

    console.log(`🔀 Conflict resolved for word ${serverWord.wordId}: local(${localWord.masteryLevel}) + server(${serverWord.masteryLevel}) = ${resolved.masteryLevel}`);

    return {
      hasConflict: true,
      resolved,
      conflict: {
        field: `wordProgress.${serverWord.wordId}`,
        clientValue: {
          masteryLevel: localWord.masteryLevel,
          repetitionCount: localWord.repetitionCount
        },
        serverValue: {
          masteryLevel: serverWord.masteryLevel,
          repetitionCount: serverWord.repetitionCount
        },
        resolvedValue: {
          masteryLevel: resolved.masteryLevel,
          repetitionCount: resolved.repetitionCount
        },
        resolution: 'merged'
      }
    };
  }

  /**
   * Get all local data for sync
   */
  private async getAllLocalData(userId: string): Promise<LocalProgressData> {
    const [words, sessions] = await Promise.all([
      DatabaseService.getWordsForPractice(),
      this.getAllSessions()
    ]);

    const wordsLearned = words.filter(w => w.masteryLevel > 0).length;
    const maxStreak = this.calculateMaxStreak(sessions);
    const syncVersion = await this.getSyncVersion(userId);

    return {
      userId,
      words,
      sessions,
      totalWordsLearned: wordsLearned,
      maxStreak,
      syncVersion
    };
  }

  /**
   * Save merged data back to local storage
   */
  private async saveLocalData(userId: string, data: LocalProgressData): Promise<void> {
    // Update words in database
    for (const word of data.words) {
      if (word.masteryLevel > 0 || word.repetitionCount > 0) {
        await DatabaseService.updateWordProgress(word.id, {
          masteryLevel: word.masteryLevel,
          repetitionCount: word.repetitionCount,
          lastReviewed: word.lastReviewed,
          nextReview: word.nextReview,
          easeFactor: word.easeFactor,
          practiceHistory: word.practiceHistory
        });
      }
    }

    // Update sync metadata
    await this.setSyncVersion(userId, data.syncVersion);
  }

  // Helper methods

  private extractRecentSessionDates(sessions: PracticeSession[]): string[] {
    const dates = new Set(
      sessions
        .filter(s => s.startTime)
        .map(s => new Date(s.startTime).toISOString().split('T')[0])
    );
    return Array.from(dates).sort().slice(-30);
  }

  private calculateCurrentStreak(sessions: PracticeSession[]): number {
    const sessionDates = this.extractRecentSessionDates(sessions);
    if (sessionDates.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Check if user practiced today or yesterday
    const latestSession = sessionDates[sessionDates.length - 1];
    if (latestSession !== today && latestSession !== yesterday) {
      return 0;
    }

    let streak = 0;
    let checkDate = today;
    
    while (sessionDates.includes(checkDate)) {
      streak++;
      const prevDay = new Date(checkDate);
      prevDay.setDate(prevDay.getDate() - 1);
      checkDate = prevDay.toISOString().split('T')[0];
    }

    return streak;
  }

  private calculateMaxStreak(sessions: PracticeSession[]): number {
    const sessionDates = this.extractRecentSessionDates(sessions);
    if (sessionDates.length === 0) return 0;

    let maxStreak = 0;
    let currentStreak = 1;

    for (let i = 1; i < sessionDates.length; i++) {
      const prevDate = new Date(sessionDates[i - 1]);
      const currDate = new Date(sessionDates[i]);
      const daysDiff = (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000);

      if (daysDiff === 1) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }

    return Math.max(maxStreak, currentStreak);
  }

  private getLastActiveDate(sessions: PracticeSession[]): string {
    if (sessions.length === 0) return new Date().toISOString().split('T')[0];
    
    const latestSession = sessions.reduce((latest, session) => {
      return new Date(session.startTime) > new Date(latest.startTime) ? session : latest;
    });
    
    return new Date(latestSession.startTime).toISOString().split('T')[0];
  }

  private laterDate(date1?: string, date2?: string): string | undefined {
    if (!date1) return date2;
    if (!date2) return date1;
    return new Date(date1) > new Date(date2) ? date1 : date2;
  }

  private earlierDate(date1?: string, date2?: string): string | undefined {
    if (!date1) return date2;
    if (!date2) return date1;
    return new Date(date1) < new Date(date2) ? date1 : date2;
  }

  // Network and queue management

  private setupNetworkMonitoring(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Network back online, processing sync queue');
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Network offline');
    });
  }

  private async queueSyncForLater(userId: string): Promise<SyncResult> {
    console.log('📤 Queuing sync for later (offline)');
    
    this.syncQueue.push(async () => {
      await this.performFullSync(userId);
    });

    return {
      success: false,
      error: 'Offline - sync queued for later'
    };
  }

  private async processSyncQueue(): Promise<void> {
    while (this.syncQueue.length > 0 && this.isOnline) {
      const syncOperation = this.syncQueue.shift();
      if (syncOperation) {
        try {
          await syncOperation();
        } catch (error) {
          console.error('❌ Queued sync failed:', error);
        }
      }
    }
  }

  // Storage helpers for sync metadata

  private async getAllSessions(): Promise<PracticeSession[]> {
    // This would integrate with your existing database service
    // For now, using a placeholder
    return []; // DatabaseService.getAllSessions(userId);
  }

  private async getSyncVersion(userId: string): Promise<number> {
    try {
      const stored = localStorage.getItem(`wordmate_sync_version_${userId}`);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  private async setSyncVersion(userId: string, version: number): Promise<void> {
    try {
      localStorage.setItem(`wordmate_sync_version_${userId}`, version.toString());
    } catch (error) {
      console.warn('Failed to save sync version:', error);
    }
  }

  private loadLastSyncTime(): void {
    try {
      const stored = localStorage.getItem('wordmate_last_sync');
      if (stored) {
        this.lastSyncTime = new Date(stored);
      }
    } catch (error) {
      console.warn('Failed to load last sync time:', error);
    }
  }

  private saveLastSyncTime(): void {
    try {
      if (this.lastSyncTime) {
        localStorage.setItem('wordmate_last_sync', this.lastSyncTime.toISOString());
      }
    } catch (error) {
      console.warn('Failed to save last sync time:', error);
    }
  }

  // Public getters

  get lastSync(): Date | null {
    return this.lastSyncTime;
  }

  get queueLength(): number {
    return this.syncQueue.length;
  }

  get isOffline(): boolean {
    return !this.isOnline;
  }
}

// Export singleton instance
export const syncManager = new SyncManager();
