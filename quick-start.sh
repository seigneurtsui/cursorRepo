#!/bin/bash

# Quick Start Script for Video Chapter Generator
# This script helps you get started quickly

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🎬 视频章节生成器 - 快速启动脚本                              ║"
echo "║      Video Chapter Generator - Quick Start                   ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件，正在创建..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件"
    echo ""
    echo "⚠️  请编辑 .env 文件并填入您的配置："
    echo "   - 数据库配置"
    echo "   - Whisper 路径"
    echo "   - Azure OpenAI 配置"
    echo ""
    read -p "按 Enter 继续编辑 .env 文件..." 
    ${EDITOR:-nano} .env
fi

echo ""
echo "🔍 检查系统依赖..."
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js 未安装"
    echo "   请访问: https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm: $NPM_VERSION"
else
    echo "❌ npm 未安装"
    exit 1
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    echo "✅ PostgreSQL: $PSQL_VERSION"
else
    echo "⚠️  PostgreSQL 命令行工具未找到"
    echo "   确保 PostgreSQL 已安装并运行"
fi

# Check FFmpeg
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg: 已安装"
else
    echo "❌ FFmpeg 未安装"
    echo "   macOS: brew install ffmpeg"
    echo "   Ubuntu: sudo apt install ffmpeg"
    exit 1
fi

echo ""
echo "📦 安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install 失败"
    exit 1
fi

echo "✅ 依赖安装完成"
echo ""

# Check if database is initialized
read -p "是否需要初始化数据库？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  初始化数据库..."
    npm run init-db
    if [ $? -ne 0 ]; then
        echo "❌ 数据库初始化失败"
        echo "   请检查 .env 中的数据库配置"
        exit 1
    fi
    echo "✅ 数据库初始化完成"
fi

echo ""
echo "🎉 准备工作完成！"
echo ""
echo "📝 下一步："
echo "   1. 确保 .env 文件配置正确"
echo "   2. 运行: npm start (生产模式)"
echo "   3. 或运行: npm run dev (开发模式)"
echo "   4. 访问: http://localhost:3000"
echo ""
echo "📚 更多信息请查看："
echo "   - README.md (项目说明)"
echo "   - INSTALL.md (安装指南)"
echo "   - PROJECT_SUMMARY.md (项目总结)"
echo ""

read -p "是否现在启动服务？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 启动服务..."
    echo ""
    npm start
else
    echo "👋 稍后可以运行 'npm start' 启动服务"
fi
