import express from "express";
import { pool } from "../config/database.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Initialize table on startup
async function initPageStatusTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS page_status (
                id INT AUTO_INCREMENT PRIMARY KEY,
                page_path VARCHAR(255) NOT NULL UNIQUE,
                page_name VARCHAR(255) NOT NULL,
                is_disabled BOOLEAN DEFAULT FALSE,
                disabled_message TEXT,
                disabled_by INT,
                disabled_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_page_path (page_path),
                INDEX idx_is_disabled (is_disabled)
            )
        `);

        // Insert default pages if they don't exist
        const defaultPages = [
            { path: '/', name: 'Hjem' },
            { path: '/sluse', name: 'Sluse' },
            { path: '/adgang', name: 'Adgang' },
            { path: '/integration', name: 'Integration' },
            { path: '/indkob', name: 'Indkøb' },
            { path: '/codes', name: 'Adgangskoder' },
            { path: '/opbevaring', name: 'Opbevaring' },
            { path: '/profil', name: 'Profil' },
            { path: '/users', name: 'Brugere' },
            { path: '/admin', name: 'Admin' }
        ];

        for (const page of defaultPages) {
            await pool.query(
                `INSERT IGNORE INTO page_status (page_path, page_name) VALUES (?, ?)`,
                [page.path, page.name]
            );
        }

        console.log('Page status table initialized');
    } catch (error) {
        console.error('Error initializing page_status table:', error);
    }
}

// Initialize on module load
initPageStatusTable();

// GET /api/page-status - Get all page statuses (admin only)
router.get("/", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [pages] = await pool.query(`
            SELECT
                ps.*,
                u.fornavn as disabled_by_name
            FROM page_status ps
            LEFT JOIN users u ON ps.disabled_by = u.id
            ORDER BY ps.page_name ASC
        `);
        res.json({ success: true, pages });
    } catch (error) {
        console.error('Error fetching page statuses:', error);
        res.status(500).json({ error: 'Kunne ikke hente side-status' });
    }
});

// GET /api/page-status/check - Check if a specific page is disabled
router.get("/check", authMiddleware, async (req, res) => {
    try {
        const pagePath = req.query.path || '/';

        const [pages] = await pool.query(
            'SELECT is_disabled, disabled_message FROM page_status WHERE page_path = ?',
            [pagePath]
        );

        if (pages.length === 0) {
            return res.json({ success: true, isDisabled: false });
        }

        const page = pages[0];
        res.json({
            success: true,
            isDisabled: page.is_disabled,
            message: page.disabled_message || 'Denne side er midlertidigt deaktiveret.'
        });
    } catch (error) {
        console.error('Error checking page status:', error);
        res.json({ success: true, isDisabled: false });
    }
});

// PUT /api/page-status/:id - Update page status (admin only)
router.put("/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_disabled, disabled_message } = req.body;

        const [existing] = await pool.query('SELECT * FROM page_status WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Side ikke fundet' });
        }

        await pool.query(
            `UPDATE page_status SET
                is_disabled = ?,
                disabled_message = ?,
                disabled_by = ?,
                disabled_at = ?
            WHERE id = ?`,
            [
                is_disabled,
                disabled_message || null,
                is_disabled ? req.session.user.id : null,
                is_disabled ? new Date() : null,
                id
            ]
        );

        res.json({ success: true, message: is_disabled ? 'Side deaktiveret' : 'Side aktiveret' });
    } catch (error) {
        console.error('Error updating page status:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere side-status' });
    }
});

// POST /api/page-status - Add new page (admin only)
router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page_path, page_name } = req.body;

        if (!page_path || !page_name) {
            return res.status(400).json({ error: 'Sti og navn er påkrævet' });
        }

        const [existing] = await pool.query('SELECT * FROM page_status WHERE page_path = ?', [page_path]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Siden findes allerede' });
        }

        await pool.query(
            'INSERT INTO page_status (page_path, page_name) VALUES (?, ?)',
            [page_path, page_name]
        );

        res.json({ success: true, message: 'Side tilføjet' });
    } catch (error) {
        console.error('Error adding page:', error);
        res.status(500).json({ error: 'Kunne ikke tilføje side' });
    }
});

export default router;
