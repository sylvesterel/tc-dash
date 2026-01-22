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

export default { authMiddleware, adminMiddleware, apiAuthMiddleware };
