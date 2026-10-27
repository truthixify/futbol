import goalCallUrl from '../assets/audio/goal-call.mp3';

/** Match audio is presentation only: it never changes simulation or replays. */
export class MatchAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voice: AudioBuffer | null = null;
  private voiceLoading = false;
  private noiseBuffer: AudioBuffer | null = null;
  private active = true;
  private closed = false;
  private sources = new Set<AudioScheduledSourceNode>();

  get enabled() { return this.active; }
  set enabled(value: boolean) {
    this.active = value;
    if (this.context && this.master) this.master.gain.setTargetAtTime(value ? 0.72 : 0, this.context.currentTime, 0.02);
    if (!value) this.stop();
  }

  unlock() {
    if (!this.active) return;
    try {
      if (!this.context || this.context.state === 'closed') {
        this.closed = false;
        this.context = new AudioContext();
        this.master = this.context.createGain(); this.master.gain.value = 0.72;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -10; limiter.knee.value = 12; limiter.ratio.value = 6;
        this.master.connect(limiter); limiter.connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
      if (!this.voice && !this.voiceLoading) {
        this.voiceLoading = true;
        void fetch(goalCallUrl).then(response => { if (!response.ok) throw new Error('Voice unavailable'); return response.arrayBuffer(); })
          .then(bytes => this.context!.decodeAudioData(bytes))
          .then(buffer => { if (!this.closed) this.voice = buffer; })
          .catch(() => { /* Keep the crowd effects if the recording cannot load. */ })
          .finally(() => { this.voiceLoading = false; });
      }
    } catch { /* Audio support never blocks playing football. */ }
  }

  private track(source: AudioScheduledSourceNode) {
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
  }

  private tone(frequency: number, endFrequency: number, duration: number, volume: number, delay = 0, type: OscillatorType = 'sine') {
    const c = this.context!, start = c.currentTime + delay;
    const oscillator = c.createOscillator(), envelope = c.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    envelope.gain.setValueAtTime(0.0001, start); envelope.gain.exponentialRampToValueAtTime(volume, start + 0.004); envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope); envelope.connect(this.master!);
    this.track(oscillator); oscillator.start(start); oscillator.stop(start + duration + 0.01);
    oscillator.addEventListener('ended', () => envelope.disconnect(), { once: true });
  }

  private noise(duration: number, volume: number, frequency: number, delay = 0, filter: BiquadFilterType = 'lowpass', attack = 0.005) {
    const c = this.context!, start = c.currentTime + delay;
    if (!this.noiseBuffer) {
      this.noiseBuffer = c.createBuffer(1, Math.ceil(c.sampleRate * 4), c.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = c.createBufferSource(), band = c.createBiquadFilter(), envelope = c.createGain();
    source.buffer = this.noiseBuffer;
    band.type = filter; band.frequency.value = frequency; band.Q.value = filter === 'bandpass' ? 0.9 : 0.5;
    envelope.gain.setValueAtTime(0.0001, start); envelope.gain.exponentialRampToValueAtTime(volume, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(band); band.connect(envelope); envelope.connect(this.master!);
    this.track(source); source.start(start, Math.random() * 0.5); source.stop(start + duration + 0.01);
    source.addEventListener('ended', () => { band.disconnect(); envelope.disconnect(); }, { once: true });
  }

  private whistle(final = false) {
    for (let i = 0; i < (final ? 3 : 1); i++) {
      const duration = final && i === 2 ? 0.55 : 0.2, delay = i * 0.3;
      this.tone(2500, 2650, duration, 0.055, delay);
      this.tone(2850, 2800, duration, 0.024, delay);
      this.noise(duration, 0.025, 3200, delay, 'bandpass');
    }
  }

  private celebrate() {
    const c = this.context!;
    if (this.voice) {
      const source = c.createBufferSource(), gain = c.createGain();
      source.buffer = this.voice; gain.gain.value = 0.9;
      source.connect(gain); gain.connect(this.master!); this.track(source);
      source.start(c.currentTime + 0.08);
      source.addEventListener('ended', () => gain.disconnect(), { once: true });
    }
    this.noise(2.4, 0.1, 850, 0.02, 'bandpass', 0.18);
    this.noise(2.8, 0.06, 1600, 0.1, 'bandpass', 0.25);
    for (let i = 0; i < 14; i++) this.noise(0.075, 0.065 - i * 0.003, 1800 + i % 4 * 430, 0.6 + i * 0.105, 'highpass');
  }

  play(kind: string) {
    if (!this.active || !this.context || this.context.state !== 'running') return;
    if (kind === 'goal') { this.celebrate(); return; }
    if (kind === 'kickoff' || kind === 'finish') { this.whistle(kind === 'finish'); return; }
    if (kind === 'shot') {
      this.tone(155, 42, 0.16, 0.6); this.noise(0.055, 0.45, 1500);
      this.noise(0.14, 0.06, 2500, 0.025, 'bandpass');
    } else if (kind === 'pass') {
      this.tone(175, 65, 0.1, 0.32); this.noise(0.035, 0.25, 1800);
    } else if (kind === 'tackle') {
      this.noise(0.25, 0.24, 1100); this.tone(85, 35, 0.12, 0.23);
    } else if (kind === 'save') {
      this.noise(0.08, 0.5, 2200); this.tone(135, 65, 0.11, 0.22);
    } else if (kind === 'bounce') {
      this.tone(200, 75, 0.075, 0.19); this.noise(0.025, 0.12, 1200);
    } else if (kind === 'dribble') {
      this.tone(130, 60, 0.055, 0.09); this.noise(0.02, 0.055, 1000);
    }
  }

  stop() {
    for (const source of this.sources) { try { source.stop(); } catch { /* Already stopped. */ } }
    this.sources.clear();
  }

  close() {
    this.closed = true; this.stop();
    void this.context?.close().catch(() => {});
    this.context = null; this.master = null; this.noiseBuffer = null;
  }
}
