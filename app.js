import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import { Seam } from "seam";
import nodemailer from "nodemailer";
import crypto from "crypto";

dotenv.config();

// SEAM Configuration
const seam = new Seam({ apiKey: process.env.SEAM_API });
const acsSystemId = process.env.SEAM_ACS_SYSTEM_ID;
const accessGroupId = process.env.SEAM_ACCESS_GROUP;

// Database Configuration - Main Dashboard
const sylleDatabaseConfig = {
    host: process.env.SYL_DB_HOST,
    user: process.env.SYL_DB_USER,
    password: process.env.SYL_DB_PASSWORD,
    database: process.env.SYL_DB_NAME,
};

const pool = mysql.createPool(sylleDatabaseConfig);

// Database Configuration - Sluse (Old TourCare System)
const sluseDatabaseConfig = {
    host: process.env.SLUSE_DB_HOST,
    user: process.env.SLUSE_DB_USER,
    password: process.env.SLUSE_DB_PASSWORD,
    database: process.env.SLUSE_DB_NAME,
};

const slusePool = mysql.createPool(sluseDatabaseConfig);

// Database Configuration - CRM Integration (HubSpot/Rentman)
const crmDatabaseConfig = {
    host: process.env.SYL_DB_HOST,
    user: process.env.SYL_DB_USER,
    password: process.env.SYL_DB_PASSWORD,
    database: process.env.CRM_DB_NAME,
};

const crmPool = mysql.createPool(crmDatabaseConfig);

// Rentman Integration Server URL
const RENTMAN_INTEGRATION_URL = process.env.RENTMAN_INTEGRATION_URL || 'http://localhost:8081';

// Email Configuration (Gmail)
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // Use App Password for Gmail
    }
});

// Dashboard URL for links in emails
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:8080';

// Seam Webhook Secret for verification
const SEAM_WEBHOOK_SECRET = process.env.SEAM_WEBHOOK_SECRET;

// SSE clients for real-time access events
const accessEventClients = new Set();

// Initialize Seam database tables
async function initSeamTables() {
    try {
        // Table for storing seam users with their acs_user_id
        await pool.query(`
            CREATE TABLE IF NOT EXISTS seam_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                acs_user_id VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_acs_user_id (acs_user_id)
            )
        `);

        // Table for storing access events from webhooks
        await pool.query(`
            CREATE TABLE IF NOT EXISTS seam_access_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_type VARCHAR(100) NOT NULL,
                acs_user_id VARCHAR(255),
                user_name VARCHAR(255),
                device_name VARCHAR(255),
                occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                raw_payload JSON,
                INDEX idx_occurred_at (occurred_at),
                INDEX idx_acs_user_id (acs_user_id)
            )
        `);

        console.log('Seam database tables initialized');
    } catch (error) {
        console.error('Error initializing seam tables:', error);
    }
}

// Call on startup
initSeamTables();

// ============================================
// Scheduled Task: Sync Seam Users every 5 minutes
// ============================================

async function syncSeamUsers() {
    try {
        console.log('[Seam Sync] Henter brugere fra Seam...');

        const users = await seam.acs.users.list({ acs_system_id: acsSystemId });

        if (!users || users.length === 0) {
            console.log('[Seam Sync] Ingen brugere fundet i Seam');
            return;
        }

        let syncedCount = 0;
        for (const user of users) {
            const acsUserId = user.acs_user_id;
            const name = user.full_name || 'Ukendt';

            if (acsUserId) {
                await pool.query(
                    `INSERT INTO seam_users (acs_user_id, name) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                    [acsUserId, name]
                );
                syncedCount++;
            }
        }

        console.log(`[Seam Sync] Synkroniseret ${syncedCount} brugere fra Seam`);
    } catch (error) {
        console.error('[Seam Sync] Fejl ved synkronisering af Seam brugere:', error.message);
    }
}

// Run sync immediately on startup, then every 5 minutes
syncSeamUsers();
setInterval(syncSeamUsers, 5 * 60 * 1000);

// Email helper function - Welcome email
async function sendWelcomeEmail(userEmail, fornavn, brugernavn, password) {
    const mailOptions = {
        from: `"TourCare Dashboard" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'Velkommen til TourCare Dashboard - Din konto er oprettet',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 0;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">TourCare Dashboard</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Din konto er klar!</p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hej ${fornavn}!</h2>
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                Velkommen til TourCare Dashboard! Din konto er nu oprettet og klar til brug.
                            </p>

                            <!-- Credentials Box -->
                            <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 25px;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Dine login-oplysninger:</h3>
                                        <table role="presentation" style="width: 100%;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #666; font-size: 14px; width: 120px;">Brugernavn:</td>
                                                <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600;">${brugernavn}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #666; font-size: 14px;">Adgangskode:</td>
                                                <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600;">${password}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin-bottom: 25px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${DASHBOARD_URL}/login.html" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 6px; font-size: 16px; font-weight: 600;">Log ind på Dashboard</a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Password Change Info -->
                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                                <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Skift din adgangskode</h4>
                                <p style="color: #856404; margin: 0; font-size: 13px; line-height: 1.5;">
                                    Ved første login skal du skifte din adgangskode.
                                    Gå til <strong>Profil</strong> i menuen og klik på <strong>Skift adgangskode</strong>.
                                </p>
                            </div>

                            <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0;">
                                Hvis du har spørgsmål eller brug for hjælp, er du velkommen til at kontakte os.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #eee;">
                            <p style="color: #888; font-size: 12px; margin: 0;">
                                TourCare Dashboard &copy; ${new Date().getFullYear()}<br>
                                Denne email blev sendt automatisk - svar venligst ikke på denne email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return false;
    }
}

// Email helper function - Password reset email
async function sendPasswordResetEmail(userEmail, fornavn, resetToken) {
    const resetLink = `${DASHBOARD_URL}/reset-password.html?token=${resetToken}`;

    const mailOptions = {
        from: `"TourCare Dashboard" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'Nulstil din adgangskode - TourCare Dashboard',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 0;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">TourCare Dashboard</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Nulstil adgangskode</p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Hej ${fornavn}!</h2>
                            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                Du har anmodet om at nulstille din adgangskode.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin-bottom: 25px;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 6px; font-size: 16px; font-weight: 600;">Nulstil adgangskode</a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Warning Box -->
                            <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px 20px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                                <h4 style="color: #721c24; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Vigtigt</h4>
                                <p style="color: #721c24; margin: 0; font-size: 13px; line-height: 1.5;">
                                    Dette link udløber om <strong>1 time</strong>. Hvis du ikke har anmodet om at nulstille din adgangskode, kan du ignorere denne email.
                                </p>
                            </div>

                            <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0 0 15px 0;">
                                Hvis knappen ikke virker, kan du kopiere og indsætte dette link i din browser:
                            </p>
                            <p style="color: #667eea; font-size: 12px; word-break: break-all; margin: 0; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
                                ${resetLink}
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #eee;">
                            <p style="color: #888; font-size: 12px; margin: 0;">
                                TourCare Dashboard &copy; ${new Date().getFullYear()}<br>
                                Denne email blev sendt automatisk - svar venligst ikke på denne email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `
    };

    try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${userEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
    }
}

// Sluse colors (fixed from old system)
const SLUSE_COLORS = {
    'Sluse1': '#703817', // Brown
    'Sluse2': '#FF0000', // Red
    'Sluse3': '#FFA500', // Orange
    'Sluse4': '#FFFF00', // Yellow
    'Sluse5': '#008000', // Green
    'Sluse6': '#0000FF', // Blue
    'Sluse7': '#EE82EE', // Violet
    'Reol1': '#808080',  // Grey (#8)
    'Reol2': '#000000',  // Black (#9)
};

const app = express();
const port = 8080;

// Middleware
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(express.static(path.join(process.cwd(), "public")));

// ============================================
// Authentication Middleware
// ============================================
const authMiddleware = (req, res, next) => {
    if (req.session.user) return next();
    return res.redirect("/login.html");
};

const adminMiddleware = (req, res, next) => {
    if (req.session.user && req.session.user.rolle === 'admin') return next();
    return res.status(403).json({ error: "Kun administratorer har adgang" });
};

// ============================================
// Authentication Endpoints
// ============================================

// Login
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Udfyld alle felter" });
        }

        // Get user from database
        const [users] = await pool.query(
            'SELECT * FROM users WHERE brugernavn = ? AND is_active = TRUE',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: "Ugyldigt brugernavn eller adgangskode" });
        }

        const user = users[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ error: "Ugyldigt brugernavn eller adgangskode" });
        }

        // Update last login
        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        // Set session
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
app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Kunne ikke logge ud" });
        }
        res.json({ success: true });
    });
});

// Get current user
app.get("/me", authMiddleware, (req, res) => {
    res.json({ user: req.session.user });
});

// ============================================
// Password Reset Endpoints (No auth required)
// ============================================

// POST /api/forgot-password - Request password reset
app.post("/api/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email er påkrævet" });
        }

        // Find user by email
        const [users] = await pool.query(
            'SELECT id, fornavn, email FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );

        // Always return success to prevent email enumeration
        if (users.length === 0) {
            return res.json({
                success: true,
                message: 'Hvis emailen findes i systemet, vil du modtage en nulstillingsmail.'
            });
        }

        const user = users[0];

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Delete any existing reset tokens for this user
        await pool.query(
            'DELETE FROM password_reset_tokens WHERE user_id = ?',
            [user.id]
        );

        // Store reset token
        await pool.query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [user.id, tokenHash, expiresAt]
        );

        // Send reset email
        await sendPasswordResetEmail(user.email, user.fornavn, resetToken);

        res.json({
            success: true,
            message: 'Hvis emailen findes i systemet, vil du modtage en nulstillingsmail.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            error: 'Der opstod en fejl. Prøv igen senere.'
        });
    }
});

