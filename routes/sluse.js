import express from "express";
import { pool, slusePool, crmPool } from "../config/database.js";
import { authMiddleware, webhookKeyMiddleware, displayKeyApiMiddleware } from "../middleware/auth.js";
import { Seam } from "seam";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// In-memory storage for selected sluse (iPad -> Display communication)
let selectedSluse = {
    slusenavn: null,
    selectedAt: null
};

// Seam configuration
const seam = new Seam({ apiKey: process.env.SEAM_API });
const acsSystemId = process.env.SEAM_ACS_SYSTEM_ID;

// Sluse colors
const SLUSE_COLORS = {
    'Sluse1': '#703817',
    'Sluse2': '#FF0000',
    'Sluse3': '#FFA500',
    'Sluse4': '#FFFF00',
    'Sluse5': '#008000',
    'Sluse6': '#0000FF',
    'Sluse7': '#EE82EE',
    'Reol1': '#808080',
    'Reol2': '#000000',
};

// Helper functions
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getDayName(dayNum) {
    const days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
    return days[dayNum];
}

// GET /api/sluse/selected - Get currently selected sluse (for display)
router.get("/selected", displayKeyApiMiddleware, async (req, res) => {
    try {
        // Auto-clear after 2 minutes of inactivity
        if (selectedSluse.selectedAt) {
            const elapsed = Date.now() - selectedSluse.selectedAt;
            if (elapsed > 2 * 60 * 1000) {
                selectedSluse = { slusenavn: null, selectedAt: null };
            }
        }

        if (!selectedSluse.slusenavn) {
            return res.json({ success: true, selected: null });
        }

        // Get the sluse data
        const [rows] = await slusePool.query(
            'SELECT * FROM infoskaerm WHERE slusenavn = ?',
            [selectedSluse.slusenavn]
        );

        if (rows.length === 0) {
            return res.json({ success: true, selected: null });
        }

        const row = rows[0];
        res.json({
            success: true,
            selected: {
                slusenavn: row.slusenavn,
                Kunde: row.Kunde,
                Detaljer: row.Detaljer,
                Dato: row.Dato,
                color: SLUSE_COLORS[row.slusenavn] || '#808080',
                selectedAt: selectedSluse.selectedAt
            }
        });
    } catch (err) {
        console.error('Error fetching selected sluse:', err);
        res.status(500).json({ error: "Kunne ikke hente data" });
    }
});

// POST /api/sluse/selected - Set selected sluse (from iPad)
router.post("/selected", displayKeyApiMiddleware, async (req, res) => {
    try {
        const { slusenavn } = req.body;

        if (!slusenavn) {
            // Clear selection
            selectedSluse = { slusenavn: null, selectedAt: null };
            return res.json({ success: true, message: "Selection cleared" });
        }

        selectedSluse = {
            slusenavn: slusenavn,
            selectedAt: Date.now()
        };

        res.json({ success: true, message: "Selection updated", selected: slusenavn });
    } catch (err) {
        console.error('Error setting selected sluse:', err);
        res.status(500).json({ error: "Kunne ikke opdatere" });
    }
});

// DELETE /api/sluse/selected - Clear selected sluse
router.delete("/selected", displayKeyApiMiddleware, (req, res) => {
    selectedSluse = { slusenavn: null, selectedAt: null };
    res.json({ success: true, message: "Selection cleared" });
});

