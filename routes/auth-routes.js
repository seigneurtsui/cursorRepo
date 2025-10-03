// routes/auth-routes.js - Authentication routes
const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const paymentService = require('../services/payment');
const { authenticate, requireAdmin } = require('../middleware/auth');
const notificationService = require('../services/notification');
const emailService = require('../services/email');
const captchaService = require('../services/captcha');
const { v4: uuidv4 } = require('uuid');

// Check email availability and validity
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: '请提供邮箱地址' });
    }

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.json({ valid: false, exists: false, message: '邮箱格式不正确' });
    }

    // Check if email exists in database
    const db = require('../db/database');
    const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (result.rows.length > 0) {
      return res.json({ valid: true, exists: true, message: '该邮箱已被注册' });
    }

    // Email doesn't exist, it's available
    res.json({ valid: true, exists: false, message: '邮箱可用' });
  } catch (error) {
    console.error('检查邮箱错误:', error);
    res.status(500).json({ error: '检查邮箱失败' });
  }
});

// Generate captcha
router.get('/captcha', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || uuidv4();
    const captcha = captchaService.generate(sessionId);
    
    res.json({
      success: true,
      svg: captcha.svg,
      sessionId: captcha.sessionId
    });
  } catch (error) {
    console.error('生成验证码错误:', error);
    res.status(500).json({ error: '生成验证码失败' });
  }
});

// Verify captcha (optional standalone verification)
router.post('/verify-captcha', async (req, res) => {
  try {
    const { sessionId, captcha } = req.body;
    
    if (!sessionId || !captcha) {
      return res.status(400).json({ error: '请提供验证码' });
    }

    const result = captchaService.verify(sessionId, captcha);
    
    res.json({
      success: result.valid,
      message: result.message
    });
  } catch (error) {
    console.error('验证码验证错误:', error);
    res.status(500).json({ error: '验证失败' });
  }
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

    // Send email using QQ Mail service
    try {
      await emailService.sendVerificationCode(email, verification.code);
      console.log(`✅ Verification code sent to ${email}: ${verification.code}`);
    } catch (emailError) {
      console.error('❌ 发送邮件失败:', emailError);
      // Also try notification service as fallback
      try {
        await notificationService.sendNotification(
          '验证码发送',
          `邮箱: ${email}\n验证码: ${verification.code}\n有效期: 10分钟`
        );
        console.log('✅ Verification code sent via notification service');
      } catch (notifError) {
        console.error('❌ 通知服务也失败:', notifError);
      }
    }

    res.json({ 
      success: true, 
      message: '验证码已发送到您的邮箱',
      expiresIn: 600 // 10 minutes in seconds
    });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, verificationCode, phone, wechat, other_contact, notes, other_info, captcha, captchaSessionId } = req.body;

    // Validate required fields
    if (!email || !username || !password || !verificationCode) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    // Validate captcha first
    if (!captcha || !captchaSessionId) {
      return res.status(400).json({ error: '请输入图形验证码' });
    }

    const captchaResult = captchaService.verify(captchaSessionId, captcha);
    if (!captchaResult.valid) {
      return res.status(400).json({ error: captchaResult.message });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: '密码至少需要8位' });
    }

    // Register user
    const user = await authService.register({
      email,
      username,
      password,
      verificationCode,
      phone,
      wechat,
      other_contact,
      notes,
      other_info
    });

    // Send notification to admin
    try {
      await notificationService.sendNotification(
        '新用户注册',
        `新用户注册:\n用户名: ${username}\n邮箱: ${email}\n注册时间: ${new Date().toLocaleString('zh-CN')}`
      );
    } catch (notifError) {
      console.error('发送通知失败:', notifError);
    }

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
        wechat: user.wechat,
        other_contact: user.other_contact,
        notes: user.notes,
        other_info: user.other_info,
        balance: parseFloat(user.balance),
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
    const { oldPassword, newPassword, currentPassword } = req.body;
    
    // Support both oldPassword and currentPassword parameter names
    const oldPwd = oldPassword || currentPassword;
    
    if (!oldPwd || !newPassword) {
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

// Reset password (forgot password)
router.post('/reset-password', async (req, res) => {
  try {
    const { email, verificationCode, newPassword } = req.body;

    if (!email || !verificationCode || !newPassword) {
      return res.status(400).json({ error: '请填写所有字段' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: '新密码至少需要8位' });
    }

    // Verify code
    const codeVerification = await authService.verifyCode(email, verificationCode);
    if (!codeVerification.valid) {
      return res.status(400).json({ error: codeVerification.message });
    }

    // Check if user exists
    const db = require('../db/database');
    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '该邮箱未注册' });
    }

    const userId = userResult.rows[0].id;

    // Hash new password
    const bcrypt = require('bcryptjs');
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

    res.json({
      success: true,
      message: '密码重置成功'
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ error: '重置密码失败' });
  }
});

