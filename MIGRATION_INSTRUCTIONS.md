# 🔄 数据库迁移说明：添加 operator_id 列

**状态**: ⏸️ 等待数据库启动  
**错误**: `ECONNREFUSED` - PostgreSQL 数据库未运行

---

## ❌ 您遇到的错误

### 错误1: 运行了 SQL 文件

```bash
# ❌ 错误命令
node scripts/add-operator-id-to-transactions.sql
```

**问题**: Node.js 不能直接执行 `.sql` 文件（SQL 是数据库语言，不是 JavaScript）

**错误信息**:
```
SyntaxError: Unexpected identifier 'operator_id'
```

### 错误2: 数据库未运行

```bash
# ✅ 正确命令
node scripts/add-operator-id-migration.js
```

**错误信息**:
```
❌ Database query error: AggregateError [ECONNREFUSED]
connect ECONNREFUSED ::1:5432
connect ECONNREFUSED 127.0.0.1:5432
```

**问题**: PostgreSQL 数据库服务未启动

---

## 🔧 解决方案

### 方案1: 启动 PostgreSQL 数据库后运行迁移（推荐）

#### 步骤1: 启动 PostgreSQL

**在 macOS 上**:
```bash
# 如果使用 Homebrew 安装的 PostgreSQL
brew services start postgresql@14

# 或者直接启动
pg_ctl -D /usr/local/var/postgres start

# 或者 PostgreSQL 15/16
brew services start postgresql@15
```

**检查数据库是否运行**:
```bash
# 方法1
pg_isready

# 方法2
psql -U postgres -c "SELECT version();"
```

**如果看到**:
```
/var/run/postgresql:5432 - accepting connections
```
✅ 数据库已启动！

#### 步骤2: 运行迁移脚本

```bash
cd /Users/seigneur/lavoro/videoTimeline
node scripts/add-operator-id-migration.js
```

**预期输出**:
```
Starting migration: Add operator_id to transactions table...
Adding operator_id column...
Adding foreign key constraint...
Adding index...
Adding column comment...
✅ Migration completed successfully!
Migration finished.
```

---

### 方案2: 使用 psql 直接执行 SQL（如果数据库已运行）

```bash
# 连接到您的数据库
psql -U your_username -d your_database_name -f scripts/add-operator-id-to-transactions.sql

# 或者使用 .env 中的配置
psql postgresql://your_username:your_password@localhost:5432/your_database \
  -f scripts/add-operator-id-to-transactions.sql
```

---

### 方案3: 在生产环境中运行（如果使用远程数据库）

如果您的数据库在远程服务器上（如 Heroku、AWS RDS、Supabase 等）:

#### 选项A: 使用远程 psql

```bash
# 替换为您的实际数据库连接信息
psql postgresql://username:password@your-db-host:5432/dbname \
  -f scripts/add-operator-id-to-transactions.sql
```

#### 选项B: 在服务器上运行 Node.js 迁移脚本

```bash
# SSH 到服务器
ssh user@your-server

# 进入项目目录
cd /path/to/videoTimeline

# 运行迁移
node scripts/add-operator-id-migration.js
```

---

## 📋 SQL 迁移内容

迁移脚本会执行以下操作：

```sql
-- 1. 添加 operator_id 列
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS operator_id INTEGER;

-- 2. 添加外键约束
ALTER TABLE transactions 
  ADD CONSTRAINT fk_transactions_operator 
  FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. 创建索引（提高查询性能）
CREATE INDEX IF NOT EXISTS idx_transactions_operator_id 
  ON transactions(operator_id);

-- 4. 添加列注释
COMMENT ON COLUMN transactions.operator_id IS 
  '操作员ID (用于管理员调整余额的审计追踪)';
```

---

## ✅ 验证迁移是否成功

### 方法1: 使用 psql

```bash
psql -U your_username -d your_database_name
```

```sql
-- 查看 transactions 表结构
\d transactions

-- 应该看到 operator_id 列:
--  operator_id | integer |  | 

-- 查看外键约束
\d+ transactions

-- 查看索引
\di idx_transactions_operator_id
```

### 方法2: 在应用中测试

1. 启动您的应用:
```bash
node server.js
```

2. 以管理员身份登录

3. 调整某个用户的余额:
   - 进入 👥 用户列表
   - 点击 💰 按钮
   - 修改余额并确认

4. 查看 💳 最近交易:
   - 应该看到类型为 "💰 充值" 或 "📝 消费"
   - 支付方式应该显示 "管理员调整"
   - 不应该出现 `operator_id` 列不存在的错误

