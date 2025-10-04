// app.js - Frontend JavaScript for Video Chapter Generator

const API_BASE = window.location.origin;
let selectedFiles = [];
let currentPage = 1;
let currentFilters = {};
let ws = null;
let selectedVideoIds = new Set();

// Processing timer variables
let processingStartTime = null;
let processingTimerInterval = null;
let currentProcessingVideoName = null;
let currentProcessingVideoIndex = null;
let totalVideosToProcess = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initializeEventListeners();
  initializeWebSocket();
  loadVideos();
});

// Check authentication
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/public/login.html';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update balance display
      const balanceElement = document.getElementById('userBalance');
      if (balanceElement) {
        balanceElement.textContent = `¥${result.user.balance.toFixed(2)}`;
      }
      
      // Store user info
      localStorage.setItem('user', JSON.stringify(result.user));
      
      // If admin, show admin-only features
      if (result.user.is_admin) {
        // Show admin user filter in video list header
        const adminFilterContainer = document.getElementById('adminUserFilterContainer');
        if (adminFilterContainer) {
          adminFilterContainer.style.display = 'inline-flex';
          adminFilterContainer.style.alignItems = 'center';
          await loadAdminUserFilter();
        }
        
        // Show member explorer button
        const memberExplorerGroup = document.getElementById('memberExplorerGroup');
        if (memberExplorerGroup) {
          memberExplorerGroup.style.display = 'block';
        }
      }
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/public/login.html';
    }
  } catch (error) {
    console.error('认证检查失败:', error);
    window.location.href = '/public/login.html';
  }
}

// Load admin user filter dropdown (for video list header)
// Global variables for user filter
let allUsersList = [];
let selectedUserIds = [];