// GET /api/sluse/public - Endpoint for display screen (requires display key)
router.get("/public", displayKeyApiMiddleware, async (req, res) => {
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

// GET /api/sluse/timer - Get timer status (requires display key)
router.get("/timer", displayKeyApiMiddleware, async (req, res) => {
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

// GET /api/sluse/settings - Get sluse settings (requires display key)
router.get("/settings", displayKeyApiMiddleware, async (req, res) => {
    try {
        const [rows] = await slusePool.query('SELECT * FROM settings LIMIT 1');
        if (rows.length === 0) {
            return res.json({ success: true, data: {} });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.status(500).json({ error: "Kunne ikke hente indstillinger" });
    }
});

// GET /api/sluse/webhook - Handle sluse webhook (requires webhook key)
router.get("/webhook", webhookKeyMiddleware, async (req, res) => {
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

// GET /api/sluse/webhook - Webhook status
router.get("/webhook/status", async (req, res) => {
    res.json({ status: 'active', message: 'Sluse webhook endpoint' });
});

// POST /api/sluse/weekly-reset - Reset weekly data (requires auth)
router.post("/weekly-reset", authMiddleware, async (req, res) => {
    try {
        await slusePool.query('UPDATE infoskaerm SET Kunde = "", Detaljer = "", Dato = ""');
        res.json({ success: true, message: "Ugentlig nulstilling gennemført" });
    } catch (err) {
        console.error('Error performing weekly reset:', err);
        res.status(500).json({ error: "Kunne ikke nulstille" });
    }
});

// GET /api/sluse/weekly-reset - Get reset status (requires auth)
router.get("/weekly-reset", authMiddleware, async (req, res) => {
    res.json({ success: true, message: "Weekly reset endpoint" });
});

// GET /api/sluse - Get all sluse data (authenticated)
router.get("/", authMiddleware, async (req, res) => {
    try {
        const [rows] = await slusePool.query('SELECT * FROM infoskaerm ORDER BY id');
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

// PUT /api/sluse/:slusenavn - Update specific sluse
router.put("/:slusenavn", authMiddleware, async (req, res) => {
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

// POST /api/sluse/save-all - Bulk update all sluse data
router.post("/save-all", authMiddleware, async (req, res) => {
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

// DELETE /api/sluse/:slusenavn/clear - Clear specific sluse
router.delete("/:slusenavn/clear", authMiddleware, async (req, res) => {
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

// GET /api/office-dashboard - Endpoint for office display (requires display key)
router.get("/office-dashboard", displayKeyApiMiddleware, async (req, res) => {
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

        // 1. Get menu
        try {
            const [menuRows] = await pool.query(`
                SELECT * FROM weekly_menu
                WHERE week_number = ? AND year = ? AND day_of_week = ?
                AND main_dish IS NOT NULL AND main_dish != ''
            `, [weekNumber, year, todayName]);

            if (menuRows.length > 0 && menuRows[0].main_dish) {
                const menu = menuRows[0];
                let toppings = menu.toppings || [];
                let salads = menu.salads || [];
                if (typeof toppings === 'string') try { toppings = JSON.parse(toppings); } catch (e) { toppings = []; }
                if (typeof salads === 'string') try { salads = JSON.parse(salads); } catch (e) { salads = []; }

                result.todaysMenu = {
                    day: todayName,
                    isToday: true,
                    main_dish: menu.main_dish,
                    main_dish_description: menu.main_dish_description,
                    toppings,
                    salads
                };
            } else {
                const [allMenus] = await pool.query(`
                    SELECT * FROM weekly_menu
                    WHERE week_number = ? AND year = ?
                    AND main_dish IS NOT NULL AND main_dish != ''
                    ORDER BY FIELD(day_of_week, 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag')
                `, [weekNumber, year]);

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
                    if (typeof toppings === 'string') try { toppings = JSON.parse(toppings); } catch (e) { toppings = []; }
                    if (typeof salads === 'string') try { salads = JSON.parse(salads); } catch (e) { salads = []; }

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

        // 2. Get sluse data
        try {
            const [sluseRows] = await slusePool.query('SELECT * FROM infoskaerm ORDER BY id');
            const occupiedSluser = sluseRows.filter(row => row.Kunde && row.Kunde.trim()).length;
            result.sluser = {
                occupied: occupiedSluser,
                total: sluseRows.length,
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

        // 3. Get Seam users count
        try {
            const seamUsers = await seam.acs.users.list({ acs_system_id: acsSystemId });
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

            result.weeklyProjects = { count: projectRows.length, projects: projectRows };
        } catch (e) {
            console.error('Error fetching weekly projects:', e);
            result.weeklyProjects = { count: 0, projects: [] };
        }

        // 5. Get integration errors
        result.integration = { unresolvedErrors: 0, recentErrors: [], recentWebhooks: [], error: null };
        try {
            const connection = await crmPool.getConnection();
            connection.release();

            const [[unresolvedCount]] = await crmPool.query(
                'SELECT COUNT(*) as count FROM integration_errors WHERE resolved = FALSE'
            );
            result.integration.unresolvedErrors = unresolvedCount.count;

            const [recentErrors] = await crmPool.query(`
                SELECT * FROM integration_errors ORDER BY created_at DESC LIMIT 10
            `);
            result.integration.recentErrors = recentErrors;

            const [recentWebhooks] = await crmPool.query(`
                SELECT id, source, event_type, status, created_at
                FROM webhook_events ORDER BY created_at DESC LIMIT 15
            `);
            result.integration.recentWebhooks = recentWebhooks;
        } catch (e) {
            console.error('Error fetching integration data:', e.message);
            result.integration.error = e.message;
        }

        // 6. Get recent access events
        try {
            const [accessEvents] = await pool.query(`
                SELECT id, event_type, acs_user_id, user_name, device_name, occurred_at
                FROM seam_access_events ORDER BY occurred_at DESC LIMIT 15
            `);
            result.accessEvents = accessEvents;
        } catch (e) {
            console.error('Error fetching access events:', e);
            result.accessEvents = [];
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching office dashboard data:', error);
        res.status(500).json({ error: 'Kunne ikke hente kontor dashboard data', message: error.message });
    }
});

// GET /api/rentman/projects - Get Rentman projects
router.get("/rentman/projects", authMiddleware, async (req, res) => {
    try {
        const apiKey = process.env.RENTMAN_API_KEY;
        if (!apiKey) {
            return res.json({ success: false, data: [], error: "Rentman API nøgle ikke konfigureret" });
        }

        const response = await fetch(
            `https://api.tourcare.dk/rentman/getdata.php?key=${apiKey}&format=json&target=sluse&stat=both`,
            { method: 'GET' }
        );

        if (!response.ok) {
            return res.json({ success: false, data: [], error: "Rentman API fejlede" });
        }

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
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

export default router;
