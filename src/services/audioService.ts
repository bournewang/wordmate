import type { Word } from '../types';

/**
 * 音频服务类
 * 处理单词发音，包括本地音频文件和TTS备用方案
 */
export class AudioService {
  private static audioCache = new Map<string, HTMLAudioElement>();
  private static isLoading = new Set<string>();
  
  /**
   * 播放单词发音
   * @param word 要播放的单词对象
   * @param fallbackToTTS 是否在音频文件加载失败时使用TTS
   * @returns Promise<boolean> 播放是否成功
   */
  static async playWordAudio(word: Word, fallbackToTTS: boolean = true): Promise<boolean> {
    try {
      // 首先尝试播放本地音频文件
      const audioPlayed = word.audioUrl ? await this.playLocalAudio(word.audioUrl) : false;
      
      if (audioPlayed) {
        return true;
      }

      // 如果本地音频失败且允许TTS，则使用文本转语音
      if (fallbackToTTS && this.isTTSSupported()) {
        return await this.playTTSAudio(word.word);
      }

      return false;
    } catch (error) {
      console.error('播放音频失败:', error);
      
      // 尝试TTS作为最后的备用方案
      if (fallbackToTTS && this.isTTSSupported()) {
        return await this.playTTSAudio(word.word);
      }
      
      return false;
    }
  }

  /**
   * 播放本地音频文件
   * @param audioUrl 音频文件路径
   * @returns Promise<boolean> 播放是否成功
   */
  private static async playLocalAudio(audioUrl: string): Promise<boolean> {
    if (!audioUrl) return false;

    try {
      // 构建完整的音频文件路径
      const fullAudioPath = audioUrl.startsWith('http') 
        ? audioUrl 
        : `/audio/${audioUrl}`;

      // 检查缓存
      let audio = this.audioCache.get(fullAudioPath);
      
      if (!audio) {
        // 避免重复加载同一个音频文件
        if (this.isLoading.has(fullAudioPath)) {
          return false;
        }

        this.isLoading.add(fullAudioPath);
        
        audio = new Audio(fullAudioPath);
        
        // 预加载音频
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('音频加载超时'));
          }, 5000);

          audio!.addEventListener('canplaythrough', () => {
            clearTimeout(timeoutId);
            resolve();
          }, { once: true });

          audio!.addEventListener('error', (e) => {
            clearTimeout(timeoutId);
            reject(new Error(`音频加载失败: ${e.message || '未知错误'}`));
          }, { once: true });

