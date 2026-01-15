-- ============================================
-- Weekly Menu Table
-- Gemmer ugens menu baseret på ugenummer
-- ============================================

CREATE TABLE IF NOT EXISTS weekly_menu (
    id INT AUTO_INCREMENT PRIMARY KEY,
    week_number INT NOT NULL,
    year INT NOT NULL,
    day_of_week ENUM('mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag') NOT NULL,

    -- Hovedret
    main_dish VARCHAR(255) NOT NULL,
    main_dish_description TEXT,

    -- Pålæg (JSON array)
    toppings JSON,

    -- Salater (JSON array)
    salads JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,

    -- Unique constraint: kun én menu per dag per uge
    UNIQUE KEY unique_day_week (week_number, year, day_of_week),

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for hurtig lookup
CREATE INDEX idx_week_year ON weekly_menu(week_number, year);

-- ============================================
-- Stored Procedure: Hent ugens menu
-- ============================================

DELIMITER //

CREATE PROCEDURE get_weekly_menu(IN p_week_number INT, IN p_year INT)
BEGIN
    SELECT
        id,
        week_number,
        year,
        day_of_week,
        main_dish,
        main_dish_description,
        toppings,
        salads,
        created_at,
        updated_at
    FROM weekly_menu
    WHERE week_number = p_week_number AND year = p_year
    ORDER BY FIELD(day_of_week, 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag');
END //

DELIMITER ;

-- ============================================
-- Insert sample data for current week
-- ============================================

INSERT INTO weekly_menu (week_number, year, day_of_week, main_dish, main_dish_description, toppings, salads) VALUES
(3, 2026, 'mandag', 'Kylling i rød karry', 'Med stegte gulerødder, knoldselleri, rød chili og ris',
    '["Grillet broccoli", "Fiskesalat", "Stegt svinebryst"]',
    '["Pastasalat med pesto, mungbønner og basilikum", "Dagens salat"]'),
(3, 2026, 'tirsdag', 'Pasta Carbonara', 'Med bacon og parmesan',
    '["Skinke", "Ost", "Leverpostej"]',
    '["Tomatsalat", "Dagens salat"]'),
(3, 2026, 'onsdag', 'Thai red curry med kylling', 'Med kokosmælk og basmatiris',
    '["Roastbeef", "Laksesalat", "Æg og rejer"]',
    '["Nudelsalat med grønt", "Dagens salat"]'),
(3, 2026, 'torsdag', 'Bøf med kartofler', 'Med bearnaisesauce og bagt kartoffel',
    '["Flæskesteg", "Rullepølse", "Makrelsalat"]',
    '["Kartoffelsalat", "Dagens salat"]'),
(3, 2026, 'fredag', 'Pizza Margherita', 'Med friske tomater og mozzarella',
    '["Italiensk skinke", "Salami", "Peberfrugt"]',
    '["Italiensk salat", "Dagens salat"]')
ON DUPLICATE KEY UPDATE
    main_dish = VALUES(main_dish),
    main_dish_description = VALUES(main_dish_description),
    toppings = VALUES(toppings),
    salads = VALUES(salads);
