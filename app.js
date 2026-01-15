import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import { Seam } from "seam";

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

// ============================================
// API Endpoints - Sluse (Old TourCare System)
// ============================================

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
        const response = await fetch(
            `https://api.tourcare.dk/rentman/getdata.php?key=${apiKey}&format=json&target=sluse&stat=both`,
            { method: 'GET' }
        );

        const data = await response.json();

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