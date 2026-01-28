-- ============================================
-- Changelog Table
-- Gemmer ændringer til systemet grupperet pr. dag
-- ============================================

CREATE TABLE IF NOT EXISTS changelog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    change_date DATE NOT NULL,
    change_type ENUM('added', 'changed', 'fixed', 'beta') NOT NULL,
    description TEXT NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_change_date (change_date),
    INDEX idx_change_type (change_type),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- Indsæt historiske ændringer
-- ============================================

INSERT INTO changelog (change_date, change_type, description, created_by) VALUES
-- Tidligere ændringer (estimerede datoer)
('2025-01-15', 'added', 'Dashboard med lager-oversigt og sluse-status', NULL),
('2025-01-15', 'added', 'Brugeradministration med roller (admin/bruger)', NULL),
('2025-01-15', 'added', 'Login-system med session-baseret autentificering', NULL),
('2025-01-15', 'added', 'Seam integration til adgangskontrol', NULL),

('2025-01-20', 'added', 'Office Dashboard med frokostmenu og projektoversigt', NULL),
('2025-01-20', 'added', 'Lager Dashboard med kamera-integration', NULL),
('2025-01-20', 'added', 'Ugentlig menu-administration', NULL),

('2025-01-25', 'added', 'Adgangskode-manager med krypteret opbevaring', NULL),
('2025-01-25', 'added', 'Integration-dashboard for HubSpot/Rentman sync', NULL),
('2025-01-25', 'added', 'Aktivitetslog for brugerhandlinger', NULL),

-- Nylige ændringer (i dag)
('2026-01-28', 'added', 'Pauseskærm-funktion til lager- og office-dashboards', NULL),
('2026-01-28', 'added', 'Pauseskærm-indstillinger side med tidsrum-konfiguration', NULL),
('2026-01-28', 'added', 'Manuel override af pauseskærm for sen arbejdstid', NULL),
('2026-01-28', 'changed', 'Pauseskærm tjekker status hvert 10. sekund (fra 60 sek)', NULL),
('2026-01-28', 'added', '"Slå pauseskærm til igen" knap i indstillinger', NULL),
('2026-01-28', 'changed', 'Skjult musemarkør på new-lager-dashboard', NULL),

('2026-01-28', 'added', 'Redigering af adgangskoder (edit-knap virker nu)', NULL),
('2026-01-28', 'added', 'To typer adgangskoder: Login og Samarbejdspartner', NULL),
('2026-01-28', 'added', 'Partner ID felt til samarbejdsaftaler (synligt, ikke skjult)', NULL),
('2026-01-28', 'changed', 'Forbedret visning af noter og "oprettet af" med ikoner', NULL),
('2026-01-28', 'changed', 'Adgangskoder vises nu i grid-layout med alignede kolonner', NULL),

('2026-01-28', 'fixed', 'Chrome autofill deaktiveret på adgangskode-formularen', NULL),
('2026-01-28', 'changed', 'Login-formular har nu unik autocomplete-sektion', NULL),

('2026-01-28', 'added', '"Løs alle" knap til integration-fejl', NULL),
('2026-01-28', 'added', 'API endpoint til at løse alle fejl på én gang', NULL),

('2026-01-28', 'added', 'Tvungen adgangskode-skift ved første login', NULL),
('2026-01-28', 'added', 'Dedikeret side til første gangs password-skift', NULL),
('2026-01-28', 'added', 'Password styrke-indikator ved oprettelse af ny kode', NULL),

('2026-01-28', 'added', 'Changelog-side under System/Indstillinger', NULL);
