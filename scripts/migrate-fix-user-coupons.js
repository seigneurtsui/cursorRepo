// scripts/migrate-fix-user-coupons.js
// 修复 user_coupons 表缺失的 coupon_id 列

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'youtube_member_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 开始修复 user_coupons 表...\n');
    
    // 检查 coupon_id 列是否存在
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_coupons' 
        AND column_name = 'coupon_id'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('📝 添加 coupon_id 列到 user_coupons 表...');
      
      // 添加 coupon_id 列
      await client.query(`
        ALTER TABLE user_coupons 
        ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id) ON DELETE CASCADE
      `);
      console.log('  ✅ 已添加 coupon_id 列');
    } else {
      console.log('  ⏭️  coupon_id 列已存在，跳过');
    }
    
    // 检查 is_used 列是否存在
    const checkIsUsed = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_coupons' 
        AND column_name = 'is_used'
    `);
    
    if (checkIsUsed.rows.length === 0) {
      console.log('📝 添加 is_used 列到 user_coupons 表...');
      await client.query(`
        ALTER TABLE user_coupons 
        ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT FALSE
      `);
      console.log('  ✅ 已添加 is_used 列');
    } else {
      console.log('  ⏭️  is_used 列已存在，跳过');
    }
    
    // 检查 transaction_id 列是否存在
    const checkTransactionId = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_coupons' 
        AND column_name = 'transaction_id'
    `);
    
    if (checkTransactionId.rows.length === 0) {
      console.log('📝 添加 transaction_id 列到 user_coupons 表...');
      await client.query(`
        ALTER TABLE user_coupons 
        ADD COLUMN IF NOT EXISTS transaction_id INTEGER
      `);
      console.log('  ✅ 已添加 transaction_id 列');
    } else {
      console.log('  ⏭️  transaction_id 列已存在，跳过');
    }
    
    // 添加 UNIQUE 约束
    console.log('\n📝 检查 UNIQUE 约束...');
    const checkConstraint = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'user_coupons' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'user_coupons_user_id_coupon_id_key'
    `);
    
    if (checkConstraint.rows.length === 0) {
      try {
        await client.query(`
          ALTER TABLE user_coupons 
          ADD CONSTRAINT user_coupons_user_id_coupon_id_key 
          UNIQUE (user_id, coupon_id)
        `);
        console.log('  ✅ 已添加 UNIQUE 约束');
      } catch (err) {
        if (err.code === '23505' || err.code === '42P07') {
          console.log('  ⏭️  UNIQUE 约束已存在或有重复数据，跳过');
        } else {
          throw err;
        }
      }
    } else {
      console.log('  ⏭️  UNIQUE 约束已存在，跳过');
    }
    
    console.log('\n✅ user_coupons 表修复完成！');
    console.log('\n📊 当前表结构:');
    
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_coupons'
      ORDER BY ordinal_position
    `);
    
    console.table(columns.rows);
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