async function loadAdminUserFilter() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/api/auth/admin/users?limit=1000`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Store all users (exclude admins)
      allUsersList = result.users.filter(u => !u.is_admin);
      
      // Render user filter list
      renderUserFilterList();
      
      // Add search event listener
      const searchInput = document.getElementById('userFilterSearch');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          renderUserFilterList(this.value.trim());
        });
      }
      
      // Close dropdown when clicking outside
      document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('userFilterDropdown');
        const button = document.getElementById('userFilterButton');
        if (dropdown && button && 
            !dropdown.contains(event.target) && 
            !button.contains(event.target)) {
          dropdown.style.display = 'none';
        }
      });
    }
  } catch (error) {
    console.error('加载会员列表失败:', error);
  }
}

// Render user filter list with optional search
function renderUserFilterList(searchTerm = '') {
  const listContainer = document.getElementById('userFilterList');
  if (!listContainer) return;
  
  // Filter users based on search
  let filteredUsers = allUsersList;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredUsers = allUsersList.filter(user => 
      user.username.toLowerCase().includes(term) || 
      user.email.toLowerCase().includes(term)
    );
  }
  
  if (filteredUsers.length === 0) {
    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">未找到匹配的会员</div>';
    return;
  }
  
  const html = filteredUsers.map(user => {
    const isChecked = selectedUserIds.includes(user.id);
    return `
      <label style="display: block; padding: 8px 10px; cursor: pointer; border-bottom: 1px solid #f5f5f5; user-select: none;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
        <input type="checkbox" value="${user.id}" ${isChecked ? 'checked' : ''} 
               onchange="handleUserCheckboxChange(${user.id})" 
               style="margin-right: 8px; cursor: pointer;">
        <span style="font-weight: 500;">${user.username}</span>
        <span style="color: #666; font-size: 12px; margin-left: 5px;">(${user.email})</span>
      </label>
    `;
  }).join('');
  
  listContainer.innerHTML = html;
}

// Toggle user filter dropdown
function toggleUserFilterDropdown() {
  const dropdown = document.getElementById('userFilterDropdown');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    
    // Focus search input when opening
    if (dropdown.style.display === 'block') {
      const searchInput = document.getElementById('userFilterSearch');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    }
  }
}

// Handle checkbox change
function handleUserCheckboxChange(userId) {
  const index = selectedUserIds.indexOf(userId);
  if (index > -1) {
    selectedUserIds.splice(index, 1);
  } else {
    selectedUserIds.push(userId);
  }
  updateUserFilterButtonText();
}

// Toggle all users selection
function toggleAllUsers() {
  const searchTerm = document.getElementById('userFilterSearch')?.value.trim() || '';
  
  // Filter users based on current search
  let filteredUsers = allUsersList;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredUsers = allUsersList.filter(user => 
      user.username.toLowerCase().includes(term) || 
      user.email.toLowerCase().includes(term)
    );
  }
  
  if (filteredUsers.length === 0) return;
  
  // Check if all filtered users are selected
  const allSelected = filteredUsers.every(user => selectedUserIds.includes(user.id));
  
  if (allSelected) {
    // Deselect all filtered users
    filteredUsers.forEach(user => {
      const index = selectedUserIds.indexOf(user.id);
      if (index > -1) {
        selectedUserIds.splice(index, 1);
      }
    });
  } else {
    // Select all filtered users
    filteredUsers.forEach(user => {
      if (!selectedUserIds.includes(user.id)) {
        selectedUserIds.push(user.id);
      }
    });
  }
  
  // Re-render list
  renderUserFilterList(searchTerm);
  updateUserFilterButtonText();
}

// Update button text based on selection
function updateUserFilterButtonText() {
  const buttonText = document.getElementById('userFilterButtonText');
  if (!buttonText) return;
  
  if (selectedUserIds.length === 0) {
    buttonText.textContent = '全部会员';
  } else if (selectedUserIds.length === 1) {
    const user = allUsersList.find(u => u.id === selectedUserIds[0]);
    buttonText.textContent = user ? `${user.username}` : '已选择 1 个会员';
  } else {
    buttonText.textContent = `已选择 ${selectedUserIds.length} 个会员`;
  }
}

// Apply user filter
function applyUserFilter() {
  // Close dropdown
  const dropdown = document.getElementById('userFilterDropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
  
  // Clear search
  const searchInput = document.getElementById('userFilterSearch');
  if (searchInput) {
    searchInput.value = '';
  }
  
  // Update button text
  updateUserFilterButtonText();
  
  // Apply filters
  applyFilters();
  
  // Show toast
  if (selectedUserIds.length === 0) {
    showToast('✅ 已清除会员筛选，显示全部会员视频', 'success');
  } else {
    showToast(`✅ 已应用筛选，显示 ${selectedUserIds.length} 个会员的视频`, 'success');
  }
}

// Logout function
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/public/login.html';
}

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
      // Update current video info if provided
      if (data.videoName) {
        updateCurrentProcessingInfo(data.videoName, data.videoIndex, data.totalVideos);
      }
      break;
    case 'completed':
      showToast(`视频处理完成！生成了 ${data.chapters} 个章节`, 'success');
      stopProcessingTimer();
      loadVideos();
      break;
    case 'error':
      showToast(`处理失败: ${data.error}`, 'error');
      stopProcessingTimer();
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

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
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

    // Immediately update UI for all videos being processed
    videoIds.forEach(videoId => {
      updateVideoStatus(videoId, 'processing', '正在处理中...');
    });

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ videoIds })
    });

    const result = await response.json();

    if (response.status === 402) {
      // Balance insufficient
      showToast(`余额不足！需要 ¥${result.required}，当前余额 ¥${result.balance}。请充值后再试。`, 'error');
      if (confirm('余额不足，是否前往充值？')) {
        window.location.href = '/public/profile.html';
      }
      loadVideos();
      return;
    }

    if (result.success) {
      showToast(result.message + (result.totalCost > 0 ? ` (将扣费 ¥${result.totalCost})` : ''), 'success');
      // Refresh balance after processing starts
      setTimeout(() => checkAuth(), 2000);
    } else {
      showToast('处理失败: ' + result.error, 'error');
      // Reload videos to get correct status on error
      loadVideos();
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
  console.log(`Video ${videoId} status: ${status} - ${message}`);
  
  // Find the video card in the DOM
  const videoCard = document.querySelector(`[data-video-id="${videoId}"]`);
  if (!videoCard) {
    console.log('Video card not found, will reload on completion');
    return;
  }
  
  // Update the status display
  const statusElement = videoCard.querySelector('.video-status');
  if (statusElement) {
    statusElement.className = `video-status ${status}`;
    statusElement.textContent = getStatusText(status);
  }
  
  // Update the action buttons based on status
  const actionsContainer = videoCard.querySelector('.video-actions');
  if (actionsContainer && status === 'processing') {
    // Find and update the process button
    const processButton = actionsContainer.querySelector('.btn-process');
    if (processButton) {
      processButton.disabled = true;
      processButton.style.opacity = '0.6';
      processButton.style.cursor = 'not-allowed';
      processButton.innerHTML = '⚙️ 处理中...';
    }
  }
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

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/api/videos?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Check authentication
    if (response.status === 401) {
      showToast('登录已过期，请重新登录', 'error');
      setTimeout(() => {
        window.location.href = '/public/login.html';
      }, 1500);
      return;
    }
    
    const result = await response.json();

    if (result.success) {
      renderVideos(result.data);
      renderPagination(result.pagination);
      updateStats(result.data);
      updateSelectedCount();  // Update selection count after rendering
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
    <div class="video-card ${video.status}" data-video-id="${video.id}">
      <div class="video-card-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" class="video-select-checkbox" 
                 data-video-id="${video.id}" 
                 onchange="toggleVideoSelection(${video.id}, this.checked)"
                 ${selectedVideoIds.has(video.id) ? 'checked' : ''}
                 style="transform: scale(1.3); cursor: pointer;">
          <div style="flex: 1;">
            <div class="video-title">${video.original_name}</div>
            <div class="video-status ${video.status}">
              ${getStatusText(video.status)}
            </div>
          </div>
          ${video.username ? `
            <div style="font-size: 12px; color: #666; background: #f0f0f0; padding: 4px 10px; border-radius: 4px; white-space: nowrap;">
              👤 ${video.username} ${video.user_email ? `<span style="color: #999;">(${video.user_email})</span>` : ''}
            </div>
          ` : ''}
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
        ${video.status === 'processing' ? `
          <button class="btn-process" disabled style="opacity: 0.6; cursor: not-allowed;">
            ⚙️ 处理中...
          </button>
        ` : ''}
        ${video.status === 'completed' && video.chapterCount > 0 ? `
          <button class="btn-view" onclick="viewChapters(${video.id})">
            👁️ 查看章节
          </button>
        ` : ''}
        ${video.status === 'completed' ? `
          <button class="btn-view" onclick="viewTranscript(${video.id})">
            📝 查看字幕
          </button>
          <button class="btn-primary" onclick="exportCustomExcel(${video.id})" style="font-size: 12px; padding: 6px 12px;">
            📊 导出定制EXCEL
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
  
  // Admin: user filter (support multiple user IDs)
  const userIds = selectedUserIds.length > 0 ? selectedUserIds.join(',') : '';

  currentFilters = {
    ...(keyword && { keyword }),
    ...(status && { status }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...(userIds && { userIds })
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
  
  // Admin: reset user filter
  selectedUserIds = [];
  updateUserFilterButtonText();
  renderUserFilterList();
  
  currentFilters = {};
  currentPage = 1;
  loadVideos();
}

// Export filtered videos to Excel (admin only) - from video list header
async function exportFilteredVideos() {
  try {
    const token = localStorage.getItem('token');
    
    // Build query parameters for current filters
    const params = new URLSearchParams();
    params.append('limit', 'ALL');
    
    // Apply current filters
    if (currentFilters.keyword) params.append('keyword', currentFilters.keyword);
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
    if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
    if (currentFilters.userIds) params.append('userIds', currentFilters.userIds);
    
    // Show loading toast
    const filterInfo = selectedUserIds.length > 0 
      ? `（已筛选 ${selectedUserIds.length} 个会员）` 
      : '（全部会员）';
    showToast(`正在获取视频数据... ${filterInfo}`, 'info');
    
    // Get videos with current filters
    const response = await fetch(`${API_BASE}/api/videos?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('获取视频数据失败');
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data || result.data.length === 0) {
      showToast('⚠️ 没有可导出的视频数据', 'warning');
      return;
    }
    
    const videoCount = result.data.length;
    
    if (!confirm(`确定要导出 ${videoCount} 个视频的信息吗？${filterInfo}\n\n导出的Excel文件将包含：\n• 视频详情\n• 上传者用户名和邮箱\n• 章节列表`)) {
      return;
    }
    
    showToast(`正在导出 ${videoCount} 个视频...`, 'info');
    
    const videoIds = result.data.map(v => v.id);
    
    // Export via existing export API
    const exportResponse = await fetch(`${API_BASE}/api/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        format: 'excel',
        videoIds: videoIds
      })
    });
    
    if (!exportResponse.ok) {
      const errorData = await exportResponse.json();
      throw new Error(errorData.error || '导出失败');
    }
    
    // Get download URL from response
    const exportResult = await exportResponse.json();
    
    if (!exportResult.success || !exportResult.downloadUrl) {
      throw new Error('导出失败：未获取到下载链接');
    }
    
    // Download the file using the provided URL
    const link = document.createElement('a');
    link.href = `${API_BASE}${exportResult.downloadUrl}`;
    link.download = exportResult.filename || `videos_export_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`✅ 成功导出${videoCount}个视频！`, 'success');
    
  } catch (error) {
    console.error('Export error:', error);
    showToast('❌ 导出失败: ' + error.message, 'error');
  }
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0;">📑 章节列表</h3>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" onclick="copyChaptersToClipboard(${videoId})" style="padding: 8px 16px; font-size: 14px;">
              📋 复制
            </button>
            <button class="btn btn-primary" onclick="exportChaptersToTxt(${videoId})" style="padding: 8px 16px; font-size: 14px;">
              💾 导出 TXT
            </button>
          </div>
        </div>
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

// Copy chapters to clipboard
async function copyChaptersToClipboard(videoId) {
  try {
    const response = await fetch(`${API_BASE}/api/videos/${videoId}`);
    const result = await response.json();

    if (result.success) {
      const video = result.data;
      const chapters = video.chapters || [];

      if (chapters.length === 0) {
        showToast('暂无章节可复制', 'warning');
        return;
      }

      // Format chapters as text
      let text = `📹 ${video.original_name}\n`;
      text += `⏱️ 时长: ${formatDuration(video.duration)}\n`;
      text += `📊 章节数: ${chapters.length}\n`;
      text += `\n${'='.repeat(50)}\n\n`;

      chapters.forEach((ch, idx) => {
        text += `📑 第 ${ch.chapter_index} 章\n`;
        text += `🕐 时间: ${formatDuration(ch.start_time)} - ${formatDuration(ch.end_time)}\n`;
        text += `📌 标题: ${ch.title}\n`;
        if (ch.description) {
          text += `📝 描述: ${ch.description}\n`;
        }
        if (idx < chapters.length - 1) {
          text += `\n${'-'.repeat(50)}\n\n`;
        }
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(text);
      showToast('✅ 章节内容已复制到剪贴板！', 'success');
    }
  } catch (error) {
    console.error('Copy error:', error);
    showToast('复制失败: ' + error.message, 'error');
  }
}

// Export chapters to TXT file
async function exportChaptersToTxt(videoId) {
  try {
    const response = await fetch(`${API_BASE}/api/videos/${videoId}`);
    const result = await response.json();

    if (result.success) {
      const video = result.data;
      const chapters = video.chapters || [];

      if (chapters.length === 0) {
        showToast('暂无章节可导出', 'warning');
        return;
      }

      // Format chapters as text
      let text = `视频章节列表\n`;
      text += `${'='.repeat(60)}\n\n`;
      text += `视频名称: ${video.original_name}\n`;
      text += `文件大小: ${formatFileSize(video.file_size)}\n`;
      text += `视频时长: ${formatDuration(video.duration)}\n`;
      text += `章节数量: ${chapters.length}\n`;
      text += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
      text += `\n${'='.repeat(60)}\n\n`;

      chapters.forEach((ch, idx) => {
        text += `【第 ${ch.chapter_index} 章】\n`;
        text += `时间范围: ${formatDuration(ch.start_time)} → ${formatDuration(ch.end_time)}\n`;
        text += `章节标题: ${ch.title}\n`;
        if (ch.description) {
          text += `章节描述: ${ch.description}\n`;
        }
        if (idx < chapters.length - 1) {
          text += `\n${'-'.repeat(60)}\n\n`;
        }
      });

      text += `\n${'='.repeat(60)}\n`;
      text += `由视频章节生成器自动生成\n`;

      // Create blob and download
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const filename = `${video.original_name.replace(/\.[^/.]+$/, '')}_章节列表_${Date.now()}.txt`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('✅ 章节列表已导出为 TXT 文件！', 'success');
    }
  } catch (error) {
    console.error('Export TXT error:', error);
    showToast('导出失败: ' + error.message, 'error');
  }
}

// View transcript
async function viewTranscript(videoId) {
  try {
    const response = await fetch(`${API_BASE}/api/videos/${videoId}`);
    const result = await response.json();

    if (result.success) {
      const video = result.data;
      const transcript = video.transcript || '暂无字幕';

      const modalContent = `
        <h2>📝 ${video.original_name} - 字幕</h2>
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0;">
          <div class="video-meta">
            <div class="meta-item">
              <span class="meta-label">视频时长</span>
              <span class="meta-value">${formatDuration(video.duration)}</span>
            </div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" onclick="toggleTranscriptView(${videoId})" style="padding: 8px 16px;">
              📄 纯文本
            </button>
            <button class="btn btn-secondary" onclick="copyTranscriptToClipboard(${videoId})" style="padding: 8px 16px;">
              📋 复制字幕
            </button>
            <button class="btn btn-primary" onclick="downloadTranscript(${videoId})" style="padding: 8px 16px;">
              💾 下载字幕
            </button>
          </div>
        </div>
        <div id="transcriptContent" style="max-height: 500px; overflow-y: auto; padding: 20px; background: #f5f5f5; border-radius: 8px; white-space: pre-wrap; font-family: monospace; font-size: 14px; line-height: 1.8;" data-mode="srt" data-video-id="${videoId}">
          ${transcript}
        </div>
      `;

      document.getElementById('modalContent').innerHTML = modalContent;
      document.getElementById('videoModal').style.display = 'block';
    }
  } catch (error) {
    console.error('View transcript error:', error);
    showToast('加载字幕失败: ' + error.message, 'error');
  }
}

// Toggle transcript view between SRT and plain text
async function toggleTranscriptView(videoId) {
  try {
    const contentDiv = document.getElementById('transcriptContent');
    const currentMode = contentDiv.dataset.mode;
    const button = event.target;
    
    const response = await fetch(`${API_BASE}/api/videos/${videoId}`);
    const result = await response.json();
    
    if (result.success) {
      const video = result.data;
      const transcript = video.transcript || '暂无字幕';
      
      if (currentMode === 'srt') {
        // Switch to plain text mode
        const plainText = parseSRTToPlainText(transcript);
        contentDiv.innerHTML = plainText;
        contentDiv.dataset.mode = 'plain';
        button.innerHTML = '📋 SRT格式';
      } else {
        // Switch back to SRT mode
        contentDiv.innerHTML = transcript;
        contentDiv.dataset.mode = 'srt';
        button.innerHTML = '📄 纯文本';
      }
    }
  } catch (error) {
    console.error('Toggle transcript view error:', error);
    showToast('切换显示模式失败: ' + error.message, 'error');
  }
}

// Parse SRT to plain text (remove timestamps and indices)
function parseSRTToPlainText(srtContent) {
  if (!srtContent) return '';
  
  const lines = srtContent.trim().split('\n');
  const textLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Skip index lines (pure numbers)
    if (/^\d+$/.test(line)) continue;
    
    // Skip timestamp lines
    if (line.includes('-->')) continue;
    
    // This is actual subtitle text
    textLines.push(line);
  }
  
  return textLines.join('\n\n');
}

// Copy transcript to clipboard
async function copyTranscriptToClipboard(videoId) {
  try {
    const response = await fetch(`${API_BASE}/api/videos/${videoId}`);
    const result = await response.json();

    if (result.success && result.data.transcript) {
      await navigator.clipboard.writeText(result.data.transcript);
      showToast('✅ 字幕已复制到剪贴板！', 'success');
    } else {
      showToast('暂无字幕可复制', 'warning');
    }
  } catch (error) {
    console.error('Copy transcript error:', error);
    showToast('复制失败: ' + error.message, 'error');
  }
}

// Download transcript
async function downloadTranscript(videoId) {
  try {
    const response = await fetch(`${API_BASE}/api/videos/${videoId}`);
    const result = await response.json();

    if (result.success && result.data.transcript) {
      const video = result.data;
      const blob = new Blob([video.transcript], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${video.original_name.replace(/\.[^/.]+$/, '')}_字幕.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('✅ 字幕文件已下载！', 'success');
    } else {
      showToast('暂无字幕可下载', 'warning');
    }
  } catch (error) {
    console.error('Download transcript error:', error);
    showToast('下载失败: ' + error.message, 'error');
  }
}

// Export custom Excel for single video
async function exportCustomExcel(videoId) {
  try {
    showToast('正在生成定制 EXCEL...', 'info');
    
    const response = await fetch(`${API_BASE}/api/export-custom-excel/${videoId}`);
    const blob = await response.blob();
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `custom_export_${videoId}_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('✅ 定制 EXCEL 已下载！', 'success');
  } catch (error) {
    console.error('Export custom Excel error:', error);
    showToast('导出失败: ' + error.message, 'error');
  }
}

