/**
 * Casino audio engine using Web Audio API — no external files needed.
 * All sounds are procedurally generated.
 */

let ctx: AudioContext | null = null;
let ambientNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let ambientMasterGain: GainNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ---------------------------------------------------------------------------
// Ambient background music — layered low-frequency drones
// ---------------------------------------------------------------------------
export function startAmbient(volume = 0.08) {
  if (ambientNodes.length > 0) return; // already running

  const ac = getCtx();
  ambientMasterGain = ac.createGain();
  ambientMasterGain.gain.setValueAtTime(volume, ac.currentTime);
  ambientMasterGain.connect(ac.destination);

  const layers: { freq: number; type: OscillatorType; vol: number }[] = [
    { freq: 55,  type: 'sine',     vol: 0.6 },
    { freq: 110, type: 'sine',     vol: 0.3 },
    { freq: 82,  type: 'triangle', vol: 0.2 },
    { freq: 165, type: 'sine',     vol: 0.15 },
  ];

  for (const layer of layers) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = layer.type;
    osc.frequency.setValueAtTime(layer.freq, ac.currentTime);
    gain.gain.setValueAtTime(layer.vol, ac.currentTime);
    osc.connect(gain);
    gain.connect(ambientMasterGain);
    osc.start();
    ambientNodes.push({ osc, gain });
  }

  // Slow LFO tremolo on master
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.setValueAtTime(0.15, ac.currentTime);
  lfoGain.gain.setValueAtTime(0.03, ac.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(ambientMasterGain.gain);
  lfo.start();
  ambientNodes.push({ osc: lfo, gain: lfoGain });
}

export function stopAmbient() {
  if (!ambientMasterGain) return;
  const ac = getCtx();
  ambientMasterGain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5);
  setTimeout(() => {
    ambientNodes.forEach(({ osc }) => { try { osc.stop(); } catch {} });
    ambientNodes = [];
    ambientMasterGain = null;
  }, 600);
}

export function setAmbientVolume(vol: number) {
  if (ambientMasterGain) {
    ambientMasterGain.gain.linearRampToValueAtTime(vol, getCtx().currentTime + 0.3);
  }
}

// ---------------------------------------------------------------------------
// Spin sound — rising noise burst
// ---------------------------------------------------------------------------
export function playSpinSound() {
  const ac = getCtx();
  const bufferSize = ac.sampleRate * 0.25;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ac.createBufferSource();
  source.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, ac.currentTime);
  filter.frequency.linearRampToValueAtTime(2400, ac.currentTime + 0.25);
  filter.Q.setValueAtTime(2, ac.currentTime);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.18, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.25);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  source.start();
}

// ---------------------------------------------------------------------------
// Reel stop click — short tick per reel
// ---------------------------------------------------------------------------
export function playReelStop(delayMs = 0) {
  const ac = getCtx();
  const delay = delayMs / 1000;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(220, ac.currentTime + delay);
  gain.gain.setValueAtTime(0.12, ac.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.06);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime + delay);
  osc.stop(ac.currentTime + delay + 0.07);
}

// ---------------------------------------------------------------------------
// Win jingle — ascending arpeggio
// ---------------------------------------------------------------------------
export function playWinSound(big = false) {
  const ac = getCtx();
  const notes = big
    ? [261, 329, 392, 523, 659, 784, 1046]
    : [261, 329, 392, 523];

  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t = ac.currentTime + i * 0.1;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.36);
  });
}

// ---------------------------------------------------------------------------
// Free spins fanfare
// ---------------------------------------------------------------------------
export function playFreeSpinsTrigger() {
  const ac = getCtx();
  const melody = [523, 659, 784, 1046, 784, 1046, 1318];
  melody.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t = ac.currentTime + i * 0.12;
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  });
}
