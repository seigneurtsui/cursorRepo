// services/auth.js - Authentication service
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthService {
  // Hash password
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // Compare password
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  // Generate JWT token
  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.is_admin
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // Generate verification code
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Create verification code
  async createVerificationCode(email) {
    const code = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const query = `
      INSERT INTO email_verifications (email, code, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    
    const result = await db.query(query, [email, code, expiresAt]);
    return result.rows[0];
  }

  // Verify code
  async verifyCode(email, code) {
    const query = `
      SELECT * FROM email_verifications 
      WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    
    const result = await db.query(query, [email, code]);
    
    if (result.rows.length === 0) {
      return { valid: false, message: '验证码无效或已过期' };
    }

    // Mark as used
    await db.query(
      'UPDATE email_verifications SET used = TRUE WHERE id = $1',
      [result.rows[0].id]
    );

    return { valid: true, message: '验证成功' };
  }

  // Register user
  async register(userData) {
    const { email, username, password, phone, wechat, other_contact, notes, other_info, verificationCode } = userData;

    // Verify code
    const codeVerification = await this.verifyCode(email, verificationCode);
    if (!codeVerification.valid) {
      throw new Error(codeVerification.message);
    }

    // Check if user exists
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new Error('该邮箱已被注册');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const query = `
      INSERT INTO users (email, username, password_hash, phone, wechat, other_contact, notes, other_info, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING id, email, username, phone, wechat, balance, created_at;
    `;

    const result = await db.query(query, [
      email,
      username,
      passwordHash,
      phone || null,
      wechat || null,
      other_contact || null,
      notes || null,
      other_info || null
    ]);

    return result.rows[0];
  }

  // Login
  async login(email, password) {
    // Find user
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = TRUE';
    const result = await db.query(query, [email]);

    if (result.rows.length === 0) {
      throw new Error('邮箱或密码错误');
    }

    const user = result.rows[0];

    // Check password
    const isValidPassword = await this.comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('邮箱或密码错误');
    }

    // Update last login
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Generate token
    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        balance: parseFloat(user.balance),
        is_admin: user.is_admin,  // Use underscore for consistency
        isAdmin: user.is_admin,   // Keep for backward compatibility
        phone: user.phone,
        wechat: user.wechat
      }
    };
  }

  // Get user by ID
  async getUserById(userId) {
    const query = 'SELECT id, email, username, phone, wechat, other_contact, notes, other_info, balance, is_admin, created_at, last_login_at FROM users WHERE id = $1 AND is_active = TRUE';
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  // Update user info
  async updateUser(userId, updates) {
    const allowedFields = ['username', 'phone', 'wechat', 'other_contact', 'notes', 'other_info'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    values.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING id, email, username, phone, wechat, balance`;
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Change password
  async changePassword(userId, oldPassword, newPassword) {
    const user = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      throw new Error('用户不存在');
    }

    const isValid = await this.comparePassword(oldPassword, user.rows[0].password_hash);
    if (!isValid) {
      throw new Error('原密码错误');
    }

    const newHash = await this.hashPassword(newPassword);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    return { message: '密码修改成功' };
  }

  // Change email (with verification)
  async changeEmail(userId, newEmail, verificationCode) {
    // Verify code
    const codeVerification = await this.verifyCode(newEmail, verificationCode);
    if (!codeVerification.valid) {
      throw new Error(codeVerification.message);
    }

    // Check if email is already taken
    const existing = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [newEmail, userId]);
    if (existing.rows.length > 0) {
      throw new Error('该邮箱已被其他用户使用');
    }

    await db.query('UPDATE users SET email = $1, email_verified = TRUE WHERE id = $2', [newEmail, userId]);
    return { message: '邮箱修改成功' };
  }
}

module.exports = new AuthService();