// Export data
async function exportData(format) {
  try {
    // Check if any videos are selected
    if (selectedVideoIds.size === 0) {
      showToast('请先选择要导出的视频', 'warning');
      return;
    }

    showToast(`正在导出 ${selectedVideoIds.size} 个视频的 ${format.toUpperCase()} 格式...`, 'info');

    const response = await fetch(`${API_BASE}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        format,
        videoIds: Array.from(selectedVideoIds)  // Send selected video IDs
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

// Toggle video selection
function toggleVideoSelection(videoId, checked) {
  if (checked) {
    selectedVideoIds.add(videoId);
  } else {
    selectedVideoIds.delete(videoId);
  }
  updateSelectedCount();
}

// Update selected count display
function updateSelectedCount() {
  const countEl = document.getElementById('selectedCount');
  if (countEl) {
    countEl.textContent = `已选择 ${selectedVideoIds.size} 个视频`;
  }
}

// Select all videos
function selectAllVideos() {
  document.querySelectorAll('.video-select-checkbox').forEach(checkbox => {
    checkbox.checked = true;
    const videoId = parseInt(checkbox.dataset.videoId);
    selectedVideoIds.add(videoId);
  });
  updateSelectedCount();
}

// Clear selection
function clearSelection() {
  document.querySelectorAll('.video-select-checkbox').forEach(checkbox => {
    checkbox.checked = false;
  });
  selectedVideoIds.clear();
  updateSelectedCount();
}

// Batch download transcripts
async function batchDownloadTranscripts() {
  if (selectedVideoIds.size === 0) {
    showToast('请先选择要下载字幕的视频', 'warning');
    return;
  }

  showToast(`正在下载 ${selectedVideoIds.size} 个视频的字幕...`, 'info');

  for (const videoId of selectedVideoIds) {
    try {
      const response = await fetch(`${API_BASE}/api/videos/${videoId}`);
      const result = await response.json();

      if (result.success && result.data.transcript) {
        const video = result.data;
        const blob = new Blob([video.transcript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${video.original_name.replace(/\.[^/.]+$/, '')}_字幕.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Download transcript error for video ${videoId}:`, error);
    }
  }

  showToast(`✅ 已下载 ${selectedVideoIds.size} 个字幕文件！`, 'success');
}

