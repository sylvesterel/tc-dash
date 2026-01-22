import express from "express";
import { pool, crmPool } from "../config/database.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.get("/dashboard", authMiddleware, async (req, res) => {
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

// GET /errors - Get error list
router.get("/errors", authMiddleware, async (req, res) => {
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

// POST /errors/:id/resolve - Resolve an error
router.post("/errors/:id/resolve", authMiddleware, async (req, res) => {
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

// GET /history - Get sync history
router.get("/history", authMiddleware, async (req, res) => {
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

// GET /webhooks - Get webhook events
router.get("/webhooks", authMiddleware, async (req, res) => {
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

// POST /sync - Trigger full sync (Admin only)
router.post("/sync", authMiddleware, adminMiddleware, async (req, res) => {
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

// POST /sync/:type - Trigger specific sync type
router.post("/sync/:type", authMiddleware, async (req, res) => {
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

// GET /status - Get current sync status
router.get("/status", authMiddleware, async (req, res) => {
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

export default router;