import express from "express";
import { Seam } from "seam";
import { pool, crmPool } from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

const seam = new Seam({ apiKey: process.env.SEAM_API });
const acsSystemId = process.env.SEAM_ACS_SYSTEM_ID;
const accessGroupId = process.env.SEAM_ACCESS_GROUP_ID;

// SSE clients for real-time access events
const accessEventClients = new Set();

// POST /create-user - Opret bruger i Seam med streaming status
router.post("/create-user", authMiddleware, async (req, res) => {
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

// GET /check-pin - Poll for pinkode
router.get("/check-pin", authMiddleware, async (req, res) => {
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

// GET /users - Hent alle Seam brugere
router.get("/users", authMiddleware, async (req, res) => {
    try {
        const users = await seam.acs.users.list({ acs_system_id: acsSystemId });
        res.json({ success: true, users });
    } catch (err) {
        console.error('Error fetching seam users:', err);
        res.status(500).json({ error: "Kunne ikke hente brugere fra Seam" });
    }
});

// POST /users/:id/suspend - Suspender en Seam bruger
router.post("/users/:id/suspend", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await seam.acs.users.suspend({ acs_user_id: id });

        res.json({ success: true, message: "Bruger suspenderet" });
    } catch (err) {
        console.error('Error suspending seam user:', err);
        res.status(500).json({ error: "Kunne ikke suspendere bruger: " + err.message });
    }
});

// POST /users/:id/unsuspend - Genaktiver en Seam bruger
router.post("/users/:id/unsuspend", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await seam.acs.users.unsuspend({ acs_user_id: id });

        res.json({ success: true, message: "Bruger genaktiveret" });
    } catch (err) {
        console.error('Error unsuspending seam user:', err);
        res.status(500).json({ error: "Kunne ikke genaktivere bruger: " + err.message });
    }
});

// DELETE /users/:id - Slet en Seam bruger
router.delete("/users/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await seam.acs.users.delete({ acs_user_id: id });

        res.json({ success: true, message: "Bruger slettet" });
    } catch (err) {
        console.error('Error deleting seam user:', err);
        res.status(500).json({ error: "Kunne ikke slette bruger: " + err.message });
    }
});

// GET /access-events/stream - SSE endpoint for real-time access events
router.get("/access-events/stream", (req, res) => {
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

export default router;
