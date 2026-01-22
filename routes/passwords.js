import express from "express";
import { pool } from "../config/database.js";
import crypto from "crypto";

const router = express.Router();

// Encryption key from environment (should be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

// ============================================
// Encryption Helpers
// ============================================
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = parts.join(':');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32), iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

// ============================================
// Auth Middleware
// ============================================
function authMiddleware(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({ error: 'Ikke autoriseret' });
    }
    next();
}

// Apply auth to all routes
router.use(authMiddleware);

// ============================================
// GET /api/passwords - Get all passwords for user
// ============================================
router.get("/", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [rows] = await pool.query(
            `SELECT id, site_name, url, username, password, created_at, updated_at
             FROM passwords
             WHERE user_id = ?
             ORDER BY site_name ASC`,
            [userId]
        );

        // Decrypt passwords before sending
        const passwords = rows.map(row => ({
            id: row.id,
            siteName: row.site_name,
            url: row.url,
            username: row.username,
            password: decrypt(row.password) || '********',
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        res.json(passwords);
    } catch (error) {
        console.error('Error fetching passwords:', error);
        res.status(500).json({ error: 'Kunne ikke hente adgangskoder' });
    }
});

// ============================================
// POST /api/passwords - Create new password
// ============================================
router.post("/", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { siteName, url, username, password } = req.body;

        if (!siteName || !url || !username || !password) {
            return res.status(400).json({ error: 'Alle felter er påkrævet' });
        }

        // Encrypt the password before storing
        const encryptedPassword = encrypt(password);

        const [result] = await pool.query(
            `INSERT INTO passwords (user_id, site_name, url, username, password)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, siteName.trim(), url.trim(), username.trim(), encryptedPassword]
        );

        res.status(201).json({
            id: result.insertId,
            siteName,
            url,
            username,
            message: 'Adgangskode gemt'
        });
    } catch (error) {
        console.error('Error creating password:', error);
        res.status(500).json({ error: 'Kunne ikke gemme adgangskode' });
    }
});

// ============================================
// PUT /api/passwords/:id - Update password
// ============================================
router.put("/:id", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { id } = req.params;
        const { siteName, url, username, password } = req.body;

        // Verify ownership
        const [existing] = await pool.query(
            'SELECT id FROM passwords WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Adgangskode ikke fundet' });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (siteName) {
            updates.push('site_name = ?');
            values.push(siteName.trim());
        }
        if (url) {
            updates.push('url = ?');
            values.push(url.trim());
        }
        if (username) {
            updates.push('username = ?');
            values.push(username.trim());
        }
        if (password) {
            updates.push('password = ?');
            values.push(encrypt(password));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Ingen felter at opdatere' });
        }

        updates.push('updated_at = NOW()');
        values.push(id, userId);

        await pool.query(
            `UPDATE passwords SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
            values
        );

        res.json({ message: 'Adgangskode opdateret' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere adgangskode' });
    }
});

// ============================================
// DELETE /api/passwords/:id - Delete password
// ============================================
router.delete("/:id", async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { id } = req.params;

        const [result] = await pool.query(
            'DELETE FROM passwords WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Adgangskode ikke fundet' });
        }

        res.json({ message: 'Adgangskode slettet' });
    } catch (error) {
        console.error('Error deleting password:', error);
        res.status(500).json({ error: 'Kunne ikke slette adgangskode' });
    }
});

export default router;
