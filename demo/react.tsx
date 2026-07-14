import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useHandwritingEngine } from '@handwriting/react';
import type { PresetName } from '@handwriting/core';
import '@handwriting/core/styles.css';
import './styles.css';
import { SAMPLE, LONG_SAMPLE } from './samples';

const PRESETS: PresetName[] = ['auto', 'fluid', 'realistic'];

function App() {
  const ref = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<PresetName>('auto');
  // `preset` flows in through the config prop; the hook hot-swaps it via setConfig.
  const engine = useHandwritingEngine(ref, { preset });
  const [sample, setSample] = useState<'short' | 'long'>('short');
  const [fontSize, setFontSize] = useState(24);

  // Stream the current sample into the engine (re-runs when the engine mounts or the sample changes).
  useEffect(() => {
    if (!engine) return;
    const chars = [...(sample === 'short' ? SAMPLE : LONG_SAMPLE)];
    const chunkMax = sample === 'short' ? 3 : 12;
    const interval = sample === 'short' ? 140 : 6;
    engine.clear();
    let i = 0;
    const id = window.setInterval(() => {
      if (i >= chars.length) {
        window.clearInterval(id);
        engine.done();
        return;
      }
      const n = 1 + Math.floor(Math.random() * chunkMax);
      engine.push(chars.slice(i, i + n).join(''));
      i += n;
    }, interval);
    return () => window.clearInterval(id);
  }, [engine, sample]);

  return (
    <>
      <div className="controls">
        <div className="group">
          <span className="label">节奏预设</span>
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`preset${preset === p ? ' active' : ''}`}
              onClick={() => setPreset(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="group">
          <button onClick={() => engine?.flush()}>⏭ 跳到结尾</button>
          <button onClick={() => engine?.clear()}>清空</button>
        </div>
        <div className="group">
          <span className="label">示例</span>
          <button
            className={sample === 'short' ? 'active' : ''}
            onClick={() => setSample('short')}
          >
            短文
          </button>
          <button
            className={sample === 'long' ? 'active' : ''}
            onClick={() => setSample('long')}
          >
            长文 10k
          </button>
        </div>
        <label className="slider">
          字号
          <input
            type="range"
            min={14}
            max={56}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
          <span>{fontSize}px</span>
        </label>
      </div>
      <div ref={ref} className="reader" style={{ fontSize: `${fontSize}px` }} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
