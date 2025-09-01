-- WordMate MySQL Database Schema - Production Ready
-- Static vocabulary in JSON files, only dynamic user data in database
-- Anonymous users in browser storage, registered users in database
-- Optimized with auto-increment IDs for high-volume tables

SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS wordmate;
CREATE DATABASE wordmate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wordmate;

-- =============================================
-- CORE TABLES (Optimized for Performance)
-- =============================================

-- Users - Only registered users with email (string ID for external API)
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY, -- Keep string ID for external API consistency
    email VARCHAR(255) UNIQUE NOT NULL, 
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    grade VARCHAR(20) DEFAULT 'grade6',
    
    -- Trial conversion tracking (for analytics only)
    registered_from_trial BOOLEAN DEFAULT FALSE,
    
    -- Progress stats (denormalized for performance)
    total_words_learned INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    max_streak INT DEFAULT 0,
    last_active_date DATE NULL,
    
    -- Subscription (embedded)
    plan VARCHAR(50) DEFAULT 'free-trial',
    plan_status ENUM('trial', 'active', 'expired') DEFAULT 'trial',
    plan_expires_at TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,
    
    INDEX idx_email (email),
    INDEX idx_plan_expires (plan_expires_at),
    INDEX idx_last_active (last_active_date),
    INDEX idx_plan_status (plan_status)
);

-- User word progress - Composite PK for logical relationship
CREATE TABLE user_words (
    user_id VARCHAR(50) NOT NULL,
    word_id VARCHAR(100) NOT NULL, -- References word ID in JSON files
    
    -- Spaced repetition core data
    mastery_level DECIMAL(3,1) DEFAULT 0.0, -- 0.0 to 5.0
    repetitions INT DEFAULT 0,
    ease_factor DECIMAL(3,1) DEFAULT 2.5,
    last_review DATE NULL,
    next_review DATE NULL,
    
    -- Simple counters
    seen_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, word_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Optimized indexes for review queries
    INDEX idx_review_due (user_id, next_review),
    INDEX idx_mastery (user_id, mastery_level),
    INDEX idx_last_review (user_id, last_review)
);

-- Practice sessions - Auto-increment for performance
CREATE TABLE sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, -- Fast integer PK
    user_id VARCHAR(50) NOT NULL,
    practice_type ENUM('flashcard', 'typing', 'choice') NOT NULL,
    
    -- Results summary
    words_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    accuracy DECIMAL(4,1) DEFAULT 0.0,
    duration_seconds INT DEFAULT 0,
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, started_at),
    INDEX idx_completed (completed_at),
    INDEX idx_user_completed (user_id, completed_at)
);

-- Session answers - Auto-increment for high performance
CREATE TABLE session_answers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, -- Fast integer PK
    session_id BIGINT NOT NULL, -- References sessions.id
    word_id VARCHAR(100) NOT NULL, -- References JSON vocabulary
    is_correct BOOLEAN NOT NULL,
    response_time_ms INT DEFAULT 0,
    quality_score TINYINT DEFAULT 0, -- 0-5 for spaced repetition
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_word_performance (word_id, is_correct),
    INDEX idx_session_word (session_id, word_id)
);

-- Payments - Auto-increment with string trade numbers for gateways
CREATE TABLE payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, -- Fast integer PK for internal use
    user_id VARCHAR(50) NOT NULL,
    amount DECIMAL(8,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'CNY',
    method ENUM('alipay', 'wechat') NOT NULL,
    status ENUM('pending', 'completed', 'failed') NOT NULL,
    
    -- Gateway identifiers (still strings for external compatibility)
    out_trade_no VARCHAR(200) UNIQUE NOT NULL, -- For payment gateways
    gateway_txn_id VARCHAR(200) NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_trade_no (out_trade_no),
    INDEX idx_created (created_at)
);

