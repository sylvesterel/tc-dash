import express from "express";
import { pool } from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// GET /api/activities - Get recent activities
router.get("/", authMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const [rows] = await pool.query(`
            SELECT id, user_id, user_name, action_type, resource_type,
                   resource_id, resource_name, description, created_at
            FROM activity_log
            ORDER BY created_at DESC
            LIMIT ?
        `, [limit]);

        res.json({ success: true, activities: rows });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Kunne ikke hente aktiviteter', message: error.message });
    }
});

// GET /api/activities/count - Get 24h activity count
router.get("/count", authMiddleware, async (req, res) => {
    try {
        const [[result]] = await pool.query(`
            SELECT COUNT(*) as count FROM activity_log
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);
        res.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error fetching activity count:', error);
        res.status(500).json({ error: 'Kunne ikke hente aktivitetsantal', message: error.message });
    }
});

// POST /api/activities - Log an activity
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { action_type, resource_type, resource_id, resource_name, description, old_values, new_values } = req.body;

        await pool.query(`
            INSERT INTO activity_log (user_id, user_name, action_type, resource_type, resource_id, resource_name, description, old_values, new_values)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.session.user.id,
            `${req.session.user.fornavn} ${req.session.user.efternavn}`,
            action_type,
            resource_type,
            resource_id || null,
            resource_name || null,
            description || null,
            old_values ? JSON.stringify(old_values) : null,
            new_values ? JSON.stringify(new_values) : null
        ]);

        res.json({ success: true, message: 'Aktivitet logget' });
    } catch (error) {
        console.error('Error logging activity:', error);
        res.status(500).json({ error: 'Kunne ikke logge aktivitet', message: error.message });
    }
});

export default router;
