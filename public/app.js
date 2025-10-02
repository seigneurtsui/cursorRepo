// app.js - Frontend JavaScript for Video Chapter Generator

const API_BASE = window.location.origin;
let selectedFiles = [];
let currentPage = 1;
let currentFilters = {};
let ws = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  initializeWebSocket();
  loadVideos();
});

// Initialize event listeners
function initializeEventListeners() {
  // File input
  const fileInput = document.getElementById('fileInput');
  const uploadArea = document.getElementById('uploadArea');

  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  });

  // Upload button
  document.getElementById('uploadBtn').addEventListener('click', uploadFiles);
  document.getElementById('clearBtn').addEventListener('click', clearFiles);

  // Search and filter
  document.getElementById('searchBtn').addEventListener('click', applyFilters);
  document.getElementById('resetBtn').addEventListener('click', resetFilters);

  // Page size
  document.getElementById('pageSize').addEventListener('change', () => {
    currentPage = 1;
    loadVideos();
  });
}

// Initialize WebSocket for real-time updates
function initializeWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('🔌 WebSocket connected');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('🔌 WebSocket disconnected, reconnecting...');
    setTimeout(initializeWebSocket, 3000);
  };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'status':
      updateVideoStatus(data.videoId, data.status, data.message);
      break;
    case 'progress':
      updateProgress(data.videoId, data.stage, data.progress, data.message);
      break;
    case 'completed':
      showToast(`视频处理完成！生成了 ${data.chapters} 个章节`, 'success');
      loadVideos();
      break;
    case 'error':
      showToast(`处理失败: ${data.error}`, 'error');
      loadVideos();
      break;
  }
}

// File selection handler
function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  addFiles(files);
}

// Add files to selection
function addFiles(files) {
  const videoFiles = files.filter(file => file.type.startsWith('video/'));
  selectedFiles = [...selectedFiles, ...videoFiles];
  renderSelectedFiles();
}

// Render selected files
function renderSelectedFiles() {
  const container = document.getElementById('selectedFiles');
  const actions = document.getElementById('uploadActions');

  if (selectedFiles.length === 0) {
    container.innerHTML = '';
    actions.style.display = 'none';
    return;
  }

  actions.style.display = 'flex';

  container.innerHTML = selectedFiles.map((file, index) => `
    <div class="file-item">
      <div class="file-info">
        <div class="file-name">📹 ${file.name}</div>
        <div class="file-meta">${formatFileSize(file.size)}</div>
      </div>
      <div class="file-actions">
        <button onclick="removeFile(${index})">删除</button>
      </div>
    </div>
  `).join('');
}

// Remove file from selection
function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
}

// Clear all files
function clearFiles() {
  selectedFiles = [];
  document.getElementById('fileInput').value = '';
  renderSelectedFiles();
}

// Upload files
async function uploadFiles() {
  if (selectedFiles.length === 0) {
    showToast('请先选择视频文件', 'warning');
    return;
  }

  const formData = new FormData();
  selectedFiles.forEach(file => {
    formData.append('videos', file);
  });

  try {
    showToast(`正在上传 ${selectedFiles.length} 个文件...`, 'info');

    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message, 'success');
      clearFiles();
      loadVideos();

      // Ask if user wants to start processing
      if (confirm('上传成功！是否立即开始处理视频？')) {
        const videoIds = result.videos.map(v => v.id);
        processVideos(videoIds);
      }
    } else {
      showToast('上传失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Upload error:', error);
    showToast('上传失败: ' + error.message, 'error');
  }
}

