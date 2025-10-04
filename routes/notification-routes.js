// routes/notification-routes.js - Notification configuration and management routes

const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const db = require('../db/database');
const ExcelJS = require('exceljs');

// ==================== User Notification Configuration ====================

/**
 * GET /api/notifications/user/config
 * Get current user's notification configuration
 */
router.get('/user/config', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        wxpusher_uid, 
        pushplus_token, 
        resend_email, 
        telegram_chat_id, 
        notification_enabled
      FROM users 
      WHERE id = $1
    `, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('获取通知配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/user/config
 * Update current user's notification configuration
 */
router.post('/user/config', authenticate, async (req, res) => {
  const { wxpusher_uid, pushplus_token, resend_email, telegram_chat_id, notification_enabled } = req.body;
  
  try {
    await db.query(`
      UPDATE users SET
        wxpusher_uid = $1,
        pushplus_token = $2,
        resend_email = $3,
        telegram_chat_id = $4,
        notification_enabled = $5,
        updated_at = NOW()
      WHERE id = $6
    `, [wxpusher_uid, pushplus_token, resend_email, telegram_chat_id, notification_enabled, req.user.id]);
    
    console.log(`✅ User ${req.user.email} updated notification config`);
    res.json({ success: true, message: '通知配置已更新' });
  } catch (error) {
    console.error('更新通知配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Channel Settings Management ====================

/**
 * GET /api/notifications/channels
 * Get all notification channel settings
 */
router.get('/channels', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM notification_channel_settings 
      ORDER BY channel
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('获取渠道设置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/channels/:channel
 * Admin: Update channel enable/disable status
 */
router.post('/channels/:channel', requireAdmin, async (req, res) => {
  const { channel } = req.params;
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled 必须是布尔值' });
  }
  
  try {
    const result = await db.query(`
      UPDATE notification_channel_settings 
      SET enabled = $1, updated_at = NOW()
      WHERE channel = $2
      RETURNING *
    `, [enabled, channel]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '渠道不存在' });
    }
    
    console.log(`✅ Admin updated channel ${channel} to ${enabled ? 'enabled' : 'disabled'}`);
    res.json({ success: true, channel: result.rows[0] });
  } catch (error) {
    console.error('更新渠道设置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Notification Logs ====================

/**
 * GET /api/notifications/logs
 * Get notification logs (admin: all logs, user: own logs)
 */
router.get('/logs', authenticate, async (req, res) => {
  try {
    let query;
    let params;
    
    if (req.user.is_admin) {
      // Admin can see all logs
      query = `
        SELECT 
          nl.*,
          u.username,
          u.email
        FROM notification_logs nl
        LEFT JOIN users u ON nl.user_id = u.id
        ORDER BY nl.sent_at DESC
        LIMIT 1000
      `;
      params = [];
    } else {
      // User can only see own logs
      query = `
        SELECT * FROM notification_logs
        WHERE user_id = $1
        ORDER BY sent_at DESC
        LIMIT 100
      `;
      params = [req.user.id];
    }
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('获取通知记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/export-logs
 * Admin: Export all notification logs to Excel
 */
router.get('/export-logs', requireAdmin, async (req, res) => {
  try {
    // Get all notification logs with user information
    const result = await db.query(`
      SELECT 
        nl.id,
        nl.user_id,
        u.username,
        u.email,
        nl.notification_type,
        nl.channel,
        nl.title,
        nl.content,
        nl.status,
        nl.error_message,
        nl.sent_at
      FROM notification_logs nl
      LEFT JOIN users u ON nl.user_id = u.id
      ORDER BY nl.sent_at DESC
    `);
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('通知记录');
    
    // Define columns
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '用户ID', key: 'user_id', width: 10 },
      { header: '用户名', key: 'username', width: 20 },
      { header: '邮箱', key: 'email', width: 30 },
      { header: '通知类型', key: 'notification_type', width: 20 },
      { header: '发送渠道', key: 'channel', width: 15 },
      { header: '标题', key: 'title', width: 40 },
      { header: '内容摘要', key: 'content_preview', width: 60 },
      { header: '状态', key: 'status', width: 15 },
      { header: '错误信息', key: 'error_message', width: 40 },
      { header: '发送时间', key: 'sent_at', width: 20 }
    ];
    
    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Add data rows
    result.rows.forEach(log => {
      worksheet.addRow({
        id: log.id,
        user_id: log.user_id,
        username: log.username || 'N/A',
        email: log.email || 'N/A',
        notification_type: log.notification_type,
        channel: log.channel || 'all',
        title: log.title,
        content_preview: log.content ? (log.content.substring(0, 100) + '...') : '',
        status: log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : '待处理',
        error_message: log.error_message || '',
        sent_at: log.sent_at ? new Date(log.sent_at).toLocaleString('zh-CN') : ''
      });
    });
    
    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: 'K1'
    };
    
    // Set response headers
    const filename = `notification_logs_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    
    console.log(`✅ Admin exported notification logs: ${result.rows.length} records`);
  } catch (error) {
    console.error('导出通知记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/test
 * Test notification configuration
 */
router.post('/test', authenticate, async (req, res) => {
  const { channel } = req.body;
  
  try {
    const notificationService = require('../services/notification');
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    
    const title = '🧪 通知测试';
    const content = `这是一条测试通知，发送给 ${user.username}`;
    
    let result;
    if (channel === 'all') {
      result = await notificationService.sendToUser(user, title, content);
    } else {
      // Test specific channel
      switch (channel) {
        case 'wxpusher':
          if (user.wxpusher_uid) {
            result = { wxpusher: await notificationService.sendWxPusher(title, content, user.wxpusher_uid) };
          } else {
            return res.status(400).json({ error: 'WxPusher UID 未配置' });
          }
          break;
        case 'pushplus':
          if (user.pushplus_token) {
            result = { pushplus: await notificationService.sendPushPlus(title, content, user.pushplus_token) };
          } else {
            return res.status(400).json({ error: 'PushPlus Token 未配置' });
          }
          break;
        case 'resend':
          if (user.resend_email) {
            result = { resend: await notificationService.sendResendEmail(title, content, user.resend_email) };
          } else {
            return res.status(400).json({ error: 'Resend Email 未配置' });
          }
          break;
        case 'telegram':
          if (user.telegram_chat_id) {
            result = { telegram: await notificationService.sendTelegram(title, content, user.telegram_chat_id) };
          } else {
            return res.status(400).json({ error: 'Telegram Chat ID 未配置' });
          }
          break;
        default:
          return res.status(400).json({ error: '不支持的渠道' });
      }
    }
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('测试通知失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
