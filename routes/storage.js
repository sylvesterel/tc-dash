import express from "express";
import { pool } from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
router.use(authMiddleware);

// ============================================
// GET /api/storage/bookings - Get all bookings
// ============================================
router.get("/bookings", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT id, customer_name, start_date, end_date, units, created_by, created_at
            FROM storage_bookings
            ORDER BY start_date ASC
        `);

        const bookings = rows.map(row => {
            let units = [];

            if (row.units) {
                // Convert Buffer or other types to string
                let unitsStr = row.units;
                if (Buffer.isBuffer(row.units)) {
                    unitsStr = row.units.toString();
                } else if (typeof row.units !== 'string') {
                    unitsStr = String(row.units);
                }

                // Split comma-separated string into array
                units = unitsStr.split(',').map(u => u.trim()).filter(Boolean);
            }

            return {
                id: row.id,
                customer_name: row.customer_name,
                start_date: row.start_date,
                end_date: row.end_date,
                units,
                created_by: row.created_by,
                created_at: row.created_at
            };
        });

        res.json({ success: true, bookings });
    } catch (error) {
        console.error('Error fetching storage bookings:', error);
        res.status(500).json({ error: 'Kunne ikke hente bookinger' });
    }
});

// ============================================
// POST /api/storage/bookings - Create booking
// ============================================
router.post("/bookings", async (req, res) => {
    try {
        const { startDate, endDate, customerName, units } = req.body;
        const userId = req.session.user.id;

        if (!startDate || !endDate || !customerName || !units || units.length === 0) {
            return res.status(400).json({ error: 'Alle felter er påkrævet' });
        }

        // Check for overlapping bookings
        const [existing] = await pool.query(`
            SELECT id, units FROM storage_bookings
            WHERE start_date <= ? AND end_date >= ?
        `, [endDate, startDate]);

        // Check if any requested units are already booked
        const bookedUnits = new Set();
        existing.forEach(booking => {
            const bookingUnits = JSON.parse(booking.units || '[]');
            bookingUnits.forEach(u => bookedUnits.add(u));
        });

        const conflicts = units.filter(u => bookedUnits.has(u));
        if (conflicts.length > 0) {
            return res.status(409).json({
                error: `Følgende lokaler er allerede booket i denne periode: ${conflicts.join(', ')}`
            });
        }

        // Create booking
        const [result] = await pool.query(`
            INSERT INTO storage_bookings (customer_name, start_date, end_date, units, created_by)
            VALUES (?, ?, ?, ?, ?)
        `, [customerName, startDate, endDate, JSON.stringify(units), userId]);

        res.status(201).json({
            success: true,
            message: 'Booking oprettet',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating storage booking:', error);
        res.status(500).json({ error: 'Kunne ikke oprette booking' });
    }
});

// ============================================
// GET /api/storage/bookings/:id - Get single booking
// ============================================
router.get("/bookings/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(`
            SELECT id, customer_name, start_date, end_date, units, created_by, created_at
            FROM storage_bookings
            WHERE id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Booking ikke fundet' });
        }

        const booking = rows[0];
        booking.units = JSON.parse(booking.units || '[]');

        res.json({ success: true, booking });
    } catch (error) {
        console.error('Error fetching storage booking:', error);
        res.status(500).json({ error: 'Kunne ikke hente booking' });
    }
});

// ============================================
// PUT /api/storage/bookings/:id - Update booking
// ============================================
router.put("/bookings/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, customerName, units } = req.body;

        // Check if booking exists
        const [existing] = await pool.query('SELECT id FROM storage_bookings WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Booking ikke fundet' });
        }

        // Check for conflicts (excluding current booking)
        if (startDate && endDate && units) {
            const [overlapping] = await pool.query(`
                SELECT id, units FROM storage_bookings
                WHERE id != ? AND start_date <= ? AND end_date >= ?
            `, [id, endDate, startDate]);

            const bookedUnits = new Set();
            overlapping.forEach(booking => {
                const bookingUnits = JSON.parse(booking.units || '[]');
                bookingUnits.forEach(u => bookedUnits.add(u));
            });

            const conflicts = units.filter(u => bookedUnits.has(u));
            if (conflicts.length > 0) {
                return res.status(409).json({
                    error: `Følgende lokaler er allerede booket: ${conflicts.join(', ')}`
                });
            }
        }

        // Update booking
        await pool.query(`
            UPDATE storage_bookings
            SET customer_name = COALESCE(?, customer_name),
                start_date = COALESCE(?, start_date),
                end_date = COALESCE(?, end_date),
                units = COALESCE(?, units)
            WHERE id = ?
        `, [customerName, startDate, endDate, units ? JSON.stringify(units) : null, id]);

        res.json({ success: true, message: 'Booking opdateret' });
    } catch (error) {
        console.error('Error updating storage booking:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere booking' });
    }
});

// ============================================
// DELETE /api/storage/bookings/:id - Delete booking
// ============================================
router.delete("/bookings/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query('DELETE FROM storage_bookings WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Booking ikke fundet' });
        }

        res.json({ success: true, message: 'Booking slettet' });
    } catch (error) {
        console.error('Error deleting storage booking:', error);
        res.status(500).json({ error: 'Kunne ikke slette booking' });
    }
});

export default router;
