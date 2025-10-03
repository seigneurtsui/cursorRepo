// services/captcha.js - Captcha service
const svgCaptcha = require('svg-captcha');

class CaptchaService {
  constructor() {
    // 使用 Map 存储验证码（生产环境建议用 Redis）
    this.sessions = new Map();
    
    // 定期清理过期验证码（每10分钟）
    setInterval(() => {
      this.cleanExpired();
    }, 10 * 60 * 1000);
  }

  // 生成验证码
  generate(sessionId) {
    const captcha = svgCaptcha.create({
      size: 4,           // 验证码长度
      noise: 2,          // 干扰线条数
      color: true,       // 彩色验证码
      background: '#f0f0f0',
      width: 150,
      height: 50,
      fontSize: 50,
      ignoreChars: '0oO1ilI' // 排除容易混淆的字符
    });

    // 存储验证码（5分钟有效）
    this.sessions.set(sessionId, {
      text: captcha.text.toLowerCase(),
      expires: Date.now() + 5 * 60 * 1000
    });

    console.log(`🔢 Generated captcha for session ${sessionId}: ${captcha.text}`);

    return {
      svg: captcha.data,
      sessionId: sessionId
    };
  }

  // 验证验证码
  verify(sessionId, userInput) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.log(`❌ Captcha session not found: ${sessionId}`);
      return { valid: false, message: '验证码已过期，请刷新' };
    }

    if (Date.now() > session.expires) {
      this.sessions.delete(sessionId);
      console.log(`❌ Captcha expired for session: ${sessionId}`);
      return { valid: false, message: '验证码已过期，请刷新' };
    }

    const isValid = session.text === userInput.toLowerCase().trim();
    
    if (isValid) {
      // 验证成功后删除，防止重复使用
      this.sessions.delete(sessionId);
      console.log(`✅ Captcha verified for session: ${sessionId}`);
    } else {
      console.log(`❌ Captcha verification failed for session: ${sessionId}`);
    }

    return {
      valid: isValid,
      message: isValid ? '验证码正确' : '验证码错误，请重新输入'
    };
  }

  // 刷新验证码（生成新的）
  refresh(sessionId) {
    // 删除旧的
    this.sessions.delete(sessionId);
    // 生成新的
    return this.generate(sessionId);
  }

  // 清理过期验证码
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expires) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired captcha sessions`);
    }
  }

  // 获取统计信息
  getStats() {
    return {
      activeSessions: this.sessions.size,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}

module.exports = new CaptchaService();
