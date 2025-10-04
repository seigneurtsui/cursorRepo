// scripts/migrate-complete-database.js - Complete database migration
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.DATABASE_PORT || process.env.DB_PORT || 5432,
  database: process.env.DATABASE_NAME || process.env.DB_DATABASE || 'youtube_member',
  user: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || ''
});

const migrate = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting complete database migration...\n');

    // ==================== Add missing columns to users table ====================
    console.log('📝 Checking users table...');
    
    const userColumns = [
      { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'phone', type: 'VARCHAR(50)' },
      { name: 'wechat', type: 'VARCHAR(100)' },
      { name: 'other_contact', type: 'TEXT' },
      { name: 'notes', type: 'TEXT' },
      { name: 'other_info', type: 'TEXT' },
      { name: 'referral_code', type: 'VARCHAR(20) UNIQUE' },
      { name: 'referred_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'wxpusher_token', type: 'TEXT' },
      { name: 'wxpusher_uid', type: 'TEXT' },
      { name: 'wxpusher_enabled', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'pushplus_token', type: 'TEXT' },
      { name: 'pushplus_enabled', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'resend_email', type: 'VARCHAR(255)' },
      { name: 'resend_enabled', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'telegram_bot_token', type: 'TEXT' },
      { name: 'telegram_chat_id', type: 'TEXT' },
      { name: 'telegram_enabled', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'notification_enabled', type: 'BOOLEAN DEFAULT TRUE' }
    ];

    for (const col of userColumns) {
      const check = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='users' AND column_name='${col.name}'
      `);

      if (check.rows.length === 0) {
        await client.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
        console.log(`  ✅ Added column: users.${col.name}`);
      } else {
        console.log(`  ⏭️  Column exists: users.${col.name}`);
      }
    }

    // Update existing users to be active
    await client.query(`UPDATE users SET is_active = TRUE WHERE is_active IS NULL`);

    // ==================== Create payment_plans table (renamed from recharge_plans) ====================
    console.log('\n📝 Checking payment_plans table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        credits NUMERIC(10, 2) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ Created/verified table: payment_plans');

    // Check if there are any plans
    const plansCount = await client.query('SELECT COUNT(*) FROM payment_plans');
    if (parseInt(plansCount.rows[0].count) === 0) {
      console.log('  📦 Inserting default payment plans...');
      await client.query(`
        INSERT INTO payment_plans (name, price, credits, description, sort_order) VALUES
        ('体验套餐', 10.00, 10.00, '适合新用户体验', 1),
        ('标准套餐', 100.00, 115.00, '充100送15，性价比之选', 2),
        ('进阶套餐', 300.00, 360.00, '充300送60，超值优惠', 3),
        ('专业套餐', 500.00, 625.00, '充500送125，专业用户首选', 4),
        ('企业套餐', 1000.00, 1300.00, '充1000送300，企业级服务', 5)
      `);
      console.log('  ✅ Inserted 5 default payment plans');
    }

    // ==================== Create membership_levels table ====================
    console.log('\n📝 Checking membership_levels table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS membership_levels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        min_recharge NUMERIC(10, 2) DEFAULT 0,
        discount NUMERIC(5, 2) DEFAULT 0,
        benefits TEXT,
        icon VARCHAR(50),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ Created/verified table: membership_levels');

    const levelsCount = await client.query('SELECT COUNT(*) FROM membership_levels');
    if (parseInt(levelsCount.rows[0].count) === 0) {
      console.log('  📦 Inserting default membership levels...');
      await client.query(`
        INSERT INTO membership_levels (name, min_recharge, discount, benefits, icon, sort_order) VALUES
        ('普通会员', 0, 0, '基础功能', '👤', 1),
        ('银牌会员', 100, 5, '95折优惠', '🥈', 2),
        ('金牌会员', 500, 10, '9折优惠', '🥇', 3),
        ('钻石会员', 1000, 15, '85折优惠', '💎', 4)
      `);
      console.log('  ✅ Inserted 4 default membership levels');
    }

    // ==================== Create user_coupons table ====================
    console.log('\n📝 Checking user_coupons table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_coupons (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100),
        discount_type VARCHAR(20),
        discount_value NUMERIC(10, 2),
        min_amount NUMERIC(10, 2),
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ Created/verified table: user_coupons');

    // ==================== Create referrals table ====================
    console.log('\n📝 Checking referrals table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reward_amount NUMERIC(10, 2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        rewarded_at TIMESTAMP,
        UNIQUE(referrer_id, referred_id)
      )
    `);
    console.log('  ✅ Created/verified table: referrals');

    // ==================== Create notification_channel_settings table ====================
    console.log('\n📝 Checking notification_channel_settings table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_channel_settings (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(50) UNIQUE NOT NULL,
        description VARCHAR(200),
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ Created/verified table: notification_channel_settings');

    const channelsCount = await client.query('SELECT COUNT(*) FROM notification_channel_settings');
    if (parseInt(channelsCount.rows[0].count) === 0) {
      console.log('  📦 Inserting default notification channels...');
      await client.query(`
        INSERT INTO notification_channel_settings (channel, description, enabled) VALUES
        ('wxpusher', 'WxPusher 微信推送', true),
        ('pushplus', 'PushPlus 推送加', true),
        ('resend', 'Resend 邮件服务', true),
        ('telegram', 'Telegram 机器人', true)
      `);
      console.log('  ✅ Inserted 4 default notification channels');
    }

    // ==================== Create notification_logs table ====================
    console.log('\n📝 Checking notification_logs table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        channel VARCHAR(50),
        type VARCHAR(50),
        title VARCHAR(200),
        message TEXT,
        status VARCHAR(20),
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ Created/verified table: notification_logs');

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at)
    `);
    console.log('  ✅ Created indexes on notification_logs');

    // ==================== Update transactions table if needed ====================
    console.log('\n📝 Checking transactions table...');
    
    const txColumns = [
      { name: 'plan_id', type: 'INTEGER REFERENCES payment_plans(id)' }
    ];

    for (const col of txColumns) {
      const check = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='transactions' AND column_name='${col.name}'
      `);

      if (check.rows.length === 0) {
        await client.query(`ALTER TABLE transactions ADD COLUMN ${col.name} ${col.type}`);
        console.log(`  ✅ Added column: transactions.${col.name}`);
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📊 Database Summary:');
    console.log('  ✅ users table - all columns added');
    console.log('  ✅ payment_plans table - created with default plans');
    console.log('  ✅ membership_levels table - created with default levels');
    console.log('  ✅ user_coupons table - created');
    console.log('  ✅ referrals table - created');
    console.log('  ✅ notification_channel_settings table - created with default channels');
    console.log('  ✅ notification_logs table - created with indexes');
    console.log('  ✅ transactions table - updated');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
