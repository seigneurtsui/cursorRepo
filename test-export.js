// Test export functionality
const ExportService = require('./services/export');
const fs = require('fs').promises;
const path = require('path');

const exportService = new ExportService();

// Sample test data
const sampleVideos = [
  {
    id: 1,
    original_name: '测试视频1.mp4',
    file_size: 104857600, // 100MB
    duration: 1200, // 20 minutes
    status: 'completed',
    created_at: new Date('2025-10-01 10:00:00'),
    processing_started_at: new Date('2025-10-01 10:05:00'),
    processing_completed_at: new Date('2025-10-01 10:08:00')
  },
  {
    id: 2,
    original_name: '测试视频2.mp4',
    file_size: 209715200, // 200MB
    duration: 1800, // 30 minutes
    status: 'completed',
    created_at: new Date('2025-10-01 11:00:00'),
    processing_started_at: new Date('2025-10-01 11:05:00'),
    processing_completed_at: new Date('2025-10-01 11:10:00')
  }
];

const sampleChapters = [
  {
    video_id: 1,
    chapter_index: 1,
    start_time: 0,
    end_time: 300,
    title: '开场介绍',
    description: '视频开场，介绍主题和内容'
  },
  {
    video_id: 1,
    chapter_index: 2,
    start_time: 300,
    end_time: 900,
    title: '核心内容讲解',
    description: '详细讲解核心知识点'
  },
  {
    video_id: 1,
    chapter_index: 3,
    start_time: 900,
    end_time: 1200,
    title: '总结与回顾',
    description: '总结要点，回顾重点内容'
  },
  {
    video_id: 2,
    chapter_index: 1,
    start_time: 0,
    end_time: 600,
    title: '第一部分',
    description: '第一部分内容'
  },
  {
    video_id: 2,
    chapter_index: 2,
    start_time: 600,
    end_time: 1200,
    title: '第二部分',
    description: '第二部分内容'
  },
  {
    video_id: 2,
    chapter_index: 3,
    start_time: 1200,
    end_time: 1800,
    title: '第三部分',
    description: '第三部分内容'
  }
];

async function testExports() {
  console.log('🧪 开始测试导出功能...\n');
  
  const exportDir = path.join(__dirname, 'exports');
  await fs.mkdir(exportDir, { recursive: true });
  
  const timestamp = Date.now();
  const results = [];

  // Test Excel export
  try {
    console.log('📊 测试 Excel 导出...');
    const workbook = await exportService.exportToExcel(sampleVideos, sampleChapters);
    const excelPath = path.join(exportDir, `test_${timestamp}.xlsx`);
    await workbook.xlsx.writeFile(excelPath);
    const stats = await fs.stat(excelPath);
    console.log(`   ✅ Excel 导出成功: ${excelPath} (${stats.size} bytes)`);
    results.push({ format: 'Excel', success: true, file: excelPath, size: stats.size });
  } catch (error) {
    console.log(`   ❌ Excel 导出失败: ${error.message}`);
    results.push({ format: 'Excel', success: false, error: error.message });
  }

  // Test CSV export
  try {
    console.log('📄 测试 CSV 导出...');
    const csvContent = await exportService.exportToCSV(sampleVideos, sampleChapters, 'videos');
    const csvPath = path.join(exportDir, `test_${timestamp}.csv`);
    await fs.writeFile(csvPath, csvContent, 'utf-8');
    const stats = await fs.stat(csvPath);
    console.log(`   ✅ CSV 导出成功: ${csvPath} (${stats.size} bytes)`);
    results.push({ format: 'CSV', success: true, file: csvPath, size: stats.size });
  } catch (error) {
    console.log(`   ❌ CSV 导出失败: ${error.message}`);
    results.push({ format: 'CSV', success: false, error: error.message });
  }

  // Test HTML export
  try {
    console.log('🌐 测试 HTML 导出...');
    const htmlContent = await exportService.exportToHTML(sampleVideos, sampleChapters);
    const htmlPath = path.join(exportDir, `test_${timestamp}.html`);
    await fs.writeFile(htmlPath, htmlContent, 'utf-8');
    const stats = await fs.stat(htmlPath);
    console.log(`   ✅ HTML 导出成功: ${htmlPath} (${stats.size} bytes)`);
    results.push({ format: 'HTML', success: true, file: htmlPath, size: stats.size });
  } catch (error) {
    console.log(`   ❌ HTML 导出失败: ${error.message}`);
    results.push({ format: 'HTML', success: false, error: error.message });
  }

  // Test PDF export
  try {
    console.log('📕 测试 PDF 导出...');
    const pdfPath = path.join(exportDir, `test_${timestamp}.pdf`);
    await exportService.exportToPDF(sampleVideos, sampleChapters, pdfPath);
    const stats = await fs.stat(pdfPath);
    console.log(`   ✅ PDF 导出成功: ${pdfPath} (${stats.size} bytes)`);
    results.push({ format: 'PDF', success: true, file: pdfPath, size: stats.size });
  } catch (error) {
    console.log(`   ❌ PDF 导出失败: ${error.message}`);
    results.push({ format: 'PDF', success: false, error: error.message });
  }

  // Test Markdown export
  try {
    console.log('📝 测试 Markdown 导出...');
    const mdContent = await exportService.exportToMarkdown(sampleVideos, sampleChapters);
    const mdPath = path.join(exportDir, `test_${timestamp}.md`);
    await fs.writeFile(mdPath, mdContent, 'utf-8');
    const stats = await fs.stat(mdPath);
    console.log(`   ✅ Markdown 导出成功: ${mdPath} (${stats.size} bytes)`);
    results.push({ format: 'Markdown', success: true, file: mdPath, size: stats.size });
  } catch (error) {
    console.log(`   ❌ Markdown 导出失败: ${error.message}`);
    results.push({ format: 'Markdown', success: false, error: error.message });
  }

  // Summary
  console.log('\n📊 测试结果汇总:');
  console.log('═'.repeat(60));
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`✅ 成功: ${successCount}/${results.length}`);
  console.log(`❌ 失败: ${failCount}/${results.length}`);
  
  if (successCount === results.length) {
    console.log('\n🎉 所有导出格式测试通过！');
  } else {
    console.log('\n⚠️  部分导出格式测试失败，请检查错误信息。');
  }
  
  console.log('\n📁 导出文件列表:');
  results.filter(r => r.success).forEach(r => {
    console.log(`   - ${r.format}: ${path.basename(r.file)}`);
  });
}

testExports().catch(console.error);
