/**
 * Type definitions for FastAPI backend integration
 * Matches the Pydantic schemas defined in the backend
 */

// Enums from backend
export type PracticeType = 'flashcard' | 'typing' | 'choice';
export type PlanStatus = 'trial' | 'active' | 'expired';
export type PaymentMethod = 'alipay' | 'wechat';
export type PaymentStatus = 'pending' | 'completed' | 'failed';

// Base API Response Structure
export interface BaseAPIResponse {
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

export interface ErrorResponse {
  success: false;
  error: APIError;
  timestamp: string;
}

export type APIResponse<T> = (BaseAPIResponse & {
  success: true;
  data: T;
}) | ErrorResponse;

// User types from backend
export interface UserBase {
  username: string;
  email: string;
  grade: string;
}

export interface UserCreate extends UserBase {
  password?: string; // Optional for passwordless auth
  device_id?: string; // For device-based authentication
  trial_data?: {
    words?: Array<{
      word_id: string;
      mastery_level: number;
      repetitions: number;
      ease_factor: number;
      seen_count: number;
      correct_count: number;
    }>;
    stats?: {
      total_words_learned: number;
      current_streak: number;
      max_streak: number;
    };
  };
}

export interface UserLogin {
  email?: string;
  username?: string;
  password?: string;
  device_id?: string; // For device-based authentication
}

export interface UserResponse extends UserBase {
  id: string;
  registered_from_trial: boolean;
  total_words_learned: number;
  current_streak: number;
  max_streak: number;
  last_active_date?: string;
  plan: string;
  plan_status: PlanStatus;
  plan_expires_at?: string;
  created_at: string;
  last_login_at?: string;
}

export interface AuthResponse extends BaseAPIResponse {
  data: {
    user: UserResponse;
    token: string;
    expires_in: number; // Token expiry in minutes
  };
}

// Word Progress types
export interface WordProgressBase {
  word_id: string;
  mastery_level: number;
  repetitions: number;
  ease_factor: number;
  last_review?: string;
  next_review?: string;
  seen_count: number;
  correct_count: number;
}

export interface WordProgressUpdate {
  is_correct: boolean;
  response_time_ms: number;
  quality_score: number;
}

export interface WordProgressResponse extends WordProgressBase {
  user_id: string;
  updated_at: string;
}

// Session types
export interface SessionAnswerBase {
  word_id: string;
  is_correct: boolean;
  response_time_ms: number;
  quality_score: number;
}

export interface SessionStart {
  practice_type: PracticeType;
}

export interface SessionComplete {
  words_count: number;
  correct_count: number;
  duration_seconds: number;
  answers: SessionAnswerBase[];
}

export interface SessionResponse {
  id: number;
  user_id: string;
  practice_type: PracticeType;
  words_count: number;
  correct_count: number;
  accuracy: number;
  duration_seconds: number;
  started_at: string;
  completed_at?: string;
}

// Payment types
export interface PaymentCreate {
  amount: number;
  method: PaymentMethod;
  plan_id?: string;
}

export interface PaymentResponse {
  id: number;
  user_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  out_trade_no: string;
  gateway_txn_id?: string;
  created_at: string;
  completed_at?: string;
}

// Progress sync types
export interface ProgressSyncData {
  words: WordProgressBase[];
  sessions: any[]; // Recent session summaries
  stats: Record<string, any>; // User statistics
}

export interface ProgressSyncRequest {
  local_progress: ProgressSyncData;
}

export interface ProgressSyncResponse extends BaseAPIResponse {
  data: {
    server_progress?: ProgressSyncData;
    conflicts?: any[];
    sync_result?: any;
  };
}

// Health check
export interface HealthCheckResponse {
  status: string;
  version: string;
  database_connected: boolean;
  timestamp: string;
}

// Frontend-specific types for compatibility
export interface FrontendUser {
  id: string;
  email?: string;
  username: string;
  grade: string;
  deviceId: string; // For frontend compatibility
  createdAt: string;
  lastActiveAt: string;
  registeredFromTrial: boolean;
  totalWordsLearned: number;
  currentStreak: number;
  maxStreak: number;
  plan: string;
  planStatus: PlanStatus;
  planExpiresAt?: string;
}

// Conversion utilities
export class BackendTypeConverter {
  /**
   * Convert backend UserResponse to frontend User format
   */
  static userResponseToFrontendUser(backendUser: UserResponse, deviceId: string): FrontendUser {
    return {
      id: backendUser.id,
      email: backendUser.email,
      username: backendUser.username,
      grade: backendUser.grade,
      deviceId: deviceId,
      createdAt: backendUser.created_at,
      lastActiveAt: backendUser.last_login_at || backendUser.created_at,
      registeredFromTrial: backendUser.registered_from_trial,
      totalWordsLearned: backendUser.total_words_learned,
      currentStreak: backendUser.current_streak,
      maxStreak: backendUser.max_streak,
      plan: backendUser.plan,
      planStatus: backendUser.plan_status,
      planExpiresAt: backendUser.plan_expires_at,
    };
  }

  /**
   * Convert frontend User to backend UserCreate format for registration
   */
  static frontendUserToUserCreate(frontendUser: Partial<FrontendUser>, password: string, trialData?: any): UserCreate {
    return {
      username: frontendUser.username || '单词达人',
      email: frontendUser.email || '',
      grade: frontendUser.grade || 'grade6',
      password: password,
      trial_data: trialData
    };
  }

  /**
   * Convert trial data format for backend compatibility
   */
  static convertTrialDataForBackend(localProgress: any) {
    // Convert local progress format to backend expected format
    const words = localProgress.words?.map((word: any) => ({
      word_id: word.id || word.wordId,
      mastery_level: word.masteryLevel || 0,
      repetitions: word.repetitionCount || 0,
      ease_factor: word.easeFactor || 2.5,
      seen_count: word.seenCount || 0,
      correct_count: word.correctCount || 0
    })) || [];

    const stats = {
      total_words_learned: localProgress.totalWordsLearned || 0,
      current_streak: localProgress.currentStreak || 0,
      max_streak: localProgress.maxStreak || 0
    };

    return { words, stats };
  }
}