---

## 🔍 故障排除

### 问题1: PostgreSQL 服务未安装

**检查**:
```bash
which psql
```

**如果未安装**:
```bash
# macOS
brew install postgresql@15

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Windows (使用 Chocolatey)
choco install postgresql
```

### 问题2: 找不到 PostgreSQL 服务

```bash
# 查找所有 PostgreSQL 版本
brew services list | grep postgres

# 启动正确的版本
brew services start postgresql@15
```

### 问题3: 端口被占用

```bash
# 检查端口 5432 是否被占用
lsof -i :5432

# 如果被占用，查看进程
ps aux | grep postgres
```

### 问题4: 权限问题

```bash
# 修改数据目录权限
sudo chown -R $(whoami) /usr/local/var/postgres

# 或者重新初始化
initdb /usr/local/var/postgres
```

### 问题5: 连接配置错误

检查您的 `.env` 文件:
```env
# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# 或者分开配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

---

## 🚀 快速开始（推荐流程）

### 本地开发环境

```bash
# 1. 启动 PostgreSQL
brew services start postgresql@15

# 2. 验证数据库连接
psql -U postgres -c "SELECT 1"

# 3. 运行迁移
cd /Users/seigneur/lavoro/videoTimeline
node scripts/add-operator-id-migration.js

# 4. 启动应用
node server.js

# 5. 测试功能（浏览器访问管理员后台）
open http://localhost:3000/admin.html
```

### 生产环境

```bash
# 1. SSH 到服务器
ssh user@your-server

# 2. 进入项目目录
cd /path/to/videoTimeline

# 3. 备份数据库（重要！）
pg_dump -U username dbname > backup_$(date +%Y%m%d_%H%M%S).sql

# 4. 运行迁移
NODE_ENV=production node scripts/add-operator-id-migration.js

# 5. 验证迁移
psql -U username -d dbname -c "\d transactions"

# 6. 重启应用
pm2 restart videoTimeline
# 或者
systemctl restart videoTimeline
```

---

## 📊 迁移状态检查

运行以下命令检查迁移状态：

```bash
cd /Users/seigneur/lavoro/videoTimeline
node -e "
const pool = require('./db/database');
(async () => {
  try {
    const result = await pool.query(\`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'transactions' AND column_name = 'operator_id'
    \`);
    
    if (result.rows.length > 0) {
      console.log('✅ operator_id column exists!');
      console.log(result.rows[0]);
    } else {
      console.log('❌ operator_id column does NOT exist!');
      console.log('Please run the migration script.');
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
})();
"
```

---

## 📝 迁移脚本的幂等性

这个迁移脚本是**幂等的**（Idempotent），意味着：

✅ 可以安全地多次运行  
✅ 如果列已存在，会跳过创建  
✅ 如果约束已存在，会跳过  
✅ 如果索引已存在，会跳过

**这意味着**：即使您不确定是否已经运行过，再次运行也是安全的！

```
第1次运行: 创建列、约束、索引 ✅
第2次运行: 跳过（已存在） ✅
第3次运行: 跳过（已存在） ✅
```

---

## 🎯 总结

### 您需要做的:

1. ✅ **启动 PostgreSQL 数据库**
   ```bash
   brew services start postgresql@15
   ```

2. ✅ **运行迁移脚本（不是 SQL 文件！）**
   ```bash
   node scripts/add-operator-id-migration.js
   ```

3. ✅ **验证成功**
   - 看到 "✅ Migration completed successfully!"
   - 应用中测试管理员调整余额功能

### 常见错误对比:

| 命令 | 状态 | 说明 |
|------|------|------|
| `node scripts/add-operator-id-to-transactions.sql` | ❌ 错误 | SQL 文件不是 JavaScript |
| `node scripts/add-operator-id-migration.js` | ✅ 正确 | Node.js 迁移脚本 |
| `psql -f scripts/add-operator-id-to-transactions.sql` | ✅ 正确 | 直接用 psql 执行 SQL |

---

## 📞 需要帮助？

如果您在运行迁移时遇到任何问题，请提供：

1. 您的操作系统（macOS, Linux, Windows）
2. PostgreSQL 版本（`psql --version`）
3. 数据库配置（从 `.env` 文件中，隐藏密码）
4. 完整的错误信息

我会帮您解决！

---

**文档创建时间**: 2025-10-02  
**相关提交**: `5bc690f`, `bc1cc0b`  
**相关文档**: `DATABASE_MIGRATION_GUIDE.md`
