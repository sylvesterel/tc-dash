import express from "express";
import { pool } from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// GET /api/changelog - Hent alle changelog entries grupperet pr. dag
router.get("/", authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                c.id,
                c.change_date,
                c.change_type,
                c.description,
                c.created_at,
                u.fornavn,
                u.efternavn
            FROM changelog c
            LEFT JOIN users u ON c.created_by = u.id
            ORDER BY c.change_date DESC, c.change_type ASC, c.created_at DESC
        `);

        // Gruppér efter dato
        const grouped = {};
        rows.forEach(row => {
            const dateKey = row.change_date.toISOString().split('T')[0];
            if (!grouped[dateKey]) {
                grouped[dateKey] = {
                    date: dateKey,
                    changes: []
                };
            }
            grouped[dateKey].changes.push({
                id: row.id,
                type: row.change_type,
                description: row.description,
                createdBy: row.fornavn ? `${row.fornavn} ${row.efternavn || ''}`.trim() : null,
                createdAt: row.created_at
            });
        });

        // Konverter til array sorteret efter dato (nyeste først)
        const changelog = Object.values(grouped).sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        res.json({ success: true, changelog });
    } catch (error) {
        console.error('Error fetching changelog:', error);
        res.status(500).json({ error: 'Kunne ikke hente changelog' });
    }
});

// POST /api/changelog - Tilføj ny changelog entry
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { changes } = req.body;
        const userId = req.session.user.id;

        if (!changes || !Array.isArray(changes) || changes.length === 0) {
            return res.status(400).json({ error: 'Mindst én ændring er påkrævet' });
        }

        const validTypes = ['added', 'changed', 'fixed', 'beta'];
        const today = new Date().toISOString().split('T')[0];

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const change of changes) {
                if (!change.type || !validTypes.includes(change.type)) {
                    throw new Error(`Ugyldig ændringstype: ${change.type}`);
                }
                if (!change.description || change.description.trim().length === 0) {
                    throw new Error('Beskrivelse er påkrævet');
                }

                await connection.query(`
                    INSERT INTO changelog (change_date, change_type, description, created_by)
                    VALUES (?, ?, ?, ?)
                `, [today, change.type, change.description.trim(), userId]);
            }

            await connection.commit();
            res.json({ success: true, message: `${changes.length} ændring(er) tilføjet` });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error adding changelog:', error);
        res.status(500).json({ error: error.message || 'Kunne ikke tilføje changelog' });
    }
});

// PUT /api/changelog/:id - Opdater changelog entry
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { type, description } = req.body;

        const validTypes = ['added', 'changed', 'fixed', 'beta'];

        if (!type || !validTypes.includes(type)) {
            return res.status(400).json({ error: 'Ugyldig ændringstype' });
        }
        if (!description || description.trim().length === 0) {
            return res.status(400).json({ error: 'Beskrivelse er påkrævet' });
        }

        const [result] = await pool.query(
            'UPDATE changelog SET change_type = ?, description = ? WHERE id = ?',
            [type, description.trim(), id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ændring ikke fundet' });
        }

        res.json({ success: true, message: 'Ændring opdateret' });
    } catch (error) {
        console.error('Error updating changelog:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere ændring' });
    }
});

// DELETE /api/changelog/:id - Slet changelog entry
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            'DELETE FROM changelog WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ændring ikke fundet' });
        }

        res.json({ success: true, message: 'Ændring slettet' });
    } catch (error) {
        console.error('Error deleting changelog:', error);
        res.status(500).json({ error: 'Kunne ikke slette ændring' });
    }
});

export default router;
