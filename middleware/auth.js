// Authentication Middleware
export const authMiddleware = (req, res, next) => {
    if (req.session.user) return next();
    return res.redirect("/login.html");
};

// Admin Middleware
export const adminMiddleware = (req, res, next) => {
    if (req.session.user && req.session.user.rolle === 'admin') return next();
    return res.status(403).json({ error: "Kun administratorer har adgang" });
};

// API Auth Middleware (returns JSON instead of redirect)
export const apiAuthMiddleware = (req, res, next) => {
    if (req.session.user) return next();
    return res.status(401).json({ error: "Ikke autoriseret" });
};

// Display Key Middleware (for public display pages - checks query parameter ?key=xxx)
export const displayKeyMiddleware = (req, res, next) => {
    const displayKey = process.env.DISPLAY_KEY;
    const providedKey = req.query.key;

    if (!displayKey) {
        console.error('DISPLAY_KEY not configured in .env');
        return res.status(500).send('Server configuration error');
    }

    if (providedKey === displayKey) {
        return next();
    }

    return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Adgang nægtet</title></head>
        <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e;">
            <div style="text-align: center; color: #fff;">
                <h1 style="color: #e74c3c;">Adgang nægtet</h1>
                <p>Ugyldig eller manglende adgangsnøgle.</p>
                <p style="color: #888; font-size: 14px;">Tilføj ?key=din_nøgle til URL'en</p>
            </div>
        </body>
        </html>
    `);
};

// Webhook Key Middleware (for webhook endpoints - checks query parameter ?key=xxx)
export const webhookKeyMiddleware = (req, res, next) => {
    const webhookKey = process.env.WEBHOOK_KEY;
    const providedKey = req.query.key;

    if (!webhookKey) {
        console.error('WEBHOOK_KEY not configured in .env');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (providedKey === webhookKey) {
        return next();
    }

    return res.status(401).json({ error: 'Ugyldig eller manglende API-nøgle' });
};

// Display Key Middleware for API endpoints (returns JSON)
export const displayKeyApiMiddleware = (req, res, next) => {
    const displayKey = process.env.DISPLAY_KEY;
    const providedKey = req.query.key;

    if (!displayKey) {
        console.error('DISPLAY_KEY not configured in .env');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (providedKey === displayKey) {
        return next();
    }

    return res.status(401).json({ error: 'Ugyldig eller manglende adgangsnøgle' });
};

export default { authMiddleware, adminMiddleware, apiAuthMiddleware, displayKeyMiddleware, webhookKeyMiddleware, displayKeyApiMiddleware };
