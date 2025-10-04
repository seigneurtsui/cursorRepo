// server.js

// 1. 导入所需模块
require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const { Pool } = require('pg');
const exceljs = require('exceljs');
const cors = require('cors');
const morgan = require('morgan');


const path = require('path');

// 2. 初始化
const app = express();
const PORT = process.env.PORT || 3000;

// YouTube API 配置
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
});

// PostgreSQL 数据库连接池配置
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// 3. 中间件
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 4. API 路由定义

/**
 * @route   POST /api/search
 * @desc    根据关键词从 YouTube 搜索播放列表并存入数据库
 * @access  Public
 */
app.post('/api/search', async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) {
        return res.status(400).json({ error: '关键词不能为空' });
    }

    try {
        const searchResponse = await youtube.search.list({
            part: 'snippet', q: keyword, type: 'playlist', maxResults: 10,
        });
        const playlists = searchResponse.data.items;
        if (!playlists || playlists.length === 0) {
            return res.status(404).json({ message: '未找到相关的播放列表' });
        }

        let allVideoIds = new Set();
        let allVideoSnippets = new Map();

        for (const playlist of playlists) {
            const playlistItemsResponse = await youtube.playlistItems.list({
                part: 'snippet,contentDetails',
                playlistId: playlist.id.playlistId,
                maxResults: 20, // 每个播放列表获取的视频数
            });
            playlistItemsResponse.data.items.forEach(item => {
                const videoId = item.contentDetails.videoId;
                if (videoId && !allVideoSnippets.has(videoId)) {
                    allVideoSnippets.set(videoId, item.snippet);
                    allVideoIds.add(videoId);
                }
            });
        }

        if (allVideoIds.size === 0) {
            return res.status(404).json({ message: '在找到的播放列表中未能获取任何视频' });
        }
        
        const videoIdsArray = Array.from(allVideoIds);
        let videosToInsert = [];

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

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let updatedOrInsertedCount = 0;
            for (const video of videosToInsert) {
                const queryText = `
                    INSERT INTO videos (video_id, playlist_id, title, description, thumbnail_url, published_at, view_count, like_count, comment_count, channel_title, channel_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (video_id) DO UPDATE SET
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
                    video.video_id, video.playlist_id, video.title, video.description,
                    video.thumbnail_url, video.published_at, video.view_count,
                    video.like_count, video.comment_count, video.channel_title, video.channel_id
                ]);
                if (result.rowCount > 0) updatedOrInsertedCount++;
            }
            await client.query('COMMIT');
            // [FIX-1A] 返回包含 updatedOrInsertedCount 的 JSON 对象
            res.status(201).json({ 
                message: `操作完成，共处理 ${videosToInsert.length} 条视频，新增或更新了 ${updatedOrInsertedCount} 条记录。`,
                updatedOrInsertedCount: updatedOrInsertedCount 
            });
        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error('数据库插入错误:', dbError);
            res.status(500).json({ error: '数据库操作失败' });
        } finally {
            client.release();
        }

    } catch (apiError) {
        console.error('YouTube API 错误:', apiError.errors || apiError);
        res.status(500).json({ error: '与 YouTube API 通信时发生错误' });
    }
});


/**
 * @route   POST /api/fetch-by-channels
 * @desc    根据指定的频道ID或用户名列表，获取所有视频并存入数据库
 * @access  Public
 */
app.post('/api/fetch-by-channels', async (req, res) => {
    const { identifiers } = req.body;
    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
        return res.status(400).json({ error: '频道标识列表不能为空' });
    }

    try {
        let finalChannelIds = new Set();
        const handlesToResolve = [];

        // 步骤 1: 分离频道ID和需要解析的用户名/handle
        identifiers.forEach(id => {
            if (id.startsWith('UC')) {
                finalChannelIds.add(id);
            } else {
                handlesToResolve.push(id.startsWith('@') ? id.substring(1) : id);
            }
        });

        // 步骤 2: 迭代解析每一个用户名/handle
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
                } else {
                    console.warn(`未能为用户名 "${handle}" 找到任何频道，已跳过。`);
                }
            } catch (searchError) {
                console.warn(`解析用户名 "${handle}" 时出错:`, searchError.errors || searchError);
            }
        }
        
        const uniqueChannelIds = [...finalChannelIds];

        if (uniqueChannelIds.length === 0) {
            return res.status(400).json({ error: '未能解析出任何有效的频道ID' });
        }

        let allVideoIds = new Set();
        let allVideoSnippets = new Map();

        for (const channelId of uniqueChannelIds) {
            // 步骤 3: 根据频道ID获取其 'uploads' 播放列表ID
            const channelResponse = await youtube.channels.list({
                part: 'contentDetails',
                id: channelId,
            });

            const uploadsPlaylistId = channelResponse.data.items[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsPlaylistId) {
                console.warn(`无法找到频道 ${channelId} 的上传列表，已跳过。`);
                continue;
            }

            // 步骤 4: 分页获取该播放列表中的所有视频
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
            return res.status(404).json({ message: '在指定的频道中未能获取任何新视频' });
        }
        
        const videoIdsArray = Array.from(allVideoIds);
        let videosToInsert = [];

        // 步骤 5: 批量获取视频的统计信息
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


        // 步骤 6: 存入数据库
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let updatedOrInsertedCount = 0;
            for (const video of videosToInsert) {
                const queryText = `
                    INSERT INTO videos (video_id, playlist_id, title, description, thumbnail_url, published_at, view_count, like_count, comment_count, channel_title, channel_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (video_id) DO UPDATE SET
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
                    video.video_id, video.playlist_id, video.title, video.description,
                    video.thumbnail_url, video.published_at, video.view_count,
                    video.like_count, video.comment_count, video.channel_title, video.channel_id
                ]);
                if (result.rowCount > 0) updatedOrInsertedCount++;
            }
            await client.query('COMMIT');
            // [FIX-1B] 返回包含 updatedOrInsertedCount 的 JSON 对象
            res.status(201).json({ 
                message: `操作完成，共处理 ${videosToInsert.length} 条视频，新增或更新了 ${updatedOrInsertedCount} 条记录。`,
                updatedOrInsertedCount: updatedOrInsertedCount
            });
        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error('数据库插入错误:', dbError);
            res.status(500).json({ error: '数据库操作失败' });
        } finally {
            client.release();
        }

    } catch (apiError) {
        console.error('YouTube API 错误:', apiError.errors || apiError);
        res.status(500).json({ error: '与 YouTube API 通信时发生错误' });
    }
});

