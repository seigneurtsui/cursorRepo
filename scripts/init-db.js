// scripts/init-db.js - Database initialization script
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'video_chapters',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || ''
});

const initializeDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database initialization...');

    // Create videos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(500) NOT NULL,
        original_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_size BIGINT,
        duration NUMERIC(10, 2),
        mime_type VARCHAR(100),
        transcript TEXT,
        status VARCHAR(50) DEFAULT 'uploaded',
        upload_started_at TIMESTAMP DEFAULT NOW(),
        upload_completed_at TIMESTAMP,
        processing_started_at TIMESTAMP,
        processing_completed_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created table: videos');

    // Create chapters table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
        chapter_index INTEGER NOT NULL,
        start_time NUMERIC(10, 2) NOT NULL,
        end_time NUMERIC(10, 2),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        transcript TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(video_id, chapter_index)
      );
    `);
    console.log('✅ Created table: chapters');

    // Create processing_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS processing_logs (
        id SERIAL PRIMARY KEY,
        video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
        stage VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        message TEXT,
        progress NUMERIC(5, 2) DEFAULT 0,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        error_details TEXT
      );
    `);
    console.log('✅ Created table: processing_logs');

    // Create users table (会员系统)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        wechat VARCHAR(100),
        other_contact TEXT,
        notes TEXT,
        other_info TEXT,
        balance NUMERIC(10, 2) DEFAULT 0.00,
        is_admin BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_login_at TIMESTAMP
      );
    `);
    console.log('✅ Created table: users');

    // Create email_verifications table (邮箱验证码)
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created table: email_verifications');

    // Create payment_plans table (充值套餐)
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        credits INTEGER,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created table: payment_plans');

    // Create transactions table (交易记录)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        balance_before NUMERIC(10, 2),
        balance_after NUMERIC(10, 2),
        payment_method VARCHAR(50),
        payment_plan_id INTEGER REFERENCES payment_plans(id),
        status VARCHAR(50) DEFAULT 'pending',
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created table: transactions');

    // Create usage_logs table (使用记录 - 用于扣费)
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        cost NUMERIC(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Created table: usage_logs');

    // Insert default payment plans
    await client.query(`
      INSERT INTO payment_plans (name, type, price, credits, description) 
      VALUES 
        ('按次付费', 'per_use', 5.00, 1, '单次视频处理，5元/次'),
        ('月度套餐', 'monthly', 50.00, NULL, '月度无限次使用，50元/月'),
        ('年度套餐', 'yearly', 300.00, NULL, '年度无限次使用，300元/年')
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Inserted default payment plans');

    // Create default admin user (password: admin123456)
    // Password hash generated with bcrypt.hash('admin123456', 10)
    await client.query(`
      INSERT INTO users (email, username, password_hash, is_admin, is_active, email_verified)
      VALUES ('admin@example.com', 'admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, TRUE, TRUE)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Created default admin user (email: admin@example.com, password: admin123456)');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
      CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chapters_video_id ON chapters(video_id);
      CREATE INDEX IF NOT EXISTS idx_chapters_start_time ON chapters(start_time);
      CREATE INDEX IF NOT EXISTS idx_processing_logs_video_id ON processing_logs(video_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
    `);
    console.log('✅ Created indexes');

    // Create updated_at trigger function
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
      DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
      CREATE TRIGGER update_videos_updated_at 
        BEFORE UPDATE ON videos 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_payment_plans_updated_at ON payment_plans;
      CREATE TRIGGER update_payment_plans_updated_at 
        BEFORE UPDATE ON payment_plans 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Created triggers');

    console.log('🎉 Database initialization completed successfully!');

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