          audio!.load();
        });

        // 缓存音频对象
        this.audioCache.set(fullAudioPath, audio);
        this.isLoading.delete(fullAudioPath);
      }

      // 重置播放位置并播放
      audio.currentTime = 0;
      await audio.play();
      
      return true;
    } catch (error) {
      this.isLoading.delete(audioUrl);
      console.warn('本地音频播放失败:', error);
      return false;
    }
  }

  /**
   * 使用TTS播放单词发音
   * @param word 要发音的单词
   * @param lang 语言代码，默认为英语
   * @returns Promise<boolean> 播放是否成功
   */
  private static async playTTSAudio(word: string, lang: string = 'en-US'): Promise<boolean> {
    if (!this.isTTSSupported()) {
      return false;
    }

    try {
      // 停止当前的TTS播放
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = lang;
      utterance.rate = 0.8; // 稍微慢一点，便于学习
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // 尝试选择合适的语音
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.name.includes('Google')
      ) || voices.find(voice => voice.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      return new Promise<boolean>((resolve) => {
        utterance.onend = () => resolve(true);
        utterance.onerror = (error) => {
          console.error('TTS播放失败:', error);
          resolve(false);
        };

        speechSynthesis.speak(utterance);
      });
    } catch (error) {
      console.error('TTS播放异常:', error);
      return false;
    }
  }

  /**
   * 检查浏览器是否支持TTS
   * @returns boolean 是否支持TTS
   */
  private static isTTSSupported(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  /**
   * 预加载音频文件
   * @param audioUrls 音频文件URL列表
   * @returns Promise<void>
   */
  static async preloadAudios(audioUrls: string[]): Promise<void> {
    const loadPromises = audioUrls.map(async (url) => {
      if (this.audioCache.has(url) || this.isLoading.has(url)) {
        return; // 已缓存或正在加载
      }

      try {
        await this.playLocalAudio(url);
      } catch (error) {
        console.warn(`预加载音频失败: ${url}`, error);
      }
    });

    await Promise.allSettled(loadPromises);
    console.log(`已预加载 ${audioUrls.length} 个音频文件`);
  }

  /**
   * 清除音频缓存
   * @param url 可选，指定要清除的URL，不指定则清除所有
   */
  static clearCache(url?: string): void {
    if (url) {
      const audio = this.audioCache.get(url);
      if (audio) {
        audio.pause();
        audio.src = '';
        this.audioCache.delete(url);
      }
    } else {
      // 清除所有缓存
      this.audioCache.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      this.audioCache.clear();
    }
  }

  /**
   * 获取TTS语音列表
   * @returns 可用的语音列表
   */
  static getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.isTTSSupported()) {
      return [];
    }

    return speechSynthesis.getVoices().filter(voice => 
      voice.lang.startsWith('en')
    );
  }

  /**
   * 设置TTS语音
   * @param voiceURI 语音URI
   */
  static setPreferredVoice(voiceURI: string): void {
    localStorage.setItem('preferredTTSVoice', voiceURI);
  }

  /**
   * 获取首选TTS语音
   * @returns 首选语音的URI
   */
  static getPreferredVoice(): string | null {
    return localStorage.getItem('preferredTTSVoice');
  }

  /**
   * 停止所有音频播放
   */
  static stopAllAudio(): void {
    // 停止TTS
    if (this.isTTSSupported()) {
      speechSynthesis.cancel();
    }

    // 停止所有缓存的音频
    this.audioCache.forEach((audio) => {
      if (!audio.paused) {
        audio.pause();
      }
    });
  }

  /**
   * 测试音频功能
   * @returns Promise<{ localAudio: boolean; tts: boolean; }>
   */
  static async testAudioCapabilities(): Promise<{
    localAudio: boolean;
    tts: boolean;
  }> {
    const results = {
      localAudio: false,
      tts: false
    };

    // 测试本地音频
    try {
      const testAudio = new Audio();
      testAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmYcCzaKzu/vgYcPImO78AxgUC0OKi+HAFTQFBxGzNrMvFMGMhpE8e4AAjEQeKWR21LhDwGKUgBN8/ULBCEACECqhSGRAbgQhSg2ASdvE3sEbSDGJhiYCE8xQnQQACOzIDIQLGKwdJbhP2z0VwmVOkVFT5gfQWAUjx3VTALIGdRwQG2Bh4wPGQiMBzQUCwUYBGGmRHnXWx+VWJFLl+HG7iHKR6qJZzJnKkLKQJgSayHRYADBnGZ8Q1aBhoMNFQeJBjITCgQWAWCuO23zYh5CaKN6oiNHC8vEyIhcHuDrywctXBGjSdQNKULKdlNDq4tCg4sGAxCsBCICBgExUgjFxw4YBGGmQ33hTh7hIEOfYpNuLDOyGQBPBSZoT3W6a1b3dgGGQzfMGg4ZYhBqHJyHQyNSbNJnXWa2jXfNK+H6hh7NINOGWm9rS8BNp0ZJHUIxC0LFIDqL3YME+7wQxIOu2rAP'+
            'RTXMGQ4ZYhBpHZ6HQCFRa9NnXma4jHfNK+D5hh7OHtKGW29pS8FPpkdJHEExDELFIDuL3YQF+rwQw4St2rANRTXMGQ4ZYhBqHJyHQiJSbNNnXWa3jXbMK+H6hh7NHtOGW29qS8BPqEdJHkExDELEIDuL3YMF+rwQxIOu2rAPRTXMGQ4ZYhBqHJyHQyNSbNJnXWa2jXfNK+H6hh7OHdOGWm9rS8BNp0ZJHkExC0LFIDuL3YME+rwQxIOu2rEPRTXMGQ4ZYhBqHJ2HQyNSbNJnXWa2jXfNK+H6hh7NHdOGW29rS8BNp0ZJHkExDELFIDuL3YME+rwQxIOu2rEPRTXMGQ4ZYhBqHJ2HQyNSbNJnXWa2jXfNK+H6hh7NHdOGW29rS8BNp0ZJHkExDELFIDuL3YME+rwQxIOu2rEPRTXMGQ4ZYhBqHJ2HQyNSbNJnXWa2jXfNK+H6hh7NHdOGW29rS8BNp0ZJHkExDELFIDuL3YME+rwQxIOu2rEPRTXMGQ4ZYhBqHJ2HQyNSbNJnXWa2jXfNK+H6hh7NHdOGW29rS8BNp0ZJHkExDELFIDuL3YME+rwQxIOu2rEP';
      
      await new Promise<void>((resolve, reject) => {
        testAudio.addEventListener('canplaythrough', () => resolve(), { once: true });
        testAudio.addEventListener('error', () => reject(), { once: true });
        testAudio.load();
      });
      
      results.localAudio = true;
    } catch (error) {
      console.warn('本地音频测试失败:', error);
    }

    // 测试TTS
    results.tts = this.isTTSSupported();

    return results;
  }
}
