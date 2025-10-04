// services/notification.js - Multi-channel notification system for video chapter generation
const axios = require('axios');
require('dotenv').config();

class NotificationService {
  constructor() {
    // Notification credentials from environment variables
    this.config = {
      wxpusher: {
        token: process.env.WXPUSHER_TOKEN || "AT_byimkOmi7B0xzvvXVYIAj0YkMrwDvV",
        uid: process.env.WXPUSHER_UID || "UID_FD24Cus5GO5CKQAcxkw8gP2ZRu"
      },
      pushplus: {
        token: process.env.PUSHPLUS_TOKEN || "f76bf4e544909c86fdae45e9db76ce"
      },
      resend: {
        apiKey: process.env.RESEND_API_KEY || "re_KwMt5gij_5c7XvcqNjmAhV3cy1DAvfj",
        toEmail: process.env.RESEND_TO_EMAIL || "seigneurtsui@goallez.dpdns.org"
      },
      telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || "8371556252:AAHUpvXA_QYDsNbmMWiqG2SOKTKzzOY_Y",
        chatId: process.env.TELEGRAM_CHAT_ID || "82048152"
      }
    };
  }

  // Format file size for display
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Format time
  formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('zh-CN');
  }

  // Calculate duration
  calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 'N/A';
    const duration = Math.round((new Date(endTime) - new Date(startTime)) / 1000);
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.round(duration / 60)}分钟`;
    return `${Math.round(duration / 3600)}小时`;
  }

  // Format video duration
  formatVideoDuration(seconds) {
    if (!seconds) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}小时${m}分钟${s}秒`;
    } else if (m > 0) {
      return `${m}分钟${s}秒`;
    } else {
      return `${s}秒`;
    }
  }

  // Send notification for single video chapter generation completion
  async sendVideoChapterNotification(videoRecord, chapters) {
    const isSuccess = videoRecord.status === 'completed';
    const statusIcon = isSuccess ? "✅" : "❌";
    const statusText = isSuccess ? "成功" : "失败";
    
    const title = `视频章节生成${statusText} - ${videoRecord.original_name}`;
    
    const duration = this.calculateDuration(videoRecord.processing_started_at, videoRecord.processing_completed_at);
    const chapterCount = chapters ? chapters.length : 0;
    
    let content = `### 视频章节生成报告

**视频文件**: ${videoRecord.original_name}
**生成状态**: ${statusIcon} ${statusText}
**文件大小**: ${this.formatFileSize(videoRecord.file_size)}
**视频时长**: ${this.formatVideoDuration(videoRecord.duration)}
**章节数量**: ${chapterCount}
**开始时间**: ${this.formatTime(videoRecord.processing_started_at)}
**完成时间**: ${this.formatTime(videoRecord.processing_completed_at)}
**处理耗时**: ${duration}`;

    if (isSuccess && chapters && chapters.length > 0) {
      content += `\n\n**章节列表**:\n`;
      chapters.slice(0, 10).forEach((ch, idx) => {
        content += `${idx + 1}. [${this.formatVideoDuration(ch.start_time)}] ${ch.title}\n`;
      });
      if (chapters.length > 10) {
        content += `... 还有 ${chapters.length - 10} 个章节\n`;
      }
    }

    if (!isSuccess && videoRecord.error_message) {
      content += `\n**错误信息**: ${videoRecord.error_message}`;
    }

    content += `\n\n---\n*由视频章节生成器自动发送*`;

    const htmlContent = content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    await this.sendNotifications(title, content, htmlContent);
  }

  // Send batch processing completion notification
  async sendBatchProcessingNotification(results, totalTime) {
    const successCount = results.filter(r => r.status === 'completed').length;
    const errorCount = results.length - successCount;
    
    const title = `视频章节批量生成完成 - 成功: ${successCount}, 失败: ${errorCount}`;
    
    const summaryList = results.map((record, idx) => {
      const statusIcon = record.status === 'completed' ? "✅" : "❌";
      const duration = this.calculateDuration(record.processing_started_at, record.processing_completed_at);
      const chapterCount = record.chapterCount || 0;
      return `${idx + 1}. ${statusIcon} ${record.original_name} - ${chapterCount}章节 - ${duration}`;
    });

    const totalChapters = results.reduce((sum, r) => sum + (r.chapterCount || 0), 0);

    const content = `### 视频章节批量生成报告

- **总计视频**: ${results.length}
- **成功**: ${successCount}
- **失败**: ${errorCount}
- **总章节数**: ${totalChapters}
- **总耗时**: ${totalTime.toFixed(2)} 秒

---
**处理详情:**
${summaryList.join('\n')}

---
*由视频章节生成器自动发送*`;

    const htmlContent = content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    await this.sendNotifications(title, content, htmlContent);
  }

  // Core notification sending function
  async sendNotifications(title, content, htmlContent) {
    console.log('📢 开始发送通知...');

    const notifications = [
      {
        name: 'WxPusher',
        url: 'https://wxpusher.zjiecode.com/api/send/message',
        headers: { 'Content-Type': 'application/json' },
        data: {
          appToken: this.config.wxpusher.token,
          content: content,
          summary: title,
          contentType: 3, // Markdown
          uids: [this.config.wxpusher.uid],
        },
        enabled: this.config.wxpusher.token && this.config.wxpusher.uid
      },
      {
        name: 'PushPlus',
        url: 'http://www.pushplus.plus/send',
        headers: { 'Content-Type': 'application/json' },
        data: {
          token: this.config.pushplus.token,
          title: title,
          content: content,
          template: "markdown",
        },
        enabled: this.config.pushplus.token
      },
      {
        name: 'Resend Email',
        url: 'https://api.resend.com/emails',
        headers: {
          'Authorization': `Bearer ${this.config.resend.apiKey}`,
          'Content-Type': 'application/json',
        },
        data: {
          from: 'onboarding@resend.dev',
          to: this.config.resend.toEmail,
          subject: title,
          html: htmlContent,
        },
        enabled: this.config.resend.apiKey && this.config.resend.toEmail
      },
      {
        name: 'Telegram',
        url: `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`,
        headers: { 'Content-Type': 'application/json' },
        data: {
          chat_id: this.config.telegram.chatId,
          text: content.replace(/### /g, '').replace(/\*\*(.*?)\*\*/g, '$1'),
          parse_mode: 'Markdown'
        },
        enabled: this.config.telegram.botToken && this.config.telegram.chatId
      },
    ];

    const promises = notifications.map(async (notification) => {
      if (!notification.enabled) {
        console.log(`🟡 跳过 ${notification.name}，配置信息不完整。`);
        return { name: notification.name, status: 'skipped' };
      }

      try {
        const response = await axios.post(
          notification.url,
          notification.data,
          {
            headers: notification.headers,
            timeout: 10000 // 10 seconds timeout
          }
        );

        console.log(`✅ ${notification.name} 通知发送成功, 状态码: ${response.status}`);
        return { name: notification.name, status: 'success', statusCode: response.status };
      } catch (error) {
        console.error(`❌ 发送 ${notification.name} 通知失败:`, error.message);
        return { name: notification.name, status: 'failed', error: error.message };
      }
    });

    const results = await Promise.all(promises);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    
    console.log(`📊 通知发送完成: 成功 ${successCount}, 失败 ${failedCount}, 跳过 ${skippedCount}`);
    return results;
  }

  // ==================== NEW: Video Processing Notifications ====================
  
  /**
   * Send notification when member starts video processing (to admin)
   * @param {Object} user - User who started processing
   * @param {Object} video - Video being processed
   */
  async sendProcessingStartNotification(user, video) {
    const title = `🎬 视频处理开始 - ${user.username}`;
    
    const content = `### 新的视频处理任务

**会员信息**:
- 用户名: ${user.username}
- 邮箱: ${user.email}
- 会员ID: ${user.id}

**视频信息**:
- 文件名: ${video.original_name}
- 文件大小: ${this.formatFileSize(video.file_size)}
- 视频时长: ${this.formatVideoDuration(video.duration)}
- 上传时间: ${this.formatTime(video.created_at)}
- 开始处理: ${this.formatTime(new Date())}

**系统状态**: 正在处理中...`;

    const results = await this.sendAll(title, content);
    console.log('📢 Processing start notification sent to admin:', results);
    return results;
  }

  /**
   * Send notification when video processing fails (to admin)
   * @param {Object} user - User who owns the video
   * @param {Object} video - Video that failed
   */
  async sendProcessingFailureNotification(user, video) {
    const title = `❌ 视频处理失败 - ${user.username}`;
    
    const duration = this.calculateDuration(video.processing_started_at, video.processing_completed_at || new Date());
    
    const content = `### 视频处理失败报告

**会员信息**:
- 用户名: ${user.username}
- 邮箱: ${user.email}
- 会员ID: ${user.id}

**视频信息**:
- 文件名: ${video.original_name}
- 文件大小: ${this.formatFileSize(video.file_size)}
- 视频时长: ${this.formatVideoDuration(video.duration)}

**处理信息**:
- 开始时间: ${this.formatTime(video.processing_started_at)}
- 失败时间: ${this.formatTime(new Date())}
- 处理耗时: ${duration}

**错误信息**: ${video.error_message || '未知错误'}

⚠️ 请检查系统日志以获取详细信息`;

    const results = await this.sendAll(title, content);
    console.log('📢 Processing failure notification sent to admin:', results);
    return results;
  }

  /**
   * Send notification when video processing succeeds (to member via email)
   * @param {Object} user - User who owns the video
   * @param {Object} video - Video that succeeded
   * @param {Array} chapters - Generated chapters
   */
  async sendProcessingSuccessNotification(user, video, chapters) {
    const emailService = require('./email');
    
    const duration = this.calculateDuration(video.processing_started_at, video.processing_completed_at);
    const chapterCount = chapters ? chapters.length : 0;
    
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px; }
    .info-item { padding: 10px; border-bottom: 1px solid #dee2e6; }
    .info-item:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #667eea; }
    .chapter { background: white; padding: 10px; margin: 5px 0; border-left: 3px solid #667eea; }
    .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ 视频处理完成</h1>
      <p>您的视频已成功生成章节</p>
    </div>
    
    <div class="content">
      <h2>视频信息</h2>
      <div class="info-item">
        <span class="label">文件名:</span> ${video.original_name}
      </div>
      <div class="info-item">
        <span class="label">文件大小:</span> ${this.formatFileSize(video.file_size)}
      </div>
      <div class="info-item">
        <span class="label">视频时长:</span> ${this.formatVideoDuration(video.duration)}
      </div>
      <div class="info-item">
        <span class="label">章节数量:</span> ${chapterCount} 个
      </div>
      <div class="info-item">
        <span class="label">处理耗时:</span> ${duration}
      </div>
    </div>`;

    if (chapters && chapters.length > 0) {
      htmlContent += `
    <div class="content">
      <h2>章节列表</h2>`;
      
      chapters.slice(0, 10).forEach((ch, idx) => {
        htmlContent += `
      <div class="chapter">
        <strong>${idx + 1}. ${ch.title}</strong><br>
        <small>⏱ ${this.formatVideoDuration(ch.start_time)} - ${this.formatVideoDuration(ch.end_time)}</small><br>
        <small>${ch.description || ''}</small>
      </div>`;
      });
      
      if (chapters.length > 10) {
        htmlContent += `<p>... 还有 ${chapters.length - 10} 个章节</p>`;
      }
      
      htmlContent += `</div>`;
    }

    htmlContent += `
    <div class="footer">
      <p>登录系统查看完整内容: <a href="${process.env.BASE_URL || 'http://localhost:8051'}/public/index.html">视频章节生成器</a></p>
      <p>此邮件由系统自动发送，请勿回复</p>
    </div>
  </div>
</body>
</html>`;

    try {
      await emailService.sendEmail(
        user.email,
        '✅ 视频章节生成完成',
        htmlContent
      );
      console.log(`📧 Success notification sent to member: ${user.email}`);
      return { success: true, email: user.email };
    } catch (error) {
      console.error('Failed to send success notification email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to user using their configured channels
   * @param {Object} user - User object with notification config
   * @param {String} title - Notification title
   * @param {String} content - Notification content
   */
  async sendToUser(user, title, content) {
    if (!user.notification_enabled) {
      console.log(`⚠️ Notifications disabled for user: ${user.email}`);
      return { success: false, reason: 'notifications_disabled' };
    }

    const results = {};
    const db = require('../db/database');

    // Get enabled channels from admin settings
    const enabledChannels = await db.query(`
      SELECT channel FROM notification_channel_settings WHERE enabled = TRUE
    `);
    const allowedChannels = enabledChannels.rows.map(r => r.channel);

    // Send to each configured channel
    if (user.wxpusher_uid && allowedChannels.includes('wxpusher')) {
      results.wxpusher = await this.sendWxPusher(title, content, user.wxpusher_uid);
    }

    if (user.pushplus_token && allowedChannels.includes('pushplus')) {
      results.pushplus = await this.sendPushPlus(title, content, user.pushplus_token);
    }

    if (user.resend_email && allowedChannels.includes('resend')) {
      results.resend = await this.sendResendEmail(title, content, user.resend_email);
    }

    if (user.telegram_chat_id && allowedChannels.includes('telegram')) {
      results.telegram = await this.sendTelegram(title, content, user.telegram_chat_id);
    }

    console.log(`📢 Sent notifications to user ${user.email}:`, results);
    return results;
  }
}

module.exports = NotificationService;