// GET /api/verify-reset-token - Verify if reset token is valid
app.get("/api/verify-reset-token", async (req, res) => {
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

        res.json({
            valid: true,
            fornavn: tokens[0].fornavn
        });
    } catch (error) {
        console.error('Verify reset token error:', error);
        res.status(500).json({
            valid: false,
            error: 'Der opstod en fejl. Prøv igen senere.'
        });
    }
});

// POST /api/reset-password - Reset password with token
app.post("/api/reset-password", async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: "Token og ny adgangskode er påkrævet" });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Adgangskode skal være mindst 8 tegn'
            });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find valid token
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

        // Hash new password
        const password_hash = await bcrypt.hash(password, 10);

        // Update user password
        await pool.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [password_hash, tokenData.user_id]
        );

        // Mark token as used
        await pool.query(
            'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?',
            [tokenData.id]
        );

        res.json({
            success: true,
            message: 'Din adgangskode er blevet nulstillet. Du kan nu logge ind.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            error: 'Der opstod en fejl. Prøv igen senere.'
        });
    }
});

// ============================================
// User Management Endpoints
// ============================================

// GET /api/users - Get all users
app.get("/api/users", authMiddleware, async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT 
                u.id,
                u.fornavn,
                u.efternavn,
                u.brugernavn,
                u.email,
                u.telefon,
                u.title,
                u.rolle,
                u.is_active,
                u.last_login,
                u.created_at,
                creator.fornavn AS created_by_fornavn,
                creator.efternavn AS created_by_efternavn
            FROM users u
            LEFT JOIN users creator ON u.created_by = creator.id
            WHERE u.is_active = TRUE
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            users: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            error: 'Kunne ikke hente brugere',
            message: error.message
        });
    }
});

// GET /api/users/:id - Get single user
app.get("/api/users/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await pool.query(`
            SELECT 
                u.id,
                u.fornavn,
                u.efternavn,
                u.brugernavn,
                u.email,
                u.telefon,
                u.title,
                u.rolle,
                u.is_active,
                u.last_login,
                u.created_at,
                creator.fornavn AS created_by_fornavn,
                creator.efternavn AS created_by_efternavn
            FROM users u
            LEFT JOIN users creator ON u.created_by = creator.id
            WHERE u.id = ? AND u.is_active = TRUE
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'Bruger ikke fundet' });
        }

        res.json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            error: 'Kunne ikke hente bruger',
            message: error.message
        });
    }
});

// POST /api/users - Create new user (Admin only)
app.post("/api/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const {
            fornavn,
            efternavn,
            brugernavn,
            email,
            telefon,
            password,
            title,
            rolle,
            sendEmail: shouldSendEmail
        } = req.body;

        // Validate required fields
        if (!fornavn || !efternavn || !brugernavn || !email || !password) {
            return res.status(400).json({
                error: 'Fornavn, efternavn, brugernavn, email og adgangskode er påkrævet'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Ugyldig email-adresse' });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Adgangskode skal være mindst 8 tegn'
            });
        }

        // Check if username already exists
        const [existingUsername] = await pool.query(
            'SELECT id FROM users WHERE brugernavn = ?',
            [brugernavn]
        );

        if (existingUsername.length > 0) {
            return res.status(400).json({ error: 'Brugernavn er allerede i brug' });
        }

        // Check if email already exists
        const [existingEmail] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingEmail.length > 0) {
            return res.status(400).json({ error: 'Email er allerede i brug' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert user
        const [result] = await pool.query(`
            INSERT INTO users (
                fornavn,
                efternavn,
                brugernavn,
                email,
                telefon,
                password_hash,
                title,
                rolle,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            fornavn,
            efternavn,
            brugernavn,
            email,
            telefon || null,
            password_hash,
            title || null,
            rolle || 'standard',
            req.session.user.id
        ]);

        const [newUser] = await pool.query(
            'SELECT id, fornavn, efternavn, brugernavn, email, telefon, title, rolle FROM users WHERE id = ?',
            [result.insertId]
        );

        // Send welcome email if requested
        let emailSent = false;
        if (shouldSendEmail) {
            emailSent = await sendWelcomeEmail(email, fornavn, brugernavn, password);
        }

        res.status(201).json({
            success: true,
            message: emailSent ? 'Bruger oprettet og velkomst-email sendt' : 'Bruger oprettet',
            user: newUser[0],
            emailSent
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            error: 'Kunne ikke oprette bruger',
            message: error.message
        });
    }
});

// PUT /api/users/:id - Update user
app.put("/api/users/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            fornavn,
            efternavn,
            email,
            telefon,
            title,
            password,
            rolle
        } = req.body;

        // Check if user exists
        const [existingUser] = await pool.query(
            'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
            [id]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({ error: 'Bruger ikke fundet' });
        }

        // Only admin can update other users or change roles
        if (req.session.user.id !== parseInt(id) && req.session.user.rolle !== 'admin') {
            return res.status(403).json({ error: 'Du har ikke tilladelse til at redigere denne bruger' });
        }

        // Only admin can change roles
        if (rolle && req.session.user.rolle !== 'admin') {
            return res.status(403).json({ error: 'Kun administratorer kan ændre brugerroller' });
        }

        // Validate email if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Ugyldig email-adresse' });
            }

            // Check if email is taken by another user
            const [emailCheck] = await pool.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, id]
            );

            if (emailCheck.length > 0) {
                return res.status(400).json({ error: 'Email er allerede i brug' });
            }
        }

        // Build update query
        let updateFields = [];
        let updateValues = [];

        if (fornavn) {
            updateFields.push('fornavn = ?');
            updateValues.push(fornavn);
        }
        if (efternavn) {
            updateFields.push('efternavn = ?');
            updateValues.push(efternavn);
        }
        if (email) {
            updateFields.push('email = ?');
            updateValues.push(email);
        }
        if (telefon !== undefined) {
            updateFields.push('telefon = ?');
            updateValues.push(telefon || null);
        }
        if (title !== undefined) {
            updateFields.push('title = ?');
            updateValues.push(title || null);
        }
        if (rolle && req.session.user.rolle === 'admin') {
            updateFields.push('rolle = ?');
            updateValues.push(rolle);
        }

        // Handle password update
        if (password) {
            if (password.length < 8) {
                return res.status(400).json({
                    error: 'Adgangskode skal være mindst 8 tegn'
                });
            }
            const password_hash = await bcrypt.hash(password, 10);
            updateFields.push('password_hash = ?');
            updateValues.push(password_hash);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Ingen felter at opdatere' });
        }

        updateValues.push(id);

        await pool.query(`
            UPDATE users 
            SET ${updateFields.join(', ')}
            WHERE id = ?
        `, updateValues);

        const [updatedUser] = await pool.query(`
            SELECT id, fornavn, efternavn, brugernavn, email, telefon, title, rolle 
            FROM users WHERE id = ?
        `, [id]);

        // Update session if user updated themselves
        if (req.session.user.id === parseInt(id)) {
            req.session.user = {
                ...req.session.user,
                ...updatedUser[0]
            };
        }

        res.json({
            success: true,
            message: 'Bruger opdateret',
            user: updatedUser[0]
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            error: 'Kunne ikke opdatere bruger',
            message: error.message
        });
    }
});

// DELETE /api/users/:id - Soft delete user (Admin only)
app.delete("/api/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const [existingUser] = await pool.query(
            'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
            [id]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({ error: 'Bruger ikke fundet' });
        }

        // Prevent deleting yourself
        if (req.session.user.id === parseInt(id)) {
            return res.status(400).json({ error: 'Du kan ikke slette din egen bruger' });
        }

        // Soft delete
        await pool.query(
            'UPDATE users SET is_active = FALSE WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Bruger slettet'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            error: 'Kunne ikke slette bruger',
            message: error.message
        });
    }
});

// GET /api/user-statistics - Get user statistics
app.get("/api/user-statistics", authMiddleware, async (req, res) => {
    try {
        const [stats] = await pool.query('CALL get_user_statistics()');
        res.json({
            success: true,
            statistics: stats[0][0]
        });
    } catch (error) {
        console.error('Error fetching user statistics:', error);
        res.status(500).json({
            error: 'Kunne ikke hente statistikker',
            message: error.message
        });
    }
});

// ============================================
// SEAM API Endpoints - Brugeroprettelse
// ============================================

// POST /api/seam/create-user - Opret bruger i Seam med streaming status
app.post("/api/seam/create-user", authMiddleware, async (req, res) => {
    try {
        const { artist_name, start_date, end_date } = req.body;

        if (!artist_name || !end_date) {
            return res.status(400).json({ error: "Artist navn og slut dato er påkrævet" });
        }

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Transfer-Encoding", "chunked");
        const writeStatus = msg => res.write(msg + "\n");

        const userName = req.session.user.fornavn || req.session.user.brugernavn;
        writeStatus(`STATUS:${userName} opretter bruger ${artist_name}`);

        const today = new Date();
        const endDate = new Date(end_date);

        // Format name with date prefix
        const month = String(endDate.getMonth() + 1).padStart(2, '0');
        const day = String(endDate.getDate()).padStart(2, '0');
        const fullName = `${month}/${day} - ${artist_name}`;

        writeStatus(`STATUS:Opretter bruger i Seam...`);

        const acsUser = await seam.acs.users.create({
            full_name: fullName,
            acs_system_id: acsSystemId,
            access_schedule: { starts_at: today, ends_at: endDate },
        });
        writeStatus(`STATUS:Bruger oprettet med ID ${acsUser.acs_user_id}`);

        writeStatus(`STATUS:Tilføjer til adgangsgruppe...`);
        await seam.acs.users.addToAccessGroup({
            acs_user_id: acsUser.acs_user_id,
            acs_access_group_id: accessGroupId,
        });
        writeStatus(`STATUS:Tilføjet til adgangsgruppe`);

        writeStatus(`STATUS:Opretter credential...`);
        const credential = await seam.acs.credentials.create({
            acs_user_id: acsUser.acs_user_id,
            access_method: "code",
        });
        writeStatus(`STATUS:Credential oprettet. Venter på pinkode...`);
        const sync = await seam.connectedAccounts.sync({
            connected_account_id: "d59e3cbd-b6fd-4b3f-b10d-e047c81e8db4"
        })

        // Gem bruger i database for webhook opslag
        try {
            await pool.query(
                `INSERT INTO seam_users (acs_user_id, name) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                [acsUser.acs_user_id, fullName]
            );
            writeStatus(`STATUS:Bruger gemt i database`);
        } catch (dbErr) {
            console.error('Error saving seam user to database:', dbErr);
        }

        writeStatus(`CREDENTIAL_ID:${credential.acs_credential_id}`);
        writeStatus(`USER_ID:${acsUser.acs_user_id}`);

        res.end();

    } catch (err) {
        console.error('Seam create user error:', err);
        res.write("ERROR:Seam API fejlede: " + err.message);
        res.end();
    }
});

