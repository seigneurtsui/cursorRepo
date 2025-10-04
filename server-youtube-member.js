// server-youtube-member.js - Integrated YouTube search with member system

require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const { Pool } = require('pg');
const exceljs = require('exceljs');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import middleware and routes
const { authenticate, requireAdmin, checkBalance } = require('./middleware/auth');
const authRoutes = require('./routes/auth-routes');
const membershipRoutes = require('./routes/membership-routes');
const paymentRoutes = require('./routes/payment-routes');
const notificationRoutes = require('./routes/notification-routes');
const NotificationService = require('./services/notification');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;
const notificationService = new NotificationService();

// YouTube API configuration
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
});

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER || process.env.DATABASE_USER,
    host: process.env.DB_HOST || process.env.DATABASE_HOST,
    database: process.env.DB_DATABASE || process.env.DATABASE_NAME,
    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD,
    port: process.env.DB_PORT || process.env.DATABASE_PORT,
});

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// 只使用 /public 路径，避免根路径冲突
app.use('/public', express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

// ========== YouTube搜索 API (需要认证 + 计费) ==========

/**
 * @route   POST /api/search
 * @desc    根据关键词从 YouTube 搜索播放列表并存入数据库 (每次5元)
 * @access  Private (需要登录 + 余额检查)
 */
app.post('/api/search', authenticate, checkBalance(5), async (req, res) => {
    const { keyword } = req.body;
    const userId = req.user.id;
    
    if (!keyword) {
        return res.status(400).json({ error: '关键词不能为空' });
    }

    const client = await pool.connect();
    try {
        // 开始事务
        await client.query('BEGIN');

        // 1. 扣费
        const balanceBefore = parseFloat(req.user.balance);
        const cost = 5.00;
        const balanceAfter = balanceBefore - cost;

        await client.query(
            'UPDATE users SET balance = $1 WHERE id = $2',
            [balanceAfter, userId]
        );

        // 记录扣费交易
        await client.query(`
            INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description)
            VALUES ($1, 'search_deduct', $2, $3, $4, $5)
        `, [userId, cost, balanceBefore, balanceAfter, `YouTube搜索: ${keyword}`]);

        // 2. 调用YouTube API
        const searchResponse = await youtube.search.list({
            part: 'snippet', q: keyword, type: 'playlist', maxResults: 10,
        });
        const playlists = searchResponse.data.items;
        
        if (!playlists || playlists.length === 0) {
            await client.query('COMMIT');
            return res.status(404).json({ 
                message: '未找到相关的播放列表',
                balance: balanceAfter 
            });
        }

        let allVideoIds = new Set();
        let allVideoSnippets = new Map();

        for (const playlist of playlists) {
            // 获取 playlistId：可能在 id.playlistId 或 id 本身
            const playlistId = playlist.id?.playlistId || playlist.id;
            
            if (!playlistId) {
                console.warn('⚠️  跳过无效的播放列表:', playlist);
                continue;
            }
            
            try {
                const playlistItemsResponse = await youtube.playlistItems.list({
                    part: 'snippet,contentDetails',
                    playlistId: playlistId,
                    maxResults: 20,
                });
                
                playlistItemsResponse.data.items.forEach(item => {
                    const videoId = item.contentDetails.videoId;
                    if (videoId && !allVideoSnippets.has(videoId)) {
                        allVideoSnippets.set(videoId, item.snippet);
                        allVideoIds.add(videoId);
                    }
                });
            } catch (playlistError) {
                console.error(`❌ 获取播放列表 ${playlistId} 失败:`, playlistError.message);
                // 继续处理其他播放列表
                continue;
            }
        }

        if (allVideoIds.size === 0) {
            await client.query('COMMIT');
            return res.status(404).json({ 
                message: '在找到的播放列表中未能获取任何视频',
                balance: balanceAfter 
            });
        }
        
        const videoIdsArray = Array.from(allVideoIds);
        let videosToInsert = [];

        // 批量获取视频详情
        for (let i = 0; i < videoIdsArray.length; i += 50) {
            const chunk = videoIdsArray.slice(i, i + 50);
            const videoDetailsResponse = await youtube.videos.list({
                part: 'statistics,snippet',
                id: chunk.join(','),
            });

            videoDetailsResponse.data.items.forEach(item => {
                const snippet = allVideoSnippets.get(item.id);
                if (!snippet) return;

                const stats = item.statistics;
                const thumbnails = item.snippet.thumbnails;
                const thumbnailUrl = (thumbnails.maxres || thumbnails.standard || thumbnails.high || thumbnails.medium || thumbnails.default).url;

                videosToInsert.push({
                    video_id: item.id,
                    playlist_id: snippet.playlistId,
                    title: snippet.title,
                    description: snippet.description,
                    thumbnail_url: thumbnailUrl,
                    published_at: snippet.publishedAt,
                    channel_title: snippet.channelTitle,
                    channel_id: item.snippet.channelId,
                    view_count: stats.viewCount ? parseInt(stats.viewCount, 10) : 0,
                    like_count: stats.likeCount ? parseInt(stats.likeCount, 10) : 0,
                    comment_count: stats.commentCount ? parseInt(stats.commentCount, 10) : 0,
                });
            });
        }

        // 3. 存入数据库 (添加 user_id)
        let updatedOrInsertedCount = 0;
        for (const video of videosToInsert) {
            const queryText = `
                INSERT INTO youtube_videos (
                    user_id, video_id, playlist_id, title, description, thumbnail_url, 
                    published_at, view_count, like_count, comment_count, channel_title, channel_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (user_id, video_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    thumbnail_url = EXCLUDED.thumbnail_url,
                    published_at = EXCLUDED.published_at,
                    view_count = EXCLUDED.view_count,
                    like_count = EXCLUDED.like_count,
                    comment_count = EXCLUDED.comment_count,
                    channel_title = EXCLUDED.channel_title,
                    channel_id = EXCLUDED.channel_id;
            `;
            const result = await client.query(queryText, [
                userId, video.video_id, video.playlist_id, video.title, video.description,
                video.thumbnail_url, video.published_at, video.view_count,
                video.like_count, video.comment_count, video.channel_title, video.channel_id
            ]);
            if (result.rowCount > 0) updatedOrInsertedCount++;
        }

        await client.query('COMMIT');
        
        // 发送4种渠道的通知
        const notificationTitle = '✅ YouTube数据获取成功';
        const notificationContent = `### YouTube数据获取报告 - 按关键字搜索

**会员**: ${req.user.email}
**搜索关键词**: ${keyword}
**获取方式**: 🔍 按关键字搜索
**处理视频数**: ${videosToInsert.length}
**新增/更新记录**: ${updatedOrInsertedCount}
**扣费金额**: ¥${cost}
**剩余余额**: ¥${balanceAfter}
**完成时间**: ${new Date().toLocaleString('zh-CN')}

📊 **数据详情**:
- 搜索到播放列表: ${playlists.length} 个
- 获取视频总数: ${allVideoIds.size} 个
- 成功处理: ${videosToInsert.length} 个

🎉 数据已成功保存到数据库，可以在主页面查看和筛选。`;

        // 异步发送通知（不阻塞响应）
        notificationService.sendAllChannels(notificationTitle, notificationContent).catch(err => {
            console.error('发送通知失败:', err);
        });
        
        res.status(201).json({ 
            message: `搜索完成！共处理 ${videosToInsert.length} 条视频，新增或更新了 ${updatedOrInsertedCount} 条记录。已扣费 ${cost} 元。`,
            updatedOrInsertedCount: updatedOrInsertedCount,
            cost: cost,
            balance: balanceAfter
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Search error:', error);
        res.status(500).json({ error: '搜索失败: ' + error.message });
    } finally {
        client.release();
    }
});

/**
 * @route   POST /api/fetch-by-channels
 * @desc    根据频道ID列表获取视频 (每次5元)
 * @access  Private
 */
app.post('/api/fetch-by-channels', authenticate, checkBalance(5), async (req, res) => {
    const { identifiers } = req.body;
    const userId = req.user.id;
    
    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
        return res.status(400).json({ error: '频道标识列表不能为空' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 扣费
        const balanceBefore = parseFloat(req.user.balance);
        const cost = 5.00;
        const balanceAfter = balanceBefore - cost;

        await client.query(
            'UPDATE users SET balance = $1 WHERE id = $2',
            [balanceAfter, userId]
        );

        await client.query(`
            INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description)
            VALUES ($1, 'channel_fetch_deduct', $2, $3, $4, $5)
        `, [userId, cost, balanceBefore, balanceAfter, `按频道获取视频: ${identifiers.join(', ')}`]);

        // 解析频道ID
        let finalChannelIds = new Set();
        const handlesToResolve = [];

        identifiers.forEach(id => {
            if (id.startsWith('UC')) {
                finalChannelIds.add(id);
            } else {
                handlesToResolve.push(id.startsWith('@') ? id.substring(1) : id);
            }
        });

        // 解析用户名到频道ID
        for (const handle of handlesToResolve) {
            try {
                const searchResponse = await youtube.search.list({
                    part: 'snippet',
                    q: handle,
                    type: 'channel',
                    maxResults: 1
                });
                
                if (searchResponse.data.items && searchResponse.data.items.length > 0) {
                    const foundChannel = searchResponse.data.items[0];
                    finalChannelIds.add(foundChannel.snippet.channelId);
                }
            } catch (searchError) {
                console.warn(`解析用户名 "${handle}" 时出错:`, searchError);
            }
        }
        
        const uniqueChannelIds = [...finalChannelIds];

        if (uniqueChannelIds.length === 0) {
            await client.query('COMMIT');
            return res.status(400).json({ 
                error: '未能解析出任何有效的频道ID',
                balance: balanceAfter 
            });
        }

        let allVideoIds = new Set();
        let allVideoSnippets = new Map();

        // 获取所有频道的视频
        for (const channelId of uniqueChannelIds) {
            const channelResponse = await youtube.channels.list({
                part: 'contentDetails',
                id: channelId,
            });

            const uploadsPlaylistId = channelResponse.data.items[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsPlaylistId) {
                continue;
            }

            let nextPageToken = null;
            do {
                const playlistItemsResponse = await youtube.playlistItems.list({
                    part: 'snippet,contentDetails',
                    playlistId: uploadsPlaylistId,
                    maxResults: 50,
                    pageToken: nextPageToken,
                });

                playlistItemsResponse.data.items.forEach(item => {
                    const videoId = item.contentDetails.videoId;
                    if (videoId && !allVideoSnippets.has(videoId)) {
                        allVideoSnippets.set(videoId, item.snippet);
                        allVideoIds.add(videoId);
                    }
                });
                nextPageToken = playlistItemsResponse.data.nextPageToken;
            } while (nextPageToken);
        }

        if (allVideoIds.size === 0) {
            await client.query('COMMIT');
            return res.status(404).json({ 
                message: '在指定的频道中未能获取任何新视频',
                balance: balanceAfter 
            });
        }
        
        const videoIdsArray = Array.from(allVideoIds);
        let videosToInsert = [];

        // 批量获取视频详情
        for (let i = 0; i < videoIdsArray.length; i += 50) {
            const chunk = videoIdsArray.slice(i, i + 50);
            const videoDetailsResponse = await youtube.videos.list({
                part: 'statistics,snippet',
                id: chunk.join(','),
            });

            videoDetailsResponse.data.items.forEach(item => {
                const snippet = allVideoSnippets.get(item.id);
                if (!snippet) return;

                const stats = item.statistics;
                const thumbnails = item.snippet.thumbnails;
                const thumbnailUrl = (thumbnails.maxres || thumbnails.standard || thumbnails.high || thumbnails.medium || thumbnails.default).url;

                videosToInsert.push({
                    video_id: item.id,
                    playlist_id: snippet.playlistId,
                    title: snippet.title,
                    description: snippet.description,
                    thumbnail_url: thumbnailUrl,
                    published_at: snippet.publishedAt,
                    channel_title: snippet.channelTitle,
                    channel_id: item.snippet.channelId,
                    view_count: stats.viewCount ? parseInt(stats.viewCount, 10) : 0,
                    like_count: stats.likeCount ? parseInt(stats.likeCount, 10) : 0,
                    comment_count: stats.commentCount ? parseInt(stats.commentCount, 10) : 0,
                });
            });
        }

        // 存入数据库
        let updatedOrInsertedCount = 0;
        for (const video of videosToInsert) {
            const queryText = `
                INSERT INTO youtube_videos (
                    user_id, video_id, playlist_id, title, description, thumbnail_url, 
                    published_at, view_count, like_count, comment_count, channel_title, channel_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (user_id, video_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    thumbnail_url = EXCLUDED.thumbnail_url,
                    published_at = EXCLUDED.published_at,
                    view_count = EXCLUDED.view_count,
                    like_count = EXCLUDED.like_count,
                    comment_count = EXCLUDED.comment_count,
                    channel_title = EXCLUDED.channel_title,
                    channel_id = EXCLUDED.channel_id;
            `;
            const result = await client.query(queryText, [
                userId, video.video_id, video.playlist_id, video.title, video.description,
                video.thumbnail_url, video.published_at, video.view_count,
                video.like_count, video.comment_count, video.channel_title, video.channel_id
            ]);
            if (result.rowCount > 0) updatedOrInsertedCount++;
        }

        await client.query('COMMIT');
        
        // 发送4种渠道的通知
        const notificationTitle = '✅ YouTube数据获取成功';
        const channelList = uniqueChannelIds.join(', ').substring(0, 100); // 限制长度
        const notificationContent = `### YouTube数据获取报告 - 按频道获取

**会员**: ${req.user.email}
**获取方式**: 📺 按指定频道获取
**频道标识**: ${identifiers.join(', ')}
**解析频道数**: ${uniqueChannelIds.length}
**处理视频数**: ${videosToInsert.length}
**新增/更新记录**: ${updatedOrInsertedCount}
**扣费金额**: ¥${cost}
**剩余余额**: ¥${balanceAfter}
**完成时间**: ${new Date().toLocaleString('zh-CN')}

📊 **数据详情**:
- 频道ID: ${channelList}${uniqueChannelIds.length > 1 ? '...' : ''}
- 获取视频总数: ${allVideoIds.size} 个
- 成功处理: ${videosToInsert.length} 个

🎉 数据已成功保存到数据库，可以在主页面查看和筛选。`;

        // 异步发送通知（不阻塞响应）
        notificationService.sendAllChannels(notificationTitle, notificationContent).catch(err => {
            console.error('发送通知失败:', err);
        });
        
        res.status(201).json({ 
            message: `频道视频获取完成！共处理 ${videosToInsert.length} 条视频，新增或更新了 ${updatedOrInsertedCount} 条记录。已扣费 ${cost} 元。`,
            updatedOrInsertedCount: updatedOrInsertedCount,
            cost: cost,
            balance: balanceAfter
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Fetch by channels error:', error);
        res.status(500).json({ error: '获取失败: ' + error.message });
    } finally {
        client.release();
    }
});

// ========== 查询 API (需要认证 + 数据隔离) ==========

/**
 * @route   GET /api/stats
 * @desc    获取当前用户的视频统计
 * @access  Private
 */
app.get('/api/stats', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.is_admin;

        let query;
        let params;

        if (isAdmin) {
            // 管理员看所有数据
            query = 'SELECT COUNT(*) FROM youtube_videos';
            params = [];
        } else {
            // 普通用户只看自己的
            query = 'SELECT COUNT(*) FROM youtube_videos WHERE user_id = $1';
            params = [userId];
        }

        const totalResult = await pool.query(query, params);
        const totalVideos = parseInt(totalResult.rows[0].count, 10);
        
        res.json({ 
            totalVideos,
            balance: req.user.balance,
            isAdmin: isAdmin
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * @route   GET /api/channels
 * @desc    获取所有唯一的频道名称（基于用户权限）
 * @access  Private
 */
app.get('/api/channels', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.is_admin;

        let query;
        let params;

        if (isAdmin) {
            query = `
                SELECT DISTINCT channel_title FROM youtube_videos 
                WHERE channel_title IS NOT NULL AND channel_title <> '' 
                ORDER BY channel_title ASC
            `;
            params = [];
        } else {
            query = `
                SELECT DISTINCT channel_title FROM youtube_videos 
                WHERE user_id = $1 AND channel_title IS NOT NULL AND channel_title <> '' 
                ORDER BY channel_title ASC
            `;
            params = [userId];
        }

        const { rows } = await pool.query(query, params);
        res.json(rows.map(row => row.channel_title));
    } catch (err) {
        console.error('Channels error:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * @route   GET /api/unique-channels
 * @desc    获取所有唯一的频道 ID 和名称
 * @access  Private
 */
app.get('/api/unique-channels', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.is_admin;

        let query;
        let params;

        if (isAdmin) {
            query = `
                SELECT DISTINCT channel_id, channel_title 
                FROM youtube_videos 
                WHERE channel_id IS NOT NULL AND channel_title IS NOT NULL
                ORDER BY channel_title ASC
            `;
            params = [];
        } else {
            query = `
                SELECT DISTINCT channel_id, channel_title 
                FROM youtube_videos 
                WHERE user_id = $1 AND channel_id IS NOT NULL AND channel_title IS NOT NULL
                ORDER BY channel_title ASC
            `;
            params = [userId];
        }

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Unique channels error:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * @route   GET /api/videos-paginated
 * @desc    获取带分页、排序和筛选的视频数据（管理员可筛选用户）
 * @access  Private
 */
app.get('/api/videos-paginated', authenticate, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 9, 
            sortBy = 'published_at', 
            sortOrder = 'DESC',
            search = '',
            startDate,
            endDate,
            channel = '',
            filterUserId = '' // 管理员专用：筛选特定用户
        } = req.query;

        const userId = req.user.id;
        const isAdmin = req.user.is_admin;

        const offset = (page - 1) * limit;
        
        let whereClauses = [];
        let queryParams = [];
        let paramIndex = 1;

        // 数据隔离：普通用户只能看自己的数据
        if (!isAdmin) {
            whereClauses.push(`user_id = $${paramIndex}`);
            queryParams.push(userId);
            paramIndex++;
        } else if (isAdmin && filterUserId) {
            // 管理员可以筛选特定用户（支持多个，逗号分隔）
            const userIds = filterUserId.split(',').map(id => id.trim()).filter(id => id);
            if (userIds.length === 1) {
                whereClauses.push(`user_id = $${paramIndex}`);
                queryParams.push(parseInt(userIds[0]));
                paramIndex++;
            } else if (userIds.length > 1) {
                const placeholders = userIds.map((_, i) => `$${paramIndex + i}`).join(', ');
                whereClauses.push(`user_id IN (${placeholders})`);
                queryParams.push(...userIds.map(id => parseInt(id)));
                paramIndex += userIds.length;
            }
        }

        if (search) {
            whereClauses.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        if (startDate) {
            whereClauses.push(`published_at >= $${paramIndex}`);
            queryParams.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            whereClauses.push(`published_at <= $${paramIndex}`);
            queryParams.push(endOfDay);
            paramIndex++;
        }
        if (channel) {
            // 支持多个频道（逗号分隔）
            const channels = channel.split(',').map(c => c.trim()).filter(c => c);
            if (channels.length === 1) {
                // 单个频道：使用精确匹配
                whereClauses.push(`channel_title = $${paramIndex}`);
                queryParams.push(channels[0]);
                paramIndex++;
            } else if (channels.length > 1) {
                // 多个频道：使用 IN 语句
                const placeholders = channels.map((_, i) => `$${paramIndex + i}`).join(', ');
                whereClauses.push(`channel_title IN (${placeholders})`);
                queryParams.push(...channels);
                paramIndex += channels.length;
            }
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const allowedSortBy = ['published_at', 'view_count', 'like_count', 'comment_count'];
        const allowedSortOrder = ['ASC', 'DESC'];
        const finalSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'published_at';
        const finalSortOrder = allowedSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        const totalResult = await pool.query(`SELECT COUNT(*) FROM youtube_videos ${whereString}`, queryParams);
        const totalItems = parseInt(totalResult.rows[0].count, 10);
        const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

        const limitClause = limit > 0 ? `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : '';
        const dataParams = limit > 0 ? [...queryParams, limit, offset] : queryParams;

        const dataQuery = `
            SELECT * FROM youtube_videos 
            ${whereString}
            ORDER BY ${finalSortBy} ${finalSortOrder}
            ${limitClause}
        `;
        const dataResult = await pool.query(dataQuery, dataParams);

        res.json({
            data: dataResult.rows,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                totalItems,
                totalPages,
            }
        });

    } catch (err) {
        console.error('Videos paginated error:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * @route   GET /api/export
 * @desc    导出Excel（基于用户权限）
 * @access  Private
 */
app.get('/api/export', async (req, res) => {
    // 从query参数或header获取token
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: '未登录' });
    }
    
    // 手动验证token
    const authService = require('./services/auth');
    let decoded;
    try {
        decoded = authService.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: '登录已过期' });
        }
        const user = await authService.getUserById(decoded.id);
        if (!user) {
            return res.status(401).json({ error: '用户不存在' });
        }
        req.user = user;
    } catch (error) {
        return res.status(401).json({ error: '认证失败' });
    }
    
    // 继续原有逻辑
    try {
        const { 
            sortBy = 'published_at', 
            sortOrder = 'DESC',
            search = '',
            startDate,
            endDate,
            channel = '',
            filterUserId = ''
        } = req.query;

        const userId = req.user.id;
        const isAdmin = req.user.is_admin;

        let whereClauses = [];
        let queryParams = [];
        let paramIndex = 1;

        // 数据隔离
        if (!isAdmin) {
            whereClauses.push(`user_id = $${paramIndex}`);
            queryParams.push(userId);
            paramIndex++;
        } else if (isAdmin && filterUserId) {
            // 管理员可以筛选特定用户（支持多个，逗号分隔）
            const userIds = filterUserId.split(',').map(id => id.trim()).filter(id => id);
            if (userIds.length === 1) {
                whereClauses.push(`user_id = $${paramIndex}`);
                queryParams.push(parseInt(userIds[0]));
                paramIndex++;
            } else if (userIds.length > 1) {
                const placeholders = userIds.map((_, i) => `$${paramIndex + i}`).join(', ');
                whereClauses.push(`user_id IN (${placeholders})`);
                queryParams.push(...userIds.map(id => parseInt(id)));
                paramIndex += userIds.length;
            }
        }

        if (search) {
            whereClauses.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        if (startDate) {
            whereClauses.push(`published_at >= $${paramIndex}`);
            queryParams.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            whereClauses.push(`published_at <= $${paramIndex}`);
            queryParams.push(endOfDay);
            paramIndex++;
        }
        if (channel) {
            // 支持多个频道（逗号分隔）
            const channels = channel.split(',').map(c => c.trim()).filter(c => c);
            if (channels.length === 1) {
                // 单个频道：使用精确匹配
                whereClauses.push(`channel_title = $${paramIndex}`);
                queryParams.push(channels[0]);
                paramIndex++;
            } else if (channels.length > 1) {
                // 多个频道：使用 IN 语句
                const placeholders = channels.map((_, i) => `$${paramIndex + i}`).join(', ');
                whereClauses.push(`channel_title IN (${placeholders})`);
                queryParams.push(...channels);
                paramIndex += channels.length;
            }
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const allowedSortBy = ['published_at', 'view_count', 'like_count', 'comment_count'];
        const allowedSortOrder = ['ASC', 'DESC'];
        const finalSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'published_at';
        const finalSortOrder = allowedSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        const { rows } = await pool.query(`
            SELECT *, channel_id FROM youtube_videos 
            ${whereString} 
            ORDER BY ${finalSortBy} ${finalSortOrder}`, 
            queryParams
        );

        if (rows.length === 0) return res.status(404).send('没有可导出的筛选结果');
        
        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('YouTube Videos');
        worksheet.columns = [
            { header: '视频ID', key: 'video_id', width: 20 },
            { header: '标题', key: 'title', width: 50 },
            { header: '频道', key: 'channel_title', width: 30 },
            { header: '频道ID', key: 'channel_id', width: 30 },
            { header: '发布日期', key: 'published_at', width: 25 },
            { header: '观看数', key: 'view_count', width: 15 },
            { header: '点赞数', key: 'like_count', width: 15 },
            { header: '评论数', key: 'comment_count', width: 15 },
            { header: '描述', key: 'description', width: 80 },
            { header: '缩略图链接', key: 'thumbnail_url', width: 40 },
        ];
        rows.forEach(video => worksheet.addRow({ 
            ...video, 
            published_at: new Date(video.published_at).toLocaleString() 
        }));
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=youtube_report.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Export error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: '导出失败' });
        }
    }
});

/**
 * @route   GET /api/admin/users
 * @desc    管理员获取所有用户列表（用于筛选）
 * @access  Private (Admin only)
 */
app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, email, username, balance, created_at, 
                   (SELECT COUNT(*) FROM youtube_videos WHERE user_id = users.id) as video_count
            FROM users 
            WHERE is_admin = FALSE
            ORDER BY created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Serve index page with cache busting
app.get('/', (req, res) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎬 YouTube 视频搜索 + 会员系统                               ║
║                                                               ║
║   🚀 Server running on: http://localhost:${PORT}                ║
║   📊 Database: PostgreSQL                                     ║
║   💰 每次获取数据计费: 5元                                      ║
║   👤 会员数据隔离已启用                                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