// Change email
router.post('/change-email', authenticate, async (req, res) => {
  try {
    const { newEmail, verificationCode } = req.body;

    if (!newEmail || !verificationCode) {
      return res.status(400).json({ error: '请提供新邮箱和验证码' });
    }

    await authService.changeEmail(req.user.id, newEmail, verificationCode);
    res.json({ success: true, message: '邮箱修改成功，请重新登录' });
  } catch (error) {
    console.error('修改邮箱错误:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get payment plans
router.get('/payment-plans', authenticate, async (req, res) => {
  try {
    const plans = await paymentService.getPaymentPlans();
    res.json({ success: true, plans });
  } catch (error) {
    console.error('获取套餐错误:', error);
    res.status(500).json({ error: '获取套餐失败' });
  }
});

// Create transaction (mock payment)
router.post('/recharge', authenticate, async (req, res) => {
  try {
    const { planId, paymentMethod } = req.body;

    if (!planId || !paymentMethod) {
      return res.status(400).json({ error: '请选择套餐和支付方式' });
    }

    const result = await paymentService.createTransaction(req.user.id, planId, paymentMethod);

    // Send notification
    try {
      const plan = await paymentService.getPaymentPlanById(planId);
      await notificationService.sendNotification(
        '用户充值通知',
        `用户充值:\n用户: ${req.user.username} (${req.user.email})\n套餐: ${plan.name}\n金额: ¥${plan.price}\n支付方式: ${paymentMethod}\n充值后余额: ¥${result.newBalance}\n时间: ${new Date().toLocaleString('zh-CN')}`
      );
    } catch (notifError) {
      console.error('发送通知失败:', notifError);
    }

    res.json({
      success: true,
      message: '充值成功',
      transaction: result.transaction,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('充值错误:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get user transactions
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const transactions = await paymentService.getUserTransactions(req.user.id, parseInt(limit), parseInt(offset));
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('获取交易记录错误:', error);
    res.status(500).json({ error: '获取交易记录失败' });
  }
});

// ===== Admin routes =====

// Get all users (admin only)
router.get('/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const query = `
      SELECT id, email, username, phone, wechat, balance, is_admin, is_active, email_verified, created_at, last_login_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await require('../db/database').query(query, [parseInt(limit), parseInt(offset)]);
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// Toggle user active status (admin only)
router.put('/admin/users/:id/toggle-status', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body;

    // Check if user is admin (cannot disable admin)
    const checkQuery = 'SELECT is_admin FROM users WHERE id = $1';
    const checkResult = await require('../db/database').query(checkQuery, [userId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (checkResult.rows[0].is_admin) {
      return res.status(403).json({ error: '无法修改管理员状态' });
    }

    const query = 'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
    const result = await require('../db/database').query(query, [isActive, userId]);

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('切换用户状态错误:', error);
    res.status(500).json({ error: '切换用户状态失败' });
  }
});

// Delete user (admin only)
router.delete('/admin/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user is admin (cannot delete admin)
    const checkQuery = 'SELECT is_admin FROM users WHERE id = $1';
    const checkResult = await require('../db/database').query(checkQuery, [userId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (checkResult.rows[0].is_admin) {
      return res.status(403).json({ error: '无法删除管理员账户' });
    }

    // Delete user (CASCADE will delete related videos, transactions, etc.)
    const query = 'DELETE FROM users WHERE id = $1';
    await require('../db/database').query(query, [userId]);

    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// Adjust user balance (admin only)
router.put('/admin/users/:id/adjust-balance', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { balance } = req.body;

    if (typeof balance !== 'number' || balance < 0) {
      return res.status(400).json({ error: '无效的余额值' });
    }

    const query = 'UPDATE users SET balance = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
    const result = await require('../db/database').query(query, [balance, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('调整余额错误:', error);
    res.status(500).json({ error: '调整余额失败' });
  }
});

// Get all transactions (admin only)
router.get('/admin/transactions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const transactions = await paymentService.getAllTransactions(parseInt(limit), parseInt(offset));
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('获取交易记录错误:', error);
    res.status(500).json({ error: '获取交易记录失败' });
  }
});

// Update payment plan (admin only)
router.put('/admin/payment-plans/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const planId = req.params.id;
    const updates = req.body;
    const plan = await paymentService.updatePaymentPlan(planId, updates);
    res.json({ success: true, message: '套餐更新成功', plan });
  } catch (error) {
    console.error('更新套餐错误:', error);
    res.status(400).json({ error: error.message });
  }
});

// Export users to Excel (admin only)
router.get('/admin/export-users', authenticate, requireAdmin, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const db = require('../db/database');

    // Get all users
    const usersResult = await db.query(`
      SELECT id, email, username, phone, wechat, other_contact, balance, is_admin, 
             email_verified, created_at, last_login_at
      FROM users
      ORDER BY created_at DESC
    `);

    // Get transaction summary for each user
    const transactionsResult = await db.query(`
      SELECT user_id, 
             SUM(CASE WHEN type = 'recharge' THEN amount ELSE 0 END) as total_recharge,
             SUM(CASE WHEN type = 'usage' THEN ABS(amount) ELSE 0 END) as total_usage,
             COUNT(*) as transaction_count
      FROM transactions
      GROUP BY user_id
    `);

    const transactionMap = {};
    transactionsResult.rows.forEach(row => {
      transactionMap[row.user_id] = row;
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('用户信息');

    // Set columns
    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '邮箱', key: 'email', width: 30 },
      { header: '用户名', key: 'username', width: 20 },
      { header: '手机', key: 'phone', width: 15 },
      { header: '微信', key: 'wechat', width: 20 },
      { header: '其他联系方式', key: 'other_contact', width: 25 },
      { header: '当前余额', key: 'balance', width: 12 },
      { header: '总充值', key: 'total_recharge', width: 12 },
      { header: '总消费', key: 'total_usage', width: 12 },
      { header: '交易次数', key: 'transaction_count', width: 12 },
      { header: '是否管理员', key: 'is_admin', width: 12 },
      { header: '邮箱已验证', key: 'email_verified', width: 12 },
      { header: '注册时间', key: 'created_at', width: 20 },
      { header: '最后登录', key: 'last_login_at', width: 20 }
    ];

    // Add data
    usersResult.rows.forEach(user => {
      const trans = transactionMap[user.id] || {};
      sheet.addRow({
        id: user.id,
        email: user.email,
        username: user.username,
        phone: user.phone || '',
        wechat: user.wechat || '',
        other_contact: user.other_contact || '',
        balance: parseFloat(user.balance),
        total_recharge: parseFloat(trans.total_recharge || 0),
        total_usage: parseFloat(trans.total_usage || 0),
        transaction_count: parseInt(trans.transaction_count || 0),
        is_admin: user.is_admin ? '是' : '否',
        email_verified: user.email_verified ? '是' : '否',
        created_at: user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '',
        last_login_at: user.last_login_at ? new Date(user.last_login_at).toLocaleString('zh-CN') : ''
      });
    });

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=users_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('导出用户错误:', error);
    res.status(500).json({ error: '导出用户失败' });
  }
});

// Create new user (admin only)
router.post('/admin/create-user', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, username, password, balance, phone, isAdmin } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: '邮箱、用户名和密码为必填项' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: '密码至少需要8位字符' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // Check if email already exists
    const db = require('../db/database');
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const query = `
      INSERT INTO users (email, username, password, balance, phone, is_admin, is_active, email_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, true, NOW(), NOW())
      RETURNING id, email, username, balance, phone, is_admin, is_active, created_at
    `;
    
    const result = await db.query(query, [
      email,
      username,
      hashedPassword,
      balance || 0,
      phone || null,
      isAdmin || false
    ]);

    const newUser = result.rows[0];

    // Send notification
    const notificationService = require('../services/notification');
    try {
      await notificationService.sendNotification({
        type: 'admin_create_user',
        data: {
          email: newUser.email,
          username: newUser.username,
          balance: newUser.balance,
          isAdmin: newUser.is_admin,
          createdBy: req.user.username
        }
      });
    } catch (notifError) {
      console.error('发送通知失败:', notifError);
    }

    res.json({
      success: true,
      message: '用户创建成功',
      user: newUser
    });
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

module.exports = router;
