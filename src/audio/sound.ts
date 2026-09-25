import type { SoundEvent } from '../sim/types';

// Short synthesized effects keep the initial download small. No audio starts before a gesture.
export class Sound {
  private context: AudioContext | null = null;
  enabled = false;
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {
        this.enabled = false;
      });
    }
  }
  play(event: SoundEvent) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const ctx = this.context,
      now = ctx.currentTime;
    const gain = ctx.createGain(),
      pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.75, Math.min(0.75, (event.x - 16) / 24));
    gain.connect(pan);
    pan.connect(ctx.destination);
    const duration = event.kind === 'shot' ? 0.12 : event.kind === 'alarm' ? 0.55 : 0.16;
    gain.gain.setValueAtTime(event.kind === 'shot' ? 0.09 : 0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    if (event.kind === 'shot') {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp((-i / data.length) * 4);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2400;
      source.connect(filter);
      filter.connect(gain);
      source.start();
      source.onended = () => {
        filter.disconnect();
        gain.disconnect();
        pan.disconnect();
      };
    } else {
      const oscillator = ctx.createOscillator();
      oscillator.type = event.kind === 'alarm' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(event.kind === 'alarm' ? 430 : 650, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        event.kind === 'alarm' ? 290 : 880,
        now + duration,
      );
      oscillator.connect(gain);
      oscillator.start();
      oscillator.stop(now + duration);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        pan.disconnect();
      };
    }
  }
}