// Batch export custom Excel (merged into one file)
async function batchExportCustomExcel() {
  if (selectedVideoIds.size === 0) {
    showToast('请先选择要导出的视频', 'warning');
    return;
  }

  showToast(`正在合并导出 ${selectedVideoIds.size} 个视频到定制 EXCEL...`, 'info');

  try {
    const response = await fetch(`${API_BASE}/api/batch-export-custom-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoIds: Array.from(selectedVideoIds)
      })
    });

    const blob = await response.blob();
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `custom_export_batch_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`✅ 已合并导出 ${selectedVideoIds.size} 个视频到一个 EXCEL 文件！`, 'success');
  } catch (error) {
    console.error('Batch export custom Excel error:', error);
    showToast('批量导出失败: ' + error.message, 'error');
  }
}

// Start processing timer
function startProcessingTimer() {
  if (!processingStartTime) {
    processingStartTime = Date.now();
  }
  
  if (!processingTimerInterval) {
    processingTimerInterval = setInterval(updateProcessingTimer, 1000);
  }
}

// Update processing timer display
function updateProcessingTimer() {
  if (!processingStartTime) return;
  
  const elapsed = Date.now() - processingStartTime;
  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  const timeElement = document.getElementById('totalProcessingTime');
  if (timeElement) {
    timeElement.textContent = timeStr;
  }
}