-- System events - Auto-increment for high-volume logging
CREATE TABLE events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, -- Fast integer PK
    user_id VARCHAR(50) NULL, -- NULL for anonymous users
    anonymous_session_id VARCHAR(100) NULL, -- Track anonymous users
    event_type ENUM('anonymous_trial', 'registration', 'login', 'payment', 'session', 'sync', 'error') NOT NULL,
    event_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_type (user_id, event_type),
    INDEX idx_anonymous_session (anonymous_session_id, event_type),
    INDEX idx_created (created_at),
    INDEX idx_event_type (event_type)
);

-- =============================================
-- BUSINESS LOGIC PROCEDURES
-- =============================================

DELIMITER //

-- Get words for review (references JSON vocabulary by ID)
CREATE PROCEDURE GetWordsForReview(IN p_user_id VARCHAR(50), IN p_limit INT)
BEGIN
    -- Return word IDs that need review - app loads definitions from JSON
    SELECT word_id, mastery_level, last_review, seen_count
    FROM user_words 
    WHERE user_id = p_user_id
      AND (next_review IS NULL OR next_review <= CURDATE())
      AND mastery_level < 4.0
    ORDER BY mastery_level ASC, last_review ASC
    LIMIT p_limit;
    
    -- Get count for new words needed
    SELECT (p_limit - ROW_COUNT()) as new_words_needed;
END//

-- Update word progress after practice
CREATE PROCEDURE UpdateWordProgress(
    IN p_user_id VARCHAR(50),
    IN p_word_id VARCHAR(100),
    IN p_is_correct BOOLEAN,
    IN p_new_mastery DECIMAL(3,1),
    IN p_new_ease DECIMAL(3,1),
    IN p_next_review DATE
)
BEGIN
    INSERT INTO user_words (
        user_id, word_id, mastery_level, repetitions, ease_factor, 
        last_review, next_review, seen_count, correct_count
    ) VALUES (
        p_user_id, p_word_id, p_new_mastery, 1, p_new_ease,
        CURDATE(), p_next_review, 1, IF(p_is_correct, 1, 0)
    ) ON DUPLICATE KEY UPDATE
        mastery_level = p_new_mastery,
        repetitions = repetitions + 1,
        ease_factor = p_new_ease,
        last_review = CURDATE(),
        next_review = p_next_review,
        seen_count = seen_count + 1,
        correct_count = correct_count + IF(p_is_correct, 1, 0),
        updated_at = NOW();
END//

-- Complete a practice session and update user stats
CREATE PROCEDURE CompleteSession(
    IN p_session_id BIGINT, -- Now integer
    IN p_user_id VARCHAR(50),
    IN p_words_count INT,
    IN p_correct_count INT,
    IN p_duration INT
)
BEGIN
    DECLARE v_accuracy DECIMAL(4,1);
    DECLARE v_practiced_today BOOLEAN DEFAULT FALSE;
    
    SET v_accuracy = IF(p_words_count > 0, (p_correct_count / p_words_count) * 100, 0);
    
    -- Mark session as completed
    UPDATE sessions 
    SET words_count = p_words_count,
        correct_count = p_correct_count,
        accuracy = v_accuracy,
        duration_seconds = p_duration,
        completed_at = NOW()
    WHERE id = p_session_id;
    
    -- Check if user already practiced today
    SELECT COUNT(*) > 0 INTO v_practiced_today
    FROM sessions 
    WHERE user_id = p_user_id 
      AND DATE(completed_at) = CURDATE()
      AND id != p_session_id
      AND completed_at IS NOT NULL;
    
    -- Update user progress
    UPDATE users 
    SET total_words_learned = (
            SELECT COUNT(*) FROM user_words 
            WHERE user_id = p_user_id AND mastery_level >= 2.0
        ),
        current_streak = CASE 
            WHEN v_practiced_today THEN current_streak
            WHEN last_active_date = CURDATE() - INTERVAL 1 DAY THEN current_streak + 1
            WHEN last_active_date = CURDATE() THEN current_streak
            ELSE 1 
        END,
        max_streak = GREATEST(max_streak, 
            CASE 
                WHEN v_practiced_today THEN current_streak
                WHEN last_active_date = CURDATE() - INTERVAL 1 DAY THEN current_streak + 1
                WHEN last_active_date = CURDATE() THEN current_streak
                ELSE 1 
            END),
        last_active_date = CURDATE(),
        updated_at = NOW()
    WHERE id = p_user_id;
