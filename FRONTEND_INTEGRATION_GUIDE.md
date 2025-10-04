# 🎨 前端整合指南 - index.html 修改说明

## 📋 概述

本文档说明如何修改原 `index.html`，整合会员登录功能。

---

## 1️⃣ HTML结构修改

### 在 `<head>` 部分添加

```html
<head>
    <!-- 现有内容... -->
    
    <!-- 添加auth-helper -->
    <script src="/public/auth-helper.js"></script>
    
    <style>
        /* 添加用户信息栏样式 */
        .user-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 30px;
            background: white;
            border-bottom: 2px solid #e5e7eb;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .user-info {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .balance {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: 600;
        }
        .admin-badge {
            background: #f59e0b;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        .btn-header {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
        }
        .btn-profile {
            background: #3b82f6;
            color: white;
        }
        .btn-profile:hover {
            background: #2563eb;
        }
        .btn-logout {
            background: #ef4444;
            color: white;
        }
        .btn-logout:hover {
            background: #dc2626;
        }
        .admin-controls {
            background: #fef3c7;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 2px solid #f59e0b;
        }
        .admin-controls select {
            width: 300px;
            padding: 8px 12px;
            border: 2px solid #d97706;
            border-radius: 6px;
            font-size: 14px;
        }
    </style>
</head>
```

### 在 `<body>` 开头添加用户信息栏

```html
<body class="bg-gray-100 font-sans">

    <!-- 添加用户信息栏 -->
    <div class="user-header">
        <div class="user-info">
            <span id="userEmail" style="font-weight: 600; color: #374151;"></span>
            <span id="adminBadge" class="admin-badge" style="display: none;">管理员</span>
            <span class="balance">余额: ¥<span id="userBalance">0.00</span></span>
        </div>
        <div class="user-info">
            <button class="btn-header btn-profile" onclick="location.href='/public/profile.html'">
                👤 个人中心
            </button>
            <button class="btn-header btn-profile" onclick="location.href='/public/admin.html'" id="adminBtn" style="display: none;">
                ⚙️ 管理后台
            </button>
            <button class="btn-header btn-logout" onclick="logout()">
                🚪 退出登录
            </button>
        </div>
    </div>

    <!-- 管理员专用：会员筛选 -->
    <div class="container mx-auto p-4 md:p-8">
        <div id="adminControls" class="admin-controls" style="display: none;">
            <label style="font-weight: 600; color: #92400e; margin-right: 10px;">
                👤 筛选会员：
            </label>
            <select id="userFilter" onchange="filterByUser()">
                <option value="">全部会员</option>
            </select>
            <span style="margin-left: 15px; color: #78350f; font-size: 14px;">
                （管理员可查看所有会员的视频数据）
            </span>
        </div>
    
        <!-- 原有的header内容 -->
        <header class="mb-8 flex justify-between items-start">
            <!-- 原有内容保持不变 -->
        </header>
        
        <!-- 原有内容继续... -->
    </div>

    <!-- 原有的描述模态框等保持不变 -->
    
</body>
```

---

## 2️⃣ JavaScript修改

### 在 `<script>` 标签开头添加

```javascript
// ========== 认证和用户信息 ==========

let currentUser = null;
let currentFilterUserId = '';

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuthAndLoadUser();
    // 原有的初始化代码...
    await fetchStats();
    await loadUniqueChannels();
    await fetchChannels();
    await fetchVideos();
});

// 检查登录状态并加载用户信息
async function checkAuthAndLoadUser() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('请先登录！');
        window.location.href = '/public/login.html';
        return;
    }
    
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('登录已过期');
        }
        
        currentUser = await response.json();
        
        // 显示用户信息
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userBalance').textContent = parseFloat(currentUser.balance).toFixed(2);
        
        // 如果是管理员，显示管理员标识和控件
        if (currentUser.isAdmin) {
            document.getElementById('adminBadge').style.display = 'inline-block';
            document.getElementById('adminBtn').style.display = 'inline-block';
            document.getElementById('adminControls').style.display = 'block';
            await loadUserList();
        }
        
    } catch (error) {
        console.error('认证失败:', error);
        alert('登录已过期，请重新登录');
        localStorage.removeItem('token');
        window.location.href = '/public/login.html';
    }
}

// 加载用户列表（管理员）
async function loadUserList() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            const select = document.getElementById('userFilter');
            
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.email} (${user.video_count} 个视频, 余额¥${user.balance})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('加载用户列表失败:', error);
    }
}

// 按用户筛选（管理员）
function filterByUser() {
    const select = document.getElementById('userFilter');
    currentFilterUserId = select.value;
    fetchVideos();
}

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('token');
        window.location.href = '/public/login.html';
    }
}

// 更新余额显示
function updateBalance(newBalance) {
    document.getElementById('userBalance').textContent = parseFloat(newBalance).toFixed(2);
    if (currentUser) {
        currentUser.balance = newBalance;
    }
}
```

