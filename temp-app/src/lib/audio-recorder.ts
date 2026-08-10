/* eslint-disable */
// Helper to handle microphone recording and real-time visual analysis
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array = new Uint8Array(0);
  private startTime: number = 0;
  private pauseTime: number = 0;
  private totalPausedDuration: number = 0;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  
  public onWaveformUpdate: ((waveData: number[]) => void) | null = null;

  async start(): Promise<void> {
    this.audioChunks = [];
    this.totalPausedDuration = 0;
    this.isPaused = false;
    
    // 1. Requisitar permissão e pegar Stream
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Tenta usar codecs de compressão comuns
    let options = { mimeType: 'audio/webm;codecs=opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/ogg;codecs=opus' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/mp4' }; // Safari fallback
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      // Deixa o navegador escolher o default
      this.mediaRecorder = new MediaRecorder(this.stream);
    } else {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // 2. Web Audio API para análise de amplitude (Ondas Sonoras)
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64; // Tamanho pequeno para ter poucas bandas de onda simples
      source.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      this.startTime = Date.now();
      this.mediaRecorder.start(250); // Envia blocos a cada 250ms
      this.startAnalyzing();
    } catch (e) {
      console.warn("Could not initialize audio visualizer:", e);
      this.mediaRecorder.start(250);
      this.startTime = Date.now();
    }
  }

  private startAnalyzing() {
    const draw = () => {
      if (!this.analyser || this.isPaused) return;
      
      this.animationFrameId = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(this.dataArray as any);
      
      // Mapear frequências em níveis normalizados (0 a 1) para renderizar a onda
      const normalizedData = Array.from(this.dataArray).map(val => val / 255);
      
      if (this.onWaveformUpdate) {
        // Enviar os dados simplificados
        this.onWaveformUpdate(normalizedData);
      }
    };
    draw();
  }

  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
      this.pauseTime = Date.now();
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
    }
  }

  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.totalPausedDuration += Date.now() - this.pauseTime;
      this.startAnalyzing();
    }
  }

  stop(): Promise<{ blob: Blob; durationSeconds: number }> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve({ blob: new Blob(), durationSeconds: 0 });
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        
        let endTime = Date.now();
        let durationMs = endTime - this.startTime - this.totalPausedDuration;
        const durationSeconds = Math.max(1, Math.round(durationMs / 1000));
        
        // Limpeza dos recursos
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        if (this.audioContext) this.audioContext.close();
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }

        this.mediaRecorder = null;
        this.stream = null;
        this.audioContext = null;
        this.analyser = null;

        resolve({ blob: audioBlob, durationSeconds });
      };

      this.mediaRecorder.stop();
    });
  }

  getRecordingDuration(): number {
    if (!this.startTime) return 0;
    if (this.isPaused) {
      return Math.round((this.pauseTime - this.startTime - this.totalPausedDuration) / 1000);
    }
    return Math.round((Date.now() - this.startTime - this.totalPausedDuration) / 1000);
  }
}
