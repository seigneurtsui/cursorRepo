// server.js - Main Express server
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const db = require('./db/database');
const WhisperService = require('./services/whisper');
const GPTChapterService = require('./services/gpt-chapter');
const NotificationService = require('./services/notification');
const ExportService = require('./services/export');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const TEMP_DIR = process.env.TEMP_DIR || './temp';

// Initialize services
const whisperService = new WhisperService();
const gptService = new GPTChapterService();
const notificationService = new NotificationService();
const exportService = new ExportService();

// Ensure upload and temp directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(TEMP_DIR, { recursive: true });
    await fs.mkdir(path.join(__dirname, 'exports'), { recursive: true });
    console.log('✅ Directories ensured');
  } catch (error) {
    console.error('❌ Error creating directories:', error);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// Multer configuration for file upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 * 1024 // 10GB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
      'video/flv', 'video/wmv', 'video/webm', 'video/x-matroska',
      'video/quicktime', 'video/x-msvideo'
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp4|avi|mkv|mov|flv|wmv|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的视频格式'));
    }
  }
});

// WebSocket connections for real-time updates
const wsClients = new Set();

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  wsClients.add(ws);

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    wsClients.delete(ws);
  });
});

// Broadcast message to all connected clients
function broadcastProgress(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Process video: extract transcript and generate chapters
async function processVideoFile(videoId) {
  let video = null;
  
  try {
    video = await db.videos.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    console.log(`\n🎬 Starting processing for video: ${video.original_name}`);
    
    // Update status to processing
    await db.videos.update(videoId, {
      status: 'processing',
      processing_started_at: new Date()
    });

    broadcastProgress({
      type: 'status',
      videoId,
      status: 'processing',
      message: '开始处理视频...'
    });

    // Stage 1: Get video duration
    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'duration',
      progress: 10,
      message: '获取视频时长...'
    });

    const duration = await whisperService.getVideoDuration(video.file_path);
    await db.videos.update(videoId, { duration });

    // Stage 2: Extract and transcribe audio
    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'transcription',
      progress: 20,
      message: '提取音频并转录...'
    });

    const transcript = await whisperService.processVideo(video.file_path, {
      language: 'zh',
      format: 'srt'
    });

    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'transcription',
      progress: 60,
      message: '转录完成，开始生成章节...'
    });

    // Stage 3: Generate chapters using GPT
    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'chapter_generation',
      progress: 70,
      message: '使用AI生成章节...'
    });

    const chaptersData = await gptService.generateChapters(transcript, duration);

    // Stage 4: Save chapters to database
    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'saving',
      progress: 90,
      message: '保存章节数据...'
    });

    const chapters = chaptersData.map(ch => ({
      videoId: videoId,
      chapterIndex: ch.chapterIndex,
      startTime: ch.startTime,
      endTime: ch.endTime,
      title: ch.title,
      description: ch.description || '',
      transcript: ch.keyPoints ? ch.keyPoints.join('; ') : ''
    }));

    await db.chapters.createBulk(chapters);

    // Update video status
    await db.videos.update(videoId, {
      status: 'completed',
      processing_completed_at: new Date()
    });

    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'completed',
      progress: 100,
      message: '处理完成！'
    });

    broadcastProgress({
      type: 'completed',
      videoId,
      chapters: chapters.length
    });

    // Fetch updated video record
    video = await db.videos.findById(videoId);
    const savedChapters = await db.chapters.findByVideoId(videoId);

    // Send notification
    await notificationService.sendVideoChapterNotification(video, savedChapters);

    console.log(`✅ Processing completed for video: ${video.original_name} (${savedChapters.length} chapters)`);
    
    return { success: true, chapters: savedChapters };

  } catch (error) {
    console.error(`❌ Processing failed for video ${videoId}:`, error);

    if (video) {
      await db.videos.update(videoId, {
        status: 'error',
        error_message: error.message,
        processing_completed_at: new Date()
      });
    }

    broadcastProgress({
      type: 'error',
      videoId,
      error: error.message
    });

    return { success: false, error: error.message };
  }
}

