import express from "express";
import { pool } from "../config/database.js";
import crypto from "crypto";

const router = express.Router();

// Encryption key from environment (should be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 64 hex-tegn i .env
const IV_LENGTH = 16;

// ============================================
// Encryption Helpers
// ============================================
function encrypt(text) {
    const iv = crypto.randomBytes(16); // AES-CBC IV = 16 bytes
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = parts.join(':');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
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
        // All logged-in users can see all passwords
        const [rows] = await pool.query(
            `SELECT p.id, p.entry_type, p.site_name, p.url, p.username, p.password, p.partner_id, p.note, p.created_at, p.updated_at,
                    u.fornavn, u.efternavn
             FROM passwords p
             LEFT JOIN users u ON u.id = p.user_id
             ORDER BY p.site_name ASC`
        );

        // Decrypt passwords before sending
        const passwords = rows.map(row => ({
            id: row.id,
            entryType: row.entry_type || 'login',
            siteName: row.site_name,
            user: row.fornavn ? `${row.fornavn} ${row.efternavn || ""}`.trim() : 'Ukendt',
            url: row.url,
            username: row.username || '',
            password: row.password ? (decrypt(row.password) || '********') : '',
            partnerId: row.partner_id || '',
            note: row.note || '',
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
        const { entryType, siteName, url, username, password, partnerId, note } = req.body;

        if (!siteName || !url) {
            return res.status(400).json({ error: 'Navn og URL er påkrævet' });
        }

        const type = entryType || 'login';

        // Validate based on type
        if (type === 'login') {
            if (!username || !password) {
                return res.status(400).json({ error: 'Brugernavn og adgangskode er påkrævet for login-type' });
            }
        } else if (type === 'partner') {
            if (!partnerId) {
                return res.status(400).json({ error: 'Partner ID er påkrævet for samarbejdspartner-type' });
            }
        }

        // Encrypt the password if provided
        const encryptedPassword = password ? encrypt(password) : null;

        const [result] = await pool.query(
            `INSERT INTO passwords (user_id, entry_type, site_name, url, username, password, partner_id, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                type,
                siteName.trim(),
                url.trim(),
                username ? username.trim() : null,
                encryptedPassword,
                partnerId ? partnerId.trim() : null,
                note || null
            ]
        );

        res.status(201).json({
            id: result.insertId,
            entryType: type,
            siteName,
            url,
            username,
            partnerId,
            note,
            message: 'Adgangskode gemt'
        });
    } catch (error) {
        console.error('Error creating password:', error);
        res.status(500).json({ error: 'Kunne ikke gemme adgangskode' });
    }
});

// ============================================
// GET /api/passwords/:id - Get single password for editing
// ============================================
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT p.id, p.entry_type, p.site_name, p.url, p.username, p.password, p.partner_id, p.note
             FROM passwords p
             WHERE p.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Adgangskode ikke fundet' });
        }

        const row = rows[0];
        res.json({
            id: row.id,
            entryType: row.entry_type || 'login',
            siteName: row.site_name,
            url: row.url,
            username: row.username || '',
            password: row.password ? (decrypt(row.password) || '') : '',
            partnerId: row.partner_id || '',
            note: row.note || ''
        });
    } catch (error) {
        console.error('Error fetching password:', error);
        res.status(500).json({ error: 'Kunne ikke hente adgangskode' });
    }
});

// ============================================
// PUT /api/passwords/:id - Update password
// ============================================
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { entryType, siteName, url, username, password, partnerId, note } = req.body;

        // Verify password exists
        const [existing] = await pool.query(
            'SELECT id, entry_type FROM passwords WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Adgangskode ikke fundet' });
        }

        const type = entryType || existing[0].entry_type || 'login';

        // Build update query dynamically
        const updates = ['entry_type = ?'];
        const values = [type];

        if (siteName !== undefined) {
            updates.push('site_name = ?');
            values.push(siteName.trim());
        }
        if (url !== undefined) {
            updates.push('url = ?');
            values.push(url.trim());
        }

        // Handle type-specific fields
        if (type === 'login') {
            if (username !== undefined) {
                updates.push('username = ?');
                values.push(username ? username.trim() : null);
            }
            if (password !== undefined && password !== '') {
                updates.push('password = ?');
                values.push(encrypt(password));
            }
            // Clear partner_id for login type
            updates.push('partner_id = NULL');
        } else if (type === 'partner') {
            if (partnerId !== undefined) {
                updates.push('partner_id = ?');
                values.push(partnerId ? partnerId.trim() : null);
            }
            // Clear login fields for partner type
            updates.push('username = NULL');
            updates.push('password = NULL');
        }

        if (note !== undefined) {
            updates.push('note = ?');
            values.push(note || null);
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        await pool.query(
            `UPDATE passwords SET ${updates.join(', ')} WHERE id = ?`,
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
        const { id } = req.params;

        const [result] = await pool.query(
            'DELETE FROM passwords WHERE id = ?',
            [id]
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