END//

-- Start a new practice session (returns session ID)
CREATE PROCEDURE StartSession(
    IN p_user_id VARCHAR(50),
    IN p_practice_type VARCHAR(20),
    OUT p_session_id BIGINT
)
BEGIN
    INSERT INTO sessions (user_id, practice_type)
    VALUES (p_user_id, p_practice_type);
    
    SET p_session_id = LAST_INSERT_ID();
END//

-- Import anonymous trial data during registration
CREATE PROCEDURE ImportTrialProgress(
    IN p_user_id VARCHAR(50),
    IN p_trial_words JSON,
    IN p_trial_stats JSON
)
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE word_count INT DEFAULT 0;
    
    -- Import word progress if exists
    IF p_trial_words IS NOT NULL THEN
        SET word_count = JSON_LENGTH(p_trial_words);
        
        WHILE i < word_count DO
            SET @word_id = JSON_UNQUOTE(JSON_EXTRACT(p_trial_words, CONCAT('$[', i, '].word_id')));
            SET @mastery = CAST(JSON_EXTRACT(p_trial_words, CONCAT('$[', i, '].mastery_level')) AS DECIMAL(3,1));
            SET @seen = CAST(JSON_EXTRACT(p_trial_words, CONCAT('$[', i, '].seen_count')) AS UNSIGNED);
            SET @correct = CAST(JSON_EXTRACT(p_trial_words, CONCAT('$[', i, '].correct_count')) AS UNSIGNED);
            SET @ease = CAST(JSON_EXTRACT(p_trial_words, CONCAT('$[', i, '].ease_factor')) AS DECIMAL(3,1));
            
            INSERT IGNORE INTO user_words (
                user_id, word_id, mastery_level, seen_count, correct_count, ease_factor
            ) VALUES (
                p_user_id, @word_id, IFNULL(@mastery, 0), IFNULL(@seen, 0), 
                IFNULL(@correct, 0), IFNULL(@ease, 2.5)
            );
            
            SET i = i + 1;
        END WHILE;
    END IF;
    
    -- Update user stats from trial data
    IF p_trial_stats IS NOT NULL THEN
        UPDATE users 
        SET total_words_learned = COALESCE(
                CAST(JSON_EXTRACT(p_trial_stats, '$.total_words_learned') AS UNSIGNED), 
                total_words_learned
            ),
            current_streak = COALESCE(
                CAST(JSON_EXTRACT(p_trial_stats, '$.current_streak') AS UNSIGNED), 
                current_streak
            ),
            max_streak = COALESCE(
                CAST(JSON_EXTRACT(p_trial_stats, '$.max_streak') AS UNSIGNED), 
                max_streak
            ),
            registered_from_trial = TRUE
        WHERE id = p_user_id;
    END IF;
END//

-- Process successful payment
CREATE PROCEDURE ProcessPayment(
    IN p_payment_id BIGINT, -- Now integer
    IN p_gateway_txn_id VARCHAR(200)
)
BEGIN
    DECLARE v_user_id VARCHAR(50);
    DECLARE v_amount DECIMAL(8,2);
    DECLARE v_plan VARCHAR(50);
    DECLARE v_expires TIMESTAMP;
    
    -- Get payment info
    SELECT user_id, amount INTO v_user_id, v_amount
    FROM payments WHERE id = p_payment_id;
    
    -- Determine plan and expiry based on amount
    CASE 
        WHEN v_amount >= 300 THEN 
            SET v_plan = 'premium-yearly';
            SET v_expires = DATE_ADD(NOW(), INTERVAL 1 YEAR);
        WHEN v_amount >= 35 THEN 
            SET v_plan = 'premium-monthly'; 
            SET v_expires = DATE_ADD(NOW(), INTERVAL 1 MONTH);
        ELSE 
            SET v_plan = 'premium-trial';
            SET v_expires = DATE_ADD(NOW(), INTERVAL 7 DAY);
    END CASE;
    
    -- Update payment
    UPDATE payments 
    SET status = 'completed',
        gateway_txn_id = p_gateway_txn_id,
        completed_at = NOW()
    WHERE id = p_payment_id;
    
    -- Activate subscription
    UPDATE users 
    SET plan = v_plan,
        plan_status = 'active',
        plan_expires_at = v_expires,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    -- Log payment success
    INSERT INTO events (user_id, event_type, event_data)
    VALUES (v_user_id, 'payment', JSON_OBJECT(
        'payment_id', p_payment_id,
        'amount', v_amount,
        'plan', v_plan,
        'expires_at', v_expires
    ));
