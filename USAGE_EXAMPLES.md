# 📖 使用示例 - Video Chapter Generator

本文档提供详细的使用示例，帮助您快速上手视频章节生成器。

## 🚀 快速开始

### 启动服务

```bash
# 方式 1: 使用快速启动脚本
./quick-start.sh

# 方式 2: 手动启动
npm start

# 方式 3: 开发模式（自动重启）
npm run dev

# 方式 4: 使用 Docker
docker-compose up -d
```

启动后访问：`http://localhost:3000`

## 📹 场景 1: 上传和处理单个视频

### 步骤 1: 上传视频

1. 打开浏览器访问 `http://localhost:3000`
2. 点击上传区域或拖拽视频文件
3. 选择一个视频文件（例如：`tutorial.mp4`）
4. 点击"开始上传"按钮

### 步骤 2: 处理视频

上传完成后，会弹出确认框：
- 点击"确定"立即开始处理
- 或点击"取消"稍后手动处理

如果选择稍后处理：
1. 在视频列表中找到上传的视频
2. 点击"开始处理"按钮

### 步骤 3: 查看进度

处理开始后，会实时显示：
- 当前处理阶段（提取音频 → 转录 → 生成章节 → 保存）
- 进度百分比
- 累计耗时

### 步骤 4: 查看章节

处理完成后：
1. 点击"查看章节"按钮
2. 在弹窗中查看所有章节
3. 每个章节包含：
   - 时间范围
   - 章节标题
   - 章节描述

### 步骤 5: 接收通知

处理完成后，您会收到通知（如果配置了）：
- 📱 微信推送（WxPusher）
- 📱 多平台推送（PushPlus）
- 📧 邮件通知（Resend）
- 💬 Telegram 消息

## 📦 场景 2: 批量上传和处理

### 示例：处理 10 个教学视频

```bash
# 准备视频文件
videos/
├── lesson01.mp4
├── lesson02.mp4
├── lesson03.mp4
├── lesson04.mp4
├── lesson05.mp4
├── lesson06.mp4
├── lesson07.mp4
├── lesson08.mp4
├── lesson09.mp4
└── lesson10.mp4
```

### 操作步骤

1. **批量选择**：
   - 点击"选择文件"
   - 按住 Ctrl/Cmd 选择多个文件
   - 或拖拽整个文件夹

2. **预览确认**：
   - 查看待上传文件列表
   - 确认文件名和大小
   - 如有误选，点击"删除"按钮移除

3. **开始上传**：
   - 点击"开始上传"
   - 等待所有文件上传完成

4. **批量处理**：
   - 选择"确定"开始批量处理
   - 或在列表中选择需要处理的视频

5. **监控进度**：
   - 每个视频独立显示进度
   - 可以同时看到多个视频的处理状态

6. **接收汇总报告**：
   - 所有视频处理完成后
   - 会收到一份汇总报告
   - 包含成功数、失败数、总耗时等

## 🔍 场景 3: 搜索和筛选

### 示例 1: 查找包含"教程"的视频

```
关键字搜索: 教程
状态筛选: （留空）
开始日期: （留空）
结束日期: （留空）
点击: 搜索
```

### 示例 2: 查找今天上传的已完成视频

```
关键字搜索: （留空）
状态筛选: 已完成
开始日期: 2024-01-15
结束日期: 2024-01-15
点击: 搜索
```

### 示例 3: 查找处理失败的视频

```
关键字搜索: （留空）
状态筛选: 错误
开始日期: （留空）
结束日期: （留空）
点击: 搜索
```

### 清除筛选

点击"重置"按钮清除所有筛选条件

## 📊 场景 4: 导出数据

### 示例 1: 导出 Excel 报告

1. 设置筛选条件（可选）
2. 点击"Excel"按钮
3. 等待生成完成
4. 自动下载文件：`chapters_1234567890.xlsx`

Excel 文件包含两个 Sheet：
- **Sheet 1: 视频列表** - 所有视频信息
- **Sheet 2: 章节列表** - 所有章节详情

### 示例 2: 导出 PDF 文档

1. 点击"PDF"按钮
2. 生成包含所有视频和章节的 PDF
3. 可直接打印或分享

### 示例 3: 导出 Markdown 笔记

1. 点击"Markdown"按钮
2. 获得适合笔记软件的 Markdown 文件
3. 可导入 Notion、Obsidian 等工具

### 示例 4: 导出 HTML 网页

1. 点击"HTML"按钮
2. 获得美观的 HTML 网页
3. 可直接在浏览器中打开查看

### 示例 5: 导出 CSV 表格

1. 点击"CSV"按钮
2. 获得纯文本表格
3. 可导入 Excel、Google Sheets 等

## 📱 场景 5: 配置通知系统

### WxPusher（微信推送）

