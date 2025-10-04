// scripts/migrate-add-is-active.js - Add is_active column to users table
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
    console.log('🚀 Starting migration: Add is_active column to users table...');

    // Check if column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='is_active'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Column is_active already exists');
    } else {
      // Add is_active column
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN is_active BOOLEAN DEFAULT TRUE
      `);
      console.log('✅ Added column: is_active');

      // Update existing users to be active
      await client.query(`
        UPDATE users 
        SET is_active = TRUE 
        WHERE is_active IS NULL
      `);
      console.log('✅ Updated existing users to active status');
    }

    // Check and add other missing columns
    const columns = [
      { name: 'phone', type: 'VARCHAR(50)' },
      { name: 'wechat', type: 'VARCHAR(100)' },
      { name: 'other_contact', type: 'TEXT' },
      { name: 'notes', type: 'TEXT' },
      { name: 'other_info', type: 'TEXT' }
    ];

    for (const col of columns) {
      const check = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='${col.name}'
      `);

      if (check.rows.length === 0) {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN ${col.name} ${col.type}
        `);
        console.log(`✅ Added column: ${col.name}`);
      } else {
        console.log(`✅ Column ${col.name} already exists`);
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    
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