END//

-- Find payment by trade number (for webhook processing)
CREATE PROCEDURE FindPaymentByTradeNo(
    IN p_out_trade_no VARCHAR(200),
    OUT p_payment_id BIGINT,
    OUT p_user_id VARCHAR(50)
)
BEGIN
    SELECT id, user_id INTO p_payment_id, p_user_id
    FROM payments 
    WHERE out_trade_no = p_out_trade_no;
END//

DELIMITER ;

-- =============================================
-- MAINTENANCE PROCEDURES
-- =============================================

DELIMITER //

-- Daily cleanup and maintenance
CREATE PROCEDURE DailyMaintenance()
BEGIN
    -- Expire subscriptions
    UPDATE users 
    SET plan_status = 'expired' 
    WHERE plan_expires_at < NOW() AND plan_status = 'active';
    
    -- Clean old events (keep 90 days)
    DELETE FROM events 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
      AND event_type NOT IN ('payment', 'registration');
    
    -- Clean old session answers (keep 30 days) 
    DELETE sa FROM session_answers sa
    JOIN sessions s ON sa.session_id = s.id
    WHERE s.started_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Clean incomplete old sessions (keep 7 days)
    DELETE FROM sessions 
    WHERE completed_at IS NULL 
      AND started_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
      
    -- Update table statistics for query optimization
    ANALYZE TABLE users, user_words, sessions, session_answers, payments, events;
END//

-- Generate user statistics
CREATE PROCEDURE GetUserStats(IN p_user_id VARCHAR(50))
BEGIN
    SELECT 
        u.username,
        u.email,
        u.total_words_learned,
        u.current_streak,
        u.max_streak,
        u.last_active_date,
        u.plan,
        u.plan_status,
        u.plan_expires_at,
        u.registered_from_trial,
        COUNT(DISTINCT s.id) as total_sessions,
        COALESCE(AVG(s.accuracy), 0) as avg_accuracy,
        COUNT(DISTINCT uw.word_id) as words_practiced,
        SUM(s.duration_seconds) as total_practice_time
    FROM users u
    LEFT JOIN sessions s ON u.id = s.user_id AND s.completed_at IS NOT NULL
    LEFT JOIN user_words uw ON u.id = uw.user_id
    WHERE u.id = p_user_id
    GROUP BY u.id;
END//

-- Get full user progress for sync (used after login)
CREATE PROCEDURE GetUserProgressForSync(IN p_user_id VARCHAR(50))
BEGIN
    -- Get user basic info
    SELECT id, username, email, grade, total_words_learned, 
           current_streak, max_streak, last_active_date,
           plan, plan_status, plan_expires_at
    FROM users WHERE id = p_user_id;
    
    -- Get word progress
    SELECT word_id, mastery_level, repetitions, ease_factor,
           last_review, next_review, seen_count, correct_count
    FROM user_words WHERE user_id = p_user_id;
    
    -- Get recent session summary (last 30 days)
    SELECT id, practice_type, words_count, correct_count, 
           accuracy, duration_seconds, started_at, completed_at
    FROM sessions 
    WHERE user_id = p_user_id 
      AND started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ORDER BY started_at DESC;
END//

DELIMITER ;

-- =============================================
-- VIEWS FOR ANALYTICS
-- =============================================

