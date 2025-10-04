// middleware/auth.js - Authentication middleware
const authService = require('../services/auth');

// Authenticate JWT token
const authenticate = async (req, res, next) => {
    try {
        // Get token from header or cookie
        const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;

        if (!token) {
            return res.status(401).json({ error: '未登录，请先登录' });
        }

        // Verify token
        const decoded = authService.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: '登录已过期，请重新登录' });
        }

        // Get user info
        const user = await authService.getUserById(decoded.id);
        if (!user) {
            return res.status(401).json({ error: '用户不存在' });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ error: '认证失败' });
    }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

// Check balance (for paid features)
const checkBalance = (cost) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: '未登录' });
            }

            const balance = parseFloat(req.user.balance);
            
            // Admin users bypass balance check
            if (req.user.is_admin) {
                return next();
            }

            if (balance < cost) {
                return res.status(402).json({ 
                    error: '余额不足，请充值',
                    balance: balance,
                    required: cost
                });
            }

            next();
        } catch (error) {
            console.error('Balance check error:', error);
            res.status(500).json({ error: '余额检查失败' });
        }
    };
};

module.exports = {
    authenticate,
    requireAdmin,
    checkBalance
};
