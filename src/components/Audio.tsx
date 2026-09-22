import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Trash2 } from 'lucide-react';
import type { RecordingVersion } from '../data/types';
import { fmtDuration } from '../rules/common';

/** 伪波形（纯前端模拟：不调用麦克风，柱高随机跳动） */
export function Waveform({ wave, live = false, playing = false, className = '' }: { wave: number[]; live?: boolean; playing?: boolean; className?: string }) {
  return (
    <div className={`wave ${className}`}>
      {wave.map((h, i) => (
        <i key={i} className={live ? 'live' : playing ? 'playing' : ''} style={{ height: `${Math.max(8, h * (playing ? 1.12 : 0.72))}%` }} />
      ))}
    </div>
  );
}

/** 模拟录音器：开始 → 计时、波形跳动 → 结束产出时长 */
export function Recorder({ onSave, disabled, disabledHint }: { onSave: (durationSec: number) => void; disabled?: boolean; disabledHint?: string }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [wave, setWave] = useState<number[]>(() => Array(40).fill(20));
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const toggle = () => {
    if (disabled) return;
    if (recording) {
      window.clearInterval(timer.current);
      setRecording(false);
      onSave(Math.max(1, seconds));
      setSeconds(0);
      setWave(Array(40).fill(20));
    } else {
      setSeconds(0);
      setRecording(true);
      timer.current = window.setInterval(() => {
        setSeconds(s => s + 1);
        setWave(w => w.map(() => 20 + Math.round(Math.random() * 66)));
      }, 400);
    }
  };

  return (
    <div className={`recorder ${disabled ? 'is-disabled' : ''}`} title={disabled ? disabledHint : undefined}>
      <div className="recorder-top">
        <span className="label">{recording ? '录音中…' : '模拟录音（不调用麦克风）'}</span>
        <span className="record-time">{fmtDuration(recording ? seconds : 0)}</span>
      </div>
      <Waveform wave={wave} live={recording} className="recorder-wave" />
      <div className="record-actions">
        <button className={recording ? 'record-button recording' : 'record-button'} onClick={toggle} disabled={disabled}>
          {recording ? <Pause size={15} /> : <Mic size={15} />}
          {recording ? '结束并保存' : '开始录音'}
        </button>
        {disabled && disabledHint && <span className="hint-text">{disabledHint}</span>}
      </div>
    </div>
  );
}

/** 版本回放卡（模拟播放：按钮切换状态，不发声） */
export function VersionPlayer({ version, compact }: { version: RecordingVersion; compact?: boolean }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const h = window.setTimeout(() => setPlaying(false), version.durationSec * 600);
    return () => window.clearTimeout(h);
  }, [playing, version.durationSec]);

  return (
    <div className={`version-player ${compact ? 'compact' : ''}`}>
      <button className="round-btn" onClick={() => setPlaying(p => !p)}>
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <Waveform wave={version.wave} playing={playing} />
      <span className="player-time">{fmtDuration(version.durationSec)}</span>
    </div>
  );
}

export function TrashButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button className="icon-btn" onClick={onClick} title={title}>
      <Trash2 size={15} />
    </button>
  );
}
