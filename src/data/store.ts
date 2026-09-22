import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LabState } from '../data/types';
import { RuleError } from '../data/types';
import { seedState } from '../data/seed';
import { record, withdrawActive } from '../rules/submissions';
import { claimReview, discardDraft, submitReview, type ReviewResult } from '../rules/reviews';
import { addPair, removePair } from '../rules/pairs';
import { createAssignment, type NewAssignment } from '../rules/assignments';
import { listBlockers } from '../rules/blockers';

const KEY = 'reading-lab-state-v1';
const CLOCK_KEY = 'reading-lab-clock-v1';

function load(): LabState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as LabState;
  } catch { /* 落到种子数据 */ }
  return structuredClone(seedState);
}

/**
 * 数据中心：作业数据、提交、配对、版本与评审全部持久化在 localStorage；
 * 刷新页面后状态一致。所有写入都经过 rules/* 中的纯函数校验。
 */
export function useLabStore() {
  const [state, setState] = useState<LabState>(load);
  // 可调时钟（演示“截止时刻”），默认当前真实时间；同样持久化
  const [now, setNow] = useState<number>(() => {
    const saved = Number(localStorage.getItem(CLOCK_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : Date.now();
  });
  const nowRef = useRef(now);
  nowRef.current = now;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { localStorage.setItem(CLOCK_KEY, String(now)); }, [now]);

  // 每秒走时：倒计时与“已截止”实时变化
  useEffect(() => {
    const h = window.setInterval(() => setNow(n => n + 1000), 1000);
    return () => window.clearInterval(h);
  }, []);

  const run = useCallback(<T,>(fn: () => T): T | undefined => {
    try {
      setError(null);
      return fn();
    } catch (e) {
      setError(e instanceof RuleError ? e.message : '操作失败');
      return undefined;
    }
  }, []);

  const api = useMemo(() => ({
    setNow,
    resetDemo: () => { localStorage.removeItem(KEY); setState(structuredClone(seedState)); setError(null); },
    record: (assignmentId: string, sentenceId: string, studentId: string, durationSec: number) =>
      run(() => setState(s => record(s, { assignmentId, sentenceId, studentId, durationSec }, nowRef.current))),
    withdraw: (assignmentId: string, sentenceId: string, studentId: string) =>
      run(() => setState(s => withdrawActive(s, { assignmentId, sentenceId, studentId, durationSec: 0 }, nowRef.current))),
    claim: (versionId: string, reviewerId: string) =>
      run(() => setState(s => claimReview(s, versionId, reviewerId, nowRef.current))),
    discard: (reviewId: string, reviewerId: string) =>
      run(() => setState(s => discardDraft(s, reviewId, reviewerId))),
    submitReview: (reviewId: string, reviewerId: string, result: ReviewResult) =>
      run(() => setState(s => submitReview(s, reviewId, reviewerId, result, nowRef.current))),
    addPair: (a: string, b: string) => run(() => setState(s => addPair(s, a, b))),
    removePair: (pairId: string) => run(() => setState(s => removePair(s, pairId))),
    createAssignment: (input: NewAssignment) => run(() => setState(s => createAssignment(s, input, nowRef.current))),
  }), [run]);

  const blockers = useMemo(() => listBlockers(state, now), [state, now]);

  return { state, now, error, setError, blockers, ...api };
}

export type LabStore = ReturnType<typeof useLabStore>;
