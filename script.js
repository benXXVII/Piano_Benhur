/* ═══════════════════════════════════════════════════════════
   GLASS PIANO — JavaScript
   ═══════════════════════════════════════════════════════════ */

/* ── Note map ─────────────────────────────────────────────
   Each keyboard letter → its note info.                        */
const NOTES = {
  a: { note: 'C',  solfege: 'Do',   freq: 261.63 },
  w: { note: 'C#', solfege: 'Do#',  freq: 277.18 },
  s: { note: 'D',  solfege: 'Re',   freq: 293.66 },
  e: { note: 'D#', solfege: 'Re#',  freq: 311.13 },
  d: { note: 'E',  solfege: 'Mi',   freq: 329.63 },
  f: { note: 'F',  solfege: 'Fa',   freq: 349.23 },
  t: { note: 'F#', solfege: 'Fa#',  freq: 369.99 },
  g: { note: 'G',  solfege: 'Sol',  freq: 392.00 },
  y: { note: 'G#', solfege: 'Sol#', freq: 415.30 },
  h: { note: 'A',  solfege: 'La',   freq: 440.00 },
  u: { note: 'A#', solfege: 'La#',  freq: 466.16 },
  j: { note: 'B',  solfege: 'Ti',   freq: 493.88 },
  k: { note: 'C',  solfege: 'Do',   freq: 523.25 },
};

/* ── Songs (bonus) ─────────────────────────────────────── */
const SONGS = {
  lamb: {
    title: 'Mary Had a Little Lamb', bpm: 112,
    seq: 'd s a s | d d d:2 | s s s:2 | d g g:2 | d s a s | d d d d | s s d s | a:2',
  },
  twinkle: {
    title: 'Twinkle Twinkle Little Star', bpm: 104,
    seq: 'a a g g h h g:2 | f f d d s s a:2 | g g f f d d s:2 | g g f f d d s:2 | a a g g h h g:2 | f f d d s s a:2',
  },
  ode: {
    title: 'Ode to Joy', bpm: 120,
    seq: 'd d f g | g f d s | a a s d | d s s:2 | d d f g | g f d s | a a s d | s a a:2',
  },
  frere: {
    title: 'Frère Jacques', bpm: 112,
    seq: 'a s d a | a s d a | d f g:2 | d f g:2 | g h g f d a:2 | g h g f d a:2 | a g a:2 | a g a:2',
  },
  jingle: {
    title: 'Jingle Bells', bpm: 124,
    seq: 'd d d:2 | d d d:2 | d g a s d:2 | f f f f f d d d:2 | d s s d s:2 | g:2',
  },
  london: {
    title: 'London Bridge', bpm: 116,
    seq: 'g h g f d f g:2 | s d f:2 | d f g:2 | g h g f d f g:2 | s:2 g:2 d:2 | a:2',
  },
  rowboat: {
    title: 'Row, Row, Row Your Boat', bpm: 108,
    seq: 'a a a s d:2 | d s d f g:2 | k k k g g g d d d a a a | g f d s a:2',
  },
};

/* ── Cached DOM refs ───────────────────────────────────── */
const nowValue   = document.getElementById('nowValue');
const nowChip    = document.getElementById('nowPlaying');
const waveform   = document.getElementById('waveform');
const emojiLayer = document.getElementById('emojiLayer');
const piano      = document.getElementById('piano');
const waveSelect = document.getElementById('waveSelect');
const volSlider  = document.getElementById('volSlider');
const songSelect = document.getElementById('songSelect');
const songSheet  = document.getElementById('songSheet');

/* ── Audio setup (Web Audio API) ───────────────────────── */
let audioCtx   = null;
let masterGain = null;
let waveformType = 'sine';

function initAudio() {
  if (audioCtx) return;
  audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = parseFloat(volSlider.value);
  masterGain.connect(audioCtx.destination);
}

// Keep each held keyboard/pointer source independent so chords work naturally.
const heldNotes = new Map();

