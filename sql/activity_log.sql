-- ============================================
-- Activity Log Table
-- Logger alle ændringer i systemet
-- ============================================

CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Hvem gjorde det
    user_id INT,
    user_name VARCHAR(100),

    -- Hvad blev gjort
    action_type ENUM(
        'create',
        'update',
        'delete',
        'login',
        'logout',
        'view',
        'export',
        'import',
        'sync'
    ) NOT NULL,

    -- Hvilken tabel/ressource
    resource_type VARCHAR(50) NOT NULL,
    resource_id INT,
    resource_name VARCHAR(255),

    -- Beskrivelse af ændringen
    description TEXT,

    -- Gamle og nye værdier (JSON)
    old_values JSON,
    new_values JSON,

    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key til users (nullable for system actions)
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for hurtig søgning
CREATE INDEX idx_activity_user ON activity_log(user_id);
CREATE INDEX idx_activity_type ON activity_log(action_type);
CREATE INDEX idx_activity_resource ON activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_date ON activity_log(created_at);

-- ============================================
-- Stored Procedure: Log en aktivitet
-- ============================================

DELIMITER //

CREATE PROCEDURE log_activity(
    IN p_user_id INT,
    IN p_user_name VARCHAR(100),
    IN p_action_type VARCHAR(20),
    IN p_resource_type VARCHAR(50),
    IN p_resource_id INT,
    IN p_resource_name VARCHAR(255),
    IN p_description TEXT,
    IN p_old_values JSON,
    IN p_new_values JSON,
    IN p_ip_address VARCHAR(45)
)
BEGIN
    INSERT INTO activity_log (
        user_id,
        user_name,
        action_type,
        resource_type,
        resource_id,
        resource_name,
        description,
        old_values,
        new_values,
        ip_address
    ) VALUES (
        p_user_id,
        p_user_name,
        p_action_type,
        p_resource_type,
        p_resource_id,
        p_resource_name,
        p_description,
        p_old_values,
        p_new_values,
        p_ip_address
    );
END //

DELIMITER ;

-- ============================================
-- Stored Procedure: Hent seneste aktiviteter
-- ============================================

DELIMITER //

CREATE PROCEDURE get_recent_activities(IN p_limit INT)
BEGIN
    SELECT
        id,
        user_id,
        user_name,
        action_type,
        resource_type,
        resource_id,
        resource_name,
        description,
        created_at
    FROM activity_log
    ORDER BY created_at DESC
    LIMIT p_limit;
END //

DELIMITER ;

-- ============================================
-- Stored Procedure: Hent aktiviteter for de sidste 24 timer
-- ============================================

DELIMITER //

CREATE PROCEDURE get_24h_activity_count()
BEGIN
    SELECT COUNT(*) as count
    FROM activity_log
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
END //

DELIMITER ;

-- ============================================
-- View: Daglig aktivitetsstatistik
-- ============================================

CREATE OR REPLACE VIEW daily_activity_stats AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_actions,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(CASE WHEN action_type = 'create' THEN 1 ELSE 0 END) as creates,
    SUM(CASE WHEN action_type = 'update' THEN 1 ELSE 0 END) as updates,
    SUM(CASE WHEN action_type = 'delete' THEN 1 ELSE 0 END) as deletes,
    SUM(CASE WHEN action_type = 'login' THEN 1 ELSE 0 END) as logins
FROM activity_log
GROUP BY DATE(created_at)
ORDER BY date DESC;
