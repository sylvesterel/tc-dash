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

        req.session.user = {
            id: user.id,
            brugernavn: user.brugernavn,
            fornavn: user.fornavn,
            efternavn: user.efternavn,
            email: user.email,
            rolle: user.rolle,
            title: user.title
        };

        res.json({
            success: true,
            user: {
                fornavn: user.fornavn,
                efternavn: user.efternavn,
                rolle: user.rolle
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: "Serverfejl. Prøv igen." });
    }
});

// Logout
router.post("/logout", (req, res) => {
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