/**
 * @route   GET /api/stats
 * @desc    获取数据库中的统计信息（如视频总数）
 * @access  Public
 */
app.get('/api/stats', async (req, res) => {
    try {
        const totalResult = await pool.query('SELECT COUNT(*) FROM videos');
        const totalVideos = parseInt(totalResult.rows[0].count, 10);
        res.json({ totalVideos });
    } catch (err) {
        console.error('查询统计数据错误:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * @route   GET /api/channels
 * @desc    获取所有唯一的频道名称
 * @access  Public
 */
app.get('/api/channels', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT DISTINCT channel_title FROM videos 
            WHERE channel_title IS NOT NULL AND channel_title <> '' 
            ORDER BY channel_title ASC
        `);
        res.json(rows.map(row => row.channel_title));
    } catch (err) {
        console.error('查询频道数据错误:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * @route   GET /api/unique-channels
 * @desc    获取所有唯一的频道 ID 和名称
 * @access  Public
 */
app.get('/api/unique-channels', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT DISTINCT channel_id, channel_title 
            FROM videos 
            WHERE channel_id IS NOT NULL AND channel_title IS NOT NULL
            ORDER BY channel_title ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('查询唯一频道数据错误:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});


/**
 * @route   GET /api/videos-paginated
 * @desc    从数据库获取带分页、排序和筛选的视频数据
 * @access  Public
 */
app.get('/api/videos-paginated', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 9, 
            sortBy = 'published_at', 
            sortOrder = 'DESC',
            search = '',
            startDate,
            endDate,
            channel = ''
        } = req.query;

        const offset = (page - 1) * limit;
        
        let whereClauses = [];
        let queryParams = [];
        let paramIndex = 1;

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
            whereClauses.push(`channel_title = $${paramIndex}`);
            queryParams.push(channel);
            paramIndex++;
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const allowedSortBy = ['published_at', 'view_count', 'like_count', 'comment_count'];
        const allowedSortOrder = ['ASC', 'DESC'];
        const finalSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'published_at';
        const finalSortOrder = allowedSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        const totalResult = await pool.query(`SELECT COUNT(*) FROM videos ${whereString}`, queryParams);
        const totalItems = parseInt(totalResult.rows[0].count, 10);
        const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

        const limitClause = limit > 0 ? `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : '';
        const dataParams = limit > 0 ? [...queryParams, limit, offset] : queryParams;

        const dataQuery = `
            SELECT * FROM videos 
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
        console.error('查询分页视频数据错误:', err);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * @route   GET /api/export
 * @desc    将筛选后的数据导出为 Excel 文件
 * @access  Public
 */
app.get('/api/export', async (req, res) => {
    try {
        const { 
            sortBy = 'published_at', 
            sortOrder = 'DESC',
            search = '',
            startDate,
            endDate,
            channel = ''
        } = req.query;

        let whereClauses = [];
        let queryParams = [];
        let paramIndex = 1;

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
            whereClauses.push(`channel_title = $${paramIndex}`);
            queryParams.push(channel);
            paramIndex++;
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        const allowedSortBy = ['published_at', 'view_count', 'like_count', 'comment_count'];
        const allowedSortOrder = ['ASC', 'DESC'];
        const finalSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'published_at';
        const finalSortOrder = allowedSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        const { rows } = await pool.query(`
            SELECT *, channel_id FROM videos 
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
        rows.forEach(video => worksheet.addRow({ ...video, published_at: new Date(video.published_at).toLocaleString() }));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'youtube_report.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('导出 Excel 错误:', err);
        res.status(500).json({ error: '导出失败' });
    }
});

// 5. 启动服务器
app.listen(PORT, () => {
    console.log(`服务器正在端口 ${PORT} 上运行`);
    console.log(`请在浏览器中打开 http://localhost:${PORT}`);
});
