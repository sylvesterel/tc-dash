-- ============================================
-- Dashboard Notes Table
-- Noter med prioritet og forfatter
-- ============================================

CREATE TABLE IF NOT EXISTS dashboard_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Indhold
    title VARCHAR(255) NOT NULL,
    content TEXT,

    -- Prioritet (1 = hojeste, 5 = laveste)
    priority INT NOT NULL DEFAULT 3,

    -- Forfatter
    created_by INT NOT NULL,
    created_by_name VARCHAR(100) NOT NULL,

    -- Status
    is_completed TINYINT(1) NOT NULL DEFAULT 0,
    completed_at TIMESTAMP NULL,
    completed_by INT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for hurtig sortering efter prioritet
CREATE INDEX idx_notes_priority ON dashboard_notes(priority, created_at DESC);
CREATE INDEX idx_notes_completed ON dashboard_notes(is_completed);

-- ============================================
-- Stored Procedure: Hent aktive noter sorteret efter prioritet
-- ============================================

DELIMITER //

CREATE PROCEDURE get_active_notes()
BEGIN
    SELECT
        id,
        title,
        content,
        priority,
        created_by,
        created_by_name,
        is_completed,
        created_at,
        updated_at
    FROM dashboard_notes
    WHERE is_completed = 0
    ORDER BY priority ASC, created_at DESC;
END //

DELIMITER ;

-- ============================================
-- Stored Procedure: Hent alle noter (inkl. faerdige)
-- ============================================

DELIMITER //

CREATE PROCEDURE get_all_notes(IN p_limit INT)
BEGIN
    SELECT
        id,
        title,
        content,
        priority,
        created_by,
        created_by_name,
        is_completed,
        completed_at,
        completed_by,
        created_at,
        updated_at
    FROM dashboard_notes
    ORDER BY is_completed ASC, priority ASC, created_at DESC
    LIMIT p_limit;
END //

DELIMITER ;
