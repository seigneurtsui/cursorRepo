# 🎬 视频章节生成器 (Video Chapter Generator)

一个基于 **Node.js + PostgreSQL + 纯HTML/CSS/JS** 的全栈应用，使用 **Whisper AI** 和 **GPT-4 Turbo** 自动为视频生成智能时间轴（章节标记）。

## ✨ 核心功能

### 🎯 前端功能
- ✅ **批量视频上传**：支持拖拽上传，支持多种视频格式（MP4, AVI, MKV, MOV等）
- ✅ **实时进度显示**：WebSocket实时展示视频处理进度和耗时
- ✅ **智能搜索**：支持关键字搜索和时间范围筛选
- ✅ **灵活分页**：可选择 10/20/30/50/100/全部 每页显示数量
- ✅ **多格式导出**：支持导出为 Excel, CSV, HTML, PDF, Markdown
- ✅ **现代UI设计**：响应式设计，美观易用

### 🤖 AI 处理流程
1. **音频提取**：使用 FFmpeg 从视频中提取音频
2. **语音转文字**：使用 Whisper API 将音频转录为文字
3. **智能分章**：使用 Azure OpenAI GPT-4 Turbo 智能分析内容生成章节
4. **数据存储**：章节数据存入 PostgreSQL 数据库
5. **多渠道通知**：通过 4 个渠道发送处理完成通知

### 📢 通知系统
支持 4 种通知渠道：
- 📱 **WxPusher**（微信推送）
- 📱 **PushPlus**（多平台推送）
- 📧 **Resend Email**（邮件通知）
- 💬 **Telegram Bot**（Telegram消息）

## 🏗️ 技术架构

### 后端技术栈
- **Node.js + Express**：Web 服务器
- **PostgreSQL**：关系型数据库
- **Whisper AI**：语音识别（本地化部署）
- **Azure OpenAI GPT-4 Turbo**：智能内容分析
- **FFmpeg**：音视频处理
- **WebSocket**：实时通信

### 前端技术栈
- **纯 HTML/CSS/JavaScript**：无框架依赖
- **WebSocket**：实时进度更新
- **现代 CSS**：渐变背景、动画效果、响应式布局

### 数据库设计
- **videos 表**：存储视频信息
- **chapters 表**：存储章节信息
- **processing_logs 表**：存储处理日志

## 📦 安装和部署

### 1. 环境要求
- Node.js >= 14.x
- PostgreSQL >= 12.x
- FFmpeg
- Whisper 模型文件

### 2. 安装依赖

```bash
# 克隆项目（如果适用）
git clone <your-repo-url>
cd video-chapter-generator

# 安装 Node.js 依赖
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=video_chapters
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# 服务器配置
PORT=3000

# Whisper 配置（本地路径）
WHISPER_MODEL_PATH=/path/to/whisper/models/ggml-large-v3-turbo.bin
WHISPER_EXECUTABLE_PATH=/path/to/whisper/main

# Azure OpenAI 配置
AZURE_OPENAI_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=my-gpt4-turbo
AZURE_OPENAI_API_VERSION=2024-02-01

# 通知系统配置（可选）
WXPUSHER_TOKEN=your_token
WXPUSHER_UID=your_uid
PUSHPLUS_TOKEN=your_token
RESEND_API_KEY=your_api_key
RESEND_TO_EMAIL=your@email.com
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 4. 初始化数据库

```bash
npm run init-db
```

### 5. 启动服务

```bash
# 生产环境
npm start

# 开发环境（自动重启）
npm run dev
```

访问：`http://localhost:3000`

## 📖 使用指南

### 上传视频
1. 点击上传区域或拖拽视频文件
2. 支持批量选择多个视频
3. 点击"开始上传"按钮
4. 上传完成后选择是否立即处理

### 处理视频
1. 在视频列表中找到已上传的视频
2. 点击"开始处理"按钮
3. 实时查看处理进度
4. 等待处理完成（会收到通知）

### 查看章节
1. 处理完成后，点击"查看章节"按钮
2. 在弹窗中查看所有章节信息
3. 包括章节标题、时间范围、描述等

### 搜索和筛选
- **关键字搜索**：输入文件名关键字
- **状态筛选**：按处理状态筛选
- **时间范围**：按上传日期筛选
- 点击"搜索"应用筛选，"重置"清空筛选

### 导出数据
选择导出格式：
- **Excel**：完整的表格数据，包含视频和章节
- **CSV**：纯文本表格，方便导入其他工具
- **HTML**：美观的网页报告
- **PDF**：可打印的文档
- **Markdown**：适合文档和笔记

## 🔧 API 接口文档

### 上传视频
```
POST /api/upload
Content-Type: multipart/form-data

Body:
- videos: File[] (视频文件数组)

Response:
{
  "success": true,
  "message": "成功上传 2 个视频",
  "videos": [...]
}
```