1. 访问 [WxPusher](https://wxpusher.zjiecode.com/)
2. 注册并创建应用
3. 获取 APP_TOKEN
4. 扫码关注并获取 UID
5. 在 `.env` 中配置：

```env
WXPUSHER_TOKEN=AT_xxxxxxxxxxxxxxx
WXPUSHER_UID=UID_xxxxxxxxxxxxxxx
```

### PushPlus（多平台推送）

1. 访问 [PushPlus](http://www.pushplus.plus/)
2. 微信扫码登录
3. 获取 Token
4. 在 `.env` 中配置：

```env
PUSHPLUS_TOKEN=xxxxxxxxxxxxxxx
```

### Resend（邮件通知）

1. 访问 [Resend](https://resend.com/)
2. 创建账号并获取 API Key
3. 在 `.env` 中配置：

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxx
RESEND_TO_EMAIL=your@email.com
```

### Telegram Bot

1. 在 Telegram 中搜索 @BotFather
2. 创建新 Bot 并获取 Token
3. 获取你的 Chat ID（可以用 @userinfobot）
4. 在 `.env` 中配置：

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

## 🔧 场景 6: API 调用示例

### 使用 cURL 上传视频

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "videos=@video1.mp4" \
  -F "videos=@video2.mp4"
```

### 使用 cURL 处理视频

```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{"videoIds": [1, 2, 3]}'
```

### 使用 cURL 获取视频列表

```bash
curl "http://localhost:3000/api/videos?page=1&limit=20&status=completed"
```

### 使用 cURL 导出数据

```bash
curl -X POST http://localhost:3000/api/export \
  -H "Content-Type: application/json" \
  -d '{"format": "excel", "filters": {"status": "completed"}}'
```

### 使用 JavaScript 调用 API

```javascript
// 上传视频
const formData = new FormData();
formData.append('videos', fileInput.files[0]);

const response = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);

// 获取视频列表
const response = await fetch('http://localhost:3000/api/videos?limit=20');
const data = await response.json();
console.log(data);
```

### 使用 Python 调用 API

```python
import requests

# 上传视频
files = {'videos': open('video.mp4', 'rb')}
response = requests.post('http://localhost:3000/api/upload', files=files)
print(response.json())

# 获取视频列表
response = requests.get('http://localhost:3000/api/videos?limit=20')
print(response.json())
```

## 🎯 场景 7: 实际应用案例

### 案例 1: 在线课程平台

**需求**：为 100 门课程自动生成章节

```bash
1. 批量上传课程视频（每次 10 个）
2. 自动处理生成章节
3. 导出 Excel 整理章节信息
4. 将章节数据导入课程平台
```

### 案例 2: 企业培训视频

**需求**：为新员工培训视频添加导航

```bash
1. 上传培训视频（入职培训、产品培训等）
2. AI 自动识别培训内容并分章
3. 导出 HTML 网页供员工查看
4. 通过邮件发送处理完成通知
```

### 案例 3: YouTube 视频管理

**需求**：为 YouTube 视频生成章节时间戳

```bash
1. 下载 YouTube 视频
2. 上传到章节生成器
3. 获取章节时间轴
4. 复制到 YouTube 视频描述
```

格式示例：
```
0:00 - 介绍
2:30 - 第一部分：基础知识
8:45 - 第二部分：实战演示
15:20 - 总结
```

## 💡 高级技巧

### 技巧 1: 自定义分页大小

根据需求选择合适的分页大小：
- **10 条/页** - 适合详细查看
- **50 条/页** - 适合快速浏览
- **100 条/页** - 适合批量操作
- **ALL** - 导出全部数据时使用

### 技巧 2: 组合筛选

结合多个筛选条件：
```
关键字: 2024
状态: 已完成
日期范围: 2024-01-01 至 2024-12-31
```
可快速找到 2024 年所有已完成的视频

### 技巧 3: 定期备份

定期导出数据备份：
1. 每周导出一次 Excel
2. 保存到云盘或本地
3. 防止数据丢失

### 技巧 4: 批量删除

删除测试数据：
1. 筛选出测试视频
2. 逐个删除或记录 ID
3. 使用 API 批量删除

### 技巧 5: 监控处理进度

使用浏览器的多个标签页：
- 标签 1：上传新视频
- 标签 2：监控处理进度
- 标签 3：查看已完成的章节

## 🐛 常见问题解决

### 问题 1: 上传失败

**症状**：文件无法上传

**解决**：
1. 检查文件格式是否支持
2. 检查文件大小是否超限
3. 查看浏览器控制台错误信息

### 问题 2: 处理失败

**症状**：视频状态显示"错误"

**解决**：
1. 点击视频查看错误信息
2. 检查 Whisper 配置
3. 检查 Azure OpenAI 配置
4. 查看服务器日志

### 问题 3: 章节质量不理想

**症状**：生成的章节不够准确

**优化建议**：
1. 使用更大的 Whisper 模型
2. 调整 GPT-4 的 prompt
3. 视频内容尽量清晰有结构

### 问题 4: 通知未收到

**症状**：处理完成但没收到通知

**解决**：
1. 检查 `.env` 配置
2. 测试通知渠道（运行测试脚本）
3. 查看服务器日志

## 📞 获取帮助

如需更多帮助：
1. 查看 `README.md` 完整文档
2. 查看 `INSTALL.md` 安装指南
3. 提交 GitHub Issue
4. 联系技术支持

---

**祝您使用愉快！** 🎉