/** Start a struck, naturally decaying piano-like tone. */
function startNote(freq) {
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const now = audioCtx.currentTime;
  const pianoPartials = [
    { ratio: 1, amplitude: 0.62, decay: 1 },
    { ratio: 2.01, amplitude: 0.25, decay: 0.72 },
    { ratio: 3.99, amplitude: 0.12, decay: 0.52 },
    { ratio: 6.02, amplitude: 0.06, decay: 0.38 },
    { ratio: 8.05, amplitude: 0.03, decay: 0.28 },
  ];
  // The piano preset uses harmonics; other wave choices use one oscillator
  // so each selected waveform plays the exact mapped note cleanly.
  const partials = waveformType === 'sine'
    ? pianoPartials
    : [{ ratio: 1, amplitude: 1, decay: 1 }];

  // Piano strings have a strong fundamental and quieter, quickly fading partials.
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 5200;
  filter.Q.value = 0.7;
  filter.connect(masterGain);

  const baseDecay = Math.max(1.8, 4.2 - Math.log2(freq / 261.63) * 0.85);
  const oscillators = [];
  const envelopes = [];

  partials.forEach((partial, index) => {
    const oscillator = audioCtx.createOscillator();
    const envelope = audioCtx.createGain();
    const decayTime = baseDecay * partial.decay;

    // Slightly inharmonic overtones and exponential decay mimic piano strings.
    oscillator.type = waveformType;
    oscillator.frequency.value = freq * partial.ratio;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(partial.amplitude * 0.32, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + decayTime);
    oscillator.connect(envelope).connect(filter);
    oscillator.start(now);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillators.push(oscillator);
    envelopes.push(envelope);
  });

  return { oscillators, envelopes, stopped: false };
}

/** Release a held note with a short fade to avoid an abrupt audio cut. */
function stopNote(voice) {
  if (!voice || voice.stopped) return;
  voice.stopped = true;
  const now = audioCtx.currentTime;
  voice.envelopes.forEach((envelope) => {
    envelope.gain.cancelAndHoldAtTime(now);
    envelope.gain.setTargetAtTime(0.0001, now, 0.025);
  });
  voice.oscillators.forEach((oscillator) => oscillator.stop(now + 0.18));
}

/* ── Visual helpers ────────────────────────────────────── */

/** Add the pressed look to a piano key element. */
function addActive(keyEl) {
  if (!keyEl) return;
  keyEl.classList.remove('active');
  // force reflow so the ripple re-triggers
  void keyEl.offsetWidth;
  keyEl.classList.add('active');
}

/** Remove the pressed look. */
function removeActive(keyEl) {
  if (keyEl) keyEl.classList.remove('active');
}

/** Update the "Now playing" chip. */
function showStatus(info) {
  nowValue.textContent = `${info.solfege} · ${info.note}`;
  nowChip.classList.remove('flash');
  void nowChip.offsetWidth;
  nowChip.classList.add('flash');
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => nowChip.classList.remove('flash'), 500);
}

/** Trigger the waveform bars. */
function pulseWaveform() {
  waveform.classList.remove('active');
  void waveform.offsetWidth;
  waveform.classList.add('active');
  clearTimeout(pulseWaveform._t);
  pulseWaveform._t = setTimeout(() => waveform.classList.remove('active'), 800);
}

/** Briefly speed up the background pulse. */
function pulseBackground() {
  document.body.classList.add('pulse');
  clearTimeout(pulseBackground._t);
  pulseBackground._t = setTimeout(
    () => document.body.classList.remove('pulse'),
    700
  );
}

/** Spawn a floating note above the pressed piano key. */
function spawnFloatingNote(keyEl) {
  if (!keyEl || !emojiLayer) return;
  const note = document.createElement('span');
  const rect = keyEl.getBoundingClientRect();
  note.className = 'float-note';
  note.textContent = '♪';
  note.style.left = `${rect.left + rect.width / 2}px`;
  note.style.top = `${rect.top}px`;
  emojiLayer.append(note);
  note.addEventListener('animationend', () => note.remove(), { once: true });
}

/** Update the visual feedback for a played note. */
function showNote(key) {
  const info = NOTES[key];
  if (!info) return;

  const keyEl = piano.querySelector(`[data-key="${key}"]`);
  addActive(keyEl);
  showStatus(info);
  pulseWaveform();
  pulseBackground();
  spawnFloatingNote(keyEl);

  return keyEl;
}

function keyIsHeld(key) {
  return [...heldNotes.values()].some((held) => held.key === key);
}

function releaseKeyVisual(key, delay = 120) {
  const keyEl = piano.querySelector(`[data-key="${key}"]`);
  if (!keyEl) return;
  clearTimeout(keyEl._activeTimeout);
  keyEl._activeTimeout = setTimeout(() => {
    if (!keyIsHeld(key)) removeActive(keyEl);
  }, delay);
}

/** Start a note once per physical key/pointer press and sustain until release. */
function pressNote(key, source) {
  const info = NOTES[key];
  if (!info || heldNotes.has(source)) return;
  heldNotes.set(source, { key, voice: startNote(info.freq) });
  showNote(key);
}