### 修改所有API调用，添加认证头

```javascript
// ========== 修改现有的API调用函数 ==========

// 修改fetchStats
async function fetchStats() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (res.status === 401) {
            window.location.href = '/public/login.html';
            return;
        }
        
        if (!res.ok) throw new Error('获取统计失败');
        const data = await res.json();
        document.getElementById('totalVideos').textContent = data.totalVideos.toLocaleString();
        
        // 更新余额
        if (data.balance !== undefined) {
            updateBalance(data.balance);
        }
    } catch (err) {
        console.error('获取统计数据错误:', err);
    }
}

// 修改fetchVideos - 添加filterUserId参数
async function fetchVideos(page = currentPage) {
    try {
        const token = localStorage.getItem('token');
        let params = new URLSearchParams({
            page,
            limit: currentLimit,
            sortBy: currentSortBy,
            sortOrder: currentSortOrder
        });
        
        if (currentSearchTerm) params.append('search', currentSearchTerm);
        if (currentStartDate) params.append('startDate', currentStartDate);
        if (currentEndDate) params.append('endDate', currentEndDate);
        if (currentChannelFilter) params.append('channel', currentChannelFilter);
        
        // 管理员筛选用户
        if (currentFilterUserId) {
            params.append('filterUserId', currentFilterUserId);
        }
        
        const res = await fetch(`/api/videos-paginated?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (res.status === 401) {
            window.location.href = '/public/login.html';
            return;
        }
        
        if (!res.ok) throw new Error('获取视频失败');
        
        const responseData = await res.json();
        const { data, pagination } = responseData;
        
        displayVideos(data);
        displayPagination(pagination);
        currentPage = pagination.page;
    } catch (err) {
        console.error('获取视频数据错误:', err);
        alert('获取视频失败: ' + err.message);
    }
}

