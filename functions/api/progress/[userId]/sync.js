/**
 * EdgeOne Pages Function: Progress Sync
 * 
 * File path: /functions/api/progress/[userId]/sync.js
 * Routes to: example.com/api/progress/{userId}/sync
 * 
 * Handles progress synchronization with minimal server data storage
 */

// Handle GET requests - retrieve user progress
export async function onRequestGet(context) {
  const { params, env } = context;
  const { userId } = params;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request, env);
    if (!authResult.success) {
      return createErrorResponse(401, 'UNAUTHORIZED', authResult.error, corsHeaders);
    }

    if (authResult.userId !== userId) {
      return createErrorResponse(403, 'FORBIDDEN', 'User ID mismatch', corsHeaders);
    }

    console.log(`📥 Get progress for user: ${userId}`);

    // Get server progress
    const serverProgress = await getServerProgress(userId, env);
    
    if (!serverProgress) {
      // Return empty progress for new users
      const emptyProgress = createEmptyProgress(userId);
      return new Response(JSON.stringify({
        success: true,
        data: emptyProgress,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: serverProgress,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Get progress error:', error);
    return createErrorResponse(500, 'GET_ERROR', error.message, corsHeaders);
  }
}

// Handle POST requests - sync progress
export async function onRequestPost(context) {
  const { request, params, env } = context;
  const { userId } = params;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Authenticate request
    const authResult = await authenticateRequest(request, env);
    if (!authResult.success) {
      return createErrorResponse(401, 'UNAUTHORIZED', authResult.error, corsHeaders);
    }

    if (authResult.userId !== userId) {
      return createErrorResponse(403, 'FORBIDDEN', 'User ID mismatch', corsHeaders);
    }

    const body = await request.json();
    const { localProgress, lastSyncVersion, deviceInfo } = body;

    console.log(`🔄 Sync request for user ${userId}, version ${lastSyncVersion}`);

    // Rate limiting check
    const rateLimitOk = await checkRateLimit(userId, 'sync', env);
    if (!rateLimitOk) {
      return createErrorResponse(429, 'RATE_LIMITED', 'Too many sync requests', corsHeaders);
    }

    // Get current server progress
    const serverProgress = await getServerProgress(userId, env);
    
    // Merge local progress with server progress
    const mergeResult = await mergeProgress(localProgress, serverProgress, userId);
    
    // Save updated progress to KV
    await saveServerProgress(userId, mergeResult.updatedProgress, env);
    
    console.log(`✅ Sync completed for user ${userId}: ${mergeResult.conflicts.length} conflicts, ${mergeResult.updatedProgress.wordProgress.length} words`);

    // Calculate data compression stats
    const originalSize = JSON.stringify(localProgress).length;
    const compressedSize = JSON.stringify(mergeResult.updatedProgress.wordProgress).length;
    const compressionRatio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : 0;

    console.log(`💾 Data compression: ${originalSize} → ${compressedSize} bytes (${compressionRatio}% reduction)`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        serverProgress: mergeResult.updatedProgress,
        conflicts: mergeResult.conflicts,
        syncResult: {
          success: true,
          dataSaved: originalSize - compressedSize,
          compressionRatio: `${compressionRatio}%`
        }
      },
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Sync processing error:', error);
    return createErrorResponse(400, 'SYNC_ERROR', error.message, corsHeaders);
  }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

/**
 * Merge local and server progress data
 */
async function mergeProgress(localProgress, serverProgress, userId) {
  const conflicts = [];
  
  // Use server progress as base, or create new if none exists
  const updatedProgress = serverProgress || createEmptyProgress(userId);
  
  // Update basic stats (take maximum values)
  updatedProgress.totalWordsLearned = Math.max(
    localProgress.totalWordsLearned || 0, 
    updatedProgress.totalWordsLearned || 0
  );
  updatedProgress.maxStreak = Math.max(
    localProgress.maxStreak || 0, 
    updatedProgress.maxStreak || 0
  );
  updatedProgress.currentStreak = localProgress.currentStreak || 0;
  updatedProgress.lastActiveDate = localProgress.lastActiveDate || updatedProgress.lastActiveDate;

  // Merge word progress - only store words with actual progress
  const serverWordsMap = new Map(
    (updatedProgress.wordProgress || []).map(word => [word.wordId, word])
  );

  const mergedWordProgress = [];

  // Process local word progress
  for (const localWord of (localProgress.wordProgress || [])) {
    const serverWord = serverWordsMap.get(localWord.wordId);
    
    if (serverWord) {
      // Resolve conflict between local and server
      const resolved = resolveWordConflict(localWord, serverWord);
      if (resolved.hasConflict) {
        conflicts.push({
          field: `wordProgress.${localWord.wordId}`,
          clientValue: localWord,
          serverValue: serverWord,
          resolvedValue: resolved.word,
          resolution: 'merged'
        });
      }
      mergedWordProgress.push(resolved.word);
    } else {
      // New word from client
      mergedWordProgress.push(localWord);
    }
    
    // Remove from server map (processed)
    serverWordsMap.delete(localWord.wordId);
  }

  // Add remaining server words that weren't in local progress
  for (const serverWord of serverWordsMap.values()) {
    mergedWordProgress.push(serverWord);
  }

  updatedProgress.wordProgress = mergedWordProgress;

  // Merge session dates
  const localDates = new Set(localProgress.recentSessionDates || []);
  const serverDates = new Set(updatedProgress.recentSessionDates || []);
  const allDates = new Set([...localDates, ...serverDates]);
  updatedProgress.recentSessionDates = Array.from(allDates)
    .sort()
    .slice(-30); // Keep last 30 days

  // Update metadata
  updatedProgress.version = (updatedProgress.version || 0) + 1;
  updatedProgress.lastSyncAt = new Date().toISOString();
  updatedProgress.updatedAt = new Date().toISOString();

  return {
    updatedProgress,
    conflicts
  };
}

/**
 * Resolve conflicts between local and server word progress
 */
function resolveWordConflict(localWord, serverWord) {
  // Check for significant differences
  const masteryDiff = Math.abs(localWord.masteryLevel - serverWord.masteryLevel);
  const repetitionDiff = Math.abs(localWord.repetitionCount - serverWord.repetitionCount);
  
  const hasConflict = masteryDiff > 0.5 || repetitionDiff > 2;
  
  if (!hasConflict) {
    // No significant conflict, use local (more recent)
    return { hasConflict: false, word: localWord };
  }

  // Resolve conflict by taking higher progress values
  const resolved = {
    wordId: localWord.wordId,
    masteryLevel: Math.max(localWord.masteryLevel, serverWord.masteryLevel),
    repetitionCount: Math.max(localWord.repetitionCount, serverWord.repetitionCount),
    lastReviewed: laterDate(localWord.lastReviewed, serverWord.lastReviewed),
    nextReview: earlierDate(localWord.nextReview, serverWord.nextReview),
    easeFactor: (localWord.easeFactor + serverWord.easeFactor) / 2,
    practiceHistory: localWord.practiceHistory || serverWord.practiceHistory
  };

  return { hasConflict: true, word: resolved };
}

/**
 * Get server progress from KV storage
 */
async function getServerProgress(userId, env) {
  try {
    const progressKey = `progress:${userId}`;
    const progressData = await env.WORDMATE_KV.get(progressKey, 'json');
    return progressData;
  } catch (error) {
    console.error('Failed to get server progress:', error);
    return null;
  }
}

/**
 * Save server progress to KV storage
 */
async function saveServerProgress(userId, progress, env) {
  try {
    const progressKey = `progress:${userId}`;
    await env.WORDMATE_KV.put(progressKey, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save server progress:', error);
    throw new Error('Failed to save progress data');
  }
}

/**
 * Create empty progress structure for new users
 */
function createEmptyProgress(userId) {
  return {
    userId,
    totalWordsLearned: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastActiveDate: new Date().toISOString().split('T')[0],
    wordProgress: [],
    recentSessionDates: [],
    version: 1,
    lastSyncAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Authenticate request using JWT token
 */
async function authenticateRequest(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Missing or invalid authorization header' };
    }

    const token = authHeader.substring(7);
    const payload = parseJWT(token);
    
    if (!payload || !payload.userId || !payload.deviceId) {
      return { success: false, error: 'Invalid token payload' };
    }

    // Check token expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { success: false, error: 'Token expired' };
    }

    return {
      success: true,
      userId: payload.userId,
      deviceId: payload.deviceId
    };

  } catch (error) {
    return { success: false, error: 'Token verification failed' };
  }
}

/**
 * Simple JWT parser
 */
function parseJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

/**
 * Rate limiting check
 */
async function checkRateLimit(userId, action, env) {
  const key = `rate_limit:${userId}:${action}`;
  const current = await env.WORDMATE_KV.get(key);
  
  const limits = {
    sync: { max: 30, window: 60 * 60 }, // 30 syncs per hour
  };
  
  const limit = limits[action];
  if (!limit) return true;
  
  const count = current ? parseInt(current) : 0;
  if (count >= limit.max) {
    return false;
  }
  
  await env.WORDMATE_KV.put(key, (count + 1).toString(), { expirationTtl: limit.window });
  return true;
}

/**
 * Utility functions
 */
function laterDate(date1, date2) {
  if (!date1) return date2;
  if (!date2) return date1;
  return new Date(date1) > new Date(date2) ? date1 : date2;
}

function earlierDate(date1, date2) {
  if (!date1) return date2;
  if (!date2) return date1;
  return new Date(date1) < new Date(date2) ? date1 : date2;
}

/**
 * Create standardized error response
 */
function createErrorResponse(status, code, message, corsHeaders) {
  return new Response(JSON.stringify({
    success: false,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
