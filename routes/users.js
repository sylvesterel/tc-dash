import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../config/database.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { sendWelcomeEmail } from "../utils/email.js";

const router = express.Router();

// GET /api/users - Get all users
router.get("/", authMiddleware, async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT
                u.id, u.fornavn, u.efternavn, u.brugernavn, u.email,
                u.telefon, u.title, u.rolle, u.is_active, u.last_login, u.created_at,
                creator.fornavn AS created_by_fornavn,
                creator.efternavn AS created_by_efternavn
            FROM users u
            LEFT JOIN users creator ON u.created_by = creator.id
            WHERE u.is_active = TRUE
            ORDER BY u.created_at DESC
        `);
        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Kunne ikke hente brugere', message: error.message });
    }
});

// GET /api/users/:id - Get single user
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await pool.query(`
            SELECT
                u.id, u.fornavn, u.efternavn, u.brugernavn, u.email,
                u.telefon, u.title, u.rolle, u.is_active, u.last_login, u.created_at,
                creator.fornavn AS created_by_fornavn,
                creator.efternavn AS created_by_efternavn
            FROM users u
            LEFT JOIN users creator ON u.created_by = creator.id
            WHERE u.id = ? AND u.is_active = TRUE
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'Bruger ikke fundet' });
        }
        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Kunne ikke hente bruger', message: error.message });
    }
});

// Generate random password
function generatePassword(length = 12) {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    // Ensure at least one of each type
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

// POST /api/users - Create new user (Admin only)
router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { fornavn, efternavn, brugernavn, email, telefon, title, rolle, sendEmail: shouldSendEmail } = req.body;

        if (!fornavn || !efternavn || !brugernavn || !email) {
            return res.status(400).json({ error: 'Fornavn, efternavn, brugernavn og email er påkrævet' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Ugyldig email-adresse' });
        }

        const [existingUsername] = await pool.query('SELECT id FROM users WHERE brugernavn = ?', [brugernavn]);
        if (existingUsername.length > 0) {
            return res.status(400).json({ error: 'Brugernavn er allerede i brug' });
        }

        const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ error: 'Email er allerede i brug' });
        }

        // Auto-generate password
        const generatedPassword = generatePassword(12);
        const password_hash = await bcrypt.hash(generatedPassword, 10);

        const [result] = await pool.query(`
            INSERT INTO users (fornavn, efternavn, brugernavn, email, telefon, password_hash, title, rolle, created_by, must_change_password)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
        `, [fornavn, efternavn, brugernavn, email, telefon || null, password_hash, title || null, rolle || 'standard', req.session.user.id]);

        const [newUser] = await pool.query(
            'SELECT id, fornavn, efternavn, brugernavn, email, telefon, title, rolle FROM users WHERE id = ?',
            [result.insertId]
        );

        let emailSent = false;
        if (shouldSendEmail) {
            emailSent = await sendWelcomeEmail(email, fornavn, brugernavn, generatedPassword);
        }

        res.status(201).json({
            success: true,
            message: emailSent ? 'Bruger oprettet og velkomst-email sendt' : 'Bruger oprettet',
            user: newUser[0],
            generatedPassword: !shouldSendEmail ? generatedPassword : undefined,
            emailSent
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Kunne ikke oprette bruger', message: error.message });
    }
});

// PUT /api/users/:id - Update user
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { fornavn, efternavn, email, telefon, title, password, rolle } = req.body;

        const [existingUser] = await pool.query('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [id]);
        if (existingUser.length === 0) {
            return res.status(404).json({ error: 'Bruger ikke fundet' });
        }

        if (req.session.user.id !== parseInt(id) && req.session.user.rolle !== 'admin') {
            return res.status(403).json({ error: 'Du har ikke tilladelse til at redigere denne bruger' });
        }

        if (rolle && req.session.user.rolle !== 'admin') {
            return res.status(403).json({ error: 'Kun administratorer kan ændre brugerroller' });
        }

        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Ugyldig email-adresse' });
            }
            const [emailCheck] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
            if (emailCheck.length > 0) {
                return res.status(400).json({ error: 'Email er allerede i brug' });
            }
        }

        let updateFields = [];
        let updateValues = [];

        if (fornavn) { updateFields.push('fornavn = ?'); updateValues.push(fornavn); }
        if (efternavn) { updateFields.push('efternavn = ?'); updateValues.push(efternavn); }
        if (email) { updateFields.push('email = ?'); updateValues.push(email); }
        if (telefon !== undefined) { updateFields.push('telefon = ?'); updateValues.push(telefon || null); }
        if (title !== undefined) { updateFields.push('title = ?'); updateValues.push(title || null); }
        if (rolle && req.session.user.rolle === 'admin') { updateFields.push('rolle = ?'); updateValues.push(rolle); }

        if (password) {
            if (password.length < 8) {
                return res.status(400).json({ error: 'Adgangskode skal være mindst 8 tegn' });
            }
            const password_hash = await bcrypt.hash(password, 10);
            updateFields.push('password_hash = ?');
            updateValues.push(password_hash);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Ingen felter at opdatere' });
        }

        updateValues.push(id);
        await pool.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

        const [updatedUser] = await pool.query(
            'SELECT id, fornavn, efternavn, brugernavn, email, telefon, title, rolle FROM users WHERE id = ?',
            [id]
        );

        if (req.session.user.id === parseInt(id)) {
            req.session.user = { ...req.session.user, ...updatedUser[0] };
        }

        res.json({ success: true, message: 'Bruger opdateret', user: updatedUser[0] });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Kunne ikke opdatere bruger', message: error.message });
    }
});

// DELETE /api/users/:id - Soft delete user (Admin only)
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const [existingUser] = await pool.query('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [id]);
        if (existingUser.length === 0) {
            return res.status(404).json({ error: 'Bruger ikke fundet' });
        }

        if (req.session.user.id === parseInt(id)) {
            return res.status(400).json({ error: 'Du kan ikke slette din egen bruger' });
        }

        await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);
        res.json({ success: true, message: 'Bruger slettet' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Kunne ikke slette bruger', message: error.message });
    }
});

// GET /api/user-statistics - Get user statistics
router.get("/statistics", authMiddleware, async (req, res) => {
    try {
        const [stats] = await pool.query('CALL get_user_statistics()');
        res.json({ success: true, statistics: stats[0][0] });
    } catch (error) {
        console.error('Error fetching user statistics:', error);
        res.status(500).json({ error: 'Kunne ikke hente statistikker', message: error.message });
    }
});

export default router;
