import express from "express";
import { pool } from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getDayName(dayIndex) {
    const days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
    return days[dayIndex];
}

// GET /api/menu - Get current week's menu
router.get("/", authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const weekNumber = req.query.week ? parseInt(req.query.week) : getWeekNumber(now);
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

        const [rows] = await pool.query(`
            SELECT * FROM weekly_menu
            WHERE week_number = ? AND year = ?
            ORDER BY FIELD(day_of_week, 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag')
        `, [weekNumber, year]);

        const menu = rows.map(row => {
            let toppings = row.toppings || [];
            let salads = row.salads || [];
            if (typeof toppings === 'string') try { toppings = JSON.parse(toppings); } catch (e) { toppings = []; }
            if (typeof salads === 'string') try { salads = JSON.parse(salads); } catch (e) { salads = []; }
            return { ...row, toppings, salads };
        });

        res.json({
            success: true,
            week_number: weekNumber,
            year: year,
            today: getDayName(now.getDay()),
            menu
        });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ error: 'Kunne ikke hente menu', message: error.message });
    }
});

// PUT /api/menu - Update week's menu
router.put("/", authMiddleware, async (req, res) => {
    try {
        const { week_number, year, menu } = req.body;

        if (!week_number || !year || !menu || !Array.isArray(menu)) {
            return res.status(400).json({ error: 'Ugenummer, år og menu er påkrævet' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const day of menu) {
                const toppings = JSON.stringify(day.toppings || []);
                const salads = JSON.stringify(day.salads || []);

                await connection.query(`
                    INSERT INTO weekly_menu (week_number, year, day_of_week, main_dish, main_dish_description, toppings, salads, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        main_dish = VALUES(main_dish),
                        main_dish_description = VALUES(main_dish_description),
                        toppings = VALUES(toppings),
                        salads = VALUES(salads),
                        updated_at = CURRENT_TIMESTAMP
                `, [week_number, year, day.day_of_week, day.main_dish, day.main_dish_description || null, toppings, salads, req.session.user.id]);
            }

            await connection.query(`
                INSERT INTO activity_log (user_id, user_name, action_type, resource_type, resource_name, description)
                VALUES (?, ?, 'update', 'weekly_menu', ?, ?)
            `, [
                req.session.user.id,
                `${req.session.user.fornavn} ${req.session.user.efternavn}`,
                `Uge ${week_number}`,
                `Menu for uge ${week_number} blev opdateret`
            ]);

            await connection.commit();
            res.json({ success: true, message: 'Menu opdateret' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating menu:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere menu', message: error.message });
    }
});

export default router;
