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

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
      CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chapters_video_id ON chapters(video_id);
      CREATE INDEX IF NOT EXISTS idx_chapters_start_time ON chapters(start_time);
      CREATE INDEX IF NOT EXISTS idx_processing_logs_video_id ON processing_logs(video_id);
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
