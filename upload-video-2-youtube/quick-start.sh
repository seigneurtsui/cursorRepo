#!/bin/bash

echo "========================================="
echo "YouTube 视频搜索与导出系统 - 快速启动"
echo "========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件"
    echo "正在从 env.example 创建..."
    if [ -f env.example ]; then
        cp env.example .env
        echo "✅ .env 文件已创建"
        echo "⚠️  请编辑 .env 文件并填写必要的配置信息"
        echo ""
    else
        echo "❌ 未找到 env.example 文件"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 安装依赖包..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
    echo ""
fi

# Check PostgreSQL connection
echo "🔍 检查数据库连接..."
source .env

# Try to connect to PostgreSQL
psql postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_DATABASE -c "SELECT 1;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ 数据库连接成功"
    
    # Check if tables exist
    TABLE_COUNT=$(psql postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_DATABASE -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'videos', 'transactions', 'email_verifications');" 2>/dev/null | tr -d ' ')
    
    if [ "$TABLE_COUNT" != "4" ]; then
        echo "⚠️  数据库表未完全初始化"
        echo "正在初始化数据库..."
        psql postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_DATABASE -f init-db.sql
        if [ $? -eq 0 ]; then
            echo "✅ 数据库初始化成功"
        else
            echo "❌ 数据库初始化失败"
            exit 1
        fi
    else
        echo "✅ 数据库表已存在"
    fi
else
    echo "❌ 无法连接到数据库"
    echo "请检查 .env 文件中的数据库配置"
    exit 1
fi

echo ""
echo "========================================="
echo "🚀 启动服务器..."
echo "========================================="
echo ""
echo "访问地址："
echo "  - 主页: http://localhost:$PORT/index.html"
echo "  - 登录: http://localhost:$PORT/login.html"
echo "  - 注册: http://localhost:$PORT/register.html"
echo ""
echo "默认管理员账号："
echo "  邮箱: admin@example.com"
echo "  密码: admin123456"
echo ""
echo "⚠️  首次登录后请立即修改管理员密码！"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "========================================="
echo ""

npm start