// GET /api/seam/check-pin - Poll for pinkode
app.get("/api/seam/check-pin", authMiddleware, async (req, res) => {
    try {
        const { credential_id } = req.query;
        if (!credential_id) {
            return res.status(400).json({ error: "Ingen credential_id" });
        }

        const userCred = await seam.acs.credentials.get({ acs_credential_id: credential_id });
        if (userCred.code !== null) {
            res.json({ pin: userCred.code });
        } else {
            res.json({ pin: null });
        }

    } catch (err) {
        console.error('Check pin error:', err);
        res.status(500).json({ error: "Fejl ved hentning af pinkode" });
    }
});

// GET /api/seam/users - Hent alle Seam brugere
app.get("/api/seam/users", authMiddleware, async (req, res) => {
    try {
        const users = await seam.acs.users.list({ acs_system_id: acsSystemId });
        res.json({ success: true, users });
    } catch (err) {
        console.error('Error fetching seam users:', err);
        res.status(500).json({ error: "Kunne ikke hente brugere fra Seam" });
    }
});

// POST /api/seam/users/:id/suspend - Suspender en Seam bruger
app.post("/api/seam/users/:id/suspend", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await seam.acs.users.suspend({ acs_user_id: id });

        res.json({ success: true, message: "Bruger suspenderet" });
    } catch (err) {
        console.error('Error suspending seam user:', err);
        res.status(500).json({ error: "Kunne ikke suspendere bruger: " + err.message });
    }
});

// POST /api/seam/users/:id/unsuspend - Genaktiver en Seam bruger
app.post("/api/seam/users/:id/unsuspend", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await seam.acs.users.unsuspend({ acs_user_id: id });

        res.json({ success: true, message: "Bruger genaktiveret" });
    } catch (err) {
        console.error('Error unsuspending seam user:', err);
        res.status(500).json({ error: "Kunne ikke genaktivere bruger: " + err.message });
    }
});

// DELETE /api/seam/users/:id - Slet en Seam bruger
app.delete("/api/seam/users/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await seam.acs.users.delete({ acs_user_id: id });

        res.json({ success: true, message: "Bruger slettet" });
    } catch (err) {
        console.error('Error deleting seam user:', err);
        res.status(500).json({ error: "Kunne ikke slette bruger: " + err.message });
    }
});

// GET /api/seam/access-events/stream - SSE endpoint for real-time access events
app.get("/api/seam/access-events/stream", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send initial connection message
    res.write('data: {"type":"connected"}\n\n');

    // Add client to set
    accessEventClients.add(res);
    console.log(`[SSE] Client connected. Total clients: ${accessEventClients.size}`);

    // Keep-alive ping every 30 seconds to prevent connection timeout
    const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
    }, 30000);

    // Remove client on disconnect
    req.on('close', () => {
        clearInterval(keepAlive);
        accessEventClients.delete(res);
        console.log(`[SSE] Client disconnected. Total clients: ${accessEventClients.size}`);
    });
});

// Broadcast access event to all connected SSE clients
function broadcastAccessEvent(eventData) {
    const message = `data: ${JSON.stringify(eventData)}\n\n`;
    console.log(`[SSE] Broadcasting to ${accessEventClients.size} clients:`, eventData.event_type, eventData.user_name, eventData.device_name);
    accessEventClients.forEach(client => {
        try {
            client.write(message);
        } catch (e) {
            console.error('[SSE] Error writing to client:', e);
        }
    });
}

// POST /api/seam/webhook - Modtag webhooks fra Seam (adgangs-events)
app.post("/api/seam/webhook", async (req, res) => {
    try {
        const event = req.body;

        console.log('Seam webhook received:', event.event_type, JSON.stringify(event, null, 2));

        // Handle access events (lock events and acs events)
        const accessEventTypes = [
            'acs_user.entered',
            'acs_user.exited',
            'acs_credential.used',
            'lock.unlocked',
            'lock.locked'
        ];

        if (accessEventTypes.includes(event.event_type) || event.event_type?.startsWith('acs_')) {
            // Seam sends data at root level, not in event.payload
            // For lock.unlocked: device_id, method, occurred_at are at root
            // For acs events: acs_user_id may be in data or at root

            let userName = null;
            let deviceName = 'Ukendt enhed';

            // Get device_id from root level (Seam's new format)
            const deviceId = event.device_id;

            // Get acs_user_id - check multiple possible locations
            const acsUserId = event.acs_user_id ||
                             event.data?.acs_user_id ||
                             event.acs_user?.acs_user_id ||
                             event.data?.acs_user?.acs_user_id;

            // Try to find user name from our database if we have acs_user_id
            if (acsUserId) {
                try {
                    const [rows] = await pool.query(
                        'SELECT name FROM seam_users WHERE acs_user_id = ?',
                        [acsUserId]
                    );
                    if (rows.length > 0) {
                        userName = rows[0].name;
                    }
                } catch (e) {
                    console.error('Error looking up user:', e);
                }
            }

            // Look up device name from Seam API if we have device_id
            if (deviceId) {
                try {
                    const device = await seam.devices.get({ device_id: deviceId });
                    deviceName = device.properties?.name || device.display_name || 'Lås';
                    console.log('Device lookup result:', device.properties?.name, device.display_name);
                } catch (e) {
                    console.error('Error looking up device from Seam:', e);
                    deviceName = 'Lås';
                }
            }

            // Save event to database
            const [result] = await pool.query(
                `INSERT INTO seam_access_events (event_type, acs_user_id, user_name, device_name, occurred_at, raw_payload)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    event.event_type,
                    acsUserId || null,
                    userName,
                    deviceName,
                    event.occurred_at ? new Date(event.occurred_at) : new Date(),
                    JSON.stringify(event)
                ]
            );

            // Broadcast to SSE clients instantly
            broadcastAccessEvent({
                type: 'access_event',
                id: result.insertId,
                event_type: event.event_type,
                acs_user_id: acsUserId,
                user_name: userName,
                device_name: deviceName,
                occurred_at: event.occurred_at || new Date().toISOString()
            });

            console.log(`Access event saved and broadcast: ${event.event_type} - ${userName || 'Unknown'} - ${deviceName}`);
        }

        // Always respond with 200 to acknowledge receipt
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error processing seam webhook:', error);
        // Still return 200 to avoid Seam retrying
        res.status(200).json({ success: true, error: error.message });
    }
});

// POST /api/seam/test-access - Test endpoint til at simulere dør-adgang (kun til udvikling)
app.post("/api/seam/test-access", async (req, res) => {
    try {
        const { user_name, device_name, event_type } = req.body;

        const eventTypes = ['acs_user.entered', 'lock.unlocked', 'acs_user.exited', 'lock.locked'];
        const selectedEventType = event_type || eventTypes[Math.floor(Math.random() * 2)]; // Default til enter/unlock
        const testUserName = user_name || 'Test Bruger';
        const testDeviceName = device_name || 'Hoveddør';

        const [result] = await pool.query(
            `INSERT INTO seam_access_events (event_type, acs_user_id, user_name, device_name, occurred_at, raw_payload)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                selectedEventType,
                'test-' + Date.now(),
                testUserName,
                testDeviceName,
                new Date(),
                JSON.stringify({ test: true })
            ]
        );

        // Broadcast to SSE clients instantly
        broadcastAccessEvent({
            type: 'access_event',
            id: result.insertId,
            event_type: selectedEventType,
            acs_user_id: null,
            user_name: testUserName,
            device_name: testDeviceName,
            occurred_at: new Date().toISOString()
        });

        res.json({ success: true, message: 'Test adgangs-event oprettet og broadcast' });
    } catch (error) {
        console.error('Error creating test access event:', error);
        res.status(500).json({ error: 'Kunne ikke oprette test event' });
    }
});

// GET /api/seam/access-events - Hent seneste adgangs-events
app.get("/api/seam/access-events", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;

        const [events] = await pool.query(
            `SELECT * FROM seam_access_events
             ORDER BY occurred_at DESC
             LIMIT ?`,
            [limit]
        );

        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching access events:', error);
        res.status(500).json({ error: 'Kunne ikke hente adgangs-events' });
    }
});

// ============================================
// API Endpoints - Sluse (Old TourCare System)
// ============================================

// GET /api/sluse/public - Public endpoint for display screen (no auth required)
app.get("/api/sluse/public", async (req, res) => {
    try {
        const [rows] = await slusePool.query('SELECT * FROM infoskaerm ORDER BY id');

        const sluseData = rows.map(row => ({
            slusenavn: row.slusenavn,
            Kunde: row.Kunde,
            Detaljer: row.Detaljer,
            Dato: row.Dato,
            color: SLUSE_COLORS[row.slusenavn] || '#808080'
        }));

        res.json({ success: true, data: sluseData });
    } catch (err) {
        console.error('Error fetching public sluse data:', err);
        res.status(500).json({ error: "Kunne ikke hente data" });
    }
});

