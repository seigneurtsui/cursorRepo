// services/export.js - Export service for different formats
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ExportService {
  // Format time for display
  formatTime(seconds) {
    if (!seconds) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Generate video title from filename
  generateVideoTitle(filename) {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    // Replace underscores and hyphens with spaces
    const title = nameWithoutExt.replace(/[_-]/g, ' ');
    return title;
  }

  // Format chapters list for export
  formatChaptersList(videoChapters) {
    if (!videoChapters || videoChapters.length === 0) {
      return '暂无章节';
    }

    let list = '### 章节列表\n\n';
    videoChapters.forEach((ch, idx) => {
      list += `${ch.chapter_index}. **[${this.formatTime(ch.start_time)} - ${this.formatTime(ch.end_time)}]** ${ch.title}\n`;
      if (ch.description) {
        list += `   > ${ch.description}\n`;
      }
      if (idx < videoChapters.length - 1) {
        list += '\n';
      }
    });
    return list;
  }

  // Export to Excel
  async exportToExcel(videos, chapters) {
    const workbook = new ExcelJS.Workbook();
    
    // Videos sheet
    const videoSheet = workbook.addWorksheet('视频列表');
    videoSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '文件名', key: 'original_name', width: 40 },
      { header: '视频标题', key: 'video_title', width: 40 },
      { header: '文件大小', key: 'file_size', width: 15 },
      { header: '视频时长', key: 'duration', width: 15 },
      { header: '状态', key: 'status', width: 15 },
      { header: '章节数', key: 'chapter_count', width: 10 },
      { header: '上传时间', key: 'created_at', width: 20 },
      { header: '处理时间', key: 'processing_time', width: 15 },
      { header: '章节列表', key: 'chapters_list', width: 80 }
    ];

    // Add video data
    videos.forEach(video => {
      const videoChapters = chapters.filter(ch => ch.video_id === video.id).sort((a, b) => a.chapter_index - b.chapter_index);
      const processingTime = video.processing_started_at && video.processing_completed_at
        ? Math.round((new Date(video.processing_completed_at) - new Date(video.processing_started_at)) / 1000)
        : 0;

      videoSheet.addRow({
        id: video.id,
        original_name: video.original_name,
        video_title: this.generateVideoTitle(video.original_name),
        file_size: this.formatFileSize(video.file_size),
        duration: this.formatTime(video.duration),
        status: video.status,
        chapter_count: videoChapters.length,
        created_at: video.created_at ? new Date(video.created_at).toLocaleString('zh-CN') : '',
        processing_time: processingTime > 0 ? `${processingTime}秒` : 'N/A',
        chapters_list: this.formatChaptersList(videoChapters)
      });
    });

    // Chapters sheet
    const chapterSheet = workbook.addWorksheet('章节列表');
    chapterSheet.columns = [
      { header: '视频ID', key: 'video_id', width: 10 },
      { header: '视频名称', key: 'video_name', width: 40 },
      { header: '章节序号', key: 'chapter_index', width: 12 },
      { header: '开始时间', key: 'start_time', width: 15 },
      { header: '结束时间', key: 'end_time', width: 15 },
      { header: '章节标题', key: 'title', width: 30 },
      { header: '章节描述', key: 'description', width: 50 }
    ];

    // Add chapter data
    chapters.forEach(chapter => {
      const video = videos.find(v => v.id === chapter.video_id);
      chapterSheet.addRow({
        video_id: chapter.video_id,
        video_name: video ? video.original_name : 'Unknown',
        chapter_index: chapter.chapter_index,
        start_time: this.formatTime(chapter.start_time),
        end_time: this.formatTime(chapter.end_time),
        title: chapter.title,
        description: chapter.description
      });
    });

    // Style headers
    [videoSheet, chapterSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });

    return workbook;
  }

  // Export to CSV
  async exportToCSV(videos, chapters, type = 'videos') {
    let data, fields;

    if (type === 'videos') {
      data = videos.map(video => {
        const videoChapters = chapters.filter(ch => ch.video_id === video.id).sort((a, b) => a.chapter_index - b.chapter_index);
        const processingTime = video.processing_started_at && video.processing_completed_at
          ? Math.round((new Date(video.processing_completed_at) - new Date(video.processing_started_at)) / 1000)
          : 0;

        return {
          id: video.id,
          文件名: video.original_name,
          视频标题: this.generateVideoTitle(video.original_name),
          文件大小: this.formatFileSize(video.file_size),
          视频时长: this.formatTime(video.duration),
          状态: video.status,
          章节数: videoChapters.length,
          上传时间: video.created_at ? new Date(video.created_at).toLocaleString('zh-CN') : '',
          处理时间: processingTime > 0 ? `${processingTime}秒` : 'N/A',
          章节列表: this.formatChaptersList(videoChapters)
        };
      });

      fields = ['id', '文件名', '视频标题', '文件大小', '视频时长', '状态', '章节数', '上传时间', '处理时间', '章节列表'];
    } else {
      data = chapters.map(chapter => {
        const video = videos.find(v => v.id === chapter.video_id);
        return {
          视频ID: chapter.video_id,
          视频名称: video ? video.original_name : 'Unknown',
          章节序号: chapter.chapter_index,
          开始时间: this.formatTime(chapter.start_time),
          结束时间: this.formatTime(chapter.end_time),
          章节标题: chapter.title,
          章节描述: chapter.description
        };
      });

      fields = ['视频ID', '视频名称', '章节序号', '开始时间', '结束时间', '章节标题', '章节描述'];
    }

    const parser = new Parser({ 
      fields,
      withBOM: true  // 添加 BOM 以支持 Excel 正确显示中文
    });
    return parser.parse(data);
  }

  // Export to HTML
  async exportToHTML(videos, chapters) {
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>视频章节报告</title>
  <style>
    body {
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      margin: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #4CAF50;
      padding-bottom: 10px;
    }
    h2 {
      color: #555;
      margin-top: 30px;
      border-bottom: 2px solid #ddd;
      padding-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #4CAF50;
      color: white;
      font-weight: bold;
    }
    tr:hover {
      background-color: #f5f5f5;
    }
    .video-section {
      margin-bottom: 40px;
      padding: 20px;
      background: #fafafa;
      border-left: 4px solid #4CAF50;
    }
    .video-title {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin-bottom: 10px;
    }
    .video-meta {
      color: #666;
      font-size: 14px;
      margin-bottom: 15px;
    }
    .chapter-item {
      padding: 10px;
      margin: 5px 0;
      background: white;
      border-radius: 4px;
      border-left: 3px solid #2196F3;
    }
    .chapter-time {
      color: #2196F3;
      font-weight: bold;
      font-family: monospace;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📹 视频章节生成报告</h1>
    <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    <p>总视频数: <strong>${videos.length}</strong> | 总章节数: <strong>${chapters.length}</strong></p>
`;

    // Group chapters by video
    videos.forEach(video => {
      const videoChapters = chapters.filter(ch => ch.video_id === video.id).sort((a, b) => a.chapter_index - b.chapter_index);
      
      html += `
    <div class="video-section">
      <div class="video-title">${video.original_name}</div>
      <div class="video-meta">
        📁 大小: ${this.formatFileSize(video.file_size)} | 
        ⏱️ 时长: ${this.formatTime(video.duration)} | 
        📊 状态: ${video.status} | 
        🔢 章节: ${videoChapters.length}
      </div>
`;

      if (videoChapters.length > 0) {
        videoChapters.forEach(chapter => {
          html += `
      <div class="chapter-item">
        <span class="chapter-time">[${this.formatTime(chapter.start_time)} - ${this.formatTime(chapter.end_time)}]</span>
        <strong>${chapter.title}</strong>
        ${chapter.description ? `<br><small>${chapter.description}</small>` : ''}
      </div>
`;
        });
      } else {
        html += `      <p><em>暂无章节</em></p>\n`;
      }

      html += `    </div>\n`;
    });

    html += `
    <div class="footer">
      <p>由视频章节生成器自动生成</p>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  // Export to PDF
  async exportToPDF(videos, chapters, outputPath) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Register Chinese font
      const fontPath = path.join(__dirname, '../node_modules/source-han-sans-cn/SourceHanSansCN-Regular.otf');
      if (fs.existsSync(fontPath)) {
        doc.registerFont('ChineseFont', fontPath);
        doc.font('ChineseFont');
      }

      // Title
      doc.fontSize(20).text('视频章节生成报告', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'center' });
      doc.text(`总视频数: ${videos.length} | 总章节数: ${chapters.length}`, { align: 'center' });
      doc.moveDown(2);

      // Videos and chapters
      videos.forEach((video, index) => {
        const videoChapters = chapters.filter(ch => ch.video_id === video.id).sort((a, b) => a.chapter_index - b.chapter_index);

        // Video header
        doc.fontSize(14).fillColor('#000').text(`${index + 1}. ${video.original_name}`, { underline: true });
        doc.fontSize(10).fillColor('#666');
        doc.text(`文件大小: ${this.formatFileSize(video.file_size)} | 时长: ${this.formatTime(video.duration)} | 章节: ${videoChapters.length}`);
        doc.moveDown(0.5);

        // Chapters
        if (videoChapters.length > 0) {
          videoChapters.forEach(chapter => {
            doc.fontSize(10).fillColor('#000');
            doc.text(`  [${this.formatTime(chapter.start_time)} - ${this.formatTime(chapter.end_time)}] ${chapter.title}`);
            if (chapter.description) {
              doc.fontSize(9).fillColor('#666');
              doc.text(`    ${chapter.description}`, { indent: 20 });
            }
          });
        } else {
          doc.fontSize(10).fillColor('#999').text('  暂无章节');
        }

        doc.moveDown(1.5);

        // Add page break if needed
        if (doc.y > 650) {
          doc.addPage();
        }
      });

      // Footer
      doc.fontSize(8).fillColor('#999').text('由视频章节生成器自动生成', { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  // Export to Markdown
  async exportToMarkdown(videos, chapters) {
    let markdown = `# 📹 视频章节生成报告\n\n`;
    markdown += `**生成时间**: ${new Date().toLocaleString('zh-CN')}  \n`;
    markdown += `**总视频数**: ${videos.length}  \n`;
    markdown += `**总章节数**: ${chapters.length}\n\n`;
    markdown += `---\n\n`;

    videos.forEach((video, index) => {
      const videoChapters = chapters.filter(ch => ch.video_id === video.id).sort((a, b) => a.chapter_index - b.chapter_index);

      markdown += `## ${index + 1}. ${video.original_name}\n\n`;
      markdown += `- **文件大小**: ${this.formatFileSize(video.file_size)}\n`;
      markdown += `- **视频时长**: ${this.formatTime(video.duration)}\n`;
      markdown += `- **状态**: ${video.status}\n`;
      markdown += `- **章节数量**: ${videoChapters.length}\n`;
      markdown += `- **上传时间**: ${video.created_at ? new Date(video.created_at).toLocaleString('zh-CN') : 'N/A'}\n\n`;

      if (videoChapters.length > 0) {
        markdown += `### 章节列表\n\n`;
        videoChapters.forEach((chapter, idx) => {
          markdown += `${idx + 1}. **[${this.formatTime(chapter.start_time)} - ${this.formatTime(chapter.end_time)}]** ${chapter.title}\n`;
          if (chapter.description) {
            markdown += `   > ${chapter.description}\n`;
          }
          markdown += `\n`;
        });
      } else {
        markdown += `*暂无章节*\n\n`;
      }

      markdown += `---\n\n`;
    });

    markdown += `\n*由视频章节生成器自动生成*\n`;

    return markdown;
  }
}

module.exports = ExportService;
