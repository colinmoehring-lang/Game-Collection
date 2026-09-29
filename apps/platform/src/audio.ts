export type SoundEvent = 'roll' | 'buy' | 'auction' | 'trade' | 'win' | 'click';

const STORAGE_KEY = 'metroville_audio_settings';

interface AudioSettings {
  muted: boolean;
  volume: number;
}

function readSettings(): AudioSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      muted: Boolean(stored.muted),
      volume: typeof stored.volume === 'number' ? Math.min(1, Math.max(0, stored.volume)) : 0.35
    };
  } catch {
    return { muted: false, volume: 0.35 };
  }
}

let settings = readSettings();
let context: AudioContext | null = null;
let masterGain: GainNode | null = null;

function persistSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function getAudioGraph() {
  context ??= new AudioContext();
  masterGain ??= context.createGain();
  masterGain.connect(context.destination);
  masterGain.gain.value = settings.muted ? 0 : settings.volume;
  return { context, masterGain };
}

function tone(frequency: number, duration: number, type: OscillatorType, offset = 0) {
  try {
    const { context: audioContext, masterGain: gain } = getAudioGraph();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    const start = audioContext.currentTime + offset;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.001, start);
    envelope.gain.exponentialRampToValueAtTime(0.35, start + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  } catch {
    // Audio is an enhancement; unsupported or blocked audio must not affect play.
  }
}

export const audio = {
  get muted() {
    return settings.muted;
  },
  get volume() {
    return settings.volume;
  },
  toggleMuted() {
    settings.muted = !settings.muted;
    persistSettings();
    if (masterGain) masterGain.gain.value = settings.muted ? 0 : settings.volume;
    return settings.muted;
  },
  setVolume(volume: number) {
    settings.volume = Math.min(1, Math.max(0, volume));
    if (settings.volume > 0) settings.muted = false;
    persistSettings();
    if (masterGain) masterGain.gain.value = settings.muted ? 0 : settings.volume;
  },
  play(event: SoundEvent) {
    if (settings.muted) return;
    switch (event) {
      case 'roll':
        tone(150, 0.08, 'square');
        tone(230, 0.1, 'square', 0.09);
        tone(320, 0.16, 'triangle', 0.2);
        break;
      case 'buy':
        tone(330, 0.1, 'triangle');
        tone(520, 0.18, 'triangle', 0.1);
        break;
      case 'auction':
        tone(260, 0.1, 'sawtooth');
        tone(190, 0.22, 'sawtooth', 0.12);
        break;
      case 'trade':
        tone(440, 0.11, 'sine');
        tone(660, 0.16, 'sine', 0.12);
        break;
      case 'win':
        tone(392, 0.14, 'triangle');
        tone(523, 0.14, 'triangle', 0.14);
        tone(784, 0.25, 'triangle', 0.28);
        break;
      case 'click':
        tone(280, 0.05, 'sine');
        break;
    }
  }
};