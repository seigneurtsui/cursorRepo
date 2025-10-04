// admin-enhanced.js - Enhanced admin panel with search, pagination, and sorting

// ==================== Global State ====================
let allUsers = [];
let filteredUsers = [];
let currentUserPage = 1;
let userPageSize = 20;
let userSortField = 'id';
let userSortDirection = 'desc';

let allTransactions = [];
let filteredTransactions = [];
let currentTransactionPage = 1;
let transactionPageSize = 20;
let transactionSortField = 'created_at';
let transactionSortDirection = 'desc';

let allLogs = [];
let filteredLogs = [];
let currentLogPage = 1;
let logPageSize = 50;
let logSortField = 'sent_at';
let logSortDirection = 'desc';

// ==================== Users Management ====================

async function loadUsers() {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    
    if (result.success) {
      allUsers = result.users;
      filteredUsers = [...allUsers];
      renderUsersTable();
    }
  } catch (error) {
    console.error('加载用户失败:', error);
  }
}

function searchUsers() {
  const dateFrom = document.getElementById('userDateFrom').value;
  const dateTo = document.getElementById('userDateTo').value;
  const keyword = document.getElementById('userKeyword').value.toLowerCase().trim();
  
  filteredUsers = allUsers.filter(user => {
    // Date filter
    if (dateFrom) {
      const userDate = new Date(user.created_at).toISOString().split('T')[0];
      if (userDate < dateFrom) return false;
    }
    if (dateTo) {
      const userDate = new Date(user.created_at).toISOString().split('T')[0];
      if (userDate > dateTo) return false;
    }
    
    // Keyword filter
    if (keyword) {
      const email = (user.email || '').toLowerCase();
      const username = (user.username || '').toLowerCase();
      if (!email.includes(keyword) && !username.includes(keyword)) {
        return false;
      }
    }
    
    return true;
  });
  
  currentUserPage = 1;
  renderUsersTable();
  showToast(`✅ 找到 ${filteredUsers.length} 个用户`);
}

function resetUserSearch() {
  document.getElementById('userDateFrom').value = '';
  document.getElementById('userDateTo').value = '';
  document.getElementById('userKeyword').value = '';
  filteredUsers = [...allUsers];
  currentUserPage = 1;
  renderUsersTable();
  showToast('🔄 已重置搜索条件');
}

function changeUserPageSize() {
  userPageSize = document.getElementById('userPageSize').value;
  currentUserPage = 1;
  renderUsersTable();
}

