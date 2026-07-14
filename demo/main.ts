import { createHandwritingEngine } from '@handwriting/core';
import type { PresetName } from '@handwriting/core';
import '@handwriting/core/styles.css';
import './styles.css';
import { SAMPLE, LONG_SAMPLE } from './samples';

const reader = document.getElementById('reader') as HTMLElement;
const engine = createHandwritingEngine(reader);
let currentText = SAMPLE;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const speed = document.getElementById('speed') as HTMLInputElement;
const speedVal = $('speedVal');
const fontSize = document.getElementById('fontSize') as HTMLInputElement;
const fontSizeVal = $('fontSizeVal');
const pauseBtn = $('pause');

let timer: number | undefined;

function renderSpeed(): void {
  speedVal.textContent = `${speed.value}ms`;
}
function renderFontSize(): void {
  reader.style.fontSize = `${fontSize.value}px`;
  fontSizeVal.textContent = `${fontSize.value}px`;
}

function stop(): void {
  if (timer !== undefined) {
    window.clearInterval(timer);
    timer = undefined;
  }
}

function start(chunkSize = 3, intervalMs = Number(speed.value)): void {
  stop();
  engine.clear();
  const chars = [...currentText];
  let i = 0;
  timer = window.setInterval(() => {
    if (i >= chars.length) {
      stop();
      engine.done();
      return;
    }
    // Simulate token chunks (random 1..chunkSize graphemes).
    const n = 1 + Math.floor(Math.random() * chunkSize);
    engine.push(chars.slice(i, i + n).join(''));
    i += n;
  }, intervalMs);
}

// Preset buttons
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    engine.setConfig({ preset: btn.dataset.preset as PresetName });
    document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('active', b === btn));
  });
});

$('start').addEventListener('click', () => start());
$('pause').addEventListener('click', () => {
  if (engine.isPaused()) {
    engine.resume();
    pauseBtn.textContent = '⏸ 暂停';
  } else {
    engine.pause();
    pauseBtn.textContent = '▶ 继续';
  }
});
$('skip').addEventListener('click', () => {
  stop();
  engine.flush();
});
$('reset').addEventListener('click', () => {
  stop();
  engine.clear();
});

// Sample switcher: short streams char-by-char; long fills ~10k chars fast so
// you can scroll and watch virtualization recycle off-screen cells.
const sampleShort = $('sampleShort');
const sampleLong = $('sampleLong');
sampleShort.addEventListener('click', () => {
  currentText = SAMPLE;
  sampleShort.classList.add('active');
  sampleLong.classList.remove('active');
  start(3, Number(speed.value));
});
sampleLong.addEventListener('click', () => {
  currentText = LONG_SAMPLE;
  sampleShort.classList.remove('active');
  sampleLong.classList.add('active');
  start(12, 6);
});

speed.addEventListener('input', renderSpeed);
fontSize.addEventListener('input', renderFontSize);
renderSpeed();
renderFontSize();

// Live virtualization stats: total cells vs reclaimed hanzi-writer instances.
const stats = $('stats');
function updateStats(): void {
  const total = reader.querySelectorAll('.hw-cell').length;
  const released = reader.querySelectorAll('.hw-cell[data-recycled]').length;
  stats.textContent = `总节点 ${total} · writer 已释放 ${released}`;
}
window.setInterval(updateStats, 300);
window.addEventListener('scroll', updateStats, { passive: true });
engine.on('charrendered', updateStats);
updateStats();

engine.on('catchupchange', (e) => console.log('[hw] catch-up', e));
engine.on('error', (e) => console.error('[hw] error', e.phase, e.char ?? '', e.err?.message ?? e));
engine.on('charrendered', (e) => {
  if (e.cls === 'hanzi') {
    console.log('[hw] hanzi', JSON.stringify(e.char), e.duration > 0 ? 'animated' : 'INSTANT(no strokes)');
  }
});
engine.on('complete', () => console.log('[hw] complete'));

start();
