import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

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
    saveUninitialized: true
}));
app.use(express.static(path.join(process.cwd(), "public")));

// ============================================
// Authentication
// ============================================
let USERS;
try {
    USERS = JSON.parse(process.env.USERS || '[]');
} catch (err) {
    console.error('Kunne ikke parse USERS fra .env:', err);
    USERS = [];
}

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = USERS.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: "Ugyldigt login" });
    req.session.user = { username };
    res.json({ success: true });
});

const authMiddleware = (req, res, next) => {
    if (req.session.user) return next();
    return res.redirect("/login.html");
};

app.get("/me", (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Ikke logget ind" });
    res.json({ username: req.session.user.username });
});

// ============================================
// API Endpoints - Stalls (Båse)
// ============================================

// GET /api/stalls - Hent alle båse
app.get("/api/stalls", async (req, res) => {
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

// POST /api/stalls - Opret ny bås
app.post("/api/stalls", async (req, res) => {
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

        // Validate required fields
        if (!stall_number) {
            return res.status(400).json({ error: 'Bås nummer er påkrævet' });
        }

        // Validate stall number range
        if (stall_number < 1 || stall_number > 12) {
            return res.status(400).json({ error: 'Bås nummer skal være mellem 1 og 12' });
        }

        // Validate color format
        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return res.status(400).json({ error: 'Ugyldig farveformat. Brug #RRGGBB' });
        }

        // Validate dates
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
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            stall_number,
            name || null,
            quantity || 0,
            start_date || null,
            end_date || null,
            color || '#9DABB9',
            status || 'available',
            notes || null
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
        
        // Handle duplicate stall_number
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Bås nummer eksisterer allerede' });
        }
        
        res.status(500).json({ 
            error: 'Kunne ikke oprette bås',
            message: error.message 
        });
    }
});

// PUT /api/stalls/:id - Opdater bås
app.put("/api/stalls/:id", async (req, res) => {
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

        // Check if stall exists
        const [existing] = await pool.query(
            'SELECT * FROM stalls WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Bås ikke fundet' });
        }

        // Validate color format
        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return res.status(400).json({ error: 'Ugyldig farveformat. Brug #RRGGBB' });
        }

        // Validate dates
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

// DELETE /api/stalls/:id - Slet bås
app.delete("/api/stalls/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if stall exists
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

// GET /api/access-codes - Hent alle adgangskoder
app.get("/api/access-codes", async (req, res) => {
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

// POST /api/access-codes - Opret ny adgangskode
app.post("/api/access-codes", async (req, res) => {
    try {
        const { 
            artist_name, 
            access_code, 
            start_date, 
            end_date, 
            rentman_project,
            notes 
        } = req.body;

        // Validate required fields
        if (!artist_name || !access_code || !start_date || !end_date) {
            return res.status(400).json({ 
                error: 'Artist navn, adgangskode, start dato og slut dato er påkrævet' 
            });
        }

        // Validate dates
        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Start dato skal være før slut dato' });
        }

        // Check if access code already exists
        const [existing] = await pool.query(
            'SELECT id FROM access_codes WHERE access_code = ?',
            [access_code]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Adgangskode eksisterer allerede' });
        }

        // Determine status based on dates
        const today = new Date();
        const start = new Date(start_date);
        const end = new Date(end_date);
        
        let status = 'active';
        if (end < today) {
            status = 'expired';
        } else if (start > today) {
            status = 'active'; // Will be active when start date arrives
        }

        const [result] = await pool.query(`
            INSERT INTO access_codes (
                artist_name, 
                access_code, 
                start_date, 
                end_date, 
                rentman_project,
                status,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            artist_name,
            access_code,
            start_date,
            end_date,
            rentman_project || null,
            status,
            notes || null
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

// PUT /api/access-codes/:id - Opdater adgangskode
app.put("/api/access-codes/:id", async (req, res) => {
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

        // Check if access code exists
        const [existing] = await pool.query(
            'SELECT * FROM access_codes WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Adgangskode ikke fundet' });
        }

        // Validate dates
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

// DELETE /api/access-codes/:id - Slet adgangskode
app.delete("/api/access-codes/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if access code exists
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

// POST /api/access-codes/:id/revoke - Tilbagekald adgangskode
app.post("/api/access-codes/:id/revoke", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if access code exists
        const [existing] = await pool.query(
            'SELECT * FROM access_codes WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Adgangskode ikke fundet' });
        }

        // Check if already revoked
        if (existing[0].status === 'revoked') {
            return res.status(400).json({ error: 'Adgangskode er allerede tilbagekaldt' });
        }

        await pool.query(`
            UPDATE access_codes 
            SET 
                status = 'revoked',
                revoked_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [id]);

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
app.get("/api/statistics", async (req, res) => {
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
app.post("/api/update-statuses", async (req, res) => {
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
    console.log(`Dashboard tilgængelig på http://localhost:${port}/`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal modtaget: Lukker server...');
    await pool.end();
    process.exit(0);
});