### 处理视频
```
POST /api/process
Content-Type: application/json

Body:
{
  "videoIds": [1, 2, 3]
}

Response:
{
  "success": true,
  "message": "开始处理 3 个视频"
}
```

### 获取视频列表
```
GET /api/videos?page=1&limit=20&keyword=test&status=completed

Response:
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 获取视频详情
```
GET /api/videos/:id

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "original_name": "video.mp4",
    "chapters": [...]
  }
}
```

### 删除视频
```
DELETE /api/videos/:id

Response:
{
  "success": true,
  "message": "视频已删除"
}
```

### 导出数据
```
POST /api/export
Content-Type: application/json

Body:
{
  "format": "excel",
  "filters": {
    "status": "completed"
  }
}

Response:
{
  "success": true,
  "downloadUrl": "/exports/chapters_1234567890.xlsx",
  "filename": "chapters_1234567890.xlsx"
}
```

## 🔌 WebSocket 实时通信

客户端连接到 WebSocket 后会收到以下类型的消息：

### 状态更新
```json
{
  "type": "status",
  "videoId": 1,
  "status": "processing",
  "message": "开始处理视频..."
}
```

### 进度更新
```json
{
  "type": "progress",
  "videoId": 1,
  "stage": "transcription",
  "progress": 60,
  "message": "转录完成，开始生成章节..."
}
```

### 完成通知
```json
{
  "type": "completed",
  "videoId": 1,
  "chapters": 8
}
```

### 错误通知
```json
{
  "type": "error",
  "videoId": 1,
  "error": "处理失败原因"
}
```

## 📊 数据库结构

### videos 表
```sql
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(500),
  original_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  duration NUMERIC(10, 2),
  status VARCHAR(50),
  upload_started_at TIMESTAMP,
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### chapters 表
```sql
CREATE TABLE chapters (
  id SERIAL PRIMARY KEY,
  video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
  chapter_index INTEGER,
  start_time NUMERIC(10, 2),
  end_time NUMERIC(10, 2),
  title VARCHAR(500),
  description TEXT,
  transcript TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎨 UI 截图说明

应用包含以下主要界面：
- **首页**：统计信息展示（总视频数、总章节数、处理中数量）
- **上传区域**：支持拖拽的文件上传界面
- **搜索筛选**：关键字、状态、日期范围筛选
- **视频列表**：卡片式展示，包含文件信息和操作按钮
- **进度显示**：实时进度条展示处理状态
- **章节详情**：弹窗展示完整章节列表
- **导出面板**：一键导出多种格式

## 🚀 性能优化

- **并发处理**：支持多个视频同时处理
- **数据库索引**：对常用查询字段建立索引
- **WebSocket 推送**：减少轮询，实时更新
- **文件流处理**：大文件采用流式处理
- **分页加载**：避免一次性加载大量数据

## 🔒 安全性

- **文件类型验证**：只允许上传视频格式
- **文件大小限制**：可配置最大文件大小
- **SQL 注入防护**：使用参数化查询
- **CORS 配置**：跨域请求控制
- **环境变量**：敏感信息不硬编码

## 🐛 故障排除

### 数据库连接失败
- 检查 PostgreSQL 是否运行
- 验证 `.env` 中的数据库配置
- 确保数据库已创建

### Whisper 转录失败
- 检查 Whisper 模型文件路径
- 验证 FFmpeg 是否安装
- 确保有足够的磁盘空间

### GPT-4 章节生成失败
- 验证 Azure OpenAI 配置
- 检查 API 密钥是否有效
- 查看是否有 API 配额限制

### 通知发送失败
- 检查通知服务的 token 配置
- 验证网络连接
- 查看服务端日志

## 📝 开发说明

### 项目结构
```
video-chapter-generator/
├── db/                 # 数据库相关
│   └── database.js     # 数据库连接和查询
├── public/             # 前端文件
│   ├── index.html      # 主页面
│   ├── styles.css      # 样式文件
│   └── app.js          # 前端逻辑
├── scripts/            # 工具脚本
│   └── init-db.js      # 数据库初始化
├── services/           # 服务层
│   ├── whisper.js      # Whisper 集成
│   ├── gpt-chapter.js  # GPT-4 集成
│   ├── notification.js # 通知服务
│   └── export.js       # 导出服务
├── uploads/            # 上传文件目录
├── temp/               # 临时文件目录
├── exports/            # 导出文件目录
├── server.js           # 主服务器
├── package.json        # 依赖配置
├── .env.example        # 环境变量模板
└── README.md           # 说明文档
```

### 添加新功能
1. 后端 API：在 `server.js` 中添加路由
2. 数据库操作：在 `db/database.js` 中添加查询方法
3. 前端界面：在 `public/index.html` 和 `public/app.js` 中实现

## 📄 许可证

MIT License

## 👨‍💻 作者

视频章节生成器开发团队

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**享受使用 AI 驱动的视频章节生成！** 🎬✨
