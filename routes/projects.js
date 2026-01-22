import express from "express";
import { pool, addBusinessDays } from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Period configuration for project queries
const PERIODS = {
    confirmed: { startOffset: -1, endOffset: 7 },
    prepped: { startOffset: -1, endOffset: 7 },
    onLocation: { startOffset: -1, endOffset: 5 },
    toBeInvoiced: { startOffset: -7, endOffset: 0 },
    delayed: { startOffset: -45, endOffset: 0 },
    transport: { startOffset: -2, endOffset: 20 }
};

// Helper function for queries
async function queryProjects(res, sql, params = []) {
    try {
        const [rows] = await pool.execute(sql, params);
        res.json(rows);
    } catch (e) {
        console.error('Project query error:', e);
        res.status(500).json([]);
    }
}

// ============================================
// Public Lager Dashboard Endpoints (No Auth)
// ============================================

// GET /projects/confirmed - Skal pakkes (Status 3)
router.get("/confirmed", (req, res) => {
    const today = new Date();
    const p = PERIODS.confirmed;
    queryProjects(res, `
        SELECT
            subproject_id AS sp_id,
            subproject_name AS displayname,
            sp_start_pp,
            sp_end_pp,
            sp_start_up,
            sp_end_up,
            project_name AS project,
            (SELECT letter FROM crew WHERE rentman_id = wh_out) AS wh_out_letter,
            (SELECT letter FROM crew WHERE rentman_id = wh_in) AS wh_in_letter,
            (SELECT name FROM rentman_status WHERE status = sp_status) AS status_name
        FROM project_with_sp
        WHERE sp_start_pp BETWEEN ? AND ?
          AND is_planning = 1
          AND sp_status = 3
        ORDER BY sp_start_up ASC
    `, [addBusinessDays(today, p.startOffset), addBusinessDays(today, p.endOffset)]);
});

// GET /projects/prepped - Er pakket (Status 4)
router.get("/prepped", (req, res) => {
    const today = new Date();
    const p = PERIODS.prepped;
    queryProjects(res, `
        SELECT
            subproject_id AS sp_id,
            subproject_name AS displayname,
            sp_start_pp,
            sp_end_pp,
            sp_start_up,
            sp_end_up,
            project_name AS project,
            (SELECT letter FROM crew WHERE rentman_id = wh_out) AS wh_out_letter,
            (SELECT letter FROM crew WHERE rentman_id = wh_in) AS wh_in_letter,
            (SELECT name FROM rentman_status WHERE status = sp_status) AS status_name
        FROM project_with_sp
        WHERE sp_start_up BETWEEN ? AND ?
          AND is_planning = 1
          AND sp_status = 4
        ORDER BY sp_start_up ASC
    `, [addBusinessDays(today, p.startOffset), addBusinessDays(today, p.endOffset)]);
});

// GET /projects/onlocation - Kommer hjem (Status 5)
router.get("/onlocation", (req, res) => {
    const today = new Date();
    const p = PERIODS.onLocation;
    queryProjects(res, `
        SELECT
            subproject_id AS sp_id,
            subproject_name AS displayname,
            sp_start_pp,
            sp_end_pp,
            sp_start_up,
            sp_end_up,
            project_name AS project,
            (SELECT letter FROM crew WHERE rentman_id = wh_out) AS wh_out_letter,
            (SELECT letter FROM crew WHERE rentman_id = wh_in) AS wh_in_letter,
            (SELECT name FROM rentman_status WHERE status = sp_status) AS status_name
        FROM project_with_sp
        WHERE sp_end_pp BETWEEN ? AND ?
          AND is_planning = 1
          AND sp_status = 5
        ORDER BY sp_end_up ASC
    `, [addBusinessDays(today, p.startOffset), addBusinessDays(today, p.endOffset)]);
});

// GET /projects/tobeinvoiced - Pakket ud (Status 9)
router.get("/tobeinvoiced", (req, res) => {
    const today = new Date();
    const p = PERIODS.toBeInvoiced;
    queryProjects(res, `
        SELECT
            subproject_id AS sp_id,
            subproject_name AS displayname,
            sp_start_pp,
            sp_end_pp,
            project_name AS project,
            (SELECT letter FROM crew WHERE rentman_id = wh_out) AS wh_out_letter,
            (SELECT letter FROM crew WHERE rentman_id = wh_in) AS wh_in_letter,
            (SELECT name FROM rentman_status WHERE status = sp_status) AS status_name
        FROM project_with_sp
        WHERE sp_end_pp BETWEEN ? AND ?
          AND is_planning = 1
          AND sp_status = 9
        ORDER BY sp_end_up ASC
    `, [addBusinessDays(today, p.startOffset), addBusinessDays(today, p.endOffset)]);
});

// GET /projects/delayed - Forsinket
router.get("/delayed", (req, res) => {
    const today = new Date();
    const p = PERIODS.delayed;
    queryProjects(res, `
        SELECT subproject_id AS sp_id,
               subproject_name AS displayname,
               sp_start_up,
               sp_end_pp,
               project_name AS project
        FROM project_with_sp
        WHERE sp_status IN (4,5)
          AND sp_end_pp BETWEEN ? AND ?
          AND is_planning = 1
    `, [addBusinessDays(today, p.startOffset), addBusinessDays(today, p.endOffset)]);
});

// GET /transports - Transport
router.get("/transports", (req, res) => {
    const today = new Date();
    const p = PERIODS.transport;
    queryProjects(res, `
        SELECT *
        FROM transport as t
        JOIN project_with_sp as sp
        ON t.subproject_id = sp.subproject_id
        WHERE up_end BETWEEN ? AND ?
    `, [addBusinessDays(today, p.startOffset), addBusinessDays(today, p.endOffset)]);
});

// ============================================
// Authenticated API Endpoints
// ============================================

// GET /api/projects - Get projects grouped by project_id
router.get("/api/projects", authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                project_id,
                project_name,
                MIN(sp_start_pp) as start_date,
                MAX(sp_end_pp) as end_date,
                COUNT(*) as subproject_count
            FROM project_with_sp
            WHERE is_planning = 1
            GROUP BY project_id, project_name
            ORDER BY start_date DESC
            LIMIT 100
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Kunne ikke hente projekter' });
    }
});

// GET /api/projects/search - Search projects by name
router.get("/api/projects/search", authMiddleware, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ success: true, data: [] });
        }

        const [rows] = await pool.query(`
            SELECT DISTINCT
                project_id,
                project_name,
                subproject_id,
                subproject_name
            FROM project_with_sp
            WHERE (project_name LIKE ? OR subproject_name LIKE ?)
              AND is_planning = 1
            ORDER BY project_name ASC
            LIMIT 20
        `, [`%${q}%`, `%${q}%`]);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Search projects error:', error);
        res.status(500).json({ error: 'Søgning fejlede' });
    }
});

export default router;