// GET /api/office-dashboard - Public endpoint for office display screen
app.get("/api/office-dashboard", async (req, res) => {
    try {
        const result = {
            success: true,
            timestamp: new Date().toISOString()
        };

        const now = new Date();
        const weekNumber = getWeekNumber(now);
        const year = now.getFullYear();
        const todayName = getDayName(now.getDay());
        const dayOrder = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
        const todayIndex = dayOrder.indexOf(todayName);

        // 1. Get menu - today or next available day
        try {
            // First try today's menu
            const [menuRows] = await pool.query(`
                SELECT * FROM weekly_menu
                WHERE week_number = ? AND year = ? AND day_of_week = ?
                AND main_dish IS NOT NULL AND main_dish != ''
            `, [weekNumber, year, todayName]);

            if (menuRows.length > 0 && menuRows[0].main_dish) {
                const menu = menuRows[0];
                let toppings = menu.toppings || [];
                let salads = menu.salads || [];

                if (typeof toppings === 'string') {
                    try { toppings = JSON.parse(toppings); } catch (e) { toppings = []; }
                }
                if (typeof salads === 'string') {
                    try { salads = JSON.parse(salads); } catch (e) { salads = []; }
                }

                result.todaysMenu = {
                    day: todayName,
                    isToday: true,
                    main_dish: menu.main_dish,
                    main_dish_description: menu.main_dish_description,
                    toppings,
                    salads
                };
            } else {
                // Find next day with menu this week
                const [allMenus] = await pool.query(`
                    SELECT * FROM weekly_menu
                    WHERE week_number = ? AND year = ?
                    AND main_dish IS NOT NULL AND main_dish != ''
                    ORDER BY FIELD(day_of_week, 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag')
                `, [weekNumber, year]);

                // Find next day after today
                let nextMenu = null;
                for (const menu of allMenus) {
                    const menuDayIndex = dayOrder.indexOf(menu.day_of_week);
                    if (menuDayIndex > todayIndex && menu.main_dish) {
                        nextMenu = menu;
                        break;
                    }
                }

                if (nextMenu) {
                    let toppings = nextMenu.toppings || [];
                    let salads = nextMenu.salads || [];

                    if (typeof toppings === 'string') {
                        try { toppings = JSON.parse(toppings); } catch (e) { toppings = []; }
                    }
                    if (typeof salads === 'string') {
                        try { salads = JSON.parse(salads); } catch (e) { salads = []; }
                    }

                    result.todaysMenu = {
                        day: nextMenu.day_of_week,
                        isToday: false,
                        main_dish: nextMenu.main_dish,
                        main_dish_description: nextMenu.main_dish_description,
                        toppings,
                        salads
                    };
                } else {
                    result.todaysMenu = null;
                }
            }
        } catch (e) {
            console.error('Error fetching menu:', e);
            result.todaysMenu = null;
        }

        // 2. Get sluse data and count occupied
        try {
            const [sluseRows] = await slusePool.query('SELECT * FROM infoskaerm ORDER BY id');
            const occupiedSluser = sluseRows.filter(row => row.Kunde && row.Kunde.trim()).length;
            const totalSluser = sluseRows.length;

            result.sluser = {
                occupied: occupiedSluser,
                total: totalSluser,
                data: sluseRows.map(row => ({
                    slusenavn: row.slusenavn,
                    Kunde: row.Kunde,
                    Detaljer: row.Detaljer,
                    Dato: row.Dato
                }))
            };
        } catch (e) {
            console.error('Error fetching sluse data:', e);
            result.sluser = { occupied: 0, total: 0, data: [] };
        }

        // 3. Get Seam users count (those starting with date format like "01/15" or "01/15 - ")
        try {
            const seamUsers = await seam.acs.users.list({ acs_system_id: acsSystemId });
            // Filter users whose name starts with date format (MM/DD) - dash is optional
            const datePatternUsers = seamUsers.filter(user => {
                const name = user.full_name || '';
                return /^\d{2}\/\d{2}/.test(name);
            });

            result.seamUsers = {
                withDatePrefix: datePatternUsers.length,
                total: seamUsers.length,
                users: datePatternUsers.map(u => ({
                    name: u.full_name,
                    id: u.acs_user_id,
                    is_suspended: u.is_suspended
                }))
            };
        } catch (e) {
            console.error('Error fetching seam users:', e);
            result.seamUsers = { withDatePrefix: 0, total: 0, users: [] };
        }

        // 4. Get weekly projects
        try {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay() + 1);
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const [projectRows] = await pool.query(`
                SELECT
                    project_id,
                    project_name,
                    MIN(sp_start_pp) as start_date,
                    MAX(sp_end_pp) as end_date
                FROM project_with_sp
                WHERE sp_start_pp <= ? AND sp_end_pp >= ?
                AND sp_status NOT IN (1, 2, 8)
                AND LOWER(project_name) NOT LIKE '%opbevaring%'
                AND LOWER(subproject_name) NOT LIKE '%opbevaring%'
                GROUP BY project_id, project_name
                ORDER BY start_date ASC
                LIMIT 20
            `, [weekEnd, weekStart]);

            result.weeklyProjects = {
                count: projectRows.length,
                projects: projectRows
            };
        } catch (e) {
            console.error('Error fetching weekly projects:', e);
            result.weeklyProjects = { count: 0, projects: [] };
        }

        // 5. Get integration errors and webhooks
        result.integration = {
            unresolvedErrors: 0,
            recentErrors: [],
            recentWebhooks: [],
            error: null
        };

        try {
            // Test connection first
            const connection = await crmPool.getConnection();
            connection.release();

            // Unresolved errors count
            const [[unresolvedCount]] = await crmPool.query(
                'SELECT COUNT(*) as count FROM integration_errors WHERE resolved = FALSE'
            );
            result.integration.unresolvedErrors = unresolvedCount.count;

            // Recent errors (last 10) - both resolved and unresolved for display
            const [recentErrors] = await crmPool.query(`
                SELECT *
                FROM integration_errors
                ORDER BY created_at DESC
                LIMIT 10
            `);
            result.integration.recentErrors = recentErrors;

            // Recent webhooks (last 15)
            const [recentWebhooks] = await crmPool.query(`
                SELECT id, source, event_type, status, created_at
                FROM webhook_events
                ORDER BY created_at DESC
                LIMIT 15
            `);
            result.integration.recentWebhooks = recentWebhooks;

        } catch (e) {
            console.error('Error fetching integration data:', e.message);
            result.integration.error = e.message;
        }

        // 6. Get recent access events from Seam webhooks
        try {
            const [accessEvents] = await pool.query(`
                SELECT id, event_type, acs_user_id, user_name, device_name, occurred_at
                FROM seam_access_events
                ORDER BY occurred_at DESC
                LIMIT 15
            `);
            result.accessEvents = accessEvents;
        } catch (e) {
            console.error('Error fetching access events:', e);
            result.accessEvents = [];
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching office dashboard data:', error);
        res.status(500).json({
            error: 'Kunne ikke hente kontor dashboard data',
            message: error.message
        });
    }
});

// GET /api/sluse - Hent alle sluse data
app.get("/api/sluse", authMiddleware, async (req, res) => {
    try {
        const [rows] = await slusePool.query('SELECT * FROM infoskaerm ORDER BY id');

        // Add colors to each sluse
        const sluseData = rows.map(row => ({
            ...row,
            color: SLUSE_COLORS[row.slusenavn] || '#808080',
            displayNumber: row.slusenavn.replace('Sluse', '').replace('Reol', '')
        }));

        res.json({ success: true, data: sluseData });
    } catch (err) {
        console.error('Error fetching sluse data:', err);
        res.status(500).json({ error: "Kunne ikke hente sluse data" });
    }
});

// PUT /api/sluse/:slusenavn - Opdater en specifik sluse
app.put("/api/sluse/:slusenavn", authMiddleware, async (req, res) => {
    try {
        const { slusenavn } = req.params;
        const { Kunde, Detaljer, Dato } = req.body;

        await slusePool.query(
            'UPDATE infoskaerm SET Kunde = ?, Detaljer = ?, Dato = ? WHERE slusenavn = ?',
            [Kunde || '', Detaljer || '', Dato || '', slusenavn]
        );

        res.json({ success: true, message: "Sluse opdateret" });
    } catch (err) {
        console.error('Error updating sluse:', err);
        res.status(500).json({ error: "Kunne ikke opdatere sluse" });
    }
});

// POST /api/sluse/save-all - Gem alle sluse data (bulk update)
app.post("/api/sluse/save-all", authMiddleware, async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ error: "Ugyldig data format" });
        }

        const connection = await slusePool.getConnection();
        try {
            await connection.beginTransaction();

            for (const item of data) {
                await connection.query(
                    'UPDATE infoskaerm SET Kunde = ?, Detaljer = ?, Dato = ? WHERE slusenavn = ?',
                    [item.Kunde || '', item.Detaljer || '', item.Dato || '', item.slusenavn]
                );
            }

            await connection.commit();
            res.json({ success: true, message: "Alle sluse data gemt!" });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error saving all sluse data:', err);
        res.status(500).json({ error: "Kunne ikke gemme sluse data" });
    }
});

// DELETE /api/sluse/:slusenavn/clear - Ryd en specifik sluse
app.delete("/api/sluse/:slusenavn/clear", authMiddleware, async (req, res) => {
    try {
        const { slusenavn } = req.params;

        await slusePool.query(
            'UPDATE infoskaerm SET Kunde = "", Detaljer = "", Dato = "" WHERE slusenavn = ?',
            [slusenavn]
        );

        res.json({ success: true, message: "Sluse ryddet" });
    } catch (err) {
        console.error('Error clearing sluse:', err);
        res.status(500).json({ error: "Kunne ikke rydde sluse" });
    }
});

