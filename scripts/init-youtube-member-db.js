// scripts/init-youtube-member-db.js - Database initialization for YouTube search with member system
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.DATABASE_PORT || process.env.DB_PORT || 5432,
  database: process.env.DATABASE_NAME || process.env.DB_DATABASE || 'youtube_member',
  user: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || ''
});

const initializeDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting YouTube Member System database initialization...');

    // ========== 会员系统表 ==========
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        is_admin BOOLEAN DEFAULT FALSE,
        balance NUMERIC(10, 2) DEFAULT 0.00,
        total_recharged NUMERIC(10, 2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'active',
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(255),
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_login_at TIMESTAMP
      );
    `);
    console.log('✅ Created table: users');

    // Create recharge_plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recharge_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        bonus NUMERIC(10, 2) DEFAULT 0.00,
        total_amount NUMERIC(10, 2) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created table: recharge_plans');

    // Create transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        balance_before NUMERIC(10, 2),
        balance_after NUMERIC(10, 2),
        description TEXT,
        order_id VARCHAR(100),
        payment_method VARCHAR(50),
        payment_status VARCHAR(50),
        operator_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created table: transactions');

    // Create captcha_records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS captcha_records (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(10) NOT NULL,
        type VARCHAR(50) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created table: captcha_records');

    // ========== YouTube 视频数据表 ==========
    
    // Create youtube_videos table (添加 user_id 字段)
    await client.query(`
      CREATE TABLE IF NOT EXISTS youtube_videos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        video_id VARCHAR(50) NOT NULL,
        playlist_id VARCHAR(50),
        title TEXT,
        description TEXT,
        thumbnail_url TEXT,
        published_at TIMESTAMP,
        channel_title VARCHAR(255),
        channel_id VARCHAR(50),
        view_count BIGINT DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, video_id)
      );
    `);
    console.log('✅ Created table: youtube_videos');

    // ========== 创建索引 ==========
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      
      CREATE INDEX IF NOT EXISTS idx_captcha_email ON captcha_records(email);
      CREATE INDEX IF NOT EXISTS idx_captcha_expires ON captcha_records(expires_at);
      
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_user_id ON youtube_videos(user_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_video_id ON youtube_videos(video_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel ON youtube_videos(channel_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_created_at ON youtube_videos(created_at DESC);
    `);
    console.log('✅ Created indexes');

    // ========== 创建触发器 ==========
    
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_youtube_videos_updated_at ON youtube_videos;
      CREATE TRIGGER update_youtube_videos_updated_at 
        BEFORE UPDATE ON youtube_videos 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Created triggers');

    // ========== 插入默认充值套餐 ==========
    
    const plansCheck = await client.query('SELECT COUNT(*) FROM recharge_plans');
    if (parseInt(plansCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO recharge_plans (name, amount, bonus, total_amount, description, sort_order) VALUES
        ('体验套餐', 10.00, 0.00, 10.00, '适合初次体验用户', 1),
        ('基础套餐', 50.00, 5.00, 55.00, '适合小量使用', 2),
        ('标准套餐', 100.00, 15.00, 115.00, '适合日常使用', 3),
        ('进阶套餐', 200.00, 40.00, 240.00, '适合频繁使用', 4),
        ('专业套餐', 500.00, 120.00, 620.00, '适合重度使用', 5),
        ('企业套餐', 1000.00, 300.00, 1300.00, '适合企业批量使用', 6);
      `);
      console.log('✅ Inserted default recharge plans');
    }

    // ========== 创建默认管理员账号 ==========
    
    const adminCheck = await client.query('SELECT COUNT(*) FROM users WHERE email = $1', ['admin@youtube.com']);
    if (parseInt(adminCheck.rows[0].count) === 0) {
      // 默认密码: Admin@123456 (请务必修改)
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Admin@123456', 10);
      
      await client.query(`
        INSERT INTO users (email, password_hash, username, is_admin, balance, status, email_verified)
        VALUES ($1, $2, $3, TRUE, 999999.00, 'active', TRUE)
      `, ['admin@youtube.com', hashedPassword, '系统管理员']);
      
      console.log('✅ Created default admin account');
      console.log('   📧 Email: admin@youtube.com');
      console.log('   🔑 Password: Admin@123456');
      console.log('   ⚠️  请立即登录并修改密码！');
    }

    console.log('');
    console.log('🎉 Database initialization completed successfully!');
    console.log('');
    console.log('📝 下一步操作:');
    console.log('   1. 配置 .env 文件');
    console.log('   2. 启动服务器: npm start');
    console.log('   3. 访问: http://localhost:3000');
    console.log('   4. 使用管理员账号登录并修改密码');
    console.log('');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run initialization
initializeDatabase().catch(console.error);