// 修改搜索功能 - 添加费用确认
async function searchVideosByKeyword() {
    const keyword = document.getElementById('keyword').value.trim();
    if (!keyword) {
        alert('请输入关键词。');
        return;
    }
    
    // 费用确认
    if (!confirm(`本次搜索将扣费 5 元，当前余额 ¥${currentUser.balance}，是否继续？`)) {
        return;
    }
    
    // 检查余额
    if (parseFloat(currentUser.balance) < 5) {
        alert('余额不足！请先充值。');
        if (confirm('是否前往充值页面？')) {
            window.location.href = '/public/profile.html';
        }
        return;
    }
    
    const btn = document.getElementById('searchBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> 搜索中...';
    
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ keyword })
        });
        
        const result = await res.json();
        
        if (res.status === 402) {
            // 余额不足
            alert(`余额不足！当前余额: ¥${result.balance}，需要: ¥${result.required}`);
            if (confirm('是否前往充值？')) {
                window.location.href = '/public/profile.html';
            }
            return;
        }
        
        if (!res.ok) {
            throw new Error(result.error || '搜索失败');
        }
        
        // 更新余额
        if (result.balance !== undefined) {
            updateBalance(result.balance);
        }
        
        alert(result.message);
        await fetchStats();
        await fetchVideos();
        
    } catch (err) {
        console.error('搜索错误:', err);
        alert('搜索失败: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// 修改按频道获取功能
async function fetchByChannels() {
    const selectedChannels = Array.from(document.querySelectorAll('#channelSelectList input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    if (selectedChannels.length === 0) {
        alert('请至少选择一个频道。');
        return;
    }
    
    // 费用确认
    if (!confirm(`本次获取将扣费 5 元，当前余额 ¥${currentUser.balance}，是否继续？`)) {
        return;
    }
    
    if (parseFloat(currentUser.balance) < 5) {
        alert('余额不足！请先充值。');
        if (confirm('是否前往充值页面？')) {
            window.location.href = '/public/profile.html';
        }
        return;
    }
    
    const btn = document.getElementById('fetchSelectedBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> 获取中...';
    
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/fetch-by-channels', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ identifiers: selectedChannels })
        });
        
        const result = await res.json();
        
        if (res.status === 402) {
            alert(`余额不足！当前余额: ¥${result.balance}，需要: ¥${result.required}`);
            if (confirm('是否前往充值？')) {
                window.location.href = '/public/profile.html';
            }
            return;
        }
        
        if (!res.ok) {
            throw new Error(result.error || '获取失败');
        }
        
        // 更新余额
        if (result.balance !== undefined) {
            updateBalance(result.balance);
        }
        
        alert(result.message);
        closeModal('channelsModal');
        await fetchStats();
        await fetchVideos();
        
    } catch (err) {
        console.error('获取错误:', err);
        alert('获取失败: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// 修改导出功能
function exportData() {
    const token = localStorage.getItem('token');
    let params = new URLSearchParams({
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
    });
    
    if (currentSearchTerm) params.append('search', currentSearchTerm);
    if (currentStartDate) params.append('startDate', currentStartDate);
    if (currentEndDate) params.append('endDate', currentEndDate);
    if (currentChannelFilter) params.append('channel', currentChannelFilter);
    if (currentFilterUserId) params.append('filterUserId', currentFilterUserId);
    
    // 创建临时链接
    const link = document.createElement('a');
    link.href = `/api/export?${params}&token=${encodeURIComponent(token)}`;
    link.download = 'youtube_report.xlsx';
    link.click();
}

// 修改其他API调用函数，添加类似的认证头...
```

---

## 3️⃣ 完整修改后的关键部分

### 主要变更总结

1. **添加用户信息栏**
   - 显示用户邮箱
   - 显示当前余额
   - 个人中心和退出按钮
   - 管理员标识

2. **添加管理员筛选控件**
   - 仅管理员可见
   - 下拉选择特定用户
   - 显示用户的视频数量和余额

3. **所有API调用添加认证**
   - 在headers中添加 `Authorization: Bearer ${token}`
   - 处理401未授权错误（跳转登录）
   - 处理402余额不足错误（提示充值）

4. **添加费用确认**
   - 搜索前确认扣费
   - 按频道获取前确认扣费
   - 余额不足时提示充值

5. **实时更新余额**
   - API返回新余额后更新显示
   - 扣费后立即更新

---

## 4️⃣ 测试步骤

### 1. 测试登录流程
```
1. 访问 http://localhost:3000
2. 应该自动跳转到登录页面
3. 注册新账号
4. 登录成功后跳转回主页
5. 查看用户信息栏显示正常
```

### 2. 测试计费功能
```
1. 充值余额（至少10元）
2. 执行关键词搜索
3. 确认扣费5元
4. 余额显示更新
5. 查看交易记录
```

### 3. 测试数据隔离
```
1. 用户A上传数据
2. 用户B登录
3. 用户B看不到用户A的数据
4. 用户A重新登录
5. 用户A可以看到自己的数据
```

### 4. 测试管理员功能
```
1. 使用管理员账号登录
2. 查看"管理员"标识显示
3. 查看"管理后台"按钮显示
4. 查看"会员筛选"下拉框显示
5. 选择不同用户，查看数据切换
```

---

## 5️⃣ 常见问题

### Q1: 登录后立即跳转回登录页？
**A**: 检查token是否正确保存到localStorage，检查/api/auth/me接口是否正常。

### Q2: 余额显示不更新？
**A**: 确保API返回包含balance字段，调用updateBalance()函数。

### Q3: 管理员看不到筛选控件？
**A**: 检查currentUser.isAdmin是否为true，检查adminControls元素是否正确显示。

### Q4: 导出时token传递失败？
**A**: 使用POST方法或者在URL中添加token参数。

---

## ✅ 验收清单

- [ ] 未登录访问自动跳转登录页
- [ ] 登录成功显示用户信息
- [ ] 余额实时显示和更新
- [ ] 搜索前费用确认
- [ ] 余额不足提示充值
- [ ] 管理员标识正确显示
- [ ] 管理员筛选控件正确显示
- [ ] 管理员可以查看所有用户数据
- [ ] 普通用户只能看自己的数据
- [ ] 退出登录功能正常

---

**前端整合完成！** 🎉