// GET /api/rentman/projects - Hent Rentman projekter
app.get("/api/rentman/projects", authMiddleware, async (req, res) => {
    try {
        const apiKey = process.env.RENTMAN_API_KEY;

        if (!apiKey) {
            console.warn('RENTMAN_API_KEY is not configured');
            return res.json({ success: false, data: [], error: "Rentman API nøgle ikke konfigureret" });
        }

        const response = await fetch(
            `https://api.tourcare.dk/rentman/getdata.php?key=${apiKey}&format=json&target=sluse&stat=both`,
            { method: 'GET' }
        );

        // Check if response is OK
        if (!response.ok) {
            console.error('Rentman API returned status:', response.status);
            return res.json({ success: false, data: [], error: "Rentman API fejlede" });
        }

        // Get response as text first to safely check if it's valid JSON
        const responseText = await response.text();

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Rentman API returned invalid JSON:', responseText);
            return res.json({ success: false, data: [], error: "Ugyldigt svar fra Rentman API" });
        }

        if (data.responseKey === "i43dxDV2pzpUs2GsBNcs") {
            res.json({ success: true, data: data.data });
        } else {
            res.json({ success: false, data: [] });
        }
    } catch (err) {
        console.error('Error fetching Rentman data:', err);
        res.status(500).json({ error: "Kunne ikke hente Rentman data" });
    }
});

// ============================================
// API Endpoints - Stalls (Båse)
// ============================================

// GET /api/stalls - Get all stalls
app.get("/api/stalls", authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id,
                stall_number,
                name,
                quantity,
                start_date,
                end_date,
                color,
                status,
                notes,
                created_at,
                updated_at
            FROM stalls
            ORDER BY stall_number
        `);

        res.json({
            success: true,
            stalls: rows
        });
    } catch (error) {
        console.error('Error fetching stalls:', error);
        res.status(500).json({
            error: 'Kunne ikke hente båse',
            message: error.message
        });
    }
});

// POST /api/stalls - Create new stall
app.post("/api/stalls", authMiddleware, async (req, res) => {
    try {
        const {
            stall_number,
            name,
            quantity,
            start_date,
            end_date,
            color,
            status,
            notes
        } = req.body;

        if (!stall_number) {
            return res.status(400).json({ error: 'Bås nummer er påkrævet' });
        }

        if (stall_number < 1 || stall_number > 12) {
            return res.status(400).json({ error: 'Bås nummer skal være mellem 1 og 12' });
        }

        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return res.status(400).json({ error: 'Ugyldig farveformat. Brug #RRGGBB' });
        }

        if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Start dato skal være før slut dato' });
        }

        const [result] = await pool.query(`
            INSERT INTO stalls (
                stall_number, 
                name, 
                quantity, 
                start_date, 
                end_date, 
                color, 
                status,
                notes,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            stall_number,
            name || null,
            quantity || 0,
            start_date || null,
            end_date || null,
            color || '#9DABB9',
            status || 'available',
            notes || null,
            req.session.user.id
        ]);

        const [newStall] = await pool.query(
            'SELECT * FROM stalls WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: 'Bås oprettet',
            stall: newStall[0]
        });
    } catch (error) {
        console.error('Error creating stall:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Bås nummer eksisterer allerede' });
        }

        res.status(500).json({
            error: 'Kunne ikke oprette bås',
            message: error.message
        });
    }
});

// PUT /api/stalls/:id - Update stall
app.put("/api/stalls/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            quantity,
            start_date,
            end_date,
            color,
            status,
            notes
        } = req.body;

        const [existing] = await pool.query(
            'SELECT * FROM stalls WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Bås ikke fundet' });
        }

        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return res.status(400).json({ error: 'Ugyldig farveformat. Brug #RRGGBB' });
        }

        if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Start dato skal være før slut dato' });
        }

        await pool.query(`
            UPDATE stalls 
            SET 
                name = ?,
                quantity = ?,
                start_date = ?,
                end_date = ?,
                color = ?,
                status = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name || null,
            quantity || 0,
            start_date || null,
            end_date || null,
            color || '#9DABB9',
            status || 'available',
            notes || null,
            id
        ]);

        const [updatedStall] = await pool.query(
            'SELECT * FROM stalls WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Bås opdateret',
            stall: updatedStall[0]
        });
    } catch (error) {
        console.error('Error updating stall:', error);
        res.status(500).json({
            error: 'Kunne ikke opdatere bås',
            message: error.message
        });
    }
});

// DELETE /api/stalls/:id - Delete stall
app.delete("/api/stalls/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await pool.query(
            'SELECT * FROM stalls WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Bås ikke fundet' });
        }

        await pool.query('DELETE FROM stalls WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Bås slettet'
        });
    } catch (error) {
        console.error('Error deleting stall:', error);
        res.status(500).json({
            error: 'Kunne ikke slette bås',
            message: error.message
        });
    }
});

// ============================================
// API Endpoints - Access Codes (Adgangskoder)
// ============================================

// GET /api/access-codes - Get all access codes
app.get("/api/access-codes", authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id,
                artist_name,
                access_code,
                start_date,
                end_date,
                rentman_project,
                status,
                notes,
                usage_count,
                last_used,
                created_at,
                updated_at,
                revoked_at
            FROM access_codes
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            access_codes: rows
        });
    } catch (error) {
        console.error('Error fetching access codes:', error);
        res.status(500).json({
            error: 'Kunne ikke hente adgangskoder',
            message: error.message
        });
    }
});

// POST /api/access-codes - Create new access code
app.post("/api/access-codes", authMiddleware, async (req, res) => {
    try {
        const {
            artist_name,
            access_code,
            start_date,
            end_date,
            rentman_project,
            notes
        } = req.body;

        if (!artist_name || !access_code || !start_date || !end_date) {
            return res.status(400).json({
                error: 'Artist navn, adgangskode, start dato og slut dato er påkrævet'
            });
        }

        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Start dato skal være før slut dato' });
        }

        const [existing] = await pool.query(
            'SELECT id FROM access_codes WHERE access_code = ?',
            [access_code]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Adgangskode eksisterer allerede' });
        }

        const today = new Date();
        const start = new Date(start_date);
        const end = new Date(end_date);

        let status = 'active';
        if (end < today) {
            status = 'expired';
        } else if (start > today) {
            status = 'active';
        }

        const [result] = await pool.query(`
            INSERT INTO access_codes (
                artist_name, 
                access_code, 
                start_date, 
                end_date, 
                rentman_project,
                status,
                notes,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            artist_name,
            access_code,
            start_date,
            end_date,
            rentman_project || null,
            status,
            notes || null,
            req.session.user.id
        ]);

        const [newAccessCode] = await pool.query(
            'SELECT * FROM access_codes WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: 'Adgangskode oprettet',
            access_code: newAccessCode[0]
        });
    } catch (error) {
        console.error('Error creating access code:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Adgangskode eksisterer allerede' });
        }

        res.status(500).json({
            error: 'Kunne ikke oprette adgangskode',
            message: error.message
        });
    }
});

// PUT /api/access-codes/:id - Update access code
app.put("/api/access-codes/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            artist_name,
            start_date,
            end_date,
            rentman_project,
            status,
            notes
        } = req.body;

        const [existing] = await pool.query(
            'SELECT * FROM access_codes WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Adgangskode ikke fundet' });
        }

        if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Start dato skal være før slut dato' });
        }

        await pool.query(`
            UPDATE access_codes 
            SET 
                artist_name = COALESCE(?, artist_name),
                start_date = COALESCE(?, start_date),
                end_date = COALESCE(?, end_date),
                rentman_project = ?,
                status = COALESCE(?, status),
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            artist_name,
            start_date,
            end_date,
            rentman_project,
            status,
            notes,
            id
        ]);

        const [updatedAccessCode] = await pool.query(
            'SELECT * FROM access_codes WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Adgangskode opdateret',
            access_code: updatedAccessCode[0]
        });
    } catch (error) {
        console.error('Error updating access code:', error);
        res.status(500).json({
            error: 'Kunne ikke opdatere adgangskode',
            message: error.message
        });
    }
});

// DELETE /api/access-codes/:id - Delete access code
app.delete("/api/access-codes/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await pool.query(
            'SELECT * FROM access_codes WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Adgangskode ikke fundet' });
        }

        await pool.query('DELETE FROM access_codes WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Adgangskode slettet'
        });
    } catch (error) {
        console.error('Error deleting access code:', error);
        res.status(500).json({
            error: 'Kunne ikke slette adgangskode',
            message: error.message
        });
    }
});

// POST /api/access-codes/:id/revoke - Revoke access code
app.post("/api/access-codes/:id/revoke", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await pool.query(
            'SELECT * FROM access_codes WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Adgangskode ikke fundet' });
        }

        if (existing[0].status === 'revoked') {
            return res.status(400).json({ error: 'Adgangskode er allerede tilbagekaldt' });
        }

        await pool.query(`
            UPDATE access_codes 
            SET 
                status = 'revoked',
                revoked_at = CURRENT_TIMESTAMP,
                revoked_by = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [req.session.user.id, id]);

        const [revokedAccessCode] = await pool.query(
            'SELECT * FROM access_codes WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Adgangskode tilbagekaldt',
            access_code: revokedAccessCode[0]
        });
    } catch (error) {
        console.error('Error revoking access code:', error);
        res.status(500).json({
            error: 'Kunne ikke tilbagekalde adgangskode',
            message: error.message
        });
    }
});

// ============================================
// Integration Dashboard API Endpoints (CRM)
// ============================================

