// services/whisper.js - Whisper API integration for speech-to-text
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config();

const execPromise = util.promisify(exec);

class WhisperService {
  constructor() {
    this.modelPath = process.env.WHISPER_MODEL_PATH || '/Users/seigneur/lavoro/subtitle/node_modules/whisper-node/whisper/models/ggml-large-v3-turbo.bin';
    this.executablePath = process.env.WHISPER_EXECUTABLE_PATH || '/Users/seigneur/lavoro/subtitle/node_modules/whisper-node/whisper/main';
    this.tempDir = process.env.TEMP_DIR || './temp';
  }

  // Extract audio from video file
  async extractAudio(videoPath) {
    const audioPath = path.join(this.tempDir, `audio_${Date.now()}.wav`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .toFormat('wav')
        .audioFrequency(16000)
        .audioChannels(1)
        .on('end', () => {
          console.log('✅ Audio extraction completed');
          resolve(audioPath);
        })
        .on('error', (err) => {
          console.error('❌ Audio extraction failed:', err);
          reject(err);
        })
        .save(audioPath);
    });
  }

  // Transcribe audio using Whisper
  async transcribe(audioPath, options = {}) {
    try {
      const language = options.language || 'zh';
      const outputFormat = options.format || 'srt';
      
      // Build Whisper command
      const command = `"${this.executablePath}" -m "${this.modelPath}" -f "${audioPath}" -l ${language} --no-gpu --output-${outputFormat}`;
      
      console.log('🎙️ Starting Whisper transcription...');
      console.log('Command:', command);

      const { stdout, stderr } = await execPromise(command, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      if (stderr) {
        console.log('Whisper stderr:', stderr);
      }

      // Read the generated SRT file
      const srtPath = audioPath.replace(/\.\w+$/, `.${outputFormat}`);
      const transcriptContent = await fs.readFile(srtPath, 'utf-8');

      console.log('✅ Whisper transcription completed');

      // Parse SRT to segments
      const segments = this.parseSRT(transcriptContent);

      // Clean up SRT file
      try {
        await fs.unlink(srtPath);
      } catch (e) {
        console.warn('⚠️ Could not delete SRT file:', e.message);
      }

      return {
        fullText: segments.map(s => s.text).join(' '),
        segments: segments,
        raw: transcriptContent
      };

    } catch (error) {
      console.error('❌ Whisper transcription error:', error);
      throw new Error(`Whisper transcription failed: ${error.message}`);
    }
  }

  // Parse SRT format to segments
  parseSRT(srtContent) {
    const segments = [];
    const blocks = srtContent.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 3) continue;

      const timeLine = lines[1];
      const text = lines.slice(2).join(' ');

      const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (!timeMatch) continue;

      const startTime = this.timeToSeconds(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      const endTime = this.timeToSeconds(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

      segments.push({
        startTime,
        endTime,
        text: text.trim()
      });
    }

    return segments;
  }

  // Convert time to seconds
  timeToSeconds(hours, minutes, seconds, milliseconds) {
    return (
      parseInt(hours) * 3600 +
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      parseInt(milliseconds) / 1000
    );
  }

  // Process video: extract audio and transcribe
  async processVideo(videoPath, options = {}) {
    let audioPath = null;
    
    try {
      console.log(`🎬 Processing video: ${videoPath}`);
      
      // Extract audio
      audioPath = await this.extractAudio(videoPath);
      
      // Transcribe
      const transcript = await this.transcribe(audioPath, options);
      
      // Clean up audio file
      try {
        await fs.unlink(audioPath);
        console.log('🧹 Cleaned up temporary audio file');
      } catch (e) {
        console.warn('⚠️ Could not delete audio file:', e.message);
      }
      
      return transcript;
      
    } catch (error) {
      // Clean up on error
      if (audioPath) {
        try {
          await fs.unlink(audioPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  // Get video duration using ffmpeg
  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }
}

module.exports = WhisperService;