// Stop processing timer
function stopProcessingTimer() {
  if (processingTimerInterval) {
    clearInterval(processingTimerInterval);
    processingTimerInterval = null;
  }
  processingStartTime = null;
  
  // Reset display
  const timeElement = document.getElementById('totalProcessingTime');
  if (timeElement) {
    timeElement.textContent = '00:00:00';
  }
  
  const nameElement = document.getElementById('currentVideoName');
  if (nameElement) {
    nameElement.textContent = '无';
  }
  
  const indexElement = document.getElementById('currentVideoIndex');
  if (indexElement) {
    indexElement.textContent = '';
  }
}

// Update current processing info
function updateCurrentProcessingInfo(videoName, videoIndex, totalVideos) {
  currentProcessingVideoName = videoName;
  currentProcessingVideoIndex = videoIndex;
  totalVideosToProcess = totalVideos || 0;
  
  const nameElement = document.getElementById('currentVideoName');
  if (nameElement) {
    nameElement.textContent = videoName || '无';
  }
  
  const indexElement = document.getElementById('currentVideoIndex');
  if (indexElement && videoIndex && totalVideos) {
    indexElement.textContent = `(${videoIndex}/${totalVideos})`;
  }
  
  // Start timer if not already started
  if (!processingTimerInterval) {
    startProcessingTimer();
  }
}

