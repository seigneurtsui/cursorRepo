// routes/auth-routes.js - Authentication routes
const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Send verification code
router.post('/send-code', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: '请提供邮箱地址' });
        }

        // Create verification code
        const verification = await authService.createVerificationCode(email);

        // In production, send email here
        console.log(`✅ Verification code for ${email}: ${verification.code}`);

        res.json({ 
            success: true, 
            message: '验证码已发送（开发环境下请查看控制台）',
            code: verification.code, // Remove this in production
            expiresIn: 600
        });
    } catch (error) {
        console.error('发送验证码错误:', error);
        res.status(500).json({ error: '发送验证码失败' });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, username, password, verificationCode, phone } = req.body;

        if (!email || !username || !password || !verificationCode) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: '密码至少需要8位' });
        }

        const user = await authService.register({
            email,
            username,
            password,
            verificationCode,
            phone
        });

        res.json({
            success: true,
            message: '注册成功',
            user: {
                id: user.id,
                email: user.email,
                username: user.username
            }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(400).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: '请填写邮箱和密码' });
        }

        const result = await authService.login(email, password);

        // Set cookie
        res.cookie('token', result.token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'strict'
        });

        res.json({
            success: true,
            message: '登录成功',
            token: result.token,
            user: result.user
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(401).json({ error: error.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: '已退出登录' });
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await authService.getUserById(req.user.id);
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                phone: user.phone,
                balance: parseFloat(user.balance),
                is_admin: user.is_admin,
                isAdmin: user.is_admin,
                createdAt: user.created_at,
                lastLoginAt: user.last_login_at
            }
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

// Update user info
router.put('/profile', authenticate, async (req, res) => {
    try {
        const updates = req.body;
        const user = await authService.updateUser(req.user.id, updates);
        res.json({
            success: true,
            message: '更新成功',
            user
        });
    } catch (error) {
        console.error('更新用户信息错误:', error);
        res.status(400).json({ error: error.message });
    }
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: '请提供旧密码和新密码' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: '新密码至少需要8位' });
        }

        await authService.changePassword(req.user.id, oldPassword, newPassword);
        res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(400).json({ error: error.message });
    }
});

// Get all users (admin only)
router.get('/admin/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, email, username, phone, balance, is_admin, is_active, email_verified, created_at, last_login_at
            FROM users
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('获取用户列表错误:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// Update user balance (admin only)
router.put('/admin/users/:id/balance', authenticate, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { balance } = req.body;

        if (typeof balance !== 'number' || balance < 0) {
            return res.status(400).json({ error: '无效的余额值' });
        }

        const result = await pool.query(
            'UPDATE users SET balance = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [balance, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // Create transaction record
        await pool.query(`
            INSERT INTO transactions (user_id, type, amount, status, description, created_at)
            VALUES ($1, 'recharge', $2, 'completed', '管理员调整余额', NOW())
        `, [userId, balance]);

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('调整余额错误:', error);
        res.status(500).json({ error: '调整余额失败' });
    }
});

module.exports = router;
