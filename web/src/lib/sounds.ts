// VHS Camcorder Sound Effects using Web Audio API
// Synthesized sounds that evoke 90s camcorder UX

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

// Play a synthesized beep/click sound
function playTone(frequency: number, duration: number, type: OscillatorType = 'square', volume: number = 0.1) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    // Quick fade in/out to avoid clicks
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not supported or blocked, fail silently
  }
}

// Play noise burst (for tape/mechanical sounds)
function playNoise(duration: number, volume: number = 0.05) {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // Fade out
    }
    
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    
    source.start();
  } catch (e) {
    // Audio not supported, fail silently
  }
}

// VHS Click - short digital beep (button press)
export function playClick() {
  playTone(1200, 0.05, 'square', 0.08);
}

// VHS Select - confirmation beep (selecting a clip)
export function playSelect() {
  playTone(880, 0.08, 'square', 0.1);
  setTimeout(() => playTone(1100, 0.08, 'square', 0.1), 50);
}

// VHS Play - tape mechanism starting
export function playStart() {
  playNoise(0.15, 0.08);
  setTimeout(() => playTone(440, 0.1, 'sine', 0.06), 50);
  setTimeout(() => playTone(550, 0.15, 'sine', 0.04), 100);
}

// VHS Navigate - tape advance click
export function playNavigate() {
  playTone(600, 0.03, 'square', 0.12);
  playNoise(0.08, 0.06);
}

// VHS Stop/Eject - mechanical stop
export function playStop() {
  playNoise(0.2, 0.1);
  setTimeout(() => playTone(300, 0.15, 'sine', 0.08), 100);
}

// VHS Hover - subtle tick
export function playHover() {
  playTone(2000, 0.02, 'sine', 0.03);
}

// VHS Error - low buzz
export function playError() {
  playTone(150, 0.2, 'sawtooth', 0.1);
}

// Initialize audio context on first user interaction
export function initAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch (e) {
    // Audio not supported
  }
}