// ===== Member Explorer Functions (Admin Only) =====

let allMembersData = [];
let filteredMembersData = [];

// Open member explorer modal
async function openMemberExplorer() {
  document.getElementById('memberExplorerModal').style.display = 'flex';
  await loadAllMembers();
}

// Close member explorer modal
function closeMemberExplorer() {
  document.getElementById('memberExplorerModal').style.display = 'none';
  document.getElementById('memberSearchInput').value = '';
  document.getElementById('memberStatusFilter').value = '';
}

// Load all members
async function loadAllMembers() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/api/auth/admin/users?limit=10000`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      allMembersData = result.users;
      filteredMembersData = allMembersData;
      renderMemberList();
    } else {
      showToast('加载会员列表失败', 'error');
    }
  } catch (error) {
    console.error('加载会员列表失败:', error);
    showToast('加载会员列表失败', 'error');
  }
}

// Filter member list
function filterMemberList() {
  const searchText = document.getElementById('memberSearchInput').value.toLowerCase();
  const statusFilter = document.getElementById('memberStatusFilter').value;
  
  filteredMembersData = allMembersData.filter(member => {
    const matchesSearch = !searchText || 
      member.username.toLowerCase().includes(searchText) ||
      member.email.toLowerCase().includes(searchText);
    
    const matchesStatus = !statusFilter || 
      (statusFilter === 'active' && member.is_active) ||
      (statusFilter === 'inactive' && !member.is_active);
    
    return matchesSearch && matchesStatus;
  });
  
  renderMemberList();
}

// Render member list
function renderMemberList() {
  const container = document.getElementById('memberListContainer');
  
  // Update count
  document.getElementById('memberCountDisplay').innerHTML = `
    共找到 <strong style="color: #667eea;">${filteredMembersData.length}</strong> 个会员账户
    ${filteredMembersData.length !== allMembersData.length ? `（从 ${allMembersData.length} 个中筛选）` : ''}
  `;
  
  if (filteredMembersData.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #999;">
        <div style="font-size: 64px; margin-bottom: 15px;">🔍</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">未找到匹配的会员</div>
        <div style="font-size: 14px;">请尝试修改搜索条件</div>
      </div>
    `;
    return;
  }
  
  const memberCards = filteredMembersData.map(member => {
    const statusBadge = member.is_active 
      ? '<span style="background: #d4edda; color: #155724; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">✅ 已激活</span>'
      : '<span style="background: #f8d7da; color: #721c24; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">❌ 已禁用</span>';
    
    const adminBadge = member.is_admin
      ? '<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 5px;">🔑 管理员</span>'
      : '';
    
    const balanceColor = member.balance >= 100 ? '#28a745' : (member.balance >= 10 ? '#ffc107' : '#dc3545');
    
    return `
      <div style="border: 2px solid #e9ecef; border-radius: 12px; padding: 20px; margin-bottom: 15px; background: white; transition: all 0.3s; cursor: pointer;" 
           onmouseover="this.style.borderColor='#667eea'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.15)'" 
           onmouseout="this.style.borderColor='#e9ecef'; this.style.boxShadow='none'"
           onclick="viewMemberVideos(${member.id}, '${member.username}')">
        
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="flex: 1;">
            <div style="font-size: 18px; font-weight: 700; color: #333; margin-bottom: 5px;">
              👤 ${member.username}
              ${adminBadge}
            </div>
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">
              📧 ${member.email}
            </div>
          </div>
          <div style="text-align: right;">
            ${statusBadge}
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; padding-top: 12px; border-top: 1px solid #f0f0f0;">
          <div>
            <div style="font-size: 12px; color: #999; margin-bottom: 3px;">💰 账户余额</div>
            <div style="font-size: 20px; font-weight: 700; color: ${balanceColor};">¥${parseFloat(member.balance).toFixed(2)}</div>
          </div>
          
          <div>
            <div style="font-size: 12px; color: #999; margin-bottom: 3px;">📅 注册时间</div>
            <div style="font-size: 14px; color: #333;">${new Date(member.created_at).toLocaleDateString('zh-CN')}</div>
          </div>
          
          ${member.phone ? `
            <div>
              <div style="font-size: 12px; color: #999; margin-bottom: 3px;">📱 手机号</div>
              <div style="font-size: 14px; color: #333;">${member.phone}</div>
            </div>
          ` : ''}
        </div>
        
        <div style="margin-top: 15px; padding-top: 12px; border-top: 1px solid #f0f0f0; text-align: right;">
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); viewMemberVideos(${member.id}, '${member.username}')" 
                  style="padding: 6px 16px; font-size: 13px; background: #667eea; margin-right: 8px;">
            📹 查看视频
          </button>
          <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); exportMemberVideos(${member.id}, '${member.username}')" 
                  style="padding: 6px 16px; font-size: 13px; background: #17a2b8;">
            📥 导出Excel
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = memberCards;
}

// View member's videos
function viewMemberVideos(userId, username) {
  closeMemberExplorer();
  
  // Set the filter in video list header
  const adminUserFilter = document.getElementById('adminUserFilter');
  if (adminUserFilter) {
    adminUserFilter.value = userId;
  }
  
  // Apply filters
  applyFilters();
  
  // Scroll to video list
  document.querySelector('.video-list-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  showToast(`正在显示 ${username} 的视频`, 'success');
}

// Export member's videos to Excel
async function exportMemberVideos(userId, username) {
  if (!confirm(`确定要导出 ${username} 的所有视频信息吗？`)) return;
  
  try {
    showToast('正在生成Excel文件...', 'info');
    const token = localStorage.getItem('token');
    
    // Get member's videos
    const response = await fetch(`${API_BASE}/api/videos?userId=${userId}&limit=ALL`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success && result.data.length > 0) {
      const videoIds = result.data.map(v => v.id);
      
      // Export via existing export API
      const exportResponse = await fetch(`${API_BASE}/api/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format: 'excel',
          videoIds: videoIds
        })
      });
      
      if (exportResponse.ok) {
        const blob = await exportResponse.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${username}_videos_${Date.now()}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        showToast(`✅ 成功导出 ${username} 的 ${result.data.length} 个视频`, 'success');
      } else {
        throw new Error('导出失败');
      }
    } else {
      showToast(`${username} 还没有上传视频`, 'warning');
    }
  } catch (error) {
    console.error('Export member videos error:', error);
    showToast('导出失败: ' + error.message, 'error');
  }
}