// Process videos
async function processVideos(videoIds) {
  try {
    showToast('开始处理视频...', 'info');
    document.getElementById('progressSection').style.display = 'block';

    const response = await fetch(`${API_BASE}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ videoIds })
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast('处理失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Process error:', error);
    showToast('处理失败: ' + error.message, 'error');
  }
}

// Update progress
function updateProgress(videoId, stage, progress, message) {
  let container = document.getElementById('progressContainer');
  let progressItem = document.getElementById(`progress-${videoId}`);

  if (!progressItem) {
    progressItem = document.createElement('div');
    progressItem.id = `progress-${videoId}`;
    progressItem.className = 'progress-item';
    container.appendChild(progressItem);
  }

  progressItem.innerHTML = `
    <div class="progress-header">
      <div class="progress-title">视频 #${videoId}</div>
      <div class="progress-status">${stage}</div>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar" style="width: ${progress}%"></div>
    </div>
    <div class="progress-message">${message}</div>
  `;

  if (progress >= 100) {
    setTimeout(() => {
      progressItem.remove();
      if (container.children.length === 0) {
        document.getElementById('progressSection').style.display = 'none';
      }
    }, 3000);
  }
}

// Update video status
function updateVideoStatus(videoId, status, message) {
  // This will be reflected when loadVideos() is called
  console.log(`Video ${videoId} status: ${status} - ${message}`);
}

// Load videos
async function loadVideos() {
  try {
    const pageSize = document.getElementById('pageSize').value;
    const params = new URLSearchParams({
      page: currentPage,
      limit: pageSize,
      ...currentFilters
    });

    const response = await fetch(`${API_BASE}/api/videos?${params}`);
    const result = await response.json();

    if (result.success) {
      renderVideos(result.data);
      renderPagination(result.pagination);
      updateStats(result.data);
    }
  } catch (error) {
    console.error('Load videos error:', error);
    showToast('加载视频失败: ' + error.message, 'error');
  }
}

// Render videos
function renderVideos(videos) {
  const container = document.getElementById('videoList');

  if (videos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📹</div>
        <h3>暂无视频</h3>
        <p>上传视频文件开始使用</p>
      </div>
    `;
    return;
  }

  container.innerHTML = videos.map(video => `
    <div class="video-card ${video.status}">
      <div class="video-card-header">
        <div>
          <div class="video-title">${video.original_name}</div>
          <div class="video-status ${video.status}">
            ${getStatusText(video.status)}
          </div>
        </div>
      </div>
      <div class="video-meta">
        <div class="meta-item">
          <span class="meta-label">文件大小</span>
          <span class="meta-value">${formatFileSize(video.file_size)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">视频时长</span>
          <span class="meta-value">${formatDuration(video.duration)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">章节数量</span>
          <span class="meta-value">${video.chapterCount || 0}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">上传时间</span>
          <span class="meta-value">${formatDate(video.created_at)}</span>
        </div>
      </div>
      ${video.error_message ? `
        <div style="color: var(--danger-color); font-size: 13px; margin-top: 10px;">
          ❌ ${video.error_message}
        </div>
      ` : ''}
      <div class="video-actions">
        ${video.status === 'uploaded' ? `
          <button class="btn-process" onclick="processVideos([${video.id}])">
            ⚙️ 开始处理
          </button>
        ` : ''}
        ${video.status === 'completed' && video.chapterCount > 0 ? `
          <button class="btn-view" onclick="viewChapters(${video.id})">
            👁️ 查看章节
          </button>
        ` : ''}
        <button class="btn-delete" onclick="deleteVideo(${video.id})">
          🗑️ 删除
        </button>
      </div>
    </div>
  `).join('');
}

// Render pagination
function renderPagination(pagination) {
  const container = document.getElementById('pagination');

  if (pagination.limit === 'ALL') {
    container.innerHTML = `
      <div class="page-info">显示全部 ${pagination.total} 条记录</div>
    `;
    return;
  }

  const pages = [];
  for (let i = 1; i <= pagination.totalPages; i++) {
    pages.push(i);
  }

  container.innerHTML = `
    <button ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
      ← 上一页
    </button>
    <div class="page-info">
      第 ${currentPage} / ${pagination.totalPages} 页 (共 ${pagination.total} 条)
    </div>
    <button ${currentPage === pagination.totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
      下一页 →
    </button>
  `;
}

// Go to page
function goToPage(page) {
  currentPage = page;
  loadVideos();
}

// Update stats
function updateStats(videos) {
  const totalVideos = videos.length;
  const totalChapters = videos.reduce((sum, v) => sum + (v.chapterCount || 0), 0);
  const processingCount = videos.filter(v => v.status === 'processing').length;

  document.getElementById('totalVideos').textContent = totalVideos;
  document.getElementById('totalChapters').textContent = totalChapters;
  document.getElementById('processingCount').textContent = processingCount;
}

// Apply filters
function applyFilters() {
  const keyword = document.getElementById('searchKeyword').value.trim();
  const status = document.getElementById('filterStatus').value;
  const startDate = document.getElementById('filterStartDate').value;
  const endDate = document.getElementById('filterEndDate').value;

  currentFilters = {
    ...(keyword && { keyword }),
    ...(status && { status }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate })
  };

  currentPage = 1;
  loadVideos();
}

