import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

dotenv.config();

// Database Configuration
const sylleDatabaseConfig = {
    host: process.env.SYL_DB_HOST,
    user: process.env.SYL_DB_USER,
    password: process.env.SYL_DB_PASSWORD,
    database: process.env.SYL_DB_NAME,
};

const pool = mysql.createPool(sylleDatabaseConfig);

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
            rolle
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

        res.status(201).json({
            success: true,
            message: 'Bruger oprettet',
            user: newUser[0]
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
    console.log(`✅ Server kører på port ${port}`);
    console.log(`📊 Database: ${sylleDatabaseConfig.database}`);
    console.log(`🔗 API endpoints tilgængelige på http://localhost:${port}/api/`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal modtaget: Lukker server...');
    await pool.end();
    process.exit(0);
});