// Export members balance to Excel (admin only)
async function exportMembersBalanceExcel() {
  try {
    const token = localStorage.getItem('token');
    
    // Show loading
    showToast('正在获取会员数据...', 'info');
    
    // Get all users data
    const response = await fetch(`${API_BASE}/api/auth/admin/users?limit=1000`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('获取会员数据失败');
    }
    
    const result = await response.json();
    
    if (!result.success || !result.users || result.users.length === 0) {
      showToast('⚠️ 没有可导出的会员数据', 'warning');
      return;
    }
    
    const userCount = result.users.length;
    
    if (!confirm(`确定要导出${userCount}个会员的账户信息和余额吗？\n\n导出的Excel文件将包含：\n• 用户ID\n• 用户名\n• 邮箱\n• 账户余额\n• 账户状态\n• 注册时间`)) {
      return;
    }
    
    showToast(`正在导出${userCount}个会员...`, 'info');
    
    // Create Excel file using ExcelJS (client-side)
    // We'll use a simple HTML table approach and convert to Excel
    
    // Prepare data for export
    const users = result.users;
    
    // Create CSV content (Excel can open CSV files)
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel
    csvContent += 'ID,用户名,邮箱,账户余额,会员等级,账户状态,手机号,微信,注册时间,最后登录\n';
    
    users.forEach(user => {
      const row = [
        user.id,
        `"${user.username || ''}"`,
        `"${user.email || ''}"`,
        parseFloat(user.balance || 0).toFixed(2),
        user.membership_level || 1,
        user.is_active ? '已激活' : '已禁用',
        `"${user.phone || ''}"`,
        `"${user.wechat || ''}"`,
        user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '',
        user.last_login_at ? new Date(user.last_login_at).toLocaleString('zh-CN') : '从未登录'
      ];
      csvContent += row.join(',') + '\n';
    });
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `members_balance_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`✅ 成功导出${userCount}个会员！`, 'success');
    
  } catch (error) {
    console.error('Export members balance error:', error);
    showToast('❌ 导出失败: ' + error.message, 'error');
  }
}
