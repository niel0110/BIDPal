/**
 * adminMiddleware.js
 * Restricts access to Admin-only routes.
 * Should be used after authenticateToken middleware.
 */

export const restrictToAdmin = (req, res, next) => {
    // req.user is populated by authenticateToken
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role?.toLowerCase() !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Admin role required' });
    }

    next();
};