// GET /api/integration/dashboard - Combined dashboard data
app.get("/api/integration/dashboard", authMiddleware, async (req, res) => {
    try {
        // Get sync status
        const [syncLogs] = await crmPool.query(`
            SELECT * FROM sync_log
            ORDER BY started_at DESC
            LIMIT 10
        `);

        // Get error summary
        const [[unresolvedCount]] = await crmPool.query(
            'SELECT COUNT(*) as count FROM integration_errors WHERE resolved = FALSE'
        );

        const [[criticalCount]] = await crmPool.query(
            `SELECT COUNT(*) as count FROM integration_errors
             WHERE resolved = FALSE AND severity IN ('critical', 'error')`
        );

        // Get recent errors
        const [recentErrors] = await crmPool.query(`
            SELECT * FROM integration_errors
            WHERE resolved = FALSE
            ORDER BY FIELD(severity, 'critical', 'error', 'warn', 'info', 'debug'), created_at DESC
            LIMIT 10
        `);

        // Get today's stats
        const [todayStats] = await crmPool.query(
            `SELECT * FROM error_statistics WHERE date = CURDATE()`
        );

        // Get 30 day statistics
        const [monthlyStats] = await crmPool.query(`
            SELECT
                SUM(COALESCE(webhook_errors, 0) + COALESCE(api_errors, 0) + COALESCE(database_errors, 0) +
                    COALESCE(validation_errors, 0) + COALESCE(sync_errors, 0) + COALESCE(other_errors, 0)) as total_errors,
                SUM(COALESCE(resolved_count, 0)) as resolved_count
            FROM error_statistics
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `);

        // Get sync statistics for 30 days
        const [syncStats] = await crmPool.query(`
            SELECT
                COUNT(*) as total_syncs,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_syncs,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
                SUM(COALESCE(total_items, 0)) as total_items_processed
            FROM sync_log
            WHERE started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        // Get recent webhooks
        const [webhookEvents] = await crmPool.query(`
            SELECT * FROM webhook_events
            ORDER BY created_at DESC
            LIMIT 20
        `);

        const lastSync = syncLogs[0] || null;
        const isRunning = lastSync && lastSync.status === 'running';

        res.json({
            success: true,
            currentStatus: {
                isRunning,
                currentType: isRunning ? lastSync.sync_type : null
            },
            lastSync,
            errors: {
                unresolvedCount: unresolvedCount.count,
                criticalCount: criticalCount.count,
                recentErrors,
                todayStats: todayStats[0] || null
            },
            syncStats: syncStats[0] || { total_syncs: 0, successful_syncs: 0, failed_syncs: 0, total_items_processed: 0 },
            monthlyStats: monthlyStats[0] || { total_errors: 0, resolved_count: 0 },
            recentSyncs: syncLogs,
            webhookEvents
        });
    } catch (error) {
        console.error('Error fetching integration dashboard:', error);
        res.status(500).json({
            error: 'Kunne ikke hente integration dashboard data',
            message: error.message
        });
    }
});

// GET /api/integration/errors - Get error list
app.get("/api/integration/errors", authMiddleware, async (req, res) => {
    try {
        const { limit = 100, resolved = 'false', severity, errorType, sourceSystem } = req.query;

        let query = 'SELECT * FROM integration_errors WHERE 1=1';
        const params = [];

        if (resolved !== undefined) {
            query += ' AND resolved = ?';
            params.push(resolved === 'true');
        }

        if (severity) {
            query += ' AND severity = ?';
            params.push(severity);
        }

        if (errorType) {
            query += ' AND error_type = ?';
            params.push(errorType);
        }

        if (sourceSystem) {
            query += ' AND source_system = ?';
            params.push(sourceSystem);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [errors] = await crmPool.query(query, params);

        res.json({ success: true, errors });
    } catch (error) {
        console.error('Error fetching integration errors:', error);
        res.status(500).json({
            error: 'Kunne ikke hente fejl',
            message: error.message
        });
    }
});

// POST /api/integration/errors/:id/resolve - Resolve an error
app.post("/api/integration/errors/:id/resolve", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const resolvedBy = req.session.user.brugernavn || 'dashboard';

        await crmPool.query(`
            UPDATE integration_errors
            SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?, resolution_notes = ?
            WHERE id = ?
        `, [resolvedBy, notes || null, id]);

        // Update today's statistics
        const today = new Date().toISOString().split('T')[0];
        await crmPool.query(`
            UPDATE error_statistics
            SET resolved_count = resolved_count + 1, unresolved_count = GREATEST(0, unresolved_count - 1)
            WHERE date = ?
        `, [today]);

        res.json({ success: true, message: 'Fejl markeret som løst' });
    } catch (error) {
        console.error('Error resolving error:', error);
        res.status(500).json({
            error: 'Kunne ikke markere fejl som løst',
            message: error.message
        });
    }
});

// GET /api/integration/history - Get sync history
app.get("/api/integration/history", authMiddleware, async (req, res) => {
    try {
        const { limit = 50, type } = req.query;

        let query = 'SELECT * FROM sync_log WHERE 1=1';
        const params = [];

        if (type) {
            query += ' AND sync_type = ?';
            params.push(type);
        }

        query += ' ORDER BY started_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [history] = await crmPool.query(query, params);

        res.json({ success: true, history });
    } catch (error) {
        console.error('Error fetching sync history:', error);
        res.status(500).json({
            error: 'Kunne ikke hente sync historik',
            message: error.message
        });
    }
});

// GET /api/integration/webhooks - Get webhook events
app.get("/api/integration/webhooks", authMiddleware, async (req, res) => {
    try {
        const { limit = 100, source, status } = req.query;

        let query = 'SELECT * FROM webhook_events WHERE 1=1';
        const params = [];

        if (source) {
            query += ' AND source = ?';
            params.push(source);
        }

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [webhooks] = await crmPool.query(query, params);

        res.json({ success: true, webhooks });
    } catch (error) {
        console.error('Error fetching webhook events:', error);
        res.status(500).json({
            error: 'Kunne ikke hente webhook events',
            message: error.message
        });
    }
});

// POST /api/integration/sync - Trigger full sync (Admin only)
app.post("/api/integration/sync", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { direction = 'bidirectional', batchSize = 100 } = req.body;
        const triggeredBy = req.session.user.brugernavn || 'dashboard';

        // Call Rentman integration server
        const response = await fetch(`${RENTMAN_INTEGRATION_URL}/sync/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'full',
                direction,
                batchSize,
                triggeredBy
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json({ success: true, message: 'Fuld sync startet', data });
    } catch (error) {
        console.error('Error triggering full sync:', error);
        res.status(500).json({
            error: 'Kunne ikke starte fuld sync',
            message: error.message
        });
    }
});

// POST /api/integration/sync/:type - Trigger specific sync type
app.post("/api/integration/sync/:type", authMiddleware, async (req, res) => {
    try {
        const { type } = req.params;
        const validTypes = ['company', 'contact', 'deal', 'order'];

        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Ugyldig sync type' });
        }

        const { direction = 'bidirectional', batchSize = 100 } = req.body;
        const triggeredBy = req.session.user.brugernavn || 'dashboard';

        // Call Rentman integration server
        const response = await fetch(`${RENTMAN_INTEGRATION_URL}/sync/run/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                direction,
                batchSize,
                triggeredBy
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json({ success: true, message: `${type} sync startet`, data });
    } catch (error) {
        console.error(`Error triggering ${req.params.type} sync:`, error);
        res.status(500).json({
            error: `Kunne ikke starte ${req.params.type} sync`,
            message: error.message
        });
    }
});

// GET /api/integration/status - Get current sync status
app.get("/api/integration/status", authMiddleware, async (req, res) => {
    try {
        const [syncLogs] = await crmPool.query(`
            SELECT * FROM sync_log
            WHERE status = 'running'
            ORDER BY started_at DESC
            LIMIT 1
        `);

        const isRunning = syncLogs.length > 0;
        const currentSync = syncLogs[0] || null;

        res.json({
            success: true,
            isRunning,
            currentType: isRunning ? currentSync.sync_type : null,
            currentSync
        });
    } catch (error) {
        console.error('Error fetching sync status:', error);
        res.status(500).json({
            error: 'Kunne ikke hente sync status',
            message: error.message
        });
    }
});

// ============================================
// Utility Endpoints
// ============================================

// GET /api/statistics - Get system statistics
app.get("/api/statistics", authMiddleware, async (req, res) => {
    try {
        const [stats] = await pool.query('CALL get_statistics()');
        res.json({
            success: true,
            statistics: stats[0][0]
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            error: 'Kunne ikke hente statistikker',
            message: error.message
        });
    }
});

// POST /api/update-statuses - Manually trigger status updates
app.post("/api/update-statuses", authMiddleware, async (req, res) => {
    try {
        await pool.query('CALL update_access_code_status()');
        await pool.query('CALL update_stall_status()');

        res.json({
            success: true,
            message: 'Statusser opdateret'
        });
    } catch (error) {
        console.error('Error updating statuses:', error);
        res.status(500).json({
            error: 'Kunne ikke opdatere statusser',
            message: error.message
        });
    }
});

// ============================================
// Protected Routes
// ============================================

app.get("/", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "index.html"));
});

app.get("/sluse", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "sluse.html"));
});

app.get("/adgang", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "adgang.html"));
});

app.get("/integration", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "integration.html"));
});

app.get("/profil", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "profil.html"));
});

app.get("/users", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "users.html"));
});

app.get("/indkob", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "indkob.html"));
});

// ============================================
// API Endpoints - Weekly Menu
// ============================================

// Helper function to get ISO week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Helper function to get day name in Danish
function getDayName(dayIndex) {
    const days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
    return days[dayIndex];
}

// GET /api/menu - Get current week's menu
app.get("/api/menu", authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const weekNumber = req.query.week ? parseInt(req.query.week) : getWeekNumber(now);
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

        const [rows] = await pool.query(`
            SELECT *
            FROM weekly_menu
            WHERE week_number = ? AND year = ?
            ORDER BY FIELD(day_of_week, 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag')
        `, [weekNumber, year]);

        // Parse JSON fields (handle both string and already-parsed cases)
        const menu = rows.map(row => {
            let toppings = row.toppings || [];
            let salads = row.salads || [];

            // If it's a string, try to parse it as JSON
            if (typeof toppings === 'string') {
                try {
                    toppings = JSON.parse(toppings);
                } catch (e) {
                    toppings = [];
                }
            }
            if (typeof salads === 'string') {
                try {
                    salads = JSON.parse(salads);
                } catch (e) {
                    salads = [];
                }
            }

            return {
                ...row,
                toppings,
                salads
            };
        });

        const todayName = getDayName(now.getDay());

        res.json({
            success: true,
            week_number: weekNumber,
            year: year,
            today: todayName,
            menu: menu
        });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({
            error: 'Kunne ikke hente menu',
            message: error.message
        });
    }
});

// PUT /api/menu - Update week's menu
app.put("/api/menu", authMiddleware, async (req, res) => {
    try {
        const { week_number, year, menu } = req.body;

        if (!week_number || !year || !menu || !Array.isArray(menu)) {
            return res.status(400).json({ error: 'Ugenummer, år og menu er påkrævet' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const day of menu) {
                const toppings = JSON.stringify(day.toppings || []);
                const salads = JSON.stringify(day.salads || []);

                await connection.query(`
                    INSERT INTO weekly_menu (week_number, year, day_of_week, main_dish, main_dish_description, toppings, salads, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        main_dish = VALUES(main_dish),
                        main_dish_description = VALUES(main_dish_description),
                        toppings = VALUES(toppings),
                        salads = VALUES(salads),
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    week_number,
                    year,
                    day.day_of_week,
                    day.main_dish,
                    day.main_dish_description || null,
                    toppings,
                    salads,
                    req.session.user.id
                ]);
            }

            // Log the activity
            await connection.query(`
                INSERT INTO activity_log (user_id, user_name, action_type, resource_type, resource_name, description)
                VALUES (?, ?, 'update', 'weekly_menu', ?, ?)
            `, [
                req.session.user.id,
                `${req.session.user.fornavn} ${req.session.user.efternavn}`,
                `Uge ${week_number}`,
                `Menu for uge ${week_number} blev opdateret`
            ]);

            await connection.commit();
            res.json({ success: true, message: 'Menu opdateret' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating menu:', error);
        res.status(500).json({
            error: 'Kunne ikke opdatere menu',
            message: error.message
        });
    }
});

// ============================================
// API Endpoints - Activity Log
// ============================================

// GET /api/activities - Get recent activities
app.get("/api/activities", authMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const [rows] = await pool.query(`
            SELECT
                id,
                user_id,
                user_name,
                action_type,
                resource_type,
                resource_id,
                resource_name,
                description,
                created_at
            FROM activity_log
            ORDER BY created_at DESC
            LIMIT ?
        `, [limit]);

        res.json({
            success: true,
            activities: rows
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({
            error: 'Kunne ikke hente aktiviteter',
            message: error.message
        });
    }
});

// GET /api/activities/count - Get 24h activity count
app.get("/api/activities/count", authMiddleware, async (req, res) => {
    try {
        const [[result]] = await pool.query(`
            SELECT COUNT(*) as count
            FROM activity_log
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);

        res.json({
            success: true,
            count: result.count
        });
    } catch (error) {
        console.error('Error fetching activity count:', error);
        res.status(500).json({
            error: 'Kunne ikke hente aktivitetsantal',
            message: error.message
        });
    }
});

// POST /api/activities - Log an activity
app.post("/api/activities", authMiddleware, async (req, res) => {
    try {
        const {
            action_type,
            resource_type,
            resource_id,
            resource_name,
            description,
            old_values,
            new_values
        } = req.body;

        await pool.query(`
            INSERT INTO activity_log (
                user_id, user_name, action_type, resource_type,
                resource_id, resource_name, description, old_values, new_values
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.session.user.id,
            `${req.session.user.fornavn} ${req.session.user.efternavn}`,
            action_type,
            resource_type,
            resource_id || null,
            resource_name || null,
            description || null,
            old_values ? JSON.stringify(old_values) : null,
            new_values ? JSON.stringify(new_values) : null
        ]);

        res.json({ success: true, message: 'Aktivitet logget' });
    } catch (error) {
        console.error('Error logging activity:', error);
        res.status(500).json({
            error: 'Kunne ikke logge aktivitet',
            message: error.message
        });
    }
});

// GET /api/dashboard-stats - Get dashboard statistics
app.get("/api/dashboard-stats", authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Get this week's project count from project_with_sp (grouped by project_id)
        // Exclude sp_status 1, 2, 8 and projects with "opbevaring" in name
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
        } catch (e) {
            projectCount = 0;
        }

        // Get 24h activity count
        let activityCount = 0;
        try {
            const [[activityResult]] = await pool.query(`
                SELECT COUNT(*) as count
                FROM activity_log
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `);
            activityCount = activityResult.count;
        } catch (e) {
            activityCount = 0;
        }

        // Get unresolved errors count
        let unresolvedErrors = { count: 0, status: 'OK' };
        try {
            const [[errorResult]] = await crmPool.query(`
                SELECT COUNT(*) as count
                FROM integration_errors
                WHERE resolved = FALSE
            `);
            unresolvedErrors.count = errorResult.count;

            if (unresolvedErrors.count === 0) {
                unresolvedErrors.status = 'OK';
            } else if (unresolvedErrors.count <= 5) {
                unresolvedErrors.status = 'Mindre';
            } else {
                unresolvedErrors.status = 'Kritisk';
            }
        } catch (e) {
            // CRM database might not be available
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
        res.status(500).json({
            error: 'Kunne ikke hente statistikker',
            message: error.message
        });
    }
});

