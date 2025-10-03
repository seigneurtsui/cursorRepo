// db/database.js - Database connection and query helpers
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'video_chapters',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '',
  client_encoding: 'UTF8',  // 确保使用 UTF-8 编码
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

// Database query helpers
const db = {
  // Generic query
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('📊 Query executed:', { text: text.substring(0, 50), duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }
  },

  // Get client for transactions
  getClient: async () => {
    const client = await pool.connect();
    return client;
  },

  // Video operations
  videos: {
    create: async (videoData) => {
      const query = `
        INSERT INTO videos (filename, original_name, file_path, file_size, mime_type, status, user_id, upload_started_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *;
      `;
      const values = [
        videoData.filename,
        videoData.originalName,
        videoData.filePath,
        videoData.fileSize,
        videoData.mimeType,
        videoData.status || 'uploaded',
        videoData.userId || null
      ];
      const result = await db.query(query, values);
      return result.rows[0];
    },

    findById: async (id) => {
      const query = `
        SELECT v.*, 
               u.username,
               u.email as user_email
        FROM videos v
        LEFT JOIN users u ON v.user_id = u.id
        WHERE v.id = $1
      `;
      const result = await db.query(query, [id]);
      return result.rows[0];
    },

    findAll: async (filters = {}) => {
      // Include user info for admin
      let query = `
        SELECT DISTINCT v.*, 
               u.username, 
               u.email as user_email
        FROM videos v
        LEFT JOIN users u ON v.user_id = u.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      // Filter by user_id (for data isolation)
      if (filters.userId) {
        query += ` AND v.user_id = $${paramCount}`;
        params.push(filters.userId);
        paramCount++;
      }
      
      // Filter by uploader email (admin only)
      if (filters.uploaderEmail) {
        query += ` AND u.email ILIKE $${paramCount}`;
        params.push(`%${filters.uploaderEmail}%`);
        paramCount++;
      }

      if (filters.status) {
        query += ` AND v.status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      if (filters.keyword) {
        // Search in videos table: filename, original_name, transcript
        // AND chapters table: title, description
        query = `
          SELECT DISTINCT v.*,
                 u.username,
                 u.email as user_email
          FROM videos v
          LEFT JOIN users u ON v.user_id = u.id
          LEFT JOIN chapters c ON v.id = c.video_id
          WHERE 1=1
          ${filters.userId ? `AND v.user_id = $1` : ''}
          ${filters.status ? `AND v.status = $${filters.userId ? 2 : 1}` : ''}
          AND (
            v.original_name ILIKE $${paramCount} OR 
            v.filename ILIKE $${paramCount} OR 
            v.transcript ILIKE $${paramCount} OR
            c.title ILIKE $${paramCount} OR
            c.description ILIKE $${paramCount}
          )
        `;
        params.push(`%${filters.keyword}%`);
        paramCount++;
      }

      if (filters.startDate) {
        query += ` AND v.created_at >= $${paramCount}`;
        params.push(filters.startDate);
        paramCount++;
      }

      if (filters.endDate) {
        query += ` AND v.created_at <= $${paramCount}`;
        params.push(filters.endDate);
        paramCount++;
      }

      query += ' ORDER BY v.created_at DESC';

      if (filters.limit && filters.limit !== 'ALL') {
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(filters.limit));
        paramCount++;
      }

      if (filters.offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(parseInt(filters.offset));
      }

      const result = await db.query(query, params);
      return result.rows;
    },

    count: async (filters = {}) => {
      let query = 'SELECT COUNT(*) FROM videos WHERE 1=1';
      const params = [];
      let paramCount = 1;

      // Filter by user_id (for data isolation)
      if (filters.userId) {
        query += ` AND user_id = $${paramCount}`;
        params.push(filters.userId);
        paramCount++;
      }

      if (filters.status) {
        query += ` AND status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      if (filters.keyword) {
        // Search in videos table: filename, original_name, transcript
        // AND chapters table: title, description
        query += ` AND (
          original_name ILIKE $${paramCount} 
          OR filename ILIKE $${paramCount}
          OR transcript ILIKE $${paramCount}
          OR EXISTS (
            SELECT 1 FROM chapters 
            WHERE chapters.video_id = videos.id 
            AND (chapters.title ILIKE $${paramCount} OR chapters.description ILIKE $${paramCount})
          )
        )`;
        params.push(`%${filters.keyword}%`);
        paramCount++;
      }

      if (filters.startDate) {
        query += ` AND created_at >= $${paramCount}`;
        params.push(filters.startDate);
        paramCount++;
      }

      if (filters.endDate) {
        query += ` AND created_at <= $${paramCount}`;
        params.push(filters.endDate);
      }

      const result = await db.query(query, params);
      return parseInt(result.rows[0].count);
    },

    update: async (id, updates) => {
      const fields = Object.keys(updates);
      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const query = `UPDATE videos SET ${setClause} WHERE id = $1 RETURNING *`;
      const values = [id, ...Object.values(updates)];
      const result = await db.query(query, values);
      return result.rows[0];
    },

    delete: async (id) => {
      const query = 'DELETE FROM videos WHERE id = $1 RETURNING *';
      const result = await db.query(query, [id]);
      return result.rows[0];
    }
  },

  // Chapter operations
  chapters: {
    create: async (chapterData) => {
      const query = `
        INSERT INTO chapters (video_id, chapter_index, start_time, end_time, title, description, transcript)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const values = [
        chapterData.videoId,
        chapterData.chapterIndex,
        chapterData.startTime,
        chapterData.endTime,
        chapterData.title,
        chapterData.description,
        chapterData.transcript
      ];
      const result = await db.query(query, values);
      return result.rows[0];
    },

    createBulk: async (chapters) => {
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        const createdChapters = [];
        
        for (const chapter of chapters) {
          const query = `
            INSERT INTO chapters (video_id, chapter_index, start_time, end_time, title, description, transcript)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
          `;
          const values = [
            chapter.videoId,
            chapter.chapterIndex,
            chapter.startTime,
            chapter.endTime,
            chapter.title,
            chapter.description || '',
            chapter.transcript || ''
          ];
          const result = await client.query(query, values);
          createdChapters.push(result.rows[0]);
        }
        
        await client.query('COMMIT');
        return createdChapters;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    findByVideoId: async (videoId) => {
      const query = 'SELECT * FROM chapters WHERE video_id = $1 ORDER BY chapter_index ASC';
      const result = await db.query(query, [videoId]);
      return result.rows;
    },

    deleteByVideoId: async (videoId) => {
      const query = 'DELETE FROM chapters WHERE video_id = $1';
      await db.query(query, [videoId]);
    }
  },

  // Processing log operations
  logs: {
    create: async (logData) => {
      const query = `
        INSERT INTO processing_logs (video_id, stage, status, message, progress, error_details)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const values = [
        logData.videoId,
        logData.stage,
        logData.status,
        logData.message,
        logData.progress || 0,
        logData.errorDetails
      ];
      const result = await db.query(query, values);
      return result.rows[0];
    },

    updateProgress: async (logId, progress, status) => {
      const query = `
        UPDATE processing_logs 
        SET progress = $2, status = $3, completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE completed_at END
        WHERE id = $1
        RETURNING *;
      `;
      const result = await db.query(query, [logId, progress, status]);
      return result.rows[0];
    },

    findByVideoId: async (videoId) => {
      const query = 'SELECT * FROM processing_logs WHERE video_id = $1 ORDER BY started_at DESC';
      const result = await db.query(query, [videoId]);
      return result.rows;
    }
  }
};

module.exports = db;
