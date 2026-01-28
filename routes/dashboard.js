import express from "express";
import { pool, crmPool } from "../config/database.js";
import { authMiddleware, displayKeyApiMiddleware } from "../middleware/auth.js";

const router = express.Router();

// GET /api/dashboard-stats - Get dashboard statistics
router.get("/stats", authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Get this week's project count
        let projectCount = 0;
        try {
            const [[projectResult]] = await pool.query(`
                SELECT COUNT(DISTINCT project_id) as count
                FROM project_with_sp
                WHERE sp_start_pp <= ? AND sp_end_pp >= ?
                AND sp_status NOT IN (1, 2, 8)
                AND LOWER(project_name) NOT LIKE '%opbevaring%'
                AND LOWER(subproject_name) NOT LIKE '%opbevaring%'
            `, [weekEnd, weekStart]);
            projectCount = projectResult.count;
        } catch (e) { projectCount = 0; }

        // Get 24h activity count
        let activityCount = 0;
        try {
            const [[activityResult]] = await pool.query(`
                SELECT COUNT(*) as count FROM activity_log
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `);
            activityCount = activityResult.count;
        } catch (e) { activityCount = 0; }

        // Get unresolved errors count
        let unresolvedErrors = { count: 0, status: 'OK' };
        try {
            const [[errorResult]] = await crmPool.query(`
                SELECT COUNT(*) as count FROM integration_errors WHERE resolved = FALSE
            `);
            unresolvedErrors.count = errorResult.count;
            if (unresolvedErrors.count === 0) unresolvedErrors.status = 'OK';
            else if (unresolvedErrors.count <= 5) unresolvedErrors.status = 'Mindre';
            else unresolvedErrors.status = 'Kritisk';
        } catch (e) {
            unresolvedErrors.count = 0;
            unresolvedErrors.status = 'OK';
        }

        res.json({
            success: true,
            stats: {
                weekly_projects: projectCount,
                activity_24h: activityCount,
                unresolved_errors: unresolvedErrors
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Kunne ikke hente statistikker', message: error.message });
    }
});

// GET /api/notes - Get all active notes
router.get("/notes", authMiddleware, async (req, res) => {
    try {
        const includeCompleted = req.query.all === 'true';

        let query = `
            SELECT id, title, content, priority, created_by,
                   (SELECT fornavn FROM users WHERE id = dashboard_notes.created_by) as created_by_name,
                   is_completed, completed_at, created_at, updated_at
            FROM dashboard_notes
            ${includeCompleted ? '' : 'WHERE is_completed = FALSE'}
            ORDER BY priority DESC, created_at DESC
        `;

        const [rows] = await pool.query(query);
        res.json({ success: true, notes: rows });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Kunne ikke hente noter', message: error.message });
    }
});

// POST /api/notes - Create a note
router.post("/notes", authMiddleware, async (req, res) => {
    try {
        const { title, content, priority } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Titel er påkrævet' });
        }

        const [result] = await pool.query(`
            INSERT INTO dashboard_notes (title, content, priority, created_by)
            VALUES (?, ?, ?, ?)
        `, [title, content || null, priority || 0, req.session.user.id]);

        const [newNote] = await pool.query('SELECT * FROM dashboard_notes WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, note: newNote[0] });
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Kunne ikke oprette note', message: error.message });
    }
});

// PUT /api/notes/:id - Update a note
router.put("/notes/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, priority } = req.body;

        await pool.query(`
            UPDATE dashboard_notes
            SET title = ?, content = ?, priority = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [title, content || null, priority || 0, id]);

        const [updatedNote] = await pool.query('SELECT * FROM dashboard_notes WHERE id = ?', [id]);
        res.json({ success: true, note: updatedNote[0] });
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere note', message: error.message });
    }
});

// PUT /api/notes/:id/complete - Toggle note completion
router.put("/notes/:id/complete", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_completed } = req.body;

        await pool.query(`
            UPDATE dashboard_notes
            SET is_completed = ?, completed_at = ${is_completed ? 'CURRENT_TIMESTAMP' : 'NULL'}
            WHERE id = ?
        `, [is_completed, id]);

        res.json({ success: true, message: is_completed ? 'Note markeret som færdig' : 'Note genåbnet' });
    } catch (error) {
        console.error('Error completing note:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere note', message: error.message });
    }
});

// DELETE /api/notes/:id - Delete a note
router.delete("/notes/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM dashboard_notes WHERE id = ?', [id]);
        res.json({ success: true, message: 'Note slettet' });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Kunne ikke slette note', message: error.message });
    }
});

router.get("/unfi/cam", displayKeyApiMiddleware, async (req, res) => {
    try {
        const url = process.env.UNIF_MONIOTR_SLUSE_URL
        res.json({ success: true,  url: url });
    } catch (error) {
        console.error('Error fetching URL', error);
        res.status(500).json({ error: 'Kunne ikke fetche URL', message: error.message });
    }
});

export default router;
