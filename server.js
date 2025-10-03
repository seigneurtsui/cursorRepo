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
const cookieParser = require('cookie-parser');
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// Authentication routes
const authRoutes = require('./routes/auth-routes');
app.use('/api/auth', authRoutes);

// Membership routes (coupons, referrals, levels)
const membershipRoutes = require('./routes/membership-routes');
app.use('/api/membership', membershipRoutes);

// Multer configuration for file upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Fix Chinese filename encoding issue
    // multer uses latin1 by default, need to convert to UTF-8
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(originalName)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 * 1024 // 10GB
  },
  fileFilter: (req, file, cb) => {
    // Fix Chinese filename encoding for validation
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    const allowedMimes = [
      'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
      'video/flv', 'video/wmv', 'video/webm', 'video/x-matroska',
      'video/quicktime', 'video/x-msvideo'
    ];
    if (allowedMimes.includes(file.mimetype) || originalName.match(/\.(mp4|avi|mkv|mov|flv|wmv|webm)$/i)) {
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
async function processVideoFile(videoId, videoIndex = null, totalVideos = null) {
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
      message: '开始处理视频...',
      videoName: video.original_name,
      videoIndex,
      totalVideos
    });

    // Stage 1: Get video duration
    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'duration',
      progress: 10,
      message: '获取视频时长...',
      videoName: video.original_name,
      videoIndex,
      totalVideos
    });

    const duration = await whisperService.getVideoDuration(video.file_path);
    await db.videos.update(videoId, { duration });

    // Stage 2: Extract and transcribe audio
    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'transcription',
      progress: 20,
      message: '提取音频并转录...',
      videoName: video.original_name,
      videoIndex,
      totalVideos
    });

    const transcript = await whisperService.processVideo(video.file_path, {
      language: 'zh',
      format: 'srt'
    });

    // Save SRT format transcript to database
    const srtTranscript = transcript.raw || '';
    await db.videos.update(videoId, { 
      transcript: srtTranscript 
    });
    console.log(`💾 Saved SRT transcript to database (${srtTranscript.length} characters)`);

    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'transcription',
      progress: 60,
      message: '转录完成，开始生成章节...',
      videoName: video.original_name,
      videoIndex,
      totalVideos
    });

    // Stage 3: Generate chapters using GPT
    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'chapter_generation',
      progress: 70,
      message: '使用AI生成章节...',
      videoName: video.original_name,
      videoIndex,
      totalVideos
    });

    const chaptersData = await gptService.generateChapters(transcript, duration);

    // Stage 4: Validate and adjust chapter times
    console.log(`🔍 Validating chapter times against video duration: ${duration}s`);
    console.log(`📊 Original chapters data:`, chaptersData.map(ch => ({
      index: ch.chapterIndex,
      start: ch.startTime,
      end: ch.endTime,
      title: ch.title
    })));
    
    const validatedChapters = [];
    
    // Check if we need to redistribute chapters evenly
    const needsRedistribution = chaptersData.some(ch => 
      ch.startTime >= duration || ch.endTime > duration || ch.endTime <= ch.startTime
    );
    
    if (needsRedistribution) {
      console.log(`⚠️ Chapter times need redistribution - using equal distribution`);
      // Distribute chapters evenly across video duration
      const chapterDuration = duration / chaptersData.length;
      
      for (let idx = 0; idx < chaptersData.length; idx++) {
        const ch = chaptersData[idx];
        const startTime = idx * chapterDuration;
        const endTime = (idx + 1) * chapterDuration;
        
        validatedChapters.push({
          chapterIndex: ch.chapterIndex,
          startTime: Math.round(startTime * 100) / 100,  // Round to 2 decimals
          endTime: Math.round(endTime * 100) / 100,
          title: ch.title,
          description: ch.description || '',
          keyPoints: ch.keyPoints || []
        });
      }
    } else {
      // Use original times with minor adjustments
      for (let idx = 0; idx < chaptersData.length; idx++) {
        const ch = chaptersData[idx];
        let startTime = Math.max(0, Math.min(ch.startTime, duration));
        let endTime = Math.min(ch.endTime, duration);
        
        // Ensure endTime is after startTime
        if (endTime <= startTime) {
          const avgDuration = duration / chaptersData.length;
          endTime = Math.min(startTime + avgDuration, duration);
        }
        
        validatedChapters.push({
          chapterIndex: ch.chapterIndex,
          startTime: Math.round(startTime * 100) / 100,
          endTime: Math.round(endTime * 100) / 100,
          title: ch.title,
          description: ch.description || '',
          keyPoints: ch.keyPoints || []
        });
      }
      
      // Ensure no overlaps
      for (let idx = 1; idx < validatedChapters.length; idx++) {
        const current = validatedChapters[idx];
        const previous = validatedChapters[idx - 1];
        
        if (current.startTime < previous.endTime) {
          current.startTime = previous.endTime;
        }
        if (current.endTime <= current.startTime) {
          const avgDuration = duration / chaptersData.length;
          current.endTime = Math.min(current.startTime + avgDuration, duration);
        }
      }
    }
    
    // Final adjustment: ensure last chapter ends at video duration
    if (validatedChapters.length > 0) {
      validatedChapters[validatedChapters.length - 1].endTime = duration;
    }
    
    console.log(`✅ Validated chapters:`, validatedChapters.map(ch => ({
      index: ch.chapterIndex,
      start: ch.startTime,
      end: ch.endTime,
      title: ch.title
    })));

    // Stage 5: Save chapters to database
    broadcastProgress({
      type: 'progress',
      videoId,
      stage: 'saving',
      progress: 90,
      message: '保存章节数据...',
      videoName: video.original_name,
      videoIndex,
      totalVideos
    });

    const chapters = validatedChapters.map(ch => ({
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
      message: '处理完成！',
      videoName: video.original_name,
      videoIndex,
      totalVideos
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

// Upload videos (require authentication)
const { authenticate, checkBalance } = require('./middleware/auth');
const paymentService = require('./services/payment');
const PROCESSING_COST = parseFloat(process.env.PROCESSING_COST) || 5.00;

app.post('/api/upload', authenticate, upload.array('videos', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const uploadedVideos = [];

    for (const file of req.files) {
      const stats = await fs.stat(file.path);
      
      // Fix Chinese filename encoding
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      
      const video = await db.videos.create({
        filename: file.filename,
        originalName: originalName,
        filePath: file.path,
        fileSize: stats.size,
        mimeType: file.mimetype,
        status: 'uploaded',
        userId: req.user.id // Associate with current user
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

// Start processing videos (require authentication and balance check)
app.post('/api/process', authenticate, async (req, res) => {
  try {
    const { videoIds } = req.body;

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: '请提供视频ID列表' });
    }

    // Check balance (skip for admin)
    const totalCost = videoIds.length * PROCESSING_COST;
    const userBalance = parseFloat(req.user.balance);
    
    if (!req.user.is_admin && userBalance < totalCost) {
      return res.status(402).json({ 
        error: '余额不足，请充值',
        balance: userBalance,
        required: totalCost,
        perVideo: PROCESSING_COST
      });
    }

    // Start processing asynchronously
    res.json({
      success: true,
      message: `开始处理 ${videoIds.length} 个视频`,
      videoIds,
      totalCost: req.user.is_admin ? 0 : totalCost
    });

    // Process videos in background
    const startTime = Date.now();
    const results = [];
    const totalVideos = videoIds.length;

    for (let i = 0; i < videoIds.length; i++) {
      const videoId = videoIds[i];
      const videoIndex = i + 1;
      
      // Deduct balance for each video (skip for admin)
      if (!req.user.is_admin) {
        try {
          await paymentService.deductBalance(
            req.user.id, 
            PROCESSING_COST, 
            `视频处理 - ${videoId}`,
            videoId
          );
          console.log(`💰 Deducted ¥${PROCESSING_COST} from user ${req.user.id} for video ${videoId}`);
        } catch (balanceError) {
          console.error(`❌ Failed to deduct balance for video ${videoId}:`, balanceError);
          // Continue processing but log the error
        }
      }
      
      const result = await processVideoFile(videoId, videoIndex, totalVideos);
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

// Get all videos with pagination and filters (require authentication for data isolation)
app.get('/api/videos', authenticate, async (req, res) => {
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
      offset: limit === 'ALL' ? 0 : (parseInt(page) - 1) * parseInt(limit),
      userId: req.user.is_admin ? null : req.user.id // Admin can see all, users see only their own
    };

    const videos = await db.videos.findAll(filters);
    const total = await db.videos.count({ 
      keyword, 
      status, 
      startDate, 
      endDate,
      userId: req.user.is_admin ? null : req.user.id
    });

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
    const { format, videoIds } = req.body;

    if (!['excel', 'csv', 'html', 'pdf', 'markdown'].includes(format)) {
      return res.status(400).json({ error: '不支持的导出格式' });
    }

    if (!videoIds || videoIds.length === 0) {
      return res.status(400).json({ error: '请选择要导出的视频' });
    }

    // Get selected videos data
    const videos = [];
    for (const videoId of videoIds) {
      const video = await db.videos.findById(videoId);
      if (video) {
        videos.push(video);
      }
    }
    
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

// Export custom Excel for single video
app.get('/api/export-custom-excel/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const video = await db.videos.findById(videoId);
    
    if (!video) {
      return res.status(404).json({ error: '视频不存在' });
    }

    const chapters = await db.chapters.findByVideoId(videoId);

    // Generate custom Excel
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('视频数据');

    // Set columns
    sheet.columns = [
      { header: 'title', key: 'title', width: 50 },
      { header: 'description', key: 'description', width: 80 },
      { header: 'filename', key: 'filename', width: 60 }
    ];

    // Generate video title
    const videoTitle = video.original_name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    
    // Format chapters list
    let description = '';
    if (chapters && chapters.length > 0) {
      chapters.sort((a, b) => a.chapter_index - b.chapter_index);
      chapters.forEach((ch) => {
        const startTime = exportService.formatTime(ch.start_time);
        const endTime = exportService.formatTime(ch.end_time);
        description += `${ch.chapter_index}. [${startTime} - ${endTime}] ${ch.title}\n`;
        if (ch.description) {
          description += `   ${ch.description}\n`;
        }
        description += '\n';
      });
    }

    // Generate filename with absolute path
    const filename = '/Users/seigneur/lavoro/video-chapters/' + video.file_path;

    // Add data row
    sheet.addRow({
      title: videoTitle,
      description: description.trim(),
      filename: filename
    });

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=custom_export_${videoId}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('❌ Export custom Excel error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch export custom Excel (merged into one file)
app.post('/api/batch-export-custom-excel', async (req, res) => {
  try {
    const { videoIds } = req.body;
    
    if (!videoIds || videoIds.length === 0) {
      return res.status(400).json({ error: '请选择要导出的视频' });
    }

    // Generate custom Excel with all videos
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('批量视频数据');

    // Set columns
    sheet.columns = [
      { header: 'title', key: 'title', width: 50 },
      { header: 'description', key: 'description', width: 80 },
      { header: 'filename', key: 'filename', width: 60 }
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Process each video
    for (const videoId of videoIds) {
      const video = await db.videos.findById(videoId);
      if (!video) continue;

      const chapters = await db.chapters.findByVideoId(videoId);

      // Generate video title
      const videoTitle = video.original_name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      
      // Format chapters list
      let description = '';
      if (chapters && chapters.length > 0) {
        chapters.sort((a, b) => a.chapter_index - b.chapter_index);
        chapters.forEach((ch) => {
          const startTime = exportService.formatTime(ch.start_time);
          const endTime = exportService.formatTime(ch.end_time);
          description += `${ch.chapter_index}. [${startTime} - ${endTime}] ${ch.title}\n`;
          if (ch.description) {
            description += `   ${ch.description}\n`;
          }
          description += '\n';
        });
      }

      // Generate filename with absolute path
      const filename = '/Users/seigneur/lavoro/video-chapters/' + video.file_path;

      // Add data row
      sheet.addRow({
        title: videoTitle,
        description: description.trim(),
        filename: filename
      });
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=custom_export_batch_${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('❌ Batch export custom Excel error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
ensureDirectories().then(() => {
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎬 视频章节生成器 - Video Chapter Generator                  ║
║                                                               ║
║   🚀 Server: http://localhost:${PORT}                          ║
║   📊 Database: PostgreSQL                                     ║
║   🤖 AI: Whisper + Ollama                                     ║
║   📢 Notifications: 4 channels ready                          ║
║   🔐 Auth: JWT enabled                                        ║
║   💰 Payment: Mock mode (demo)                                ║
║                                                               ║
║   登录页面: http://localhost:${PORT}/public/login.html         ║
║   注册页面: http://localhost:${PORT}/public/register.html      ║
║   管理后台: http://localhost:${PORT}/public/admin.html         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
});
