import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MediaAttachment } from '../../types/Communication';
import logger from '../../utils/logger';

export interface VoiceProcessingOptions {
  outputFormat: 'wav' | 'mp3' | 'flac';
  sampleRate: number;
  channels: number;
  quality: 'low' | 'medium' | 'high';
  maxDuration: number; // in seconds
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration: number;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  metadata: {
    originalFile: string;
    processedFile: string;
    audioFormat: string;
    sampleRate: number;
    channels: number;
    processedAt: Date;
  };
}

export interface VoiceProcessorConfig {
  tempDir: string;
  ffmpegPath: string;
  whisperModelPath?: string; // For local Whisper models
  openaiApiKey?: string; // For OpenAI Whisper API
  transcriptionProvider: 'local' | 'openai' | 'google' | 'azure';
  maxFileSize: number; // in bytes
  supportedFormats: string[];
}

export class VoiceProcessor {
  private static readonly DEFAULT_OPTIONS: VoiceProcessingOptions = {
    outputFormat: 'wav',
    sampleRate: 16000,
    channels: 1,
    quality: 'medium',
    maxDuration: 300, // 5 minutes
  };

  private static readonly DEFAULT_CONFIG: VoiceProcessorConfig = {
    tempDir: path.join(process.cwd(), 'temp', 'audio'),
    ffmpegPath: 'ffmpeg',
    transcriptionProvider: 'local',
    maxFileSize: 25 * 1024 * 1024, // 25MB
    supportedFormats: ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'],
  };

