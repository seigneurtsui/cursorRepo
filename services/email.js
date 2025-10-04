// services/email.js - Email service using nodemailer with QQ Mail
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // QQ邮箱配置
    this.config = {
      host: 'smtp.qq.com',
      port: 465,
      secure: true, // 使用 SSL
      auth: {
        user: process.env.QQ_EMAIL_USER || '2826824650@qq.com',
        pass: process.env.QQ_EMAIL_PASSWORD || 'bmuvxqexvqqoddhe' // QQ邮箱授权码
      }
    };

    this.transporter = null;
    this.initialize();
  }

  initialize() {
    try {
      this.transporter = nodemailer.createTransport(this.config);
      console.log('✅ QQ Email service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  // 发送邮件
  async sendEmail({ to, subject, text, html }) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    const mailOptions = {
      from: `"视频章节生成器" <${this.config.auth.user}>`,
      to: to,
      subject: subject,
      text: text,
      html: html || text
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  // 发送验证码邮件
  async sendVerificationCode(email, code) {
    const subject = '视频章节生成器 - 验证码';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">🎬 视频章节生成器</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">您的验证码是：</h3>
          <div style="font-size: 32px; font-weight: bold; color: #007bff; text-align: center; padding: 20px; background: white; border-radius: 8px; letter-spacing: 8px;">
            ${code}
          </div>
          <p style="color: #666; margin-top: 20px;">
            该验证码将在 <strong>10分钟</strong> 后过期。
          </p>
          <p style="color: #999; font-size: 14px; margin-top: 20px;">
            如果这不是您的操作，请忽略此邮件。
          </p>
        </div>
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>此邮件由系统自动发送，请勿回复</p>
        </div>
      </div>
    `;

    const text = `您的验证码是: ${code}\n\n该验证码将在10分钟后过期。\n\n如果这不是您的操作，请忽略此邮件。`;

    return await this.sendEmail({
      to: email,
      subject: subject,
      text: text,
      html: html
    });
  }

  // 测试邮件服务
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