// ===== API ENDPOINTS =====

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Upload videos
app.post('/api/upload', upload.array('videos', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const uploadedVideos = [];

    for (const file of req.files) {
      const stats = await fs.stat(file.path);
      
      const video = await db.videos.create({
        filename: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: stats.size,
        mimeType: file.mimetype,
        status: 'uploaded'
      });

      uploadedVideos.push(video);
    }

    console.log(`✅ Uploaded ${uploadedVideos.length} video(s)`);

    res.json({
      success: true,
      message: `成功上传 ${uploadedVideos.length} 个视频`,
      videos: uploadedVideos
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start processing videos
app.post('/api/process', async (req, res) => {
  try {
    const { videoIds } = req.body;

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: '请提供视频ID列表' });
    }

    // Start processing asynchronously
    res.json({
      success: true,
      message: `开始处理 ${videoIds.length} 个视频`,
      videoIds
    });

    // Process videos in background
    const startTime = Date.now();
    const results = [];

    for (const videoId of videoIds) {
      const result = await processVideoFile(videoId);
      const video = await db.videos.findById(videoId);
      const chapters = await db.chapters.findByVideoId(videoId);
      
      results.push({
        ...video,
        chapterCount: chapters.length
      });
    }

    const totalTime = (Date.now() - startTime) / 1000;

    // Send batch completion notification
    await notificationService.sendBatchProcessingNotification(results, totalTime);

    console.log(`✅ Batch processing completed in ${totalTime.toFixed(2)}s`);

  } catch (error) {
    console.error('❌ Process error:', error);
  }
});

// Get all videos with pagination and filters
app.get('/api/videos', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      keyword,
      status,
      startDate,
      endDate
    } = req.query;

    const filters = {
      keyword,
      status,
      startDate,
      endDate,
      limit: limit === 'ALL' ? null : limit,
      offset: limit === 'ALL' ? 0 : (parseInt(page) - 1) * parseInt(limit)
    };

    const videos = await db.videos.findAll(filters);
    const total = await db.videos.count({ keyword, status, startDate, endDate });

    // Get chapter counts for each video
    const videosWithChapters = await Promise.all(
      videos.map(async (video) => {
        const chapters = await db.chapters.findByVideoId(video.id);
        return {
          ...video,
          chapterCount: chapters.length
        };
      })
    );

    res.json({
      success: true,
      data: videosWithChapters,
      pagination: {
        page: parseInt(page),
        limit: limit === 'ALL' ? 'ALL' : parseInt(limit),
        total,
        totalPages: limit === 'ALL' ? 1 : Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Get videos error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get video by ID with chapters
app.get('/api/videos/:id', async (req, res) => {
  try {
    const video = await db.videos.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: '视频不存在' });
    }

    const chapters = await db.chapters.findByVideoId(video.id);

    res.json({
      success: true,
      data: {
        ...video,
        chapters
      }
    });

  } catch (error) {
    console.error('❌ Get video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete video
app.delete('/api/videos/:id', async (req, res) => {
  try {
    const video = await db.videos.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: '视频不存在' });
    }

    // Delete file
    try {
      await fs.unlink(video.file_path);
    } catch (e) {
      console.warn('⚠️ Could not delete video file:', e.message);
    }

    // Delete from database (chapters will be deleted via CASCADE)
    await db.videos.delete(video.id);

    res.json({
      success: true,
      message: '视频已删除'
    });

  } catch (error) {
    console.error('❌ Delete video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export data
app.post('/api/export', async (req, res) => {
  try {
    const { format, filters = {} } = req.body;

    if (!['excel', 'csv', 'html', 'pdf', 'markdown'].includes(format)) {
      return res.status(400).json({ error: '不支持的导出格式' });
    }

    // Get filtered data
    const videos = await db.videos.findAll(filters);
    const videoIds = videos.map(v => v.id);
    
    let allChapters = [];
    for (const videoId of videoIds) {
      const chapters = await db.chapters.findByVideoId(videoId);
      allChapters = allChapters.concat(chapters);
    }

    const timestamp = Date.now();
    let outputPath, content, mimeType, filename;

    switch (format) {
      case 'excel':
        const workbook = await exportService.exportToExcel(videos, allChapters);
        outputPath = path.join(__dirname, 'exports', `chapters_${timestamp}.xlsx`);
        await workbook.xlsx.writeFile(outputPath);
        filename = `chapters_${timestamp}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;

      case 'csv':
        content = await exportService.exportToCSV(videos, allChapters, 'videos');
        outputPath = path.join(__dirname, 'exports', `chapters_${timestamp}.csv`);
        await fs.writeFile(outputPath, content, 'utf-8');
        filename = `chapters_${timestamp}.csv`;
        mimeType = 'text/csv';
        break;

      case 'html':
        content = await exportService.exportToHTML(videos, allChapters);
        outputPath = path.join(__dirname, 'exports', `chapters_${timestamp}.html`);
        await fs.writeFile(outputPath, content, 'utf-8');
        filename = `chapters_${timestamp}.html`;
        mimeType = 'text/html';
        break;

      case 'pdf':
        outputPath = path.join(__dirname, 'exports', `chapters_${timestamp}.pdf`);
        await exportService.exportToPDF(videos, allChapters, outputPath);
        filename = `chapters_${timestamp}.pdf`;
        mimeType = 'application/pdf';
        break;

      case 'markdown':
        content = await exportService.exportToMarkdown(videos, allChapters);
        outputPath = path.join(__dirname, 'exports', `chapters_${timestamp}.md`);
        await fs.writeFile(outputPath, content, 'utf-8');
        filename = `chapters_${timestamp}.md`;
        mimeType = 'text/markdown';
        break;
    }

    res.json({
      success: true,
      downloadUrl: `/exports/${filename}`,
      filename
    });

  } catch (error) {
    console.error('❌ Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
  await ensureDirectories();
  
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎬 视频章节生成器 - Video Chapter Generator                  ║
║                                                               ║
║   🚀 Server running on: http://localhost:${PORT}                ║
║   📊 Database: PostgreSQL                                     ║
║   🤖 AI: Whisper + GPT-4 Turbo                                ║
║   📢 Notifications: 4 channels ready                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);

module.exports = app;
