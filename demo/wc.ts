import '@handwriting/wc/auto';
import '@handwriting/core/styles.css';
import './styles.css';
import type { HandwritingStreamElement } from '@handwriting/wc';
import type { PresetName } from '@handwriting/core';
import { SAMPLE, LONG_SAMPLE } from './samples';

// `import '@handwriting/wc/auto'` registered & upgraded <handwriting-stream> above,
// so connectedCallback has already created the engine.
const reader = document.getElementById('reader') as unknown as HandwritingStreamElement;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fontSize = document.getElementById('fontSize') as HTMLInputElement;
const fontSizeVal = $('fontSizeVal');
const stats = $('stats');

let currentText: string = SAMPLE;
let timer: number | undefined;

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

function start(chunkSize = 3, intervalMs = 140): void {
  stop();
  reader.clear();
  const chars = [...currentText];
  let i = 0;
  timer = window.setInterval(() => {
    if (i >= chars.length) {
      stop();
      reader.done();
      return;
    }
    const n = 1 + Math.floor(Math.random() * chunkSize);
    reader.push(chars.slice(i, i + n).join(''));
    i += n;
  }, intervalMs);
}

// Preset buttons → reflected `preset` attribute → engine.setConfig({ preset }).
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    reader.setAttribute('preset', btn.dataset.preset as PresetName);
    document
      .querySelectorAll('[data-preset]')
      .forEach((b) => b.classList.toggle('active', b === btn));
  });
});

$('start').addEventListener('click', () => start());
$('skip').addEventListener('click', () => {
  stop();
  reader.flush();
});
$('reset').addEventListener('click', () => {
  stop();
  reader.clear();
});

const sampleShort = $('sampleShort');
const sampleLong = $('sampleLong');
sampleShort.addEventListener('click', () => {
  currentText = SAMPLE;
  sampleShort.classList.add('active');
  sampleLong.classList.remove('active');
  start(3, 140);
});
sampleLong.addEventListener('click', () => {
  currentText = LONG_SAMPLE;
  sampleShort.classList.remove('active');
  sampleLong.classList.add('active');
  start(12, 6);
});

fontSize.addEventListener('input', renderFontSize);
renderFontSize();

function updateStats(): void {
  const total = reader.querySelectorAll('.hw-cell').length;
  const released = reader.querySelectorAll('.hw-cell[data-recycled]').length;
  stats.textContent = `总节点 ${total} · writer 已释放 ${released}`;
}
window.setInterval(updateStats, 300);
window.addEventListener('scroll', updateStats, { passive: true });
reader.addEventListener('hw-charrendered', updateStats as EventListener);
updateStats();

reader.addEventListener('hw-error', (e) =>
  console.error('[hw] error', (e as CustomEvent).detail),
);
reader.addEventListener('hw-complete', () => console.log('[hw] complete'));

start();
