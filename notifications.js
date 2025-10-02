// notifications.js - Multi-channel notification system
const axios = require('axios');
require('dotenv').config();

class NotificationSystem {
  constructor() {
    // Notification credentials from environment variables
    this.config = {
      wxpusher: {
        token: process.env.WXPUSHER_TOKEN || "AT_byimkOmi7B0xzvvXVYIAj0YkMrwDvV", // Fallback for demo
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

  // Format upload time
  formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('zh-CN');
  }

  // Calculate upload duration
  calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 'N/A';
    const duration = Math.round((new Date(endTime) - new Date(startTime)) / 1000);
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.round(duration / 60)}分钟`;
    return `${Math.round(duration / 3600)}小时`;
  }

  // Send notification for single video upload completion
  async sendVideoUploadNotification(videoRecord) {
    const isSuccess = videoRecord.status === 'completed';
    const statusIcon = isSuccess ? "✅" : "❌";
    const statusText = isSuccess ? "成功" : "失败";
    
    const title = `YouTube视频上传${statusText} - ${videoRecord.title}`;
    
    const duration = this.calculateDuration(videoRecord.upload_started_at, videoRecord.upload_completed_at);
    
    let content = `### YouTube视频上传报告 (macOS)
    
**视频标题**: ${videoRecord.title}
**文件名**: ${videoRecord.video_file}
**上传状态**: ${statusIcon} ${statusText}
**文件大小**: ${this.formatFileSize(videoRecord.file_size)}
**上传进度**: ${videoRecord.progress}%
**开始时间**: ${this.formatTime(videoRecord.upload_started_at)}
**完成时间**: ${this.formatTime(videoRecord.upload_completed_at)}
**耗时**: ${duration}`;

    if (isSuccess && videoRecord.youtube_id) {
      content += `\n**YouTube链接**: https://www.youtube.com/watch?v=${videoRecord.youtube_id}`;
    }

    if (!isSuccess && videoRecord.error_message) {
      content += `\n**错误信息**: ${videoRecord.error_message}`;
    }

    content += `\n\n---\n*由YouTube批量上传器自动发送*`;

    const htmlContent = content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    await this.sendNotifications(title, content, htmlContent);
  }

  // Send batch upload completion notification
  async sendBatchUploadNotification(results, totalTime) {
    const successCount = results.filter(r => r.status === 'completed').length;
    const errorCount = results.length - successCount;
    
    const title = `YouTube批量上传完成 - 成功: ${successCount}, 失败: ${errorCount}`;
    
    const summaryList = results.map(record => {
      const statusIcon = record.status === 'completed' ? "✅" : "❌";
      const duration = this.calculateDuration(record.upload_started_at, record.upload_completed_at);
      return `${statusIcon} ${record.title || record.video_file} (${record.status}) (${duration}) (${this.formatFileSize(record.file_size)})`;
    });

    const content = `### YouTube批量上传任务报告 (macOS)

- **总计文件**: ${results.length}
- **成功**: ${successCount}
- **失败**: ${errorCount}
- **总耗时**: ${totalTime.toFixed(2)} 秒

---
**上传详情:**
${summaryList.join('\n')}

---
*由YouTube批量上传器自动发送*`;

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

  // Test all notification channels
  async testAllNotifications() {
    const title = "YouTube上传器通知测试";
    const content = `### 通知系统测试

这是一条测试消息，用于验证通知系统是否正常工作。

**测试时间**: ${new Date().toLocaleString('zh-CN')}
**系统**: YouTube批量上传器

---
*测试消息由系统自动发送*`;

    const htmlContent = content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    return await this.sendNotifications(title, content, htmlContent);
  }
}

module.exports = NotificationSystem;