// Reset filters
function resetFilters() {
  document.getElementById('searchKeyword').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterStartDate').value = '';
  document.getElementById('filterEndDate').value = '';
  currentFilters = {};
  currentPage = 1;
  loadVideos();
}

// View chapters
async function viewChapters(videoId) {
  try {
    const response = await fetch(`${API_BASE}/api/videos/${videoId}`);
    const result = await response.json();

    if (result.success) {
      const video = result.data;
      const chapters = video.chapters || [];

      const modalContent = `
        <h2>📹 ${video.original_name}</h2>
        <div class="video-meta" style="margin: 20px 0;">
          <div class="meta-item">
            <span class="meta-label">文件大小</span>
            <span class="meta-value">${formatFileSize(video.file_size)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">视频时长</span>
            <span class="meta-value">${formatDuration(video.duration)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">章节数量</span>
            <span class="meta-value">${chapters.length}</span>
          </div>
        </div>
        <h3>📑 章节列表</h3>
        <div class="chapter-list">
          ${chapters.length > 0 ? chapters.map(ch => `
            <div class="chapter-item">
              <div class="chapter-header">
                <div class="chapter-time">
                  [${formatDuration(ch.start_time)} - ${formatDuration(ch.end_time)}]
                </div>
                <div>#${ch.chapter_index}</div>
              </div>
              <div class="chapter-title">${ch.title}</div>
              ${ch.description ? `<div class="chapter-description">${ch.description}</div>` : ''}
            </div>
          `).join('') : '<p>暂无章节</p>'}
        </div>
      `;

      document.getElementById('modalContent').innerHTML = modalContent;
      document.getElementById('videoModal').style.display = 'block';
    }
  } catch (error) {
    console.error('View chapters error:', error);
    showToast('加载章节失败: ' + error.message, 'error');
  }
}

// Close modal
function closeModal() {
  document.getElementById('videoModal').style.display = 'none';
}

// Delete video
async function deleteVideo(videoId) {
  if (!confirm('确定要删除这个视频吗？此操作不可恢复。')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/videos/${videoId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showToast('视频已删除', 'success');
      loadVideos();
    } else {
      showToast('删除失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('删除失败: ' + error.message, 'error');
  }
}

// Export data
async function exportData(format) {
  try {
    showToast(`正在导出 ${format.toUpperCase()} 格式...`, 'info');

    const response = await fetch(`${API_BASE}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        format,
        filters: currentFilters
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast('导出成功！正在下载...', 'success');
      
      // Download file
      const link = document.createElement('a');
      link.href = `${API_BASE}${result.downloadUrl}`;
      link.download = result.filename;
      link.click();
    } else {
      showToast('导出失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Export error:', error);
    showToast('导出失败: ' + error.message, 'error');
  }
}

// Helper functions
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}

function getStatusText(status) {
  const statusMap = {
    uploaded: '已上传',
    processing: '处理中',
    completed: '已完成',
    error: '错误'
  };
  return statusMap[status] || status;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('videoModal');
  if (event.target === modal) {
    closeModal();
  }
};
