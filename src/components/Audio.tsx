import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, RotateCcw } from 'lucide-react';

/** 静态/活动波形条 */
export function Wave({ bars, playing = false, live = false, color }: { bars: number[]; playing?: boolean; live?: boolean; color?: string }) {
  return (
    <div className="rl-wave">
      {bars.map((h, i) => (
        <i
          key={i}
          className={live ? 'live' : ''}
          style={{ height: `${Math.min(100, h * (playing ? 1.15 : 0.72))}%`, background: color }}
        />
      ))}
    </div>
  );
}

const seedBars = (n: number, salt: number) =>
  Array.from({ length: n }, (_, i) => 18 + Math.round(Math.abs(Math.sin(i * 1.37 + salt) * 42)) + ((i * (salt + 1)) % 9));

/** 录音器：模拟麦克风（计时 + 实时波形），停止后把时长与波形交给上层入库 */
export function Recorder({ disabled, disabledReason, onDone }: { disabled: boolean; disabledReason?: string; onDone: (sec: number, wave: number[]) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [salt] = useState(() => Math.floor(Math.random() * 99));
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const toggle = () => {
    if (disabled) return;
    if (recording) {
      window.clearInterval(timer.current);
      setRecording(false);
      const sec = Math.max(2, seconds);
      onDone(sec, seedBars(44, salt + sec));
      setSeconds(0);
      return;
    }
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  return (
    <div className={`rl-recorder ${disabled ? 'is-disabled' : ''}`} title={disabled ? disabledReason : undefined}>
      <div className="rl-recorder-wave">
        <Wave
          bars={seedBars(44, salt + seconds)}
          live={recording}
          playing={recording}
        />
      </div>
      <div className="rl-recorder-actions">
        <span className="rl-timer">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </span>
        <button className={recording ? 'rl-mic recording' : 'rl-mic'} onClick={toggle} disabled={disabled}>
          {recording ? <Pause size={15} /> : <Mic size={15} />}
          {recording ? '结束录音并保存' : '开始录音'}
        </button>
        {recording && (
          <button className="rl-mini" onClick={() => { window.clearInterval(timer.current); setRecording(false); setSeconds(0); }}>
            <RotateCcw size={13} /> 放弃
          </button>
        )}
        {!recording && disabledReason && <span className="rl-hint">{disabledReason}</span>}
      </div>
    </div>
  );
}

/** 播放器：模拟回放动画 */
export function Player({ bars, durationSec, compact }: { bars: number[]; durationSec: number; compact?: boolean }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setPlaying(false), Math.min(6000, durationSec * 700));
    return () => window.clearTimeout(t);
  }, [playing, durationSec]);
  return (
    <div className={`rl-player ${compact ? 'compact' : ''}`}>
      <button className="rl-round" onClick={() => setPlaying((p) => !p)}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <Wave bars={bars} playing={playing} />
      <span>0:{String(durationSec).padStart(2, '0')}</span>
    </div>
  );
}