  constructor(private config: Partial<VoiceProcessorConfig> = {}) {
    this.config = { ...VoiceProcessor.DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    try {
      // Ensure temp directory exists
      await fs.mkdir(this.config.tempDir!, { recursive: true });
      
      // Test FFmpeg availability
      await this.testFFmpeg();
      
      logger.info('Voice processor initialized successfully', {
        tempDir: this.config.tempDir,
        provider: this.config.transcriptionProvider,
        maxFileSize: this.config.maxFileSize,
      });
    } catch (error) {
      logger.error('Failed to initialize voice processor', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async processVoiceMessage(
    attachment: MediaAttachment,
    options: Partial<VoiceProcessingOptions> = {}
  ): Promise<TranscriptionResult> {
    const processingOptions = { ...VoiceProcessor.DEFAULT_OPTIONS, ...options };
    
    try {
      logger.info('Processing voice message', {
        filename: attachment.filename,
        size: attachment.size,
        mimeType: attachment.mimeType,
      });

      // Validate input
      await this.validateAudioFile(attachment);

      // Convert audio to optimal format for transcription
      const processedFile = await this.convertAudio(attachment, processingOptions);

      // Extract audio metadata
      const metadata = await this.extractAudioMetadata(processedFile);

      // Transcribe audio
      const transcription = await this.transcribeAudio(processedFile, metadata);

      // Cleanup processed file
      await this.cleanup(processedFile);

      const result: TranscriptionResult = {
        ...transcription,
        metadata: {
          originalFile: attachment.filename,
          processedFile: path.basename(processedFile),
          audioFormat: processingOptions.outputFormat,
          sampleRate: processingOptions.sampleRate,
          channels: processingOptions.channels,
          processedAt: new Date(),
        },
      };

      logger.info('Voice message processed successfully', {
        filename: attachment.filename,
        transcriptionLength: result.text.length,
        confidence: result.confidence,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      logger.error('Voice message processing failed', {
        error: error instanceof Error ? error.message : String(error),
        filename: attachment.filename,
      });
      throw error;
    }
  }

  private async validateAudioFile(attachment: MediaAttachment): Promise<void> {
    // Check file size
    if (attachment.size > this.config.maxFileSize!) {
      throw new Error(`Audio file too large: ${attachment.size} bytes (max: ${this.config.maxFileSize})`);
    }

    // Check file format
    const ext = path.extname(attachment.filename).toLowerCase();
    if (!this.config.supportedFormats!.includes(ext)) {
      throw new Error(`Unsupported audio format: ${ext}`);
    }

    // Check if file exists
    try {
      await fs.access(attachment.url);
    } catch (error) {
      throw new Error(`Audio file not accessible: ${attachment.url}`);
    }
  }

  private async convertAudio(
    attachment: MediaAttachment,
    options: VoiceProcessingOptions
  ): Promise<string> {
    const outputFilename = `processed_${Date.now()}.${options.outputFormat}`;
    const outputPath = path.join(this.config.tempDir!, outputFilename);

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', attachment.url,
        '-ar', options.sampleRate.toString(),
        '-ac', options.channels.toString(),
        '-t', options.maxDuration.toString(),
        '-y', // Overwrite output file
        outputPath,
      ];

      // Add quality settings
      if (options.quality === 'high') {
        ffmpegArgs.splice(-1, 0, '-q:a', '0');
      } else if (options.quality === 'low') {
        ffmpegArgs.splice(-1, 0, '-q:a', '9');
      }

      const ffmpeg = spawn(this.config.ffmpegPath!, ffmpegArgs);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });
  }

  private async extractAudioMetadata(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const ffprobeArgs = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ];

      const ffprobe = spawn('ffprobe', ffprobeArgs);
      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(stdout);
            resolve(metadata);
          } catch (error) {
            reject(new Error(`Failed to parse audio metadata: ${error}`));
          }
        } else {
          reject(new Error(`FFprobe failed with code ${code}: ${stderr}`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`FFprobe spawn error: ${error.message}`));
      });
    });
  }

  private async transcribeAudio(filePath: string, metadata: any): Promise<Omit<TranscriptionResult, 'metadata'>> {
    const duration = parseFloat(metadata.format.duration) || 0;

    switch (this.config.transcriptionProvider) {
      case 'local':
        return await this.transcribeWithLocalWhisper(filePath, duration);
      case 'openai':
        return await this.transcribeWithOpenAI(filePath, duration);
      case 'google':
        return await this.transcribeWithGoogle(filePath, duration);
      case 'azure':
        return await this.transcribeWithAzure(filePath, duration);
      default:
        throw new Error(`Unsupported transcription provider: ${this.config.transcriptionProvider}`);
    }
  }

  private async transcribeWithLocalWhisper(filePath: string, duration: number): Promise<Omit<TranscriptionResult, 'metadata'>> {
    // Implementation for local Whisper model
    // This would use a local Whisper installation or Python script
    try {
      logger.info('Transcribing with local Whisper', { filePath, duration });

      // For now, return a mock implementation
      // In production, this would call a local Whisper model
      const mockTranscription = {
        text: "This is a mock transcription from local Whisper. The actual implementation would process the audio file using a local Whisper model.",
        confidence: 0.85,
        language: 'en',
        duration,
        segments: [{
          text: "This is a mock transcription from local Whisper.",
          start: 0,
          end: duration,
          confidence: 0.85,
        }],
      };

      return mockTranscription;
    } catch (error) {
      throw new Error(`Local Whisper transcription failed: ${error}`);
    }
  }

  private async transcribeWithOpenAI(filePath: string, duration: number): Promise<Omit<TranscriptionResult, 'metadata'>> {
    // Implementation for OpenAI Whisper API
    if (!this.config.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      logger.info('Transcribing with OpenAI Whisper API', { filePath, duration });

      // This would use the OpenAI API
      // For now, return a mock implementation
      const mockTranscription = {
        text: "This is a mock transcription from OpenAI Whisper API. The actual implementation would call the OpenAI transcription endpoint.",
        confidence: 0.92,
        language: 'en',
        duration,
      };

      return mockTranscription;
    } catch (error) {
      throw new Error(`OpenAI Whisper transcription failed: ${error}`);
    }
  }

  private async transcribeWithGoogle(filePath: string, duration: number): Promise<Omit<TranscriptionResult, 'metadata'>> {
    // Implementation for Google Speech-to-Text
    try {
      logger.info('Transcribing with Google Speech-to-Text', { filePath, duration });

      // This would use Google Cloud Speech-to-Text API
      const mockTranscription = {
        text: "This is a mock transcription from Google Speech-to-Text. The actual implementation would use Google Cloud APIs.",
        confidence: 0.88,
        language: 'en',
        duration,
      };

      return mockTranscription;
    } catch (error) {
      throw new Error(`Google Speech-to-Text transcription failed: ${error}`);
    }
  }

  private async transcribeWithAzure(filePath: string, duration: number): Promise<Omit<TranscriptionResult, 'metadata'>> {
    // Implementation for Azure Speech Services
    try {
      logger.info('Transcribing with Azure Speech Services', { filePath, duration });

      // This would use Azure Cognitive Services Speech API
      const mockTranscription = {
        text: "This is a mock transcription from Azure Speech Services. The actual implementation would use Azure Cognitive Services.",
        confidence: 0.90,
        language: 'en',
        duration,
      };

      return mockTranscription;
    } catch (error) {
      throw new Error(`Azure Speech Services transcription failed: ${error}`);
    }
  }

  private async testFFmpeg(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.config.ffmpegPath!, ['-version']);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg not available at path: ${this.config.ffmpegPath}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg test failed: ${error.message}`));
      });
    });
  }

  private async cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug('Cleaned up processed audio file', { filePath });
    } catch (error) {
      logger.warn('Failed to cleanup processed audio file', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async processVideoAudio(attachment: MediaAttachment): Promise<TranscriptionResult> {
    // Extract audio from video file and transcribe
    try {
      logger.info('Extracting audio from video', {
        filename: attachment.filename,
        size: attachment.size,
      });

      // Extract audio track using FFmpeg
      const audioFilename = `extracted_${Date.now()}.wav`;
      const audioPath = path.join(this.config.tempDir!, audioFilename);

      await new Promise<void>((resolve, reject) => {
        const ffmpegArgs = [
          '-i', attachment.url,
          '-vn', // No video
          '-acodec', 'pcm_s16le',
          '-ar', '16000',
          '-ac', '1',
          '-y',
          audioPath,
        ];

        const ffmpeg = spawn(this.config.ffmpegPath!, ffmpegArgs);

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Audio extraction failed with code ${code}`));
          }
        });

        ffmpeg.on('error', reject);
      });

      // Create temporary audio attachment
      const audioAttachment: MediaAttachment = {
        id: `extracted-${Date.now()}`,
        type: 'audio',
        url: audioPath,
        filename: audioFilename,
        size: (await fs.stat(audioPath)).size,
        mimeType: 'audio/wav',
      };

      // Transcribe extracted audio
      const result = await this.processVoiceMessage(audioAttachment);

      // Cleanup extracted audio
      await this.cleanup(audioPath);

      return result;
    } catch (error) {
      logger.error('Video audio processing failed', {
        error: error instanceof Error ? error.message : String(error),
        filename: attachment.filename,
      });
      throw error;
    }
  }

  async cleanupOldFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.config.tempDir!);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.config.tempDir!, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          logger.info('Cleaned up old audio file', { file });
        }
      }
    } catch (error) {
      logger.error('Audio file cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getConfig(): VoiceProcessorConfig {
    return this.config as VoiceProcessorConfig;
  }

  async shutdown(): Promise<void> {
    // Cleanup any remaining temp files
    await this.cleanupOldFiles(0);
    logger.info('Voice processor shut down');
  }
}

export default VoiceProcessor;