function sortUsers(field) {
  if (userSortField === field) {
    userSortDirection = userSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    userSortField = field;
    userSortDirection = 'asc';
  }
  
  filteredUsers.sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    
    // Handle null/undefined
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';
    
    // Convert to comparable types
    if (field === 'balance') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else if (field === 'created_at') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    } else if (field === 'id') {
      aVal = parseInt(aVal) || 0;
      bVal = parseInt(bVal) || 0;
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    
    if (userSortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
  
  renderUsersTable();
}

function renderUsersTable() {
  const startIndex = userPageSize === 'all' ? 0 : (currentUserPage - 1) * parseInt(userPageSize);
  const endIndex = userPageSize === 'all' ? filteredUsers.length : startIndex + parseInt(userPageSize);
  const pageUsers = filteredUsers.slice(startIndex, endIndex);
  
  const sortIcon = (field) => {
    if (userSortField !== field) return '↕️';
    return userSortDirection === 'asc' ? '↑' : '↓';
  };
  
  const html = `
    <table class="table">
      <thead>
        <tr>
          <th onclick="sortUsers('id')" style="cursor: pointer;">ID ${sortIcon('id')}</th>
          <th onclick="sortUsers('email')" style="cursor: pointer;">邮箱 ${sortIcon('email')}</th>
          <th onclick="sortUsers('username')" style="cursor: pointer;">用户名 ${sortIcon('username')}</th>
          <th onclick="sortUsers('balance')" style="cursor: pointer;">余额 ${sortIcon('balance')}</th>
          <th onclick="sortUsers('is_active')" style="cursor: pointer;">状态 ${sortIcon('is_active')}</th>
          <th onclick="sortUsers('phone')" style="cursor: pointer;">手机 ${sortIcon('phone')}</th>
          <th onclick="sortUsers('created_at')" style="cursor: pointer;">注册时间 ${sortIcon('created_at')}</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${pageUsers.map(user => `
          <tr>
            <td>${user.id}</td>
            <td>${user.email}</td>
            <td>${user.username}${user.is_admin ? ' <span style="background: #ffc107; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">管理员</span>' : ''}</td>
            <td id="balance-${user.id}">¥${parseFloat(user.balance).toFixed(2)}</td>
            <td>
              <span style="color: ${user.is_active ? '#28a745' : '#dc3545'};">
                ${user.is_active ? '✅ 激活' : '❌ 禁用'}
              </span>
            </td>
            <td>${user.phone || '-'}</td>
            <td>${new Date(user.created_at).toLocaleString('zh-CN')}</td>
            <td>
              ${!user.is_admin ? `
                <button class="btn btn-sm ${user.is_active ? 'btn-warning' : 'btn-success'}" 
                        onclick="toggleUserStatus(${user.id}, '${user.username}', ${!user.is_active})">
                  ${user.is_active ? '禁用' : '激活'}
                </button>
                <button class="btn btn-sm btn-info" onclick="showAdjustBalanceModal(${user.id}, '${user.username}', ${user.balance})">调整余额</button>
                <button class="btn btn-sm btn-warning" onclick="resetUserPassword(${user.id}, '${user.username}')">重置密码</button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">删除</button>
              ` : '<span style="color: #999;">-</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="text-align: center; color: #666; margin-top: 10px;">
      显示 ${startIndex + 1}-${Math.min(endIndex, filteredUsers.length)} / 共 ${filteredUsers.length} 个用户
    </div>
  `;
  
  document.getElementById('usersTable').innerHTML = html;
  renderUserPagination();
}

function renderUserPagination() {
  if (userPageSize === 'all') {
    document.getElementById('userPagination').innerHTML = '';
    return;
  }
  
  const totalPages = Math.ceil(filteredUsers.length / parseInt(userPageSize));
  let html = '';
  
  if (currentUserPage > 1) {
    html += `<button onclick="gotoUserPage(${currentUserPage - 1})" class="btn btn-sm btn-secondary">上一页</button>`;
  }
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentUserPage - 2 && i <= currentUserPage + 2)) {
      html += `<button onclick="gotoUserPage(${i})" class="btn btn-sm ${i === currentUserPage ? 'btn-primary' : 'btn-secondary'}">${i}</button>`;
    } else if (i === currentUserPage - 3 || i === currentUserPage + 3) {
      html += `<span style="padding: 0 5px;">...</span>`;
    }
  }
  
  if (currentUserPage < totalPages) {
    html += `<button onclick="gotoUserPage(${currentUserPage + 1})" class="btn btn-sm btn-secondary">下一页</button>`;
  }
  
  document.getElementById('userPagination').innerHTML = html;
}

function gotoUserPage(page) {
  currentUserPage = page;
  renderUsersTable();
}

async function exportFilteredUsers() {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) {
    alert('❌ Excel库未加载，请刷新页面重试');
    return;
  }
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('用户列表');
  
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: '邮箱', key: 'email', width: 30 },
    { header: '用户名', key: 'username', width: 20 },
    { header: '余额', key: 'balance', width: 15 },
    { header: '状态', key: 'status', width: 10 },
    { header: '手机', key: 'phone', width: 20 },
    { header: '注册时间', key: 'created_at', width: 20 }
  ];
  
  filteredUsers.forEach(user => {
    worksheet.addRow({
      id: user.id,
      email: user.email,
      username: user.username + (user.is_admin ? ' (管理员)' : ''),
      balance: `¥${parseFloat(user.balance).toFixed(2)}`,
      status: user.is_active ? '激活' : '禁用',
      phone: user.phone || '-',
      created_at: new Date(user.created_at).toLocaleString('zh-CN')
    });
  });
  
  // Style header
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `用户列表_${Date.now()}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  showToast(`✅ 已导出 ${filteredUsers.length} 个用户`);
}

// ==================== Transactions Management ====================

async function loadTransactions() {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/admin/transactions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    
    if (result.success) {
      allTransactions = result.transactions;
      filteredTransactions = [...allTransactions];
      renderTransactionsTable();
    }
  } catch (error) {
    console.error('加载交易失败:', error);
  }
}

function searchTransactions() {
  const dateFrom = document.getElementById('transactionDateFrom').value;
  const dateTo = document.getElementById('transactionDateTo').value;
  const keyword = document.getElementById('transactionKeyword').value.toLowerCase().trim();
  
  filteredTransactions = allTransactions.filter(t => {
    // Date filter
    if (dateFrom) {
      const transDate = new Date(t.created_at).toISOString().split('T')[0];
      if (transDate < dateFrom) return false;
    }
    if (dateTo) {
      const transDate = new Date(t.created_at).toISOString().split('T')[0];
      if (transDate > dateTo) return false;
    }
    
    // Keyword filter
    if (keyword) {
      const user = (t.user_email || '').toLowerCase() + ' ' + (t.username || '').toLowerCase();
      const type = (t.type || '').toLowerCase();
      const amount = String(t.amount || '');
      const plan = (t.plan_name || '').toLowerCase();
      const method = (t.payment_method || '').toLowerCase();
      
      const searchText = (user + ' ' + type + ' ' + amount + ' ' + plan + ' ' + method).toLowerCase();
      if (!searchText.includes(keyword)) return false;
    }
    
    return true;
  });
  
  currentTransactionPage = 1;
  renderTransactionsTable();
  showToast(`✅ 找到 ${filteredTransactions.length} 条交易`);
}

function resetTransactionSearch() {
  document.getElementById('transactionDateFrom').value = '';
  document.getElementById('transactionDateTo').value = '';
  document.getElementById('transactionKeyword').value = '';
  filteredTransactions = [...allTransactions];
  currentTransactionPage = 1;
  renderTransactionsTable();
  showToast('🔄 已重置搜索条件');
}

function changeTransactionPageSize() {
  transactionPageSize = document.getElementById('transactionPageSize').value;
  currentTransactionPage = 1;
  renderTransactionsTable();
}

function sortTransactions(field) {
  if (transactionSortField === field) {
    transactionSortDirection = transactionSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    transactionSortField = field;
    transactionSortDirection = 'asc';
  }
  
  filteredTransactions.sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';
    
    if (field === 'amount') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else if (field === 'created_at') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    } else if (field === 'id') {
      aVal = parseInt(aVal) || 0;
      bVal = parseInt(bVal) || 0;
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    
    if (transactionSortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
  
  renderTransactionsTable();
}

function renderTransactionsTable() {
  const startIndex = transactionPageSize === 'all' ? 0 : (currentTransactionPage - 1) * parseInt(transactionPageSize);
  const endIndex = transactionPageSize === 'all' ? filteredTransactions.length : startIndex + parseInt(transactionPageSize);
  const pageTransactions = filteredTransactions.slice(startIndex, endIndex);
  
  const sortIcon = (field) => {
    if (transactionSortField !== field) return '↕️';
    return transactionSortDirection === 'asc' ? '↑' : '↓';
  };
  
  const html = `
    <table class="table">
      <thead>
        <tr>
          <th onclick="sortTransactions('created_at')" style="cursor: pointer;">时间 ${sortIcon('created_at')}</th>
          <th onclick="sortTransactions('username')" style="cursor: pointer;">用户 ${sortIcon('username')}</th>
          <th onclick="sortTransactions('type')" style="cursor: pointer;">类型 ${sortIcon('type')}</th>
          <th onclick="sortTransactions('amount')" style="cursor: pointer;">金额 ${sortIcon('amount')}</th>
          <th onclick="sortTransactions('plan_name')" style="cursor: pointer;">套餐 ${sortIcon('plan_name')}</th>
          <th onclick="sortTransactions('payment_method')" style="cursor: pointer;">支付方式 ${sortIcon('payment_method')}</th>
          <th onclick="sortTransactions('status')" style="cursor: pointer;">状态 ${sortIcon('status')}</th>
        </tr>
      </thead>
      <tbody>
        ${pageTransactions.map(t => `
          <tr>
            <td>${new Date(t.created_at).toLocaleString('zh-CN')}</td>
            <td>
              <div>${t.username || 'N/A'}</div>
              <small style="color: #999;">${t.user_email || ''}</small>
            </td>
            <td>${t.type === 'recharge' ? '💰 充值' : '📝 消费'}</td>
            <td style="color: ${t.type === 'recharge' ? '#28a745' : '#dc3545'}; font-weight: 600;">
              ${t.type === 'recharge' ? '+' : '-'}¥${Math.abs(parseFloat(t.amount)).toFixed(2)}
            </td>
            <td>${t.plan_name || '-'}</td>
            <td>${t.payment_method || '-'}</td>
            <td>
              <span style="color: ${t.status === 'completed' ? '#28a745' : t.status === 'pending' ? '#ffc107' : '#dc3545'};">
                ${t.status === 'completed' ? '✅ 完成' : t.status === 'pending' ? '⏳ 待处理' : '❌ 失败'}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="text-align: center; color: #666; margin-top: 10px;">
      显示 ${startIndex + 1}-${Math.min(endIndex, filteredTransactions.length)} / 共 ${filteredTransactions.length} 条交易
    </div>
  `;
  
  document.getElementById('transactionsTable').innerHTML = html;
  renderTransactionPagination();
}

function renderTransactionPagination() {
  if (transactionPageSize === 'all') {
    document.getElementById('transactionPagination').innerHTML = '';
    return;
  }
  
  const totalPages = Math.ceil(filteredTransactions.length / parseInt(transactionPageSize));
  let html = '';
  
  if (currentTransactionPage > 1) {
    html += `<button onclick="gotoTransactionPage(${currentTransactionPage - 1})" class="btn btn-sm btn-secondary">上一页</button>`;
  }
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentTransactionPage - 2 && i <= currentTransactionPage + 2)) {
      html += `<button onclick="gotoTransactionPage(${i})" class="btn btn-sm ${i === currentTransactionPage ? 'btn-primary' : 'btn-secondary'}">${i}</button>`;
    } else if (i === currentTransactionPage - 3 || i === currentTransactionPage + 3) {
      html += `<span style="padding: 0 5px;">...</span>`;
    }
  }
  
  if (currentTransactionPage < totalPages) {
    html += `<button onclick="gotoTransactionPage(${currentTransactionPage + 1})" class="btn btn-sm btn-secondary">下一页</button>`;
  }
  
  document.getElementById('transactionPagination').innerHTML = html;
}

function gotoTransactionPage(page) {
  currentTransactionPage = page;
  renderTransactionsTable();
}

async function exportFilteredTransactions() {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) {
    alert('❌ Excel库未加载，请刷新页面重试');
    return;
  }
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('交易记录');
  
  worksheet.columns = [
    { header: '时间', key: 'created_at', width: 20 },
    { header: '用户', key: 'username', width: 20 },
    { header: '邮箱', key: 'user_email', width: 30 },
    { header: '类型', key: 'type', width: 10 },
    { header: '金额', key: 'amount', width: 15 },
    { header: '套餐', key: 'plan_name', width: 20 },
    { header: '支付方式', key: 'payment_method', width: 15 },
    { header: '状态', key: 'status', width: 10 }
  ];
  
  filteredTransactions.forEach(t => {
    worksheet.addRow({
      created_at: new Date(t.created_at).toLocaleString('zh-CN'),
      username: t.username || 'N/A',
      user_email: t.user_email || '',
      type: t.type === 'recharge' ? '充值' : '消费',
      amount: `¥${parseFloat(t.amount).toFixed(2)}`,
      plan_name: t.plan_name || '-',
      payment_method: t.payment_method || '-',
      status: t.status === 'completed' ? '完成' : t.status === 'pending' ? '待处理' : '失败'
    });
  });
  
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `交易记录_${Date.now()}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  showToast(`✅ 已导出 ${filteredTransactions.length} 条交易`);
}

// ==================== Notification Logs Management ====================

async function loadNotificationLogs() {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch(`${API_BASE}/api/notifications/logs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const logs = await response.json();
    
    allLogs = logs;
    filteredLogs = [...allLogs];
    renderLogsTable();
  } catch (error) {
    console.error('加载通知记录失败:', error);
    document.getElementById('notificationLogsList').innerHTML = '<div style="color: #dc3545; text-align: center; padding: 20px;">加载失败</div>';
  }
}

function searchLogs() {
  const dateFrom = document.getElementById('logDateFrom').value;
  const dateTo = document.getElementById('logDateTo').value;
  const keyword = document.getElementById('logKeyword').value.toLowerCase().trim();
  
  filteredLogs = allLogs.filter(log => {
    // Date filter
    if (dateFrom) {
      const logDate = new Date(log.sent_at).toISOString().split('T')[0];
      if (logDate < dateFrom) return false;
    }
    if (dateTo) {
      const logDate = new Date(log.sent_at).toISOString().split('T')[0];
      if (logDate > dateTo) return false;
    }
    
    // Keyword filter
    if (keyword) {
      const user = ((log.username || '') + ' ' + (log.email || '')).toLowerCase();
      const type = (log.notification_type || '').toLowerCase();
      const channel = (log.channel || '').toLowerCase();
      const title = (log.title || '').toLowerCase();
      const status = (log.status || '').toLowerCase();
      
      const searchText = (user + ' ' + type + ' ' + channel + ' ' + title + ' ' + status).toLowerCase();
      if (!searchText.includes(keyword)) return false;
    }
    
    return true;
  });
  
  currentLogPage = 1;
  renderLogsTable();
  showToast(`✅ 找到 ${filteredLogs.length} 条通知记录`);
}

function resetLogSearch() {
  document.getElementById('logDateFrom').value = '';
  document.getElementById('logDateTo').value = '';
  document.getElementById('logKeyword').value = '';
  filteredLogs = [...allLogs];
  currentLogPage = 1;
  renderLogsTable();
  showToast('🔄 已重置搜索条件');
}

function changeLogPageSize() {
  logPageSize = document.getElementById('logPageSize').value;
  currentLogPage = 1;
  renderLogsTable();
}

function sortLogs(field) {
  if (logSortField === field) {
    logSortDirection = logSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    logSortField = field;
    logSortDirection = 'asc';
  }
  
  filteredLogs.sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';
    
    if (field === 'sent_at') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    } else if (field === 'id') {
      aVal = parseInt(aVal) || 0;
      bVal = parseInt(bVal) || 0;
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    
    if (logSortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
  
  renderLogsTable();
}

function renderLogsTable() {
  if (filteredLogs.length === 0) {
    document.getElementById('notificationLogsList').innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">暂无通知记录</div>';
    return;
  }
  
  const startIndex = logPageSize === 'all' ? 0 : (currentLogPage - 1) * parseInt(logPageSize);
  const endIndex = logPageSize === 'all' ? filteredLogs.length : startIndex + parseInt(logPageSize);
  const pageLogs = filteredLogs.slice(startIndex, endIndex);
  
  const sortIcon = (field) => {
    if (logSortField !== field) return '↕️';
    return logSortDirection === 'asc' ? '↑' : '↓';
  };
  
  const html = `
    <table class="table">
      <thead>
        <tr>
          <th onclick="sortLogs('id')" style="cursor: pointer;">ID ${sortIcon('id')}</th>
          <th onclick="sortLogs('username')" style="cursor: pointer;">用户 ${sortIcon('username')}</th>
          <th onclick="sortLogs('notification_type')" style="cursor: pointer;">类型 ${sortIcon('notification_type')}</th>
          <th onclick="sortLogs('channel')" style="cursor: pointer;">渠道 ${sortIcon('channel')}</th>
          <th onclick="sortLogs('title')" style="cursor: pointer;">标题 ${sortIcon('title')}</th>
          <th onclick="sortLogs('status')" style="cursor: pointer;">状态 ${sortIcon('status')}</th>
          <th onclick="sortLogs('sent_at')" style="cursor: pointer;">发送时间 ${sortIcon('sent_at')}</th>
        </tr>
      </thead>
      <tbody>
        ${pageLogs.map(log => `
          <tr>
            <td>${log.id}</td>
            <td>
              <div>${log.username || 'N/A'}</div>
              <small style="color: #999;">${log.email || ''}</small>
            </td>
            <td>${log.notification_type}</td>
            <td>${log.channel || 'all'}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" 
                title="${log.title}">${log.title}</td>
            <td>
              <span style="color: ${log.status === 'success' ? '#28a745' : log.status === 'failed' ? '#dc3545' : '#ffc107'};">
                ${log.status === 'success' ? '✅ 成功' : log.status === 'failed' ? '❌ 失败' : '⏳ 待处理'}
              </span>
            </td>
            <td>${new Date(log.sent_at).toLocaleString('zh-CN')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="text-align: center; color: #666; margin-top: 10px;">
      显示 ${startIndex + 1}-${Math.min(endIndex, filteredLogs.length)} / 共 ${filteredLogs.length} 条记录
    </div>
  `;
  
  document.getElementById('notificationLogsList').innerHTML = html;
  renderLogPagination();
}

function renderLogPagination() {
  if (logPageSize === 'all') {
    document.getElementById('logPagination').innerHTML = '';
    return;
  }
  
  const totalPages = Math.ceil(filteredLogs.length / parseInt(logPageSize));
  let html = '';
  
  if (currentLogPage > 1) {
    html += `<button onclick="gotoLogPage(${currentLogPage - 1})" class="btn btn-sm btn-secondary">上一页</button>`;
  }
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentLogPage - 2 && i <= currentLogPage + 2)) {
      html += `<button onclick="gotoLogPage(${i})" class="btn btn-sm ${i === currentLogPage ? 'btn-primary' : 'btn-secondary'}">${i}</button>`;
    } else if (i === currentLogPage - 3 || i === currentLogPage + 3) {
      html += `<span style="padding: 0 5px;">...</span>`;
    }
  }
  
  if (currentLogPage < totalPages) {
    html += `<button onclick="gotoLogPage(${currentLogPage + 1})" class="btn btn-sm btn-secondary">下一页</button>`;
  }
  
  document.getElementById('logPagination').innerHTML = html;
}

function gotoLogPage(page) {
  currentLogPage = page;
  renderLogsTable();
}

async function exportFilteredLogs() {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) {
    alert('❌ Excel库未加载，请刷新页面重试');
    return;
  }
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('通知记录');
  
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: '用户ID', key: 'user_id', width: 10 },
    { header: '用户名', key: 'username', width: 20 },
    { header: '邮箱', key: 'email', width: 30 },
    { header: '通知类型', key: 'notification_type', width: 20 },
    { header: '发送渠道', key: 'channel', width: 15 },
    { header: '标题', key: 'title', width: 40 },
    { header: '内容摘要', key: 'content_preview', width: 60 },
    { header: '状态', key: 'status', width: 15 },
    { header: '错误信息', key: 'error_message', width: 40 },
    { header: '发送时间', key: 'sent_at', width: 20 }
  ];
  
  filteredLogs.forEach(log => {
    worksheet.addRow({
      id: log.id,
      user_id: log.user_id,
      username: log.username || 'N/A',
      email: log.email || '',
      notification_type: log.notification_type,
      channel: log.channel || 'all',
      title: log.title,
      content_preview: (log.content || '').substring(0, 200),
      status: log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : '待处理',
      error_message: log.error_message || '',
      sent_at: new Date(log.sent_at).toLocaleString('zh-CN')
    });
  });
  
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `通知记录_${Date.now()}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  showToast(`✅ 已导出 ${filteredLogs.length} 条通知记录`);
}
