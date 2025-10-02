// services/gpt-chapter.js - Azure OpenAI GPT-4 integration for intelligent chapter generation
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');
require('dotenv').config();

class GPTChapterService {
  constructor() {
    this.apiKey = process.env.AZURE_OPENAI_KEY;
    this.endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    this.deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'my-gpt4-turbo';
    this.apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';

    if (!this.apiKey || !this.endpoint) {
      console.warn('⚠️ Azure OpenAI credentials not configured. Chapter generation will use fallback method.');
    }

    this.client = this.apiKey && this.endpoint ? new OpenAIClient(
      this.endpoint,
      new AzureKeyCredential(this.apiKey)
    ) : null;
  }

  // Generate chapters from transcript using GPT-4
  async generateChapters(transcript, videoDuration) {
    if (!this.client) {
      console.log('⚠️ Using fallback chapter generation (no Azure OpenAI configured)');
      return this.fallbackChapterGeneration(transcript, videoDuration);
    }

    try {
      const prompt = this.buildChapterPrompt(transcript, videoDuration);
      
      console.log('🤖 Requesting GPT-4 to generate chapters...');

      const response = await this.client.getChatCompletions(
        this.deployment,
        [
          {
            role: 'system',
            content: 'You are an expert video content analyzer. Your task is to analyze video transcripts and generate meaningful chapter divisions with titles and descriptions. You must respond in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        {
          temperature: 0.7,
          maxTokens: 4000
        }
      );

      const content = response.choices[0].message.content;
      console.log('✅ GPT-4 response received');

      // Parse JSON response
      const chapters = this.parseGPTResponse(content);
      
      return chapters;

    } catch (error) {
      console.error('❌ GPT-4 chapter generation error:', error);
      console.log('⚠️ Falling back to automatic chapter generation');
      return this.fallbackChapterGeneration(transcript, videoDuration);
    }
  }

  // Build prompt for GPT-4
  buildChapterPrompt(transcript, videoDuration) {
    const { fullText, segments } = transcript;
    
    return `请分析以下视频字幕内容，为这个时长 ${Math.round(videoDuration / 60)} 分钟的视频生成章节时间轴。

视频字幕内容：
${fullText.substring(0, 8000)}${fullText.length > 8000 ? '...(内容已截断)' : ''}

时间戳片段（前50个）：
${segments.slice(0, 50).map(s => `[${this.formatTime(s.startTime)} - ${this.formatTime(s.endTime)}] ${s.text}`).join('\n')}

要求：
1. 根据内容的语义变化和主题转换，智能划分章节
2. 每个章节应该有清晰的主题
3. 章节长度适中，建议每个章节3-10分钟
4. 为每个章节生成有意义的标题（简短精炼，15字以内）
5. 为每个章节生成简要描述（50字以内）
6. 章节的起始时间必须对应实际的字幕时间戳

请以JSON格式返回，格式如下：
{
  "chapters": [
    {
      "index": 1,
      "startTime": 0,
      "endTime": 180.5,
      "title": "章节标题",
      "description": "章节描述",
      "keyPoints": ["要点1", "要点2"]
    }
  ]
}

注意：
- 只返回JSON，不要包含其他说明文字
- startTime 和 endTime 必须是数字（秒）
- 确保章节时间连续且不重叠
- 最后一个章节的 endTime 应该接近视频总时长 ${videoDuration} 秒`;
  }

  // Parse GPT-4 JSON response
  parseGPTResponse(content) {
    try {
      // Extract JSON from markdown code blocks if present
      let jsonStr = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const data = JSON.parse(jsonStr);
      
      if (!data.chapters || !Array.isArray(data.chapters)) {
        throw new Error('Invalid response format: missing chapters array');
      }

      return data.chapters.map((ch, idx) => ({
        chapterIndex: ch.index || (idx + 1),
        startTime: parseFloat(ch.startTime),
        endTime: parseFloat(ch.endTime),
        title: ch.title || `Chapter ${idx + 1}`,
        description: ch.description || '',
        keyPoints: ch.keyPoints || []
      }));

    } catch (error) {
      console.error('❌ Failed to parse GPT response:', error);
      throw new Error(`Invalid GPT response format: ${error.message}`);
    }
  }

  // Fallback chapter generation (when GPT is not available)
  fallbackChapterGeneration(transcript, videoDuration) {
    const { segments } = transcript;
    const chapters = [];
    
    // Simple algorithm: create chapters every 5 minutes or based on silence gaps
    const chapterDuration = 300; // 5 minutes
    const numChapters = Math.max(1, Math.ceil(videoDuration / chapterDuration));
    
    for (let i = 0; i < numChapters; i++) {
      const startTime = i * chapterDuration;
      const endTime = Math.min((i + 1) * chapterDuration, videoDuration);
      
      // Find segments in this time range
      const chapterSegments = segments.filter(
        s => s.startTime >= startTime && s.startTime < endTime
      );
      
      // Generate title from first segment or generic
      const title = chapterSegments.length > 0 
        ? this.generateTitleFromText(chapterSegments[0].text)
        : `第 ${i + 1} 部分`;
      
      chapters.push({
        chapterIndex: i + 1,
        startTime: startTime,
        endTime: endTime,
        title: title,
        description: chapterSegments.slice(0, 3).map(s => s.text).join(' ').substring(0, 100),
        keyPoints: []
      });
    }
    
    return chapters;
  }

  // Generate simple title from text
  generateTitleFromText(text) {
    const words = text.trim().split(/\s+/).slice(0, 8).join(' ');
    return words.length > 20 ? words.substring(0, 20) + '...' : words;
  }

  // Format seconds to HH:MM:SS
  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}

module.exports = GPTChapterService;
