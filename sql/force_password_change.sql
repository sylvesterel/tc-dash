-- ============================================
-- Force Password Change on First Login
-- Tilføjer must_change_password kolonne til users tabel
-- ============================================

-- Tilføj must_change_password kolonne
-- Nye brugere skal ændre kode ved første login
ALTER TABLE users
ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

-- Eksisterende brugere skal IKKE ændre kode (de har allerede logget ind før)
UPDATE users SET must_change_password = FALSE WHERE id > 0;
