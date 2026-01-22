import express from "express";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import compression from "compression";
import helmet from "helmet";
import { Seam } from "seam";
import { pool } from "./config/database.js";

// Route imports
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import projectRoutes from "./routes/projects.js";
import sluseRoutes from "./routes/sluse.js";
import menuRoutes from "./routes/menu.js";
import activitiesRoutes from "./routes/activities.js";
import dashboardRoutes from "./routes/dashboard.js";
import pageRoutes from "./routes/pages.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const isProduction = process.env.NODE_ENV === 'production';

// Seam Configuration
const seam = new Seam({ apiKey: process.env.SEAM_API });
const acsSystemId = process.env.SEAM_ACS_SYSTEM_ID;

// ============================================
// Production Middleware
// ============================================
if (isProduction) {
    // Enable gzip compression
    app.use(compression());

    // Security headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                frameSrc: ["'self'", "https://monitor.ui.com"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));

    // Trust proxy for HTTPS
    app.set('trust proxy', 1);
}

// ============================================
// Core Middleware
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: isProduction,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Static files
app.use(express.static(path.join(process.cwd(), "public"), {
    maxAge: isProduction ? '1d' : 0,
    etag: true
}));

// ============================================
// Database Initialization
// ============================================
async function initDatabase() {
    try {
        // Initialize Seam tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS seam_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                acs_user_id VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_acs_user_id (acs_user_id)
            )
        `);

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

        console.log('Database tables initialized');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// ============================================
// Seam User Sync
// ============================================
async function syncSeamUsers() {
    try {
        console.log('[Seam Sync] Syncing users from Seam...');
        const users = await seam.acs.users.list({ acs_system_id: acsSystemId });

        if (!users || users.length === 0) {
            console.log('[Seam Sync] No users found');
            return;
        }

        let syncedCount = 0;
        for (const user of users) {
            if (user.acs_user_id) {
                await pool.query(
                    `INSERT INTO seam_users (acs_user_id, name) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                    [user.acs_user_id, user.full_name || 'Unknown']
                );
                syncedCount++;
            }
        }
        console.log(`[Seam Sync] Synced ${syncedCount} users`);
    } catch (error) {
        console.error('[Seam Sync] Error:', error.message);
    }
}

// ============================================
// Routes
// ============================================

// Auth routes (no prefix)
app.use(authRoutes);

// API routes
app.use("/api/users", userRoutes);
app.use("/api/sluse", sluseRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api", dashboardRoutes);

// Project routes (public lager dashboard endpoints)
app.use("/projects", projectRoutes);
app.use(projectRoutes); // Also mount at root for /api/projects

// Office dashboard (public endpoint)
app.get("/api/office-dashboard", sluseRoutes);

// Page routes (protected HTML pages)
app.use(pageRoutes);

// ============================================
// Health Check
// ============================================
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// Error Handling
// ============================================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: isProduction ? 'Something went wrong' : err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ============================================
// Server Startup
// ============================================
async function startServer() {
    await initDatabase();

    // Start Seam sync
    syncSeamUsers();
    setInterval(syncSeamUsers, 5 * 60 * 1000); // Every 5 minutes

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
    });
}

startServer();

export default app;
