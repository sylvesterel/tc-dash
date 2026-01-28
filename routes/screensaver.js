import express from "express";
import { pool } from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Middleware til at validere display key (for public endpoints)
function displayKeyMiddleware(req, res, next) {
    const displayKey = process.env.DISPLAY_KEY;
    const providedKey = req.query.key;

    if (providedKey === displayKey) {
        return next();
    }

    // Fallback til session auth
    if (req.session?.user) {
        return next();
    }

    return res.status(401).json({ error: 'Adgang nægtet' });
}

// GET /api/screensaver/status - Hent pauseskærm status (public med display key)
router.get("/status", displayKeyMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                s.id,
                s.active_start,
                s.active_end,
                s.manual_override_until,
                s.updated_at,
                CASE
                    WHEN CURTIME() BETWEEN s.active_start AND s.active_end THEN TRUE
                    ELSE FALSE
                END AS is_work_hours,
                CASE
                    WHEN s.manual_override_until IS NOT NULL AND s.manual_override_until > NOW() THEN TRUE
                    ELSE FALSE
                END AS has_manual_override,
                CASE
                    WHEN (CURTIME() NOT BETWEEN s.active_start AND s.active_end)
                         AND (s.manual_override_until IS NULL OR s.manual_override_until <= NOW()) THEN TRUE
                    ELSE FALSE
                END AS should_show_screensaver
            FROM screensaver_settings s
            LIMIT 1
        `);

        if (rows.length === 0) {
            // Opret default indstillinger hvis de ikke findes
            await pool.query(`
                INSERT INTO screensaver_settings (active_start, active_end)
                VALUES ('08:30:00', '18:00:00')
            `);

            return res.json({
                success: true,
                active_start: '08:30:00',
                active_end: '18:00:00',
                manual_override_until: null,
                is_work_hours: false,
                has_manual_override: false,
                should_show_screensaver: true
            });
        }

        const settings = rows[0];
        res.json({
            success: true,
            active_start: settings.active_start,
            active_end: settings.active_end,
            manual_override_until: settings.manual_override_until,
            is_work_hours: Boolean(settings.is_work_hours),
            has_manual_override: Boolean(settings.has_manual_override),
            should_show_screensaver: Boolean(settings.should_show_screensaver)
        });
    } catch (error) {
        console.error('Error fetching screensaver status:', error);
        res.status(500).json({ error: 'Kunne ikke hente pauseskærm status', message: error.message });
    }
});

// GET /api/screensaver/settings - Hent indstillinger (kræver login)
router.get("/settings", authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                s.*,
                u.fornavn,
                u.efternavn
            FROM screensaver_settings s
            LEFT JOIN users u ON s.updated_by = u.id
            LIMIT 1
        `);

        if (rows.length === 0) {
            // Opret default indstillinger
            await pool.query(`
                INSERT INTO screensaver_settings (active_start, active_end)
                VALUES ('08:30:00', '18:00:00')
            `);

            return res.json({
                success: true,
                settings: {
                    active_start: '08:30',
                    active_end: '18:00',
                    manual_override_until: null,
                    updated_by_name: null,
                    updated_at: null
                }
            });
        }

        const settings = rows[0];
        res.json({
            success: true,
            settings: {
                active_start: settings.active_start.substring(0, 5), // HH:MM format
                active_end: settings.active_end.substring(0, 5),
                manual_override_until: settings.manual_override_until,
                updated_by_name: settings.fornavn && settings.efternavn
                    ? `${settings.fornavn} ${settings.efternavn}`
                    : null,
                updated_at: settings.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching screensaver settings:', error);
        res.status(500).json({ error: 'Kunne ikke hente indstillinger', message: error.message });
    }
});

