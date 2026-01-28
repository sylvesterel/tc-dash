-- ============================================
-- Screensaver Settings Table
-- Gemmer indstillinger for pauseskærm på dashboards
-- ============================================

CREATE TABLE IF NOT EXISTS screensaver_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Tidsrum hvor pauseskærm er slået fra (arbejdstid)
    active_start TIME NOT NULL DEFAULT '08:30:00',
    active_end TIME NOT NULL DEFAULT '18:00:00',

    -- Manuel override - pauseskærm slået fra indtil denne timestamp
    manual_override_until DATETIME DEFAULT NULL,

    -- Hvem lavede sidst en ændring
    updated_by INT DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indsæt default indstillinger (kun én række - singleton)
INSERT INTO screensaver_settings (active_start, active_end)
VALUES ('08:30:00', '18:00:00')
ON DUPLICATE KEY UPDATE id = id;

-- ============================================
-- View til at tjekke om pauseskærm skal vises
-- Returnerer true hvis pauseskærm skal være aktiv (uden for arbejdstid og ingen override)
-- ============================================

CREATE OR REPLACE VIEW screensaver_status AS
SELECT
    s.id,
    s.active_start,
    s.active_end,
    s.manual_override_until,
    s.updated_at,
    -- Er vi inden for arbejdstiden?
    CASE
        WHEN CURTIME() BETWEEN s.active_start AND s.active_end THEN TRUE
        ELSE FALSE
    END AS is_work_hours,
    -- Er der en aktiv manuel override?
    CASE
        WHEN s.manual_override_until IS NOT NULL AND s.manual_override_until > NOW() THEN TRUE
        ELSE FALSE
    END AS has_manual_override,
    -- Skal pauseskærm vises? (uden for arbejdstid OG ingen override)
    CASE
        WHEN (CURTIME() NOT BETWEEN s.active_start AND s.active_end)
             AND (s.manual_override_until IS NULL OR s.manual_override_until <= NOW()) THEN TRUE
        ELSE FALSE
    END AS should_show_screensaver
FROM screensaver_settings s
LIMIT 1;
