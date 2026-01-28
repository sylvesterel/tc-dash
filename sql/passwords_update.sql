-- ============================================
-- Passwords Table Update
-- Tilføjer type felt og gør username/password nullable
-- for at understøtte samarbejdspartner-aftaler
-- ============================================

-- Tilføj entry_type kolonne (login eller partner)
-- Kør kun hvis kolonnen ikke allerede eksisterer
SET @dbname = DATABASE();
SET @tablename = 'passwords';
SET @columnname = 'entry_type';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, " ENUM('login', 'partner') NOT NULL DEFAULT 'login' AFTER user_id")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Tilføj partner_id kolonne
SET @columnname = 'partner_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(255) DEFAULT NULL AFTER password')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Gør username nullable (for partner type)
ALTER TABLE passwords MODIFY COLUMN username VARCHAR(255) NULL;

-- Gør password nullable (for partner type)
ALTER TABLE passwords MODIFY COLUMN password TEXT NULL;

-- Index på entry_type (ignorer fejl hvis det allerede eksisterer)
-- CREATE INDEX idx_entry_type ON passwords(entry_type);