// PUT /api/screensaver/settings - Opdater tidsrum (kræver login)
router.put("/settings", authMiddleware, async (req, res) => {
    try {
        const { active_start, active_end } = req.body;

        if (!active_start || !active_end) {
            return res.status(400).json({ error: 'Start- og sluttid er påkrævet' });
        }

        // Valider tidsformat (HH:MM)
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(active_start) || !timeRegex.test(active_end)) {
            return res.status(400).json({ error: 'Ugyldigt tidsformat. Brug HH:MM' });
        }

        // Opdater indstillinger
        await pool.query(`
            UPDATE screensaver_settings
            SET active_start = ?, active_end = ?, updated_by = ?
            WHERE id = 1
        `, [`${active_start}:00`, `${active_end}:00`, req.session.user.id]);

        // Hvis ingen række blev opdateret, opret en ny
        const [result] = await pool.query(`SELECT ROW_COUNT() as affected`);
        if (result[0]?.affected === 0) {
            await pool.query(`
                INSERT INTO screensaver_settings (active_start, active_end, updated_by)
                VALUES (?, ?, ?)
            `, [`${active_start}:00`, `${active_end}:00`, req.session.user.id]);
        }

        // Log aktivitet
        await pool.query(`
            INSERT INTO activity_log (user_id, user_name, action_type, resource_type, resource_name, description)
            VALUES (?, ?, 'update', 'screensaver_settings', 'Pauseskærm', ?)
        `, [
            req.session.user.id,
            `${req.session.user.fornavn} ${req.session.user.efternavn}`,
            `Pauseskærm tidsrum ændret til ${active_start} - ${active_end}`
        ]);

        res.json({ success: true, message: 'Indstillinger opdateret' });
    } catch (error) {
        console.error('Error updating screensaver settings:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere indstillinger', message: error.message });
    }
});

// POST /api/screensaver/override - Slå pauseskærm fra manuelt (kræver login)
router.post("/override", authMiddleware, async (req, res) => {
    try {
        // Hent nuværende indstillinger for at beregne næste tidsrum
        const [settings] = await pool.query(`
            SELECT active_start, active_end FROM screensaver_settings LIMIT 1
        `);

        if (settings.length === 0) {
            return res.status(404).json({ error: 'Indstillinger ikke fundet' });
        }

        const { active_start } = settings[0];

        // Beregn hvornår pauseskærm normalt ville slå til igen (næste dag kl. active_start)
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Sæt override til næste dag ved active_start tidspunktet
        const [hours, minutes] = active_start.split(':');
        tomorrow.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Opdater med manuel override
        await pool.query(`
            UPDATE screensaver_settings
            SET manual_override_until = ?, updated_by = ?
            WHERE id = 1
        `, [tomorrow, req.session.user.id]);

        // Log aktivitet
        await pool.query(`
            INSERT INTO activity_log (user_id, user_name, action_type, resource_type, resource_name, description)
            VALUES (?, ?, 'update', 'screensaver_settings', 'Pauseskærm', ?)
        `, [
            req.session.user.id,
            `${req.session.user.fornavn} ${req.session.user.efternavn}`,
            `Pauseskærm slået fra manuelt indtil ${tomorrow.toLocaleString('da-DK')}`
        ]);

        res.json({
            success: true,
            message: 'Pauseskærm slået fra',
            override_until: tomorrow
        });
    } catch (error) {
        console.error('Error setting screensaver override:', error);
        res.status(500).json({ error: 'Kunne ikke slå pauseskærm fra', message: error.message });
    }
});

// DELETE /api/screensaver/override - Fjern manuel override (kræver login)
router.delete("/override", authMiddleware, async (req, res) => {
    try {
        await pool.query(`
            UPDATE screensaver_settings
            SET manual_override_until = NULL, updated_by = ?
            WHERE id = 1
        `, [req.session.user.id]);

        // Log aktivitet
        await pool.query(`
            INSERT INTO activity_log (user_id, user_name, action_type, resource_type, resource_name, description)
            VALUES (?, ?, 'update', 'screensaver_settings', 'Pauseskærm', ?)
        `, [
            req.session.user.id,
            `${req.session.user.fornavn} ${req.session.user.efternavn}`,
            'Manuel override af pauseskærm fjernet'
        ]);

        res.json({ success: true, message: 'Manuel override fjernet' });
    } catch (error) {
        console.error('Error removing screensaver override:', error);
        res.status(500).json({ error: 'Kunne ikke fjerne override', message: error.message });
    }
});

export default router;