// GET /api/projects - Get projects from project_with_sp grouped by project_id
app.get("/api/projects", authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                project_id,
                project_name,
                MIN(sp_start_pp) as start_date,
                MAX(sp_end_pp) as end_date,
                MIN(sp_start_up) as usage_start,
                MAX(sp_end_up) as usage_end,
                COUNT(*) as subproject_count
            FROM project_with_sp
            GROUP BY project_id, project_name
            ORDER BY start_date DESC
        `);

        res.json({
            success: true,
            projects: rows
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({
            error: 'Kunne ikke hente projekter',
            message: error.message
        });
    }
});

// GET /api/projects/search - Search projects by name
app.get("/api/projects/search", authMiddleware, async (req, res) => {
    try {
        const { q } = req.query;
        const searchTerm = `%${q || ''}%`;

        const [rows] = await pool.query(`
            SELECT
                project_id,
                project_name,
                MIN(sp_start_pp) as start_date,
                MAX(sp_end_pp) as end_date,
                MIN(sp_start_up) as usage_start,
                MAX(sp_end_up) as usage_end
            FROM project_with_sp
            WHERE project_name LIKE ?
            GROUP BY project_id, project_name
            ORDER BY start_date DESC
            LIMIT 20
        `, [searchTerm]);

        res.json({
            success: true,
            projects: rows
        });
    } catch (error) {
        console.error('Error searching projects:', error);
        res.status(500).json({
            error: 'Kunne ikke søge projekter',
            message: error.message
        });
    }
});

// ============================================
// API Endpoints - Dashboard Notes
// ============================================

// GET /api/notes - Get all active notes sorted by priority
app.get("/api/notes", authMiddleware, async (req, res) => {
    try {
        const includeCompleted = req.query.all === 'true';

        let query = `
            SELECT
                id,
                title,
                content,
                priority,
                created_by,
                created_by_name,
                is_completed,
                completed_at,
                created_at,
                updated_at
            FROM dashboard_notes
        `;

        if (!includeCompleted) {
            query += ` WHERE is_completed = 0`;
        }

        query += ` ORDER BY is_completed ASC, priority ASC, created_at DESC`;

        const [rows] = await pool.query(query);

        res.json({
            success: true,
            notes: rows
        });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({
            error: 'Kunne ikke hente noter',
            message: error.message
        });
    }
});

// POST /api/notes - Create a new note
app.post("/api/notes", authMiddleware, async (req, res) => {
    try {
        const { title, content, priority } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Titel er paakraevet' });
        }

        const notePriority = Math.min(5, Math.max(1, parseInt(priority) || 3));

        const [result] = await pool.query(`
            INSERT INTO dashboard_notes (title, content, priority, created_by, created_by_name)
            VALUES (?, ?, ?, ?, ?)
        `, [
            title.trim(),
            content || null,
            notePriority,
            req.session.user.id,
            `${req.session.user.fornavn} ${req.session.user.efternavn}`
        ]);

        res.json({
            success: true,
            message: 'Note oprettet',
            note_id: result.insertId
        });
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({
            error: 'Kunne ikke oprette note',
            message: error.message
        });
    }
});

// PUT /api/notes/:id - Update a note
app.put("/api/notes/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, priority } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Titel er paakraevet' });
        }

        const notePriority = Math.min(5, Math.max(1, parseInt(priority) || 3));

        await pool.query(`
            UPDATE dashboard_notes
            SET title = ?, content = ?, priority = ?
            WHERE id = ?
        `, [title.trim(), content || null, notePriority, id]);

        res.json({ success: true, message: 'Note opdateret' });
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({
            error: 'Kunne ikke opdatere note',
            message: error.message
        });
    }
});

// PUT /api/notes/:id/complete - Mark note as completed
app.put("/api/notes/:id/complete", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(`
            UPDATE dashboard_notes
            SET is_completed = 1, completed_at = CURRENT_TIMESTAMP, completed_by = ?
            WHERE id = ?
        `, [req.session.user.id, id]);

        res.json({ success: true, message: 'Note markeret som faerdig' });
    } catch (error) {
        console.error('Error completing note:', error);
        res.status(500).json({
            error: 'Kunne ikke markere note som faerdig',
            message: error.message
        });
    }
});

// DELETE /api/notes/:id - Delete a note
app.delete("/api/notes/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(`DELETE FROM dashboard_notes WHERE id = ?`, [id]);

        res.json({ success: true, message: 'Note slettet' });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({
            error: 'Kunne ikke slette note',
            message: error.message
        });
    }
});

// ============================================
// Sluse Timer / Webhook Endpoints
// ============================================

// GET /api/sluse/timer - Public endpoint for display timer status (no auth required)
app.get("/api/sluse/timer", async (req, res) => {
    try {
        const [rows] = await slusePool.query(`
            SELECT
                id, portnavn, status, livestatus, warn, alarm, paused,
                UNIX_TIMESTAMP(timer) AS timer_unix,
                UNIX_TIMESTAMP(opdateret) AS opdateret_unix,
                UNIX_TIMESTAMP(NOW()) AS now_unix
            FROM portstatus
            WHERE portnavn = 'sluse'
        `);

        if (rows.length === 0) {
            return res.json({ error: 'Ingen data fundet' });
        }

        const data = rows[0];
        data.difference = data.timer_unix - data.now_unix;

        res.json(data);
    } catch (err) {
        console.error('Error fetching timer status:', err);
        res.status(500).json({ error: "Kunne ikke hente timer status" });
    }
});

// POST /api/sluse/webhook - Webhook endpoint for updating timer (no auth)
app.post("/api/sluse/webhook", async (req, res) => {
    try {
        const { port, warn, alarm, timer, portlive, paused } = req.body;

        const params = [];
        const values = [];

        // Handle port status
        if (port !== undefined) {
            switch (port) {
                case 'closed':
                    params.push("status = ?");
                    values.push(0);
                    break;
                case 'closing':
                    params.push("status = ?");
                    values.push(1);
                    break;
                case 'open':
                    params.push("status = ?");
                    values.push(2);
                    break;
            }
        }

        // Handle paused status
        if (paused !== undefined) {
            params.push("paused = ?");
            values.push(paused === '1' || paused === 1 ? 1 : 0);
        }

        // Handle live port status
        if (portlive !== undefined) {
            switch (portlive) {
                case 'closed':
                    params.push("livestatus = ?");
                    values.push(0);
                    break;
                case 'closing':
                    params.push("livestatus = ?");
                    values.push(1);
                    break;
                case 'open':
                    params.push("livestatus = ?");
                    values.push(2);
                    break;
            }
        }

        // Handle warn threshold
        if (warn !== undefined) {
            params.push("warn = ?");
            values.push(parseInt(warn));
        }

        // Handle alarm threshold
        if (alarm !== undefined) {
            params.push("alarm = ?");
            values.push(parseInt(alarm));
        }

        // Handle timer (format: "MM:SS")
        if (timer !== undefined) {
            const timeParts = timer.split(':');
            if (timeParts.length === 2) {
                const minutes = parseInt(timeParts[0]);
                const seconds = parseInt(timeParts[1]);
                params.push("timer = DATE_ADD(NOW(), INTERVAL ? SECOND)");
                values.push(minutes * 60 + seconds);
            }
        }

        // Always update the opdateret timestamp
        params.push("opdateret = NOW()");

        if (params.length === 1) {
            // Only opdateret was added, nothing to update
            return res.json({ success: true, message: 'No changes' });
        }

        const sql = `UPDATE portstatus SET ${params.join(", ")} WHERE portnavn = 'sluse'`;
        await slusePool.query(sql, values);

        // Log webhook call to sluselog
        const varsForLog = Object.entries(req.body)
            .filter(([key]) => key !== 'responseKey')
            .map(([key, val]) => `${key}=${val}`)
            .join('&');
        await slusePool.query(
            "INSERT INTO sluselog (slusenavn, action, variables) VALUES (?, 'statusMsg', ?)",
            ['sluse', varsForLog]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error processing webhook:', err);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});

// GET variant of webhook for compatibility with existing Arduino setup
app.get("/api/sluse/webhook", async (req, res) => {
    try {
        const { port, warn, alarm, timer, portlive, paused } = req.query;

        const params = [];
        const values = [];

        if (port !== undefined) {
            switch (port) {
                case 'closed':
                    params.push("status = ?");
                    values.push(0);
                    break;
                case 'closing':
                    params.push("status = ?");
                    values.push(1);
                    break;
                case 'open':
                    params.push("status = ?");
                    values.push(2);
                    break;
            }
        }

        if (paused !== undefined) {
            params.push("paused = ?");
            values.push(paused === '1' || paused === 1 ? 1 : 0);
        }

        if (portlive !== undefined) {
            switch (portlive) {
                case 'closed':
                    params.push("livestatus = ?");
                    values.push(0);
                    break;
                case 'closing':
                    params.push("livestatus = ?");
                    values.push(1);
                    break;
                case 'open':
                    params.push("livestatus = ?");
                    values.push(2);
                    break;
            }
        }

        if (warn !== undefined) {
            params.push("warn = ?");
            values.push(parseInt(warn));
        }

        if (alarm !== undefined) {
            params.push("alarm = ?");
            values.push(parseInt(alarm));
        }

        if (timer !== undefined) {
            const timeParts = timer.split(':');
            if (timeParts.length === 2) {
                const minutes = parseInt(timeParts[0]);
                const seconds = parseInt(timeParts[1]);
                params.push("timer = DATE_ADD(NOW(), INTERVAL ? SECOND)");
                values.push(minutes * 60 + seconds);
            }
        }

        params.push("opdateret = NOW()");

        if (params.length === 1) {
            return res.json({ success: true, message: 'No changes' });
        }

        const sql = `UPDATE portstatus SET ${params.join(", ")} WHERE portnavn = 'sluse'`;
        await slusePool.query(sql, values);

        // Log webhook call to sluselog
        const varsForLog = Object.entries(req.query)
            .filter(([key]) => key !== 'responseKey' && key !== 'key')
            .map(([key, val]) => `${key}=${val}`)
            .join('&');
        await slusePool.query(
            "INSERT INTO sluselog (slusenavn, action, variables) VALUES (?, 'statusMsg', ?)",
            ['sluse', varsForLog]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error processing webhook:', err);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});

// GET /api/sluse/settings - Arduino fetches settings (no auth - uses key validation)
app.get("/api/sluse/settings", async (req, res) => {
    try {
        const { key, firststart, format } = req.query;

        // Optional key validation (set SLUSE_SETTINGS_KEY in .env if needed)
        const settingsKey = process.env.SLUSE_SETTINGS_KEY;
        if (settingsKey && key !== settingsKey) {
            return res.status(403).json({ error: 'Invalid request key' });
        }

        const slusenavn = 'sluse';

        // If firststart=1, reset shouldReset and log
        if (firststart === '1') {
            await slusePool.query(
                "UPDATE slusesettings SET shouldReset = 0, lastFirststart = NOW() WHERE slusenavn = ?",
                [slusenavn]
            );
            await slusePool.query(
                "INSERT INTO sluselog (slusenavn, action) VALUES (?, 'firstStart')",
                [slusenavn]
            );
        }

        // Fetch settings
        const [rows] = await slusePool.query(
            "SELECT * FROM slusesettings WHERE slusenavn = ?",
            [slusenavn]
        );

        // Default values (in milliseconds)
        let settings = {
            openDuration: 450000,      // 7.5 minutes
            portCycleTime: 40000,      // 40 seconds
            saltoImpulseDuration: 6000, // 6 seconds
            warningThreshold: 45000    // 45 seconds
        };

        let shouldReset = 0;

        if (rows.length > 0) {
            const row = rows[0];
            if (row.openDuration) settings.openDuration = Math.max(30000, parseInt(row.openDuration));
            if (row.portCycleTime) settings.portCycleTime = parseInt(row.portCycleTime);
            if (row.saltoImpulseDuration) settings.saltoImpulseDuration = parseInt(row.saltoImpulseDuration);
            if (row.warningThreshold) settings.warningThreshold = Math.min(parseInt(row.warningThreshold), settings.openDuration);
            shouldReset = row.shouldReset ? 1 : 0;
        }

        // Log settings fetch
        await slusePool.query(
            "INSERT INTO sluselog (slusenavn, action) VALUES (?, 'fetchSettings')",
            [slusenavn]
        );

        // Response key (optional, set in .env)
        const responseKey = process.env.SLUSE_RESPONSE_KEY || '';

        if (format === 'json') {
            const response = {
                responseKey,
                ...settings
            };
            if (shouldReset === 1) response.reset = 1;
            res.json(response);
        } else {
            // URL-encoded format for Arduino
            let output = `responseKey=${responseKey}&`;
            output += `openDuration=${settings.openDuration}&`;
            output += `portCycleTime=${settings.portCycleTime}&`;
            output += `saltoImpulseDuration=${settings.saltoImpulseDuration}&`;
            output += `warningThreshold=${settings.warningThreshold}`;
            if (shouldReset === 1) output += '&reset=1';
            res.type('text/plain').send(output);
        }
    } catch (err) {
        console.error('Error fetching sluse settings:', err);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

// POST /api/sluse/weekly-reset - Trigger weekly reset (sets shouldReset=1, cleans old logs)
app.post("/api/sluse/weekly-reset", async (req, res) => {
    try {
        const slusenavn = 'sluse';

        // Set shouldReset = 1
        await slusePool.query(
            "UPDATE slusesettings SET shouldReset = 1 WHERE slusenavn = ?",
            [slusenavn]
        );

        // Clean old logs (older than 1 month)
        const [result] = await slusePool.query(
            "DELETE FROM sluselog WHERE time < NOW() - INTERVAL 1 MONTH"
        );

        res.json({
            success: true,
            message: 'Weekly reset triggered',
            logsDeleted: result.affectedRows
        });
    } catch (err) {
        console.error('Error triggering weekly reset:', err);
        res.status(500).json({ error: "Failed to trigger reset" });
    }
});

// GET variant for cron job compatibility
app.get("/api/sluse/weekly-reset", async (req, res) => {
    try {
        const slusenavn = 'sluse';

        await slusePool.query(
            "UPDATE slusesettings SET shouldReset = 1 WHERE slusenavn = ?",
            [slusenavn]
        );

        const [result] = await slusePool.query(
            "DELETE FROM sluselog WHERE time < NOW() - INTERVAL 1 MONTH"
        );

        res.json({
            success: true,
            message: 'Weekly reset triggered',
            logsDeleted: result.affectedRows
        });
    } catch (err) {
        console.error('Error triggering weekly reset:', err);
        res.status(500).json({ error: "Failed to trigger reset" });
    }
});

// ============================================
// Error Handling
// ============================================

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint ikke fundet' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Intern serverfejl',
        message: err.message
    });
});


// ============================================
// Start Server
// ============================================

app.listen(port, () => {
    console.log(`Server korer pa port ${port}`);
    console.log(`Database: ${sylleDatabaseConfig.database}`);
    console.log(`API endpoints tilgangelige pa http://localhost:${port}/api/`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal modtaget: Lukker server...');
    await pool.end();
    process.exit(0);
});