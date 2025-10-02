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
}

module.exports = NotificationService;