-- Active users overview
CREATE VIEW v_active_users AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.plan,
    u.plan_status,
    u.total_words_learned,
    u.current_streak,
    u.last_active_date,
    u.registered_from_trial,
    COUNT(s.id) as sessions_count,
    COALESCE(AVG(s.accuracy), 0) as avg_accuracy
FROM users u
LEFT JOIN sessions s ON u.id = s.user_id AND s.completed_at IS NOT NULL
WHERE u.last_active_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY u.id;

-- Daily activity stats
CREATE VIEW v_daily_stats AS
SELECT 
    DATE(s.completed_at) as date,
    COUNT(DISTINCT s.user_id) as active_registered_users,
    COUNT(s.id) as registered_sessions,
    AVG(s.accuracy) as avg_accuracy,
    SUM(s.duration_seconds) as total_seconds,
    COUNT(DISTINCT sa.word_id) as unique_words_practiced
FROM sessions s
LEFT JOIN session_answers sa ON s.id = sa.session_id
WHERE s.completed_at IS NOT NULL
  AND s.completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(s.completed_at)
ORDER BY date DESC;

-- Trial conversion analysis
CREATE VIEW v_trial_conversion AS
SELECT 
    DATE(created_at) as registration_date,
    COUNT(*) as total_registrations,
    COUNT(CASE WHEN registered_from_trial = TRUE THEN 1 END) as from_trial,
    ROUND(COUNT(CASE WHEN registered_from_trial = TRUE THEN 1 END) / COUNT(*) * 100, 2) as conversion_rate
FROM users 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  AND id != '__system__'
GROUP BY DATE(created_at)
ORDER BY registration_date DESC;

-- Word difficulty analysis (from user performance data)
CREATE VIEW v_word_difficulty_analysis AS
SELECT 
    word_id,
    COUNT(DISTINCT user_id) as learners_count,
    AVG(mastery_level) as avg_mastery,
    ROUND(AVG(CASE WHEN seen_count > 0 THEN correct_count / seen_count ELSE 0 END) * 100, 2) as success_rate,
    COUNT(CASE WHEN mastery_level >= 2.0 THEN 1 END) as mastered_count
FROM user_words
WHERE seen_count > 0
GROUP BY word_id
HAVING learners_count >= 5 -- Only show words practiced by 5+ users
ORDER BY success_rate ASC;

-- Performance metrics view
CREATE VIEW v_performance_metrics AS
SELECT 
    'sessions' as table_name,
    COUNT(*) as row_count,
    AVG(CHAR_LENGTH(id)) as avg_id_size
FROM sessions
UNION ALL
SELECT 
    'session_answers' as table_name,
    COUNT(*) as row_count,
    AVG(CHAR_LENGTH(id)) as avg_id_size
FROM session_answers
UNION ALL
SELECT 
    'payments' as table_name,
    COUNT(*) as row_count,
    AVG(CHAR_LENGTH(id)) as avg_id_size
FROM payments;

-- =============================================
-- INITIAL DATA
-- =============================================

-- Default system config user (for admin operations)
INSERT INTO users (id, username, email, password_hash, grade) 
VALUES ('__system__', 'System', 'admin@wordmate.app', 'unused', 'admin');

-- =============================================
-- PERFORMANCE OPTIMIZATION
-- =============================================

-- Compound indexes for optimal query performance
CREATE INDEX idx_user_words_review_compound ON user_words(user_id, next_review, mastery_level);
CREATE INDEX idx_sessions_user_completed_compound ON sessions(user_id, completed_at, started_at);
CREATE INDEX idx_session_answers_performance ON session_answers(session_id, is_correct, response_time_ms);

-- Final table optimization
ANALYZE TABLE users, user_words, sessions, session_answers, payments, events;

-- Show table structure and confirm optimization
SHOW TABLES;
SELECT 
    TABLE_NAME,
    ENGINE,
    TABLE_ROWS,
    AVG_ROW_LENGTH,
    DATA_LENGTH,
    INDEX_LENGTH
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'wordmate'
  AND TABLE_NAME != 'information_schema';

SELECT 'Production-ready schema with optimized auto-increment IDs!' as status;

SET FOREIGN_KEY_CHECKS = 1;
