# 🚀 快速安装指南

## 系统要求

- **操作系统**：Linux / macOS / Windows
- **Node.js**：>= 14.x
- **PostgreSQL**：>= 12.x
- **FFmpeg**：最新稳定版
- **Whisper 模型**：已下载并配置

## 步骤 1: 安装系统依赖

### macOS
```bash
# 安装 Homebrew (如果未安装)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 PostgreSQL
brew install postgresql@14
brew services start postgresql@14

# 安装 FFmpeg
brew install ffmpeg

# 安装 Node.js
brew install node
```

### Ubuntu/Debian
```bash
# 更新包列表
sudo apt update

# 安装 PostgreSQL
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 安装 FFmpeg
sudo apt install ffmpeg

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs
```

### Windows
1. 下载并安装 [PostgreSQL](https://www.postgresql.org/download/windows/)
2. 下载并安装 [Node.js](https://nodejs.org/)
3. 下载并安装 [FFmpeg](https://ffmpeg.org/download.html)

## 步骤 2: 配置 PostgreSQL

```bash
# 登录 PostgreSQL
sudo -u postgres psql

# 创建数据库和用户
CREATE DATABASE video_chapters;
CREATE USER video_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE video_chapters TO video_user;

# 退出
\q
```

## 步骤 3: 安装 Whisper

### 选项 A: 使用 whisper-node (推荐)
```bash
npm install whisper-node
```

模型文件会自动下载到 `node_modules/whisper-node/whisper/models/`

### 选项 B: 手动安装 Whisper
```bash
# 克隆 Whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# 编译
make

# 下载模型 (large-v3-turbo)
bash ./models/download-ggml-model.sh large-v3-turbo

# 记录路径，稍后配置到 .env
pwd  # 记录这个路径
```

## 步骤 4: 配置 Azure OpenAI

1. 访问 [Azure Portal](https://portal.azure.com)
2. 创建 Azure OpenAI 服务
3. 部署 GPT-4 Turbo 模型
4. 获取以下信息：
   - API Key
   - Endpoint URL
   - Deployment Name

## 步骤 5: 安装项目

```bash
# 进入项目目录
cd video-chapter-generator

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的配置
nano .env  # 或使用你喜欢的编辑器
```

### 必填配置项

在 `.env` 文件中配置以下必填项：

```env
# 数据库配置 (必填)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=video_chapters
DATABASE_USER=video_user
DATABASE_PASSWORD=your_secure_password

# Whisper 配置 (必填)
WHISPER_MODEL_PATH=/path/to/whisper/models/ggml-large-v3-turbo.bin
WHISPER_EXECUTABLE_PATH=/path/to/whisper/main

# Azure OpenAI 配置 (必填)
AZURE_OPENAI_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_API_VERSION=2024-02-01
```

### 可选配置项 (通知系统)

```env
# 如果不需要某个通知渠道，可以留空或删除
WXPUSHER_TOKEN=your_token
WXPUSHER_UID=your_uid
PUSHPLUS_TOKEN=your_token
RESEND_API_KEY=your_api_key
RESEND_TO_EMAIL=your@email.com
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 步骤 6: 初始化数据库

```bash
npm run init-db
```

你应该看到：
```
✅ Created table: videos
✅ Created table: chapters
✅ Created table: processing_logs
✅ Created indexes
✅ Created triggers
🎉 Database initialization completed successfully!
```

## 步骤 7: 启动服务

### 开发模式 (推荐用于测试)
```bash
npm run dev
```

### 生产模式
```bash
npm start
```

你应该看到：
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎬 视频章节生成器 - Video Chapter Generator                  ║
║                                                               ║
║   🚀 Server running on: http://localhost:3000                 ║
║   📊 Database: PostgreSQL                                     ║
║   🤖 AI: Whisper + GPT-4 Turbo                                ║
║   📢 Notifications: 4 channels ready                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

## 步骤 8: 访问应用

打开浏览器访问：`http://localhost:3000`

## 🎉 完成！

现在你可以：
1. ✅ 上传视频文件
2. ✅ 自动生成章节
3. ✅ 查看和导出数据
4. ✅ 接收通知提醒

## 故障排查

### 问题 1: 数据库连接失败
```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql  # Linux
brew services list  # macOS

# 测试连接
psql -h localhost -U video_user -d video_chapters
```

### 问题 2: Whisper 路径错误
```bash
# 找到 whisper 安装位置
find / -name "whisper" -type d 2>/dev/null
find / -name "ggml-large-v3-turbo.bin" 2>/dev/null

# 更新 .env 中的路径
```

### 问题 3: FFmpeg 未安装
```bash
# 验证 FFmpeg
ffmpeg -version

# 如果未安装，根据系统安装
```

### 问题 4: 端口被占用
```bash
# 修改 .env 中的 PORT
PORT=3001

# 或者释放 3000 端口
lsof -ti:3000 | xargs kill -9
```

## 生产环境部署

### 使用 PM2
```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name video-chapter-generator

# 设置开机自启
pm2 startup
pm2 save
```

### 使用 Nginx 反向代理
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 使用 Docker (可选)
```bash
# 构建镜像
docker build -t video-chapter-generator .

# 运行容器
docker run -d -p 3000:3000 \
  --env-file .env \
  --name video-chapters \
  video-chapter-generator
```

## 更新应用

```bash
# 拉取最新代码
git pull

# 安装新依赖
npm install

# 重启服务
pm2 restart video-chapter-generator
```

## 获取帮助

如遇到问题：
1. 查看服务器日志
2. 检查数据库连接
3. 验证环境变量配置
4. 提交 Issue 到 GitHub

---

**祝你使用愉快！** 🚀
