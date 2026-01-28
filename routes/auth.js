import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool } from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";
import { sendPasswordResetEmail } from "../utils/email.js";

const router = express.Router();

// Login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Udfyld alle felter" });
        }

        const [users] = await pool.query(
            'SELECT * FROM users WHERE brugernavn = ? AND is_active = TRUE',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: "Ugyldigt brugernavn eller adgangskode" });
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ error: "Ugyldigt brugernavn eller adgangskode" });
        }

        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

        // Log login aktivitet
        try {
            await pool.query(`
                INSERT INTO activity_log (user_id, user_name, action_type, resource_type, description)
                VALUES (?, ?, 'login', 'session', 'Bruger loggede ind')
            `, [user.id, `${user.fornavn} ${user.efternavn}`]);
        } catch (logErr) {
            console.error('Error logging login activity:', logErr);
        }

        req.session.user = {
            id: user.id,
            brugernavn: user.brugernavn,
            fornavn: user.fornavn,
            efternavn: user.efternavn,
            email: user.email,
            rolle: user.rolle,
            title: user.title,
            mustChangePassword: user.must_change_password || false
        };

        res.json({
            success: true,
            user: {
                fornavn: user.fornavn,
                efternavn: user.efternavn,
                rolle: user.rolle
            },
            mustChangePassword: user.must_change_password || false
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: "Serverfejl. Prøv igen." });
    }
});

// Logout
router.post("/logout", async (req, res) => {
    // Log logout aktivitet før session destroyes
    if (req.session?.user) {
        try {
            await pool.query(`
                INSERT INTO activity_log (user_id, user_name, action_type, resource_type, description)
                VALUES (?, ?, 'logout', 'session', 'Bruger loggede ud')
            `, [req.session.user.id, `${req.session.user.fornavn} ${req.session.user.efternavn || ''}`]);
        } catch (logErr) {
            console.error('Error logging logout activity:', logErr);
        }
    }

    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Kunne ikke logge ud" });
        }
        res.json({ success: true });
    });
});

// Get current user
router.get("/me", authMiddleware, (req, res) => {
    res.json({ user: req.session.user });
});

// Force change password (first login)
router.post("/api/force-change-password", async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session?.user) {
            return res.status(401).json({ error: "Ikke autoriseret" });
        }

        // Only allow if user must change password
        if (!req.session.user.mustChangePassword) {
            return res.status(403).json({ error: "Du har allerede ændret din adgangskode" });
        }

        const { newPassword, confirmPassword } = req.body;

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ error: "Alle felter er påkrævet" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: "Adgangskoderne matcher ikke" });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: "Adgangskode skal være mindst 8 tegn" });
        }

        // Update password and clear must_change_password flag
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await pool.query(
            'UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?',
            [newPasswordHash, req.session.user.id]
        );

        // Update session
        req.session.user.mustChangePassword = false;

        // Log activity
        try {
            await pool.query(`
                INSERT INTO activity_log (user_id, user_name, action_type, resource_type, description)
                VALUES (?, ?, 'update', 'user', 'Bruger ændrede adgangskode (første login)')
            `, [req.session.user.id, `${req.session.user.fornavn} ${req.session.user.efternavn || ''}`]);
        } catch (logErr) {
            console.error('Error logging password change:', logErr);
        }

        res.json({ success: true, message: "Adgangskode ændret" });
    } catch (error) {
        console.error('Force change password error:', error);
        res.status(500).json({ error: "Serverfejl. Prøv igen." });
    }
});

// Request password reset
router.post("/api/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email er påkrævet" });
        }

        const [users] = await pool.query(
            'SELECT id, fornavn, email FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );

        if (users.length === 0) {
            return res.json({
                success: true,
                message: 'Hvis emailen findes i systemet, vil du modtage en nulstillingsmail.'
            });
        }

        const user = users[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await pool.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);
        await pool.query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [user.id, tokenHash, expiresAt]
        );

        await sendPasswordResetEmail(user.email, user.fornavn, resetToken);

        res.json({
            success: true,
            message: 'Hvis emailen findes i systemet, vil du modtage en nulstillingsmail.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Der opstod en fejl. Prøv igen senere.' });
    }
});

// Verify reset token
router.get("/api/verify-reset-token", async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: "Token er påkrævet", valid: false });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const [tokens] = await pool.query(
            `SELECT prt.*, u.fornavn, u.email
             FROM password_reset_tokens prt
             JOIN users u ON prt.user_id = u.id
             WHERE prt.token_hash = ? AND prt.expires_at > NOW() AND prt.used = FALSE`,
            [tokenHash]
        );

        if (tokens.length === 0) {
            return res.json({
                valid: false,
                error: 'Ugyldigt eller udløbet link. Anmod om et nyt nulstillingslink.'
            });
        }

        res.json({ valid: true, fornavn: tokens[0].fornavn });
    } catch (error) {
        console.error('Verify reset token error:', error);
        res.status(500).json({ valid: false, error: 'Der opstod en fejl. Prøv igen senere.' });
    }
});

// Reset password
router.post("/api/reset-password", async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: "Token og ny adgangskode er påkrævet" });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Adgangskode skal være mindst 8 tegn' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const [tokens] = await pool.query(
            `SELECT prt.*, u.id as user_id
             FROM password_reset_tokens prt
             JOIN users u ON prt.user_id = u.id
             WHERE prt.token_hash = ? AND prt.expires_at > NOW() AND prt.used = FALSE`,
            [tokenHash]
        );

        if (tokens.length === 0) {
            return res.status(400).json({
                error: 'Ugyldigt eller udløbet link. Anmod om et nyt nulstillingslink.'
            });
        }

        const tokenData = tokens[0];
        const password_hash = await bcrypt.hash(password, 10);

        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, tokenData.user_id]);
        await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = ?', [tokenData.id]);

        res.json({
            success: true,
            message: 'Din adgangskode er blevet nulstillet. Du kan nu logge ind.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Der opstod en fejl. Prøv igen senere.' });
    }
});

export default router;