function releaseNote(source) {
  const held = heldNotes.get(source);
  if (!held) return;
  heldNotes.delete(source);
  stopNote(held.voice);
  if (!keyIsHeld(held.key)) releaseKeyVisual(held.key);
}

/** Play short notes for the built-in song sequences. */
function triggerNote(key, duration = 0.24) {
  const info = NOTES[key];
  if (!info) return;
  const voice = startNote(info.freq);
  showNote(key);
  setTimeout(() => {
    stopNote(voice);
    releaseKeyVisual(key);
  }, duration * 1000);
}

function isFormControl(target) {
  return target instanceof Element && target.closest('input, select, textarea, button');
}

// Play with the computer keyboard. Ignore held-key repeats and form controls.
document.addEventListener('keydown', (event) => {
  if (event.repeat || isFormControl(event.target)) return;
  const key = event.key.toLowerCase();
  if (!NOTES[key]) return;
  event.preventDefault();
  pressNote(key, `keyboard:${key}`);
});

document.addEventListener('keyup', (event) => {
  releaseNote(`keyboard:${event.key.toLowerCase()}`);
});

// Play with mouse or touch, sustaining the note until the pointer is released.
piano.addEventListener('pointerdown', (event) => {
  const keyEl = event.target.closest('.key[data-key]');
  if (!keyEl) return;
  event.preventDefault();
  pressNote(keyEl.dataset.key, `pointer:${event.pointerId}`);
});

document.addEventListener('pointerup', (event) => {
  releaseNote(`pointer:${event.pointerId}`);
});

document.addEventListener('pointercancel', (event) => {
  releaseNote(`pointer:${event.pointerId}`);
});

// Prevent stuck notes if the browser window loses focus mid-press.
window.addEventListener('blur', () => {
  [...heldNotes.keys()].forEach(releaseNote);
});

// Keep the master volume and waveform controls in sync with the audio engine.
volSlider.addEventListener('input', () => {
  if (masterGain) masterGain.gain.value = Number(volSlider.value);
});

waveSelect.addEventListener('change', () => {
  waveformType = waveSelect.value;
});

// Show the notes for a selected song and play its sequence at a steady tempo.
let songTimers = [];
function stopSong() {
  songTimers.forEach(clearTimeout);
  songTimers = [];
}

songSelect.addEventListener('change', () => {
  stopSong();
  const song = SONGS[songSelect.value];
  songSheet.replaceChildren();
  songSheet.hidden = !song;
  if (!song) return;

  const title = document.createElement('div');
  title.className = 'song-title';
  title.textContent = `${song.title} · ${song.bpm} BPM`;
  const sequenceSheet = document.createElement('div');
  sequenceSheet.className = 'song-sequence';
  songSheet.append(title, sequenceSheet);

  const sequence = song.seq.trim().split(/\s+/)
    .filter((token) => token !== '|')
    .map((token) => {
      if (token === '-') return { key: null, beats: 1 };
      const [key, beatCount = '1'] = token.split(':');
      return { key, beats: Number(beatCount) || 1 };
    });

  sequence.forEach((step, index) => {
    const note = document.createElement('span');
    note.className = step.key ? 'song-note' : 'song-note rest';
    note.dataset.index = String(index);
    if (step.key) {
      const pitch = document.createElement('span');
      pitch.className = 'song-pitch';
      pitch.textContent = NOTES[step.key]?.note ?? step.key;
      const keyHint = document.createElement('kbd');
      keyHint.className = 'song-key';
      keyHint.textContent = step.key.toUpperCase();
      note.append(pitch, keyHint);
      note.setAttribute('aria-label', `${NOTES[step.key]?.note}, computer key ${step.key.toUpperCase()}`);
    } else {
      note.textContent = '·';
      note.setAttribute('aria-label', 'rest');
    }
    sequenceSheet.append(note);
  });

  const beatMs = 60000 / song.bpm;
  let elapsedMs = 0;
  sequence.forEach((step, index) => {
    if (step.key) {
      songTimers.push(setTimeout(() => {
        songSheet.querySelectorAll('.hit').forEach((item) => item.classList.remove('hit'));
        sequenceSheet.children[index]?.classList.add('hit');
        triggerNote(step.key, (beatMs * step.beats * 0.9) / 1000);
      }, elapsedMs));
    }
    elapsedMs += beatMs * step.beats;
  });

  songTimers.push(setTimeout(() => {
    songSheet.querySelectorAll('.hit').forEach((item) => item.classList.remove('hit'));
  }, elapsedMs + 